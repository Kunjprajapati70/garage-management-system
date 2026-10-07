import { Schema, model, type Types } from 'mongoose'

export interface ServiceDoc {
  _id: Types.ObjectId
  name: string
  description?: string
  category: string
  basePrice: number
  estimatedHours: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const serviceSchema = new Schema<ServiceDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true, index: true },
    description: { type: String, maxlength: 1000 },
    category: { type: String, required: true, trim: true, index: true },
    basePrice: { type: Number, required: true, min: 0 },
    estimatedHours: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

export const Service = model<ServiceDoc>('Service', serviceSchema)
