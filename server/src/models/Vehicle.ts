import { Schema, model, type Types } from 'mongoose'

export interface VehicleDoc {
  _id: Types.ObjectId
  customer: Types.ObjectId
  customerName: string
  make: string
  model: string
  year: number
  color?: string
  licensePlate: string
  vin?: string
  mileage: number
  fuelType: 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid'
  transmission: 'Manual' | 'Automatic'
  notes?: string
  lastServiceAt?: Date
  createdAt: Date
  updatedAt: Date
}

const vehicleSchema = new Schema<VehicleDoc>(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true, index: true },
    make: { type: String, required: true, trim: true, index: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true, min: 1980, max: 2100 },
    color: { type: String, trim: true },
    licensePlate: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    vin: { type: String, uppercase: true, trim: true, unique: true, sparse: true, index: true },
    mileage: { type: Number, default: 0, min: 0 },
    fuelType: { type: String, enum: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'], required: true },
    transmission: { type: String, enum: ['Manual', 'Automatic'], required: true },
    notes: { type: String, maxlength: 2000 },
    lastServiceAt: { type: Date },
  },
  { timestamps: true },
)

vehicleSchema.index({ createdAt: -1 })
vehicleSchema.index({ make: 1, model: 1 })

export const Vehicle = model<VehicleDoc>('Vehicle', vehicleSchema)
