import type { Types } from 'mongoose'
import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { Events, type Role } from '../constants.js'
import { emitToRole, emitToUser } from '../sockets/io.js'

interface NoticeInput {
  title: string
  message: string
  type: string
  link?: string
  entityType?: string
  entityId?: Types.ObjectId | string
}

export async function notifyUser(userId: string, input: NoticeInput) {
  const doc = await Notification.create({ user: userId, ...input, read: false })
  emitToUser(userId, Events.notificationCreated, {
    id: doc._id.toString(),
    title: doc.title,
    message: doc.message,
    type: doc.type,
    link: doc.link,
    createdAt: doc.createdAt,
    read: false,
  })
  return doc
}

export async function notifyRoles(roles: Role[], input: NoticeInput, excludeUserId?: string) {
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id role')
  const docs = users
    .filter((user) => user._id.toString() !== excludeUserId)
    .map((user) => ({
      user: user._id,
      role: user.role,
      ...input,
      read: false,
    }))
  if (docs.length) await Notification.insertMany(docs)
  for (const role of roles) {
    emitToRole(role, Events.notificationCreated, input)
  }
}
