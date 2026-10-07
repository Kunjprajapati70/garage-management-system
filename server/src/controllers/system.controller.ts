import type { Request, Response } from 'express'
import { Notification, AuditLog } from '../models/Notification.js'
import { EmailLog, Setting, ensureSettings } from '../models/Setting.js'
import { Customer } from '../models/Customer.js'
import { Vehicle } from '../models/Vehicle.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { escapeRegex, pageMeta, parseSort } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { getSmtpStatus, verifyAndSendTest } from '../services/email.js'
import { logoUpload } from '../middleware/upload.js'

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; unread?: string }
  const filter: Record<string, unknown> = { user: req.user!.id }
  if (query.unread === 'true') filter.read = false
  const page = query.page
  const limit = query.limit
  const sort = parseSort(query.sort, ['createdAt'], '-createdAt')
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user!.id, read: false }),
  ])
  sendSuccess(res, items, 'Notifications', 200, { ...pageMeta(page, limit, total), unread })
})

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user!.id },
    { read: true, readAt: new Date() },
    { new: true },
  )
  if (!item) throw new ApiError(404, 'Notification not found')
  sendSuccess(res, item, 'Notification marked read')
})

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await Notification.updateMany({ user: req.user!.id, read: false }, { read: true, readAt: new Date() })
  sendSuccess(res, null, 'All notifications marked read')
})

export const listAudit = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; action?: string; entity?: string }
  const filter: Record<string, unknown> = {}
  if (query.action && query.action !== 'all') filter.action = query.action
  if (query.entity && query.entity !== 'all') filter.entity = query.entity
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ summary: pattern }, { userName: pattern }, { entityId: pattern }]
  }
  const page = query.page
  const limit = query.limit
  const sort = parseSort(query.sort, ['createdAt', 'action', 'entity'])
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Audit logs', 200, pageMeta(page, limit, total))
})

export const publicSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await ensureSettings()
  sendSuccess(res, {
    garageName: settings?.garageName,
    tagline: settings?.tagline,
    phone: settings?.phone,
    address: settings?.address,
    city: settings?.city,
    logoUrl: settings?.logoUrl,
    taxPercent: settings?.taxPercent ?? 18,
  })
})

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await ensureSettings()
  sendSuccess(res, { ...settings, smtp: getSmtpStatus() })
})

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await Setting.findOneAndUpdate({ key: 'general' }, req.body, { new: true, upsert: true, runValidators: true })
  await writeAudit(req, 'UPDATE', 'Setting', 'Updated workshop settings', settings.id)
  sendSuccess(res, settings, 'Settings saved')
})

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, 'Choose a JPEG, PNG, or WebP image under 2 MB')
  const settings = await Setting.findOneAndUpdate(
    { key: 'general' },
    { logoUrl: `/uploads/logos/${req.file.filename}` },
    { new: true, upsert: true },
  )
  sendSuccess(res, settings, 'Logo updated')
})

export const testEmail = asyncHandler(async (req: Request, res: Response) => {
  const result = await verifyAndSendTest(req.body.to)
  await writeAudit(req, 'EMAIL', 'Setting', `SMTP test to ${req.body.to}`, undefined, { ok: result.ok })
  if (!result.ok) throw new ApiError(400, result.message)
  sendSuccess(res, { smtp: getSmtpStatus() }, result.message)
})

export const listEmails = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; status?: string; template?: string }
  const filter: Record<string, unknown> = {}
  if (query.status && query.status !== 'all') filter.status = query.status
  if (query.template && query.template !== 'all') filter.template = query.template
  if (query.search) filter.to = new RegExp(escapeRegex(query.search), 'i')
  const page = query.page
  const limit = query.limit
  const sort = parseSort(query.sort, ['createdAt', 'status', 'template'])
  const [items, total] = await Promise.all([
    EmailLog.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    EmailLog.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Email log', 200, pageMeta(page, limit, total))
})

export const search = asyncHandler(async (req: Request, res: Response) => {
  const term = String(req.query.q || '').trim()
  if (term.length < 2) {
    sendSuccess(res, { customers: [], vehicles: [], requests: [] })
    return
  }
  const pattern = new RegExp(escapeRegex(term), 'i')
  const requestFilter: Record<string, unknown> = {
    $or: [{ requestNumber: pattern }, { customerName: pattern }, { vehicleLabel: pattern }, { licensePlate: pattern }],
  }
  if (req.user!.role === 'MECHANIC') requestFilter.assignedMechanic = req.user!.mechanicId
  const [customers, vehicles, requests] = await Promise.all([
    req.user!.role === 'MECHANIC'
      ? Promise.resolve([])
      : Customer.find({ $or: [{ name: pattern }, { phone: pattern }, { email: pattern }] }).limit(5).select('name phone city').lean(),
    req.user!.role === 'MECHANIC'
      ? ServiceRequest.find(requestFilter).limit(5).select('vehicle vehicleLabel licensePlate').lean().then(async (rows) => {
          const ids = rows.map((row) => row.vehicle)
          return Vehicle.find({ _id: { $in: ids } }).select('make model licensePlate customerName').lean()
        })
      : Vehicle.find({ $or: [{ licensePlate: pattern }, { vin: pattern }, { make: pattern }, { model: pattern }, { customerName: pattern }] }).limit(5).select('make model licensePlate customerName').lean(),
    ServiceRequest.find(requestFilter).limit(5).select('requestNumber customerName vehicleLabel status').lean(),
  ])
  sendSuccess(res, { customers, vehicles, requests })
})

export { logoUpload }
