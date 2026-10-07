import { Schema, model, type Types } from 'mongoose'
import { INVOICE_STATUSES, PAYMENT_METHODS, type InvoiceStatus } from '../constants.js'

const itemSchema = new Schema(
  {
    kind: { type: String, enum: ['service', 'part'], required: true },
    name: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
)

export interface InvoiceDoc {
  _id: Types.ObjectId
  invoiceNumber: string
  serviceRequest?: Types.ObjectId
  requestNumber?: string
  customer: Types.ObjectId
  customerName: string
  customerEmail?: string
  customerPhone?: string
  vehicleLabel?: string
  items: {
    kind: 'service' | 'part'
    name: string
    sku?: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  amountPaid: number
  balance: number
  status: InvoiceStatus
  dueDate: Date
  issuedAt: Date
  notes?: string
  createdBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const invoiceSchema = new Schema<InvoiceDoc>(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    serviceRequest: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', index: true },
    requestNumber: { type: String, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String },
    customerPhone: { type: String },
    vehicleLabel: { type: String },
    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: 'issued', index: true },
    dueDate: { type: Date, required: true, index: true },
    issuedAt: { type: Date, required: true, index: true },
    notes: { type: String, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

invoiceSchema.index({ createdAt: -1 })
invoiceSchema.index({ status: 1, dueDate: 1 })

export const Invoice = model<InvoiceDoc>('Invoice', invoiceSchema)

export interface PaymentDoc {
  _id: Types.ObjectId
  invoice: Types.ObjectId
  invoiceNumber: string
  customer: Types.ObjectId
  amount: number
  method: (typeof PAYMENT_METHODS)[number]
  status: 'completed' | 'failed'
  reference?: string
  paidAt: Date
  receivedBy?: Types.ObjectId
  receivedByName?: string
  createdAt: Date
  updatedAt: Date
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    invoiceNumber: { type: String, required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: ['completed', 'failed'], default: 'completed', index: true },
    reference: { type: String, trim: true },
    paidAt: { type: Date, required: true, index: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receivedByName: { type: String },
  },
  { timestamps: true },
)

export const Payment = model<PaymentDoc>('Payment', paymentSchema)
