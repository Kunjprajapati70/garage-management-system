import { Schema, model, type Types } from 'mongoose'

export interface PartDoc {
  _id: Types.ObjectId
  sku: string
  name: string
  description?: string
  category: string
  quantity: number
  minStock: number
  unitPrice: number
  supplier?: string
  location?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const partSchema = new Schema<PartDoc>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String, maxlength: 1000 },
    category: { type: String, required: true, trim: true, index: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    minStock: { type: Number, required: true, min: 0, default: 5 },
    unitPrice: { type: Number, required: true, min: 0 },
    supplier: { type: String, trim: true },
    location: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

partSchema.index({ quantity: 1, minStock: 1 })

export const Part = model<PartDoc>('Part', partSchema)
