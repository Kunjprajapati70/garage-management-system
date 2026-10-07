import { Schema, model, type Types } from 'mongoose'

export interface CustomerDoc {
  _id: Types.ObjectId
  name: string
  email?: string
  phone: string
  alternatePhone?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  notes?: string
  vehicleCount: number
  isActive: boolean
  createdBy?: Types.ObjectId
  createdByName?: string
  createdAt: Date
  updatedAt: Date
}

const customerSchema = new Schema<CustomerDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140, index: true },
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true },
    phone: { type: String, required: true, trim: true, unique: true, index: true },
    alternatePhone: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 300 },
    city: { type: String, trim: true, index: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    notes: { type: String, maxlength: 2000 },
    vehicleCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
  },
  { timestamps: true },
)

customerSchema.index({ createdAt: -1 })
customerSchema.index({ name: 'text', phone: 'text', email: 'text' })

export const Customer = model<CustomerDoc>('Customer', customerSchema)
