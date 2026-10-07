import { Schema, model, type Types } from 'mongoose'
import { MECHANIC_STATUSES } from '../constants.js'

export interface MechanicDoc {
  _id: Types.ObjectId
  user: Types.ObjectId
  name: string
  email: string
  phone?: string
  employeeId: string
  specialization: string
  experienceYears: number
  hourlyRate: number
  status: (typeof MECHANIC_STATUSES)[number]
  activeJobs: number
  createdAt: Date
  updatedAt: Date
}

const mechanicSchema = new Schema<MechanicDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    specialization: { type: String, required: true, trim: true, index: true },
    experienceYears: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, default: 400, min: 0 },
    status: { type: String, enum: MECHANIC_STATUSES, default: 'available', index: true },
    activeJobs: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
)

export const Mechanic = model<MechanicDoc>('Mechanic', mechanicSchema)
