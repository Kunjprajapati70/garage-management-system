import type { Request, Response } from 'express'
import { User } from '../models/User.js'
import { Mechanic } from '../models/Mechanic.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { nextSequence } from '../models/Setting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { blankToUndefined, escapeRegex, pageMeta, parseSort } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { sendLoginMail } from '../services/credentials.js'
import { notifyRoles } from '../services/notify.js'

async function syncMechanic(user: { _id: { toString(): string }; name: string; email: string; phone?: string; role: string }, extras?: { specialization?: string; experienceYears?: number; hourlyRate?: number }) {
  if (user.role !== 'MECHANIC') return
  const existing = await Mechanic.findOne({ user: user._id })
  if (existing) {
    existing.name = user.name
    existing.email = user.email
    existing.phone = user.phone
    if (extras?.specialization) existing.specialization = extras.specialization
    if (extras?.experienceYears !== undefined) existing.experienceYears = extras.experienceYears
    if (extras?.hourlyRate !== undefined) existing.hourlyRate = extras.hourlyRate
    await existing.save()
    await ServiceRequest.updateMany({ assignedMechanic: existing._id }, { mechanicName: user.name })
    return existing
  }
  const seq = await nextSequence('employee')
  return Mechanic.create({
    user: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    employeeId: `EMP-${String(seq).padStart(4, '0')}`,
    specialization: extras?.specialization || 'General Service',
    experienceYears: extras?.experienceYears ?? 1,
    hourlyRate: extras?.hourlyRate ?? 450,
    status: 'available',
    activeJobs: 0,
  })
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; status?: string }
  const page = query.page
  const limit = query.limit
  const filter: Record<string, unknown> = {}
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }]
  }
  if (query.status && query.status !== 'all') filter.role = query.status
  const sort = parseSort(query.sort, ['name', 'email', 'role', 'createdAt'])
  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Users', 200, pageMeta(page, limit, total))
})

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const email = req.body.email.toLowerCase()
  if (await User.findOne({ email })) throw new ApiError(409, 'An account with this email already exists')
  const user = await User.create({
    name: req.body.name,
    email,
    phone: blankToUndefined(req.body.phone),
    password: req.body.password,
    role: req.body.role,
    isActive: req.body.isActive ?? true,
  })
  await syncMechanic(user, req.body)
  const mailed = await sendLoginMail({
    to: user.email,
    name: user.name,
    password: String(req.body.password),
    account: user.role,
    relatedId: user._id.toString(),
  })
  await writeAudit(req, 'CREATE', 'User', `Created ${user.role} account ${user.email}`, user._id.toString())
  await notifyRoles(['ADMIN'], { title: 'Staff account created', message: `${user.name} was added as ${user.role}.`, type: 'user', link: '/users' }, req.user!.id)
  sendSuccess(res, user, mailed.sent ? 'User created. Login email and password were sent.' : `User created, but the email was not sent. ${mailed.message}`, 201)
})

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select('+password')
  if (!user) throw new ApiError(404, 'User not found')
  if (req.body.email && req.body.email.toLowerCase() !== user.email) {
    const clash = await User.findOne({ email: req.body.email.toLowerCase() })
    if (clash) throw new ApiError(409, 'An account with this email already exists')
    user.email = req.body.email.toLowerCase()
  }
  if (req.body.name) user.name = req.body.name
  if (req.body.phone !== undefined) user.phone = blankToUndefined(req.body.phone)
  if (req.body.role) user.role = req.body.role
  if (req.body.isActive !== undefined) {
    if (!req.body.isActive && user._id.toString() === req.user!.id) {
      throw new ApiError(400, 'You cannot disable your own account')
    }
    user.isActive = req.body.isActive
  }
  const nextPassword = req.body.password ? String(req.body.password) : ''
  if (nextPassword) user.password = nextPassword
  await user.save()
  let mailed = null as { sent: boolean; message: string } | null
  if (nextPassword) {
    mailed = await sendLoginMail({
      to: user.email,
      name: user.name,
      password: nextPassword,
      account: user.role,
      relatedId: user._id.toString(),
    })
  }
  await syncMechanic(user, req.body)
  await writeAudit(req, 'UPDATE', 'User', `Updated account ${user.email}`, user._id.toString(), { role: user.role, isActive: user.isActive })
  const message = !mailed ? 'User updated' : mailed.sent ? 'User updated. The new password was emailed.' : `User updated, but the email was not sent. ${mailed.message}`
  sendSuccess(res, user, message)
})

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.user!.id) throw new ApiError(400, 'You cannot disable your own account')
  const user = await User.findById(req.params.id)
  if (!user) throw new ApiError(404, 'User not found')
  await User.updateOne({ _id: user._id }, { $set: { isActive: false }, $unset: { refreshTokenHash: 1 } })
  user.isActive = false
  await writeAudit(req, 'UPDATE', 'User', `Disabled account ${user.email}`, user._id.toString())
  sendSuccess(res, user, 'User disabled')
})
