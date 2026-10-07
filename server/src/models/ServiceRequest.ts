import { Schema, model, type Types } from 'mongoose'
import { PRIORITIES, REQUEST_STATUSES, type Priority, type RequestStatus } from '../constants.js'

const serviceLineSchema = new Schema(
  {
    service: { type: Schema.Types.ObjectId, ref: 'Service' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: true },
)

const partLineSchema = new Schema(
  {
    part: { type: Schema.Types.ObjectId, ref: 'Part' },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: true },
)

const noteSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 2000 },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    authorName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
)

export interface ServiceRequestDoc {
  _id: Types.ObjectId
  requestNumber: string
  customer: Types.ObjectId
  customerName: string
  vehicle: Types.ObjectId
  vehicleLabel: string
  licensePlate: string
  assignedMechanic?: Types.ObjectId
  mechanicName?: string
  description: string
  diagnosis?: string
  priority: Priority
  status: RequestStatus
  estimatedCost: number
  actualCost: number
  estimatedCompletion?: Date
  completedAt?: Date
  services: {
    _id: Types.ObjectId
    service?: Types.ObjectId
    name: string
    quantity: number
    unitPrice: number
  }[]
  parts: {
    _id: Types.ObjectId
    part?: Types.ObjectId
    sku: string
    name: string
    quantity: number
    unitPrice: number
  }[]
  notes: {
    _id: Types.ObjectId
    text: string
    author?: Types.ObjectId
    authorName: string
    createdAt: Date
  }[]
  createdBy?: Types.ObjectId
  createdByName?: string
  mileageAtService?: number
  createdAt: Date
  updatedAt: Date
}

const serviceRequestSchema = new Schema<ServiceRequestDoc>(
  {
    requestNumber: { type: String, required: true, unique: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true, index: true },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    vehicleLabel: { type: String, required: true },
    licensePlate: { type: String, required: true, index: true },
    assignedMechanic: { type: Schema.Types.ObjectId, ref: 'Mechanic', index: true },
    mechanicName: { type: String },
    description: { type: String, required: true, maxlength: 4000 },
    diagnosis: { type: String, maxlength: 4000 },
    priority: { type: String, enum: PRIORITIES, default: 'medium', index: true },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending', index: true },
    estimatedCost: { type: Number, default: 0, min: 0 },
    actualCost: { type: Number, default: 0, min: 0 },
    estimatedCompletion: { type: Date },
    completedAt: { type: Date },
    services: { type: [serviceLineSchema], default: [] },
    parts: { type: [partLineSchema], default: [] },
    notes: { type: [noteSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String },
    mileageAtService: { type: Number, min: 0 },
  },
  { timestamps: true },
)

serviceRequestSchema.index({ status: 1, createdAt: -1 })
serviceRequestSchema.index({ priority: 1, createdAt: -1 })
serviceRequestSchema.index({ assignedMechanic: 1, status: 1 })
serviceRequestSchema.index({ createdAt: -1 })

export const ServiceRequest = model<ServiceRequestDoc>('ServiceRequest', serviceRequestSchema)
