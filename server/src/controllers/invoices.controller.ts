import type { Request, Response } from 'express'
import { Invoice, Payment } from '../models/Invoice.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Customer } from '../models/Customer.js'
import { ensureSettings, nextSequence } from '../models/Setting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { escapeRegex, pageMeta, parseSort, roundMoney } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { notifyRoles } from '../services/notify.js'
import { deliverEmail } from '../services/email.js'
import { emitOperational } from '../sockets/io.js'
import { Events } from '../constants.js'

async function refreshOverdue() {
  await Invoice.updateMany(
    { status: { $in: ['issued', 'partial'] }, dueDate: { $lt: new Date() }, balance: { $gt: 0 } },
    { $set: { status: 'overdue' } },
  )
}

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  await refreshOverdue()
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; status?: string; customer?: string }
  const filter: Record<string, unknown> = {}
  if (query.status === 'outstanding') filter.status = { $in: ['issued', 'partial', 'overdue'] }
  else if (query.status && query.status !== 'all') filter.status = query.status
  if (query.customer) filter.customer = query.customer
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ invoiceNumber: pattern }, { customerName: pattern }, { requestNumber: pattern }, { vehicleLabel: pattern }]
  }
  const sort = parseSort(query.sort, ['invoiceNumber', 'customerName', 'total', 'balance', 'status', 'issuedAt', 'dueDate'])
  const page = query.page
  const limit = query.limit
  const [items, total] = await Promise.all([
    Invoice.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Invoice.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Invoices', 200, pageMeta(page, limit, total))
})

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const requestDoc = await ServiceRequest.findById(req.body.serviceRequestId)
  if (!requestDoc) throw new ApiError(404, 'Service request not found')
  if (requestDoc.status === 'cancelled') throw new ApiError(400, 'Cancelled requests cannot be invoiced')
  const existing = await Invoice.findOne({ serviceRequest: requestDoc._id, status: { $ne: 'cancelled' } })
  if (existing) throw new ApiError(409, `Invoice ${existing.invoiceNumber} already exists for this request`)
  const lines = [
    ...requestDoc.services.map((line) => ({
      kind: 'service' as const,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: roundMoney(line.quantity * line.unitPrice),
    })),
    ...requestDoc.parts.map((line) => ({
      kind: 'part' as const,
      name: line.name,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: roundMoney(line.quantity * line.unitPrice),
    })),
  ]
  if (!lines.length) throw new ApiError(400, 'Add at least one service or part before generating an invoice')
  const settings = await ensureSettings()
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const discount = roundMoney(Math.min(req.body.discount || 0, subtotal))
  const taxable = roundMoney(subtotal - discount)
  const taxRate = settings?.taxPercent ?? 18
  const taxAmount = roundMoney((taxable * taxRate) / 100)
  const total = roundMoney(taxable + taxAmount)
  const customer = await Customer.findById(requestDoc.customer)
  const year = new Date().getFullYear()
  const seq = await nextSequence(`invoice-${year}`)
  const due = new Date()
  due.setDate(due.getDate() + (req.body.dueInDays ?? 7))
  const invoice = await Invoice.create({
    invoiceNumber: `INV-${year}-${String(seq).padStart(5, '0')}`,
    serviceRequest: requestDoc._id,
    requestNumber: requestDoc.requestNumber,
    customer: requestDoc.customer,
    customerName: requestDoc.customerName,
    customerEmail: customer?.email,
    customerPhone: customer?.phone,
    vehicleLabel: requestDoc.vehicleLabel,
    items: lines,
    subtotal,
    taxRate,
    taxAmount,
    discount,
    total,
    amountPaid: 0,
    balance: total,
    status: 'issued',
    dueDate: due,
    issuedAt: new Date(),
    notes: req.body.notes,
    createdBy: req.user!.id,
  })
  await writeAudit(req, 'CREATE', 'Invoice', `Issued ${invoice.invoiceNumber} for ${invoice.total}`, invoice._id.toString())
  await notifyRoles(['ADMIN', 'MANAGER', 'RECEPTIONIST'], {
    title: 'Invoice generated',
    message: `${invoice.invoiceNumber} for ${invoice.customerName} · ₹${invoice.total.toLocaleString('en-IN')}.`,
    type: 'invoice',
    link: `/invoices/${invoice._id}`,
    entityId: invoice._id,
  }, req.user!.id)
  emitOperational(Events.invoiceCreated, { id: invoice._id, invoiceNumber: invoice.invoiceNumber, total: invoice.total })
  emitOperational(Events.billingUpdated, { invoiceId: invoice._id })
  sendSuccess(res, invoice, 'Invoice generated', 201)
})

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  await refreshOverdue()
  const invoice = await Invoice.findById(req.params.id).lean()
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  const payments = await Payment.find({ invoice: invoice._id }).sort('-paidAt').lean()
  const settings = await ensureSettings()
  sendSuccess(res, { ...invoice, payments, garage: settings })
})

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  if (invoice.status === 'cancelled' || invoice.status === 'paid') throw new ApiError(400, 'This invoice cannot accept a payment')
  const amount = roundMoney(req.body.amount)
  if (amount > invoice.balance + 0.001) {
    throw new ApiError(400, `Amount exceeds the balance of ₹${invoice.balance}`, [{ field: 'amount', message: 'Amount is higher than the balance' }])
  }
  const payment = await Payment.create({
    invoice: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    customer: invoice.customer,
    amount,
    method: req.body.method,
    reference: req.body.reference,
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
    receivedBy: req.user!.id,
    receivedByName: req.user!.name,
  })
  invoice.amountPaid = roundMoney(invoice.amountPaid + amount)
  invoice.balance = roundMoney(Math.max(0, invoice.total - invoice.amountPaid))
  invoice.status = invoice.balance <= 0 ? 'paid' : invoice.dueDate < new Date() ? 'overdue' : 'partial'
  await invoice.save()
  await writeAudit(req, 'PAYMENT', 'Invoice', `Recorded ₹${amount} against ${invoice.invoiceNumber}`, invoice._id.toString())
  emitOperational(Events.billingUpdated, { invoiceId: invoice._id, balance: invoice.balance, status: invoice.status })
  sendSuccess(res, { invoice, payment }, 'Payment recorded', 201)
})

export const emailInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  if (!invoice.customerEmail) throw new ApiError(400, 'This customer does not have an email address')
  const result = await deliverEmail({
    to: invoice.customerEmail,
    subject: `Invoice ${invoice.invoiceNumber}`,
    title: `Invoice ${invoice.invoiceNumber}`,
    intro: `Hello ${invoice.customerName}, your workshop invoice is ready. The balance due is ₹${invoice.balance.toLocaleString('en-IN')}.`,
    rows: [
      { label: 'Invoice', value: invoice.invoiceNumber },
      { label: 'Vehicle', value: invoice.vehicleLabel || '—' },
      { label: 'Total', value: `₹${invoice.total.toLocaleString('en-IN')}` },
      { label: 'Balance', value: `₹${invoice.balance.toLocaleString('en-IN')}` },
      { label: 'Due', value: invoice.dueDate.toDateString() },
    ],
    template: 'invoice',
    flag: 'invoice',
    force: true,
    relatedModel: 'Invoice',
    relatedId: invoice._id.toString(),
  })
  await writeAudit(req, 'EMAIL', 'Invoice', `Emailed ${invoice.invoiceNumber}`, invoice._id.toString())
  if (!result.sent) throw new ApiError(502, result.message)
  if (invoice.status === 'draft') {
    invoice.status = 'issued'
    await invoice.save()
  }
  sendSuccess(res, result, 'Invoice emailed')
})

export const cancelInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  if (invoice.amountPaid > 0) throw new ApiError(400, 'Refund recorded payments before cancelling this invoice')
  invoice.status = 'cancelled'
  invoice.balance = 0
  await invoice.save()
  await writeAudit(req, 'UPDATE', 'Invoice', `Cancelled ${invoice.invoiceNumber}`, invoice._id.toString())
  emitOperational(Events.billingUpdated, { invoiceId: invoice._id, status: 'cancelled' })
  sendSuccess(res, invoice, 'Invoice cancelled')
})
