import type { Request, Response } from 'express'
import type { Types } from 'mongoose'
import { Mechanic } from '../models/Mechanic.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { User } from '../models/User.js'
import { nextSequence } from '../models/Setting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { escapeRegex, pageMeta, parseSort } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { sendLoginMail } from '../services/credentials.js'

const ACTIVE = ['diagnosing', 'waiting_for_parts', 'in_progress']

async function completedJobMap(ids: Types.ObjectId[]) {
  if (!ids.length) return new Map<string, number>()
  const rows = await ServiceRequest.aggregate<{ _id: Types.ObjectId; completed: number }>([
    { $match: { status: 'completed', assignedMechanic: { $in: ids } } },
    { $group: { _id: '$assignedMechanic', completed: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row.completed]))
}

export async function refreshMechanicLoad(mechanicId: string) {
  const activeJobs = await ServiceRequest.countDocuments({ assignedMechanic: mechanicId, status: { $in: ACTIVE } })
  const mechanic = await Mechanic.findById(mechanicId)
  if (!mechanic) return null
  mechanic.activeJobs = activeJobs
  if (mechanic.status !== 'off_duty') mechanic.status = activeJobs > 0 ? 'busy' : 'available'
  await mechanic.save()
  return mechanic
}

export const createMechanic = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email).toLowerCase()
  if (await User.findOne({ email })) throw new ApiError(409, 'An account with this email already exists')
  const user = await User.create({
    name: req.body.name,
    email,
    phone: req.body.phone,
    password: req.body.password,
    role: 'MECHANIC',
    isActive: true,
  })
  const seq = await nextSequence('employee')
  const mechanic = await Mechanic.create({
    user: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    employeeId: `EMP-${String(seq).padStart(4, '0')}`,
    specialization: req.body.specialization,
    experienceYears: req.body.experienceYears,
    hourlyRate: req.body.hourlyRate,
    status: 'available',
    activeJobs: 0,
  })
  const mailed = await sendLoginMail({
    to: user.email,
    name: user.name,
    password: String(req.body.password),
    account: 'MECHANIC',
    relatedId: user._id.toString(),
  })
  await writeAudit(req, 'CREATE', 'Mechanic', `Created mechanic ${mechanic.name}`, mechanic._id.toString())
  sendSuccess(res, mechanic, mailed.sent ? 'Mechanic created. Login email and password were sent.' : `Mechanic created, but the email was not sent. ${mailed.message}`, 201)
})

export const listMechanics = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; status?: string }
  const filter: Record<string, unknown> = {}
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ name: pattern }, { email: pattern }, { employeeId: pattern }, { specialization: pattern }]
  }
  if (query.status && query.status !== 'all') filter.status = query.status
  const sort = parseSort(query.sort, ['name', 'employeeId', 'status', 'activeJobs', 'experienceYears', 'createdAt'])
  const page = query.page
  const limit = query.limit
  const [items, total] = await Promise.all([
    Mechanic.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Mechanic.countDocuments(filter),
  ])
  const completed = await completedJobMap(items.map((item) => item._id))
  sendSuccess(
    res,
    items.map((item) => ({ ...item, completedJobs: completed.get(String(item._id)) || 0 })),
    'Mechanics',
    200,
    pageMeta(page, limit, total),
  )
})

export const getMechanic = asyncHandler(async (req: Request, res: Response) => {
  const mechanic = await Mechanic.findById(req.params.id).lean()
  if (!mechanic) throw new ApiError(404, 'Mechanic not found')
  if (req.user!.role === 'MECHANIC' && mechanic.user.toString() !== req.user!.id) {
    throw new ApiError(403, 'You can only view your own mechanic profile')
  }
  const [jobs, completedJobs] = await Promise.all([
    ServiceRequest.find({ assignedMechanic: mechanic._id }).sort('-updatedAt').limit(30).select('requestNumber status priority customerName vehicleLabel estimatedCompletion updatedAt').lean(),
    ServiceRequest.countDocuments({ assignedMechanic: mechanic._id, status: 'completed' }),
  ])
  sendSuccess(res, { ...mechanic, jobs, completedJobs })
})

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const mechanic = await Mechanic.findById(req.params.id)
  if (!mechanic) throw new ApiError(404, 'Mechanic not found')
  if (req.user!.role === 'MECHANIC' && mechanic.user.toString() !== req.user!.id) {
    throw new ApiError(403, 'You can only view your own assigned jobs')
  }
  const query = req.validatedQuery as { page: number; limit: number; status?: string }
  const filter: Record<string, unknown> = { assignedMechanic: mechanic._id }
  if (query.status && query.status !== 'all') filter.status = query.status
  const page = query.page
  const limit = query.limit
  const [items, total, completed] = await Promise.all([
    ServiceRequest.find(filter).sort('-updatedAt').skip((page - 1) * limit).limit(limit).select('requestNumber status priority customerName vehicleLabel estimatedCompletion updatedAt actualCost').lean(),
    ServiceRequest.countDocuments(filter),
    ServiceRequest.countDocuments({ assignedMechanic: mechanic._id, status: 'completed' }),
  ])
  sendSuccess(res, { mechanic: mechanic.name, activeJobs: mechanic.activeJobs, completedJobs: completed, jobs: items }, 'Assigned jobs', 200, pageMeta(page, limit, total))
})

export const deactivateMechanic = asyncHandler(async (req: Request, res: Response) => {
  const mechanic = await Mechanic.findById(req.params.id)
  if (!mechanic) throw new ApiError(404, 'Mechanic not found')
  mechanic.status = 'off_duty'
  await mechanic.save()
  await User.findByIdAndUpdate(mechanic.user, { isActive: false })
  await writeAudit(req, 'DELETE', 'Mechanic', `Deactivated mechanic ${mechanic.name}`, mechanic._id.toString())
  sendSuccess(res, mechanic, 'Mechanic deactivated')
})

export const updateMechanic = asyncHandler(async (req: Request, res: Response) => {
  const mechanic = await Mechanic.findById(req.params.id)
  if (!mechanic) throw new ApiError(404, 'Mechanic not found')
  mechanic.specialization = req.body.specialization
  mechanic.experienceYears = req.body.experienceYears
  mechanic.hourlyRate = req.body.hourlyRate
  mechanic.status = req.body.status === 'off_duty' ? 'off_duty' : mechanic.activeJobs > 0 ? 'busy' : 'available'
  if (req.body.phone !== undefined) {
    mechanic.phone = req.body.phone || undefined
    await User.findByIdAndUpdate(mechanic.user, { phone: mechanic.phone })
  }
  await mechanic.save()
  await writeAudit(req, 'UPDATE', 'Mechanic', `Updated mechanic ${mechanic.name}`, mechanic._id.toString(), { status: mechanic.status })
  sendSuccess(res, mechanic, 'Mechanic updated')
})

export const mechanicOptions = asyncHandler(async (_req: Request, res: Response) => {
  const items = await Mechanic.find({ status: { $ne: 'off_duty' } }).sort('name').select('name specialization status activeJobs employeeId').limit(200).lean()
  sendSuccess(res, items)
})
