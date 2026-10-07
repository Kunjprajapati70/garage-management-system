import { Schema, model } from 'mongoose'

const counterSchema = new Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
})

export const Counter = model('Counter', counterSchema)

export interface SettingDoc {
  key: string
  garageName: string
  tagline: string
  address: string
  city: string
  phone: string
  email: string
  gstin: string
  taxPercent: number
  currency: string
  logoUrl?: string
  emailNotifications: {
    welcome: boolean
    serviceRequest: boolean
    assignment: boolean
    status: boolean
    completed: boolean
    invoice: boolean
  }
}

const settingSchema = new Schema<SettingDoc>(
  {
    key: { type: String, required: true, unique: true, default: 'general' },
    garageName: { type: String, default: 'Apex Motors' },
    tagline: { type: String, default: 'Workshop management for modern service bays' },
    address: { type: String, default: '14 Industrial Estate, Andheri East' },
    city: { type: String, default: 'Mumbai' },
    phone: { type: String, default: '+91 22 4000 1200' },
    email: { type: String, default: 'service@apexmotors.local' },
    gstin: { type: String, default: '' },
    taxPercent: { type: Number, default: 18, min: 0, max: 28 },
    currency: { type: String, default: 'INR' },
    logoUrl: { type: String },
    emailNotifications: {
      welcome: { type: Boolean, default: true },
      serviceRequest: { type: Boolean, default: true },
      assignment: { type: Boolean, default: true },
      status: { type: Boolean, default: true },
      completed: { type: Boolean, default: true },
      invoice: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
)

export const Setting = model<SettingDoc>('Setting', settingSchema)

const emailLogSchema = new Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    template: { type: String, required: true, index: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true, index: true },
    error: { type: String },
    preview: { type: String },
    relatedModel: { type: String },
    relatedId: { type: String },
  },
  { timestamps: true },
)

emailLogSchema.index({ createdAt: -1 })

export const EmailLog = model('EmailLog', emailLogSchema)

export async function nextSequence(key: string) {
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { new: true, upsert: true })
  return doc.seq
}

export async function ensureSettings() {
  await Setting.updateOne(
    { key: 'general' },
    { $setOnInsert: { key: 'general' } },
    { upsert: true },
  )
  return Setting.findOne({ key: 'general' }).lean()
}
