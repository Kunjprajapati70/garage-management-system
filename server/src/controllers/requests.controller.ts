import type { Request, Response } from 'express'
import { Types } from 'mongoose'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Invoice } from '../models/Invoice.js'
import { Customer } from '../models/Customer.js'
import { Vehicle } from '../models/Vehicle.js'
import { Mechanic } from '../models/Mechanic.js'
import { Service } from '../models/Service.js'
import { Part } from '../models/Part.js'
import { User } from '../models/User.js'
import { nextSequence } from '../models/Setting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { escapeRegex, pageMeta, parseSort, roundMoney } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { notifyRoles, notifyUser } from '../services/notify.js'
import { deliverEmail } from '../services/email.js'
import { emitMechanic, emitOperational } from '../sockets/io.js'
import { Events, STATUS_TRANSITIONS, type RequestStatus, type Role } from '../constants.js'
import { refreshMechanicLoad } from './mechanics.controller.js'

const STAFF: Role[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST']

function actualCost(doc: { services: { quantity: number; unitPrice: number }[]; parts: { quantity: number; unitPrice: number }[] }) {
  const total = [...doc.services, ...doc.parts].reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  return roundMoney(total)
}

function assertAccess(req: Request, doc: { assignedMechanic?: { toString(): string } | null }) {
  if (req.user!.role === 'MECHANIC' && doc.assignedMechanic?.toString() !== req.user!.mechanicId) {
    throw new ApiError(403, 'This service request is not assigned to you')
  }
}

function assertEditable(doc: { status: string }) {
  if (doc.status === 'completed' || doc.status === 'cancelled') {
    throw new ApiError(400, 'Reopen the service request before changing services, parts, or diagnosis')
  }
}

async function mechanicUserId(mechanicId?: string | null) {
  if (!mechanicId) return undefined
  const mechanic = await Mechanic.findById(mechanicId).select('user')
  return mechanic?.user.toString()
}

export const listRequests = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as {
    page: number
    limit: number
    sort?: string
    search?: string
    status?: string
    priority?: string
    mechanic?: string
    customer?: string
    from?: string
    to?: string
  }
  const filter: Record<string, unknown> = {}
  if (req.user!.role === 'MECHANIC') filter.assignedMechanic = req.user!.mechanicId
  if (query.status && query.status !== 'all') filter.status = query.status
  if (query.priority && query.priority !== 'all') filter.priority = query.priority
  if (query.mechanic && req.user!.role !== 'MECHANIC') filter.assignedMechanic = query.mechanic
  if (query.customer) filter.customer = query.customer
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ requestNumber: pattern }, { customerName: pattern }, { vehicleLabel: pattern }, { licensePlate: pattern }, { mechanicName: pattern }]
  }
  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {}
    if (query.from) createdAt.$gte = new Date(query.from)
    if (query.to) createdAt.$lte = new Date(query.to)
    if (Number.isNaN(createdAt.$gte?.getTime?.() ?? 0) || Number.isNaN(createdAt.$lte?.getTime?.() ?? 0)) {
      throw new ApiError(400, 'Invalid date filter')
    }
    filter.createdAt = createdAt
  }
  const sort = parseSort(query.sort, ['requestNumber', 'customerName', 'status', 'priority', 'createdAt', 'actualCost', 'estimatedCompletion'])
  const page = query.page
  const limit = query.limit
  const [items, total] = await Promise.all([
    ServiceRequest.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-notes -services -parts')
      .lean(),
    ServiceRequest.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Service requests', 200, pageMeta(page, limit, total))
})

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role === 'MECHANIC') throw new ApiError(403, 'You do not have permission to perform this action')
  const customer = await Customer.findById(req.body.customer)
  if (!customer) throw new ApiError(400, 'Customer not found', [{ field: 'customer', message: 'Select a customer' }])
  const vehicle = await Vehicle.findById(req.body.vehicle)
  if (!vehicle || vehicle.customer.toString() !== customer._id.toString()) {
    throw new ApiError(400, 'Vehicle does not belong to the selected customer', [{ field: 'vehicle', message: 'Select a vehicle for this customer' }])
  }
  let mechanic: { _id: Types.ObjectId; name: string; user: Types.ObjectId } | null = null
  if (req.body.assignedMechanic) {
    mechanic = await Mechanic.findById(req.body.assignedMechanic)
    if (!mechanic) throw new ApiError(400, 'Mechanic not found', [{ field: 'assignedMechanic', message: 'Select a mechanic' }])
  }
  const opened = new Date()
  const stamp = `${opened.getFullYear()}${String(opened.getMonth() + 1).padStart(2, '0')}${String(opened.getDate()).padStart(2, '0')}`
  const seq = await nextSequence(`request-${stamp}`)
  const requestNumber = `SR-${stamp}-${String(seq).padStart(6, '0')}`
  const doc = await ServiceRequest.create({
    requestNumber,
    customer: customer._id,
    customerName: customer.name,
    vehicle: vehicle._id,
    vehicleLabel: `${vehicle.make} ${vehicle.model} · ${vehicle.licensePlate}`,
    licensePlate: vehicle.licensePlate,
    assignedMechanic: mechanic?._id,
    mechanicName: mechanic?.name,
    description: req.body.description,
    priority: req.body.priority,
    status: mechanic ? 'diagnosing' : 'pending',
    estimatedCost: req.body.estimatedCost ?? 0,
    estimatedCompletion: req.body.estimatedCompletion ? new Date(req.body.estimatedCompletion) : undefined,
    createdBy: req.user!.id,
    createdByName: req.user!.name,
    mileageAtService: vehicle.mileage,
  })
  vehicle.lastServiceAt = new Date()
  await vehicle.save()
  if (mechanic) await refreshMechanicLoad(mechanic._id.toString())
  await writeAudit(req, 'CREATE', 'ServiceRequest', `Opened ${doc.requestNumber} for ${customer.name}`, doc._id.toString())
  const payload = { id: doc._id, requestNumber: doc.requestNumber, status: doc.status }
  emitOperational(Events.requestCreated, payload, mechanic ? [`user:${mechanic.user.toString()}`, `request:${doc._id}`] : [])
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'Service request opened',
    message: `${doc.requestNumber} for ${customer.name} (${doc.vehicleLabel}).`,
    type: 'service-request',
    link: `/service-requests/${doc._id}`,
    entityId: doc._id,
    entityType: 'ServiceRequest',
  }, req.user!.id)
  if (mechanic) {
    await notifyUser(mechanic.user.toString(), {
      title: 'Job assigned',
      message: `${doc.requestNumber} · ${doc.vehicleLabel} was assigned to you.`,
      type: 'assignment',
      link: `/service-requests/${doc._id}`,
      entityId: doc._id,
    })
    const mechanicUser = await User.findById(mechanic.user).select('email name')
    if (mechanicUser?.email) {
      void deliverEmail({
        to: mechanicUser.email,
        subject: `Assigned: ${doc.requestNumber}`,
        title: 'A job was assigned to you',
        intro: `Hello ${mechanicUser.name}, a service request is now on your board.`,
        rows: [
          { label: 'Request', value: doc.requestNumber },
          { label: 'Vehicle', value: doc.vehicleLabel },
          { label: 'Priority', value: doc.priority },
        ],
        template: 'mechanic-assigned',
        flag: 'assignment',
        relatedModel: 'ServiceRequest',
        relatedId: doc._id.toString(),
      })
    }
  }
  if (customer.email) {
    void deliverEmail({
      to: customer.email,
      subject: `Service request ${doc.requestNumber}`,
      title: 'We have logged your service request',
      intro: `Hello ${customer.name}, your vehicle is booked into the workshop.`,
      rows: [
        { label: 'Request', value: doc.requestNumber },
        { label: 'Vehicle', value: doc.vehicleLabel },
        { label: 'Priority', value: doc.priority },
        { label: 'Status', value: doc.status.replaceAll('_', ' ') },
      ],
      template: 'request-confirmation',
      flag: 'serviceRequest',
      relatedModel: 'ServiceRequest',
      relatedId: doc._id.toString(),
    })
  }
  sendSuccess(res, doc, 'Service request created', 201)
})

export const getRequest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id).lean()
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  sendSuccess(res, doc)
})

export const updateRequest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  const role = req.user!.role
  if (req.body.description !== undefined) {
    if (role === 'MECHANIC') throw new ApiError(403, 'Mechanics update diagnosis and workshop notes')
    doc.description = req.body.description
  }
  if (req.body.diagnosis !== undefined) {
    assertEditable(doc)
    doc.diagnosis = req.body.diagnosis
  }
  if (req.body.priority !== undefined) {
    if (role === 'MECHANIC') throw new ApiError(403, 'You do not have permission to change priority')
    doc.priority = req.body.priority
  }
  if (req.body.estimatedCost !== undefined) {
    if (role === 'MECHANIC') throw new ApiError(403, 'You do not have permission to change the estimate')
    doc.estimatedCost = req.body.estimatedCost
  }
  if (req.body.estimatedCompletion !== undefined) {
    doc.estimatedCompletion = req.body.estimatedCompletion ? new Date(req.body.estimatedCompletion) : undefined
  }
  await doc.save()
  await writeAudit(req, 'UPDATE', 'ServiceRequest', `Updated ${doc.requestNumber}`, doc._id.toString())
  emitOperational(Events.requestUpdated, { id: doc._id, requestNumber: doc.requestNumber }, [`request:${doc._id}`])
  const userId = await mechanicUserId(doc.assignedMechanic?.toString())
  emitMechanic(userId, Events.requestUpdated, { id: doc._id, requestNumber: doc.requestNumber })
  sendSuccess(res, doc, 'Service request updated')
})

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  const next = req.body.status as RequestStatus
  const role = req.user!.role
  if (!STATUS_TRANSITIONS[doc.status].includes(next)) {
    throw new ApiError(400, `Cannot move a ${doc.status.replaceAll('_', ' ')} request to ${next.replaceAll('_', ' ')}`)
  }
  if (next === 'cancelled' && role === 'MECHANIC') throw new ApiError(403, 'Mechanics cannot cancel a service request')
  if (doc.status === 'completed' && role !== 'ADMIN') throw new ApiError(403, 'Only an administrator can reopen a completed request')
  if (doc.status === 'cancelled' && !['ADMIN', 'MANAGER'].includes(role)) throw new ApiError(403, 'Only a manager can reopen a cancelled request')
  const previous = doc.status
  doc.status = next
  doc.completedAt = next === 'completed' ? new Date() : undefined
  if (req.body.note) {
    doc.notes.push({ text: req.body.note, author: new Types.ObjectId(req.user!.id), authorName: req.user!.name, createdAt: new Date() } as never)
  }
  await doc.save()
  if (doc.assignedMechanic) await refreshMechanicLoad(doc.assignedMechanic.toString())
  await writeAudit(req, 'STATUS_CHANGE', 'ServiceRequest', `${doc.requestNumber} moved from ${previous} to ${next}`, doc._id.toString())
  const payload = { id: doc._id, requestNumber: doc.requestNumber, status: next }
  const mechanicUser = await mechanicUserId(doc.assignedMechanic?.toString())
  emitOperational(Events.requestStatus, payload, [`request:${doc._id}`, ...(mechanicUser ? [`user:${mechanicUser}`] : [])])
  emitMechanic(mechanicUser, Events.requestStatus, payload)
  if (mechanicUser && mechanicUser !== req.user!.id) {
    await notifyUser(mechanicUser, {
      title: 'Service status changed',
      message: `${doc.requestNumber} is now ${next.replaceAll('_', ' ')}.`,
      type: 'status',
      link: `/service-requests/${doc._id}`,
    })
  }
  await notifyRoles(['ADMIN', 'MANAGER'], {
    title: 'Service status changed',
    message: `${doc.requestNumber} is now ${next.replaceAll('_', ' ')}.`,
    type: 'status',
    link: `/service-requests/${doc._id}`,
  }, req.user!.id)
  const customer = await Customer.findById(doc.customer).select('name email')
  if (customer?.email) {
    void deliverEmail({
      to: customer.email,
      subject: `${doc.requestNumber} is ${next.replaceAll('_', ' ')}`,
      title: 'Service status update',
      intro: `Hello ${customer.name}, the workshop updated your service request.`,
      rows: [
        { label: 'Request', value: doc.requestNumber },
        { label: 'Vehicle', value: doc.vehicleLabel },
        { label: 'Status', value: next.replaceAll('_', ' ') },
      ],
      template: next === 'completed' ? 'service-completed' : 'service-status',
      flag: next === 'completed' ? 'completed' : 'status',
      relatedModel: 'ServiceRequest',
      relatedId: doc._id.toString(),
    })
  }
  sendSuccess(res, doc, 'Status updated')
})

export const assignMechanic = asyncHandler(async (req: Request, res: Response) => {
  if (!STAFF.includes(req.user!.role)) throw new ApiError(403, 'You do not have permission to assign mechanics')
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  if (doc.status === 'cancelled' || doc.status === 'completed') throw new ApiError(400, 'This request cannot be reassigned')
  const mechanic = await Mechanic.findById(req.body.mechanicId)
  if (!mechanic) throw new ApiError(400, 'Mechanic not found')
  const previous = doc.assignedMechanic?.toString()
  doc.assignedMechanic = mechanic._id
  doc.mechanicName = mechanic.name
  if (doc.status === 'pending') doc.status = 'diagnosing'
  await doc.save()
  if (previous) await refreshMechanicLoad(previous)
  await refreshMechanicLoad(mechanic._id.toString())
  await writeAudit(req, 'ASSIGN', 'ServiceRequest', `Assigned ${mechanic.name} to ${doc.requestNumber}`, doc._id.toString())
  const payload = { id: doc._id, requestNumber: doc.requestNumber, mechanicName: mechanic.name }
  emitOperational(Events.requestAssigned, payload, [`user:${mechanic.user.toString()}`, `request:${doc._id}`])
  emitMechanic(mechanic.user.toString(), Events.requestAssigned, payload)
  await notifyUser(mechanic.user.toString(), {
    title: 'Job assigned',
    message: `${doc.requestNumber} · ${doc.vehicleLabel} was assigned to you.`,
    type: 'assignment',
    link: `/service-requests/${doc._id}`,
  })
  const mechanicUser = await User.findById(mechanic.user).select('email name')
  if (mechanicUser?.email) {
    void deliverEmail({
      to: mechanicUser.email,
      subject: `Assigned: ${doc.requestNumber}`,
      title: 'A job was assigned to you',
      intro: `Hello ${mechanicUser.name}, ${req.user!.name} assigned a service request to you.`,
      rows: [
        { label: 'Request', value: doc.requestNumber },
        { label: 'Vehicle', value: doc.vehicleLabel },
        { label: 'Customer', value: doc.customerName },
      ],
      template: 'mechanic-assigned',
      flag: 'assignment',
      relatedModel: 'ServiceRequest',
      relatedId: doc._id.toString(),
    })
  }
  sendSuccess(res, doc, 'Mechanic assigned')
})

export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  doc.notes.push({ text: req.body.text, author: new Types.ObjectId(req.user!.id), authorName: req.user!.name, createdAt: new Date() } as never)
  await doc.save()
  emitOperational(Events.requestUpdated, { id: doc._id, requestNumber: doc.requestNumber }, [`request:${doc._id}`])
  sendSuccess(res, doc, 'Note added')
})

export const addServiceLine = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  assertEditable(doc)
  const service = await Service.findById(req.body.serviceId)
  if (!service || !service.isActive) throw new ApiError(400, 'Service is not available')
  const unitPrice = req.user!.role === 'MECHANIC' || req.body.unitPrice === undefined ? service.basePrice : req.body.unitPrice
  doc.services.push({ service: service._id, name: service.name, quantity: req.body.quantity, unitPrice } as never)
  doc.actualCost = actualCost(doc)
  await doc.save()
  await writeAudit(req, 'UPDATE', 'ServiceRequest', `Added ${service.name} to ${doc.requestNumber}`, doc._id.toString())
  emitOperational(Events.requestUpdated, { id: doc._id, actualCost: doc.actualCost }, [`request:${doc._id}`])
  sendSuccess(res, doc, 'Service added')
})

export const removeServiceLine = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  assertEditable(doc)
  const before = doc.services.length
  doc.services = doc.services.filter((line) => line._id.toString() !== req.params.lineId) as typeof doc.services
  if (doc.services.length === before) throw new ApiError(404, 'Service line not found')
  doc.markModified('services')
  doc.actualCost = actualCost(doc)
  await doc.save()
  emitOperational(Events.requestUpdated, { id: doc._id, actualCost: doc.actualCost }, [`request:${doc._id}`])
  sendSuccess(res, doc, 'Service removed')
})

export const addPartLine = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  assertEditable(doc)
  const part = await Part.findOneAndUpdate(
    { _id: req.body.partId, isActive: true, quantity: { $gte: req.body.quantity } },
    { $inc: { quantity: -req.body.quantity } },
    { new: true },
  )
  if (!part) throw new ApiError(400, 'Insufficient stock for that part')
  const unitPrice = req.user!.role === 'MECHANIC' || req.body.unitPrice === undefined ? part.unitPrice : req.body.unitPrice
  doc.parts.push({ part: part._id, sku: part.sku, name: part.name, quantity: req.body.quantity, unitPrice } as never)
  doc.actualCost = actualCost(doc)
  await doc.save()
  await writeAudit(req, 'UPDATE', 'ServiceRequest', `Used ${req.body.quantity} × ${part.sku} on ${doc.requestNumber}`, doc._id.toString(), { sku: part.sku, quantity: req.body.quantity, remaining: part.quantity })
  emitOperational(Events.requestParts, { id: part._id, requestNumber: doc.requestNumber, sku: part.sku, quantity: part.quantity }, [`request:${doc._id}`])
  if (part.quantity <= part.minStock) {
    emitOperational('inventory-low', { id: part._id, sku: part.sku, name: part.name, quantity: part.quantity, minStock: part.minStock })
    await notifyRoles(['ADMIN', 'MANAGER'], {
      title: 'Low stock',
      message: `${part.name} (${part.sku}) has ${part.quantity} left. Reorder level is ${part.minStock}.`,
      type: 'low_stock',
      link: '/parts',
      entityId: part._id,
    })
  }
  sendSuccess(res, doc, 'Part added')
})

export const deleteRequest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  const invoice = await Invoice.findOne({ serviceRequest: doc._id, status: { $ne: 'cancelled' } })
  if (invoice) throw new ApiError(409, 'Cancel the invoice before deleting this service request')
  for (const line of doc.parts) {
    if (line.part) await Part.findByIdAndUpdate(line.part, { $inc: { quantity: line.quantity } })
  }
  const mechanicId = doc.assignedMechanic?.toString()
  await doc.deleteOne()
  if (mechanicId) await refreshMechanicLoad(mechanicId)
  await writeAudit(req, 'DELETE', 'ServiceRequest', `Deleted ${doc.requestNumber}`, doc._id.toString())
  emitOperational(Events.requestUpdated, { id: doc._id, requestNumber: doc.requestNumber, deleted: true })
  sendSuccess(res, null, 'Service request deleted')
})

export const removePartLine = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  assertAccess(req, doc)
  assertEditable(doc)
  const line = doc.parts.find((item) => item._id.toString() === req.params.lineId)
  if (!line) throw new ApiError(404, 'Part line not found')
  if (line.part) await Part.findByIdAndUpdate(line.part, { $inc: { quantity: line.quantity } })
  doc.parts = doc.parts.filter((item) => item._id.toString() !== req.params.lineId) as typeof doc.parts
  doc.markModified('parts')
  doc.actualCost = actualCost(doc)
  await doc.save()
  emitOperational(Events.requestParts, { id: doc._id, requestNumber: doc.requestNumber }, [`request:${doc._id}`])
  sendSuccess(res, doc, 'Part returned to stock')
})

export const notifyCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role === 'MECHANIC') throw new ApiError(403, 'You do not have permission to perform this action')
  const doc = await ServiceRequest.findById(req.params.id)
  if (!doc) throw new ApiError(404, 'Service request not found')
  const customer = await Customer.findById(doc.customer)
  if (!customer?.email) throw new ApiError(400, 'This customer does not have an email address')
  const result = await deliverEmail({
    to: customer.email,
    subject: req.body.subject,
    title: req.body.subject,
    intro: req.body.message,
    rows: [
      { label: 'Request', value: doc.requestNumber },
      { label: 'Vehicle', value: doc.vehicleLabel },
      { label: 'Status', value: doc.status.replaceAll('_', ' ') },
    ],
    template: 'customer-message',
    force: true,
    relatedModel: 'ServiceRequest',
    relatedId: doc._id.toString(),
  })
  await writeAudit(req, 'EMAIL', 'ServiceRequest', `Emailed customer about ${doc.requestNumber}`, doc._id.toString())
  if (!result.sent) throw new ApiError(502, result.message)
  sendSuccess(res, result, 'Customer notified')
})
