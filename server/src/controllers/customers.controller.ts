import type { Request, Response } from 'express'
import { Customer, type CustomerDoc } from '../models/Customer.js'
import { User } from '../models/User.js'
import { Vehicle } from '../models/Vehicle.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Invoice } from '../models/Invoice.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { blankToUndefined, escapeRegex, pageMeta, parseSort } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { notifyRoles } from '../services/notify.js'
import { deliverEmail } from '../services/email.js'
import { sendLoginMail, temporaryPassword } from '../services/credentials.js'
import { emitOperational } from '../sockets/io.js'
import { Events } from '../constants.js'

function listFilter(query: { search?: string; city?: string; active?: string }) {
  const filter: Record<string, unknown> = {}
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { city: pattern }]
  }
  if (query.city) filter.city = new RegExp(escapeRegex(query.city), 'i')
  if (query.active === 'true') filter.isActive = true
  if (query.active === 'false') filter.isActive = false
  return filter
}

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; city?: string; active?: string }
  const page = query.page
  const limit = query.limit
  const filter = listFilter(query)
  const sort = parseSort(query.sort, ['name', 'phone', 'city', 'createdAt', 'vehicleCount'])
  const [items, total] = await Promise.all([
    Customer.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Customer.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Customers', 200, pageMeta(page, limit, total))
})

async function ensurePortalLogin(customer: CustomerDoc) {
  if (!customer.email) return { created: false, mailed: null as { sent: boolean; message: string } | null }
  const linked = await User.findOne({ customer: customer._id })
  if (linked) {
    linked.name = customer.name
    linked.phone = customer.phone
    if (linked.email !== customer.email) {
      const clash = await User.findOne({ email: customer.email })
      if (clash) throw new ApiError(409, 'An account with this email already exists')
      linked.email = customer.email
    }
    await linked.save()
    return { created: false, mailed: null }
  }
  if (await User.findOne({ email: customer.email })) throw new ApiError(409, 'An account with this email already exists')
  const password = temporaryPassword()
  const user = await User.create({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    password,
    role: 'CUSTOMER',
    customer: customer._id,
    isActive: customer.isActive,
  })
  const mailed = await sendLoginMail({
    to: user.email,
    name: user.name,
    password,
    account: 'Customer portal',
    relatedId: user._id.toString(),
  })
  return { created: true, mailed }
}

function customerMessage(action: 'created' | 'updated', login: { created: boolean; mailed: { sent: boolean; message: string } | null }, hasEmail: boolean) {
  if (!hasEmail) return `Customer ${action}. Add an email address to send a portal login.`
  if (!login.created) return `Customer ${action}`
  if (login.mailed?.sent) return `Customer ${action}. Portal user ID and password were emailed.`
  return `Customer ${action}, but the login email was not sent. ${login.mailed?.message || ''}`.trim()
}

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const email = blankToUndefined(req.body.email)?.toLowerCase()
  if (email && (await User.findOne({ email }))) throw new ApiError(409, 'An account with this email already exists')
  const customer = await Customer.create({
    ...req.body,
    email: blankToUndefined(req.body.email),
    alternatePhone: blankToUndefined(req.body.alternatePhone),
    createdBy: req.user!.id,
    createdByName: req.user!.name,
  })
  await writeAudit(req, 'CREATE', 'Customer', `Created customer ${customer.name}`, customer._id.toString())
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'New customer',
    message: `${customer.name} was added by ${req.user!.name}.`,
    type: 'customer',
    link: `/customers/${customer._id}`,
    entityType: 'Customer',
    entityId: customer._id,
  }, req.user!.id)
  emitOperational(Events.customerCreated, { id: customer._id, name: customer.name })
  const login = await ensurePortalLogin(customer)
  sendSuccess(res, customer, customerMessage('created', login, Boolean(customer.email)), 201)
})

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id).lean()
  if (!customer) throw new ApiError(404, 'Customer not found')
  const [vehicles, requests] = await Promise.all([
    Vehicle.find({ customer: customer._id }).sort('-createdAt').lean(),
    ServiceRequest.find({ customer: customer._id }).sort('-createdAt').limit(20).select('requestNumber status priority vehicleLabel createdAt actualCost').lean(),
  ])
  sendSuccess(res, { ...customer, vehicles, requests })
})

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id)
  if (!customer) throw new ApiError(404, 'Customer not found')
  Object.assign(customer, {
    ...req.body,
    email: blankToUndefined(req.body.email),
    alternatePhone: blankToUndefined(req.body.alternatePhone),
  })
  await customer.save()
  await Vehicle.updateMany({ customer: customer._id }, { customerName: customer.name })
  await ServiceRequest.updateMany({ customer: customer._id }, { customerName: customer.name })
  await Invoice.updateMany({ customer: customer._id }, { customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone })
  const login = await ensurePortalLogin(customer)
  await writeAudit(req, 'UPDATE', 'Customer', `Updated customer ${customer.name}`, customer._id.toString())
  emitOperational(Events.customerUpdated, { id: customer._id, name: customer.name })
  sendSuccess(res, customer, customerMessage('updated', login, Boolean(customer.email)))
})

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id)
  if (!customer) throw new ApiError(404, 'Customer not found')
  const vehicles = await Vehicle.countDocuments({ customer: customer._id })
  if (vehicles > 0) throw new ApiError(409, 'Remove or reassign this customer’s vehicles before deleting the profile')
  await customer.deleteOne()
  await writeAudit(req, 'DELETE', 'Customer', `Deleted customer ${customer.name}`, customer._id.toString())
  sendSuccess(res, null, 'Customer deleted')
})

export const emailCustomer = asyncHandler(async (req: Request, res: Response) => {
  const customer = await Customer.findById(req.params.id)
  if (!customer) throw new ApiError(404, 'Customer not found')
  if (!customer.email) throw new ApiError(400, 'This customer does not have an email address')
  const result = await deliverEmail({
    to: customer.email,
    subject: req.body.subject,
    title: req.body.subject,
    intro: req.body.message,
    rows: [{ label: 'Customer', value: customer.name }],
    template: 'customer-message',
    force: true,
    relatedModel: 'Customer',
    relatedId: customer._id.toString(),
  })
  await writeAudit(req, 'EMAIL', 'Customer', `Emailed ${customer.name}: ${req.body.subject}`, customer._id.toString())
  if (!result.sent) throw new ApiError(502, result.message)
  sendSuccess(res, result, 'Email sent')
})
