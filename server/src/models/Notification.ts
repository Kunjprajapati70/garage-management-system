import { Schema, model, type Types } from 'mongoose'
import type { Role } from '../constants.js'

export interface NotificationDoc {
  _id: Types.ObjectId
  user: Types.ObjectId
  role?: Role
  title: string
  message: string
  type: string
  link?: string
  read: boolean
  readAt?: Date
  entityType?: string
  entityId?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true, index: true },
    link: { type: String },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
)

notificationSchema.index({ user: 1, read: 1, createdAt: -1 })

export const Notification = model<NotificationDoc>('Notification', notificationSchema)

export interface AuditLogDoc {
  _id: Types.ObjectId
  user?: Types.ObjectId
  userName?: string
  role?: string
  action: string
  entity: string
  entityId?: string
  summary: string
  details?: Record<string, unknown>
  ip?: string
  createdAt: Date
  updatedAt: Date
}

const auditLogSchema = new Schema<AuditLogDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String },
    role: { type: String },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String },
    summary: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ entity: 1, createdAt: -1 })

export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema)
