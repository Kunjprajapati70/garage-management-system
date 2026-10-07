import type { Request, Response } from 'express'
import { Service } from '../models/Service.js'
import { Part } from '../models/Part.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { blankToUndefined, escapeRegex, pageMeta, parseSort } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { emitOperational } from '../sockets/io.js'
import { Events } from '../constants.js'

export const listServices = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; category?: string; active?: string }
  const filter: Record<string, unknown> = {}
  if (query.search) filter.name = new RegExp(escapeRegex(query.search), 'i')
  if (query.category) filter.category = query.category
  if (query.active === 'true') filter.isActive = true
  if (query.active === 'false') filter.isActive = false
  const sort = parseSort(query.sort, ['name', 'category', 'basePrice', 'createdAt'])
  const page = query.page
  const limit = query.limit
  const [items, total] = await Promise.all([
    Service.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Service.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Services', 200, pageMeta(page, limit, total))
})

export const createService = asyncHandler(async (req: Request, res: Response) => {
  const service = await Service.create({ ...req.body, description: blankToUndefined(req.body.description), isActive: req.body.isActive ?? true })
  await writeAudit(req, 'CREATE', 'Service', `Created service ${service.name}`, service._id.toString())
  emitOperational(Events.serviceCreated, { id: service._id, name: service.name })
  sendSuccess(res, service, 'Service created', 201)
})

export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const service = await Service.findByIdAndUpdate(req.params.id, { ...req.body, description: blankToUndefined(req.body.description) }, { new: true, runValidators: true })
  if (!service) throw new ApiError(404, 'Service not found')
  await writeAudit(req, 'UPDATE', 'Service', `Updated service ${service.name}`, service._id.toString())
  emitOperational(Events.serviceUpdated, { id: service._id, name: service.name })
  sendSuccess(res, service, 'Service updated')
})

export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const service = await Service.findByIdAndDelete(req.params.id)
  if (!service) throw new ApiError(404, 'Service not found')
  await writeAudit(req, 'DELETE', 'Service', `Deleted service ${service.name}`, service._id.toString())
  emitOperational(Events.serviceUpdated, { id: service._id, name: service.name })
  sendSuccess(res, null, 'Service deleted')
})

export const listParts = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as { page: number; limit: number; sort?: string; search?: string; category?: string; lowStock?: string; active?: string }
  const filter: Record<string, unknown> = {}
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ name: pattern }, { sku: pattern }, { supplier: pattern }]
  }
  if (query.category) filter.category = query.category
  if (query.active === 'true') filter.isActive = true
  if (query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$minStock'] }
  const sort = parseSort(query.sort, ['name', 'sku', 'quantity', 'unitPrice', 'createdAt'])
  const page = query.page
  const limit = query.limit
  const [items, total] = await Promise.all([
    Part.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Part.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Parts', 200, pageMeta(page, limit, total))
})

export const createPart = asyncHandler(async (req: Request, res: Response) => {
  const part = await Part.create({
    ...req.body,
    sku: String(req.body.sku).toUpperCase(),
    description: blankToUndefined(req.body.description),
    supplier: blankToUndefined(req.body.supplier),
    location: blankToUndefined(req.body.location),
    isActive: req.body.isActive ?? true,
  })
  await writeAudit(req, 'CREATE', 'Part', `Created part ${part.sku}`, part._id.toString())
  emitOperational(Events.partsUpdated, { id: part._id, sku: part.sku })
  sendSuccess(res, part, 'Part created', 201)
})

export const updatePart = asyncHandler(async (req: Request, res: Response) => {
  const part = await Part.findById(req.params.id)
  if (!part) throw new ApiError(404, 'Part not found')
  Object.assign(part, { ...req.body, sku: String(req.body.sku || part.sku).toUpperCase(), description: blankToUndefined(req.body.description) })
  await part.save()
  await writeAudit(req, 'UPDATE', 'Part', `Updated part ${part.sku}`, part._id.toString())
  emitOperational(Events.partsUpdated, { id: part._id, sku: part.sku })
  sendSuccess(res, part, 'Part updated')
})

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const part = await Part.findById(req.params.id)
  if (!part) throw new ApiError(404, 'Part not found')
  const next = part.quantity + req.body.quantity
  if (next < 0) throw new ApiError(400, 'Stock cannot go below zero')
  part.quantity = next
  await part.save()
  await writeAudit(req, 'UPDATE', 'Part', `${req.body.reason} (${req.body.quantity > 0 ? '+' : ''}${req.body.quantity} ${part.sku})`, part._id.toString(), { quantity: part.quantity })
  emitOperational(Events.partsUpdated, { id: part._id, sku: part.sku, quantity: part.quantity })
  sendSuccess(res, part, 'Stock updated')
})

export const deletePart = asyncHandler(async (req: Request, res: Response) => {
  const part = await Part.findByIdAndDelete(req.params.id)
  if (!part) throw new ApiError(404, 'Part not found')
  await writeAudit(req, 'DELETE', 'Part', `Deleted part ${part.sku}`, part._id.toString())
  emitOperational(Events.partsUpdated, { id: part._id, sku: part.sku })
  sendSuccess(res, null, 'Part deleted')
})

export const catalogCategories = asyncHandler(async (_req: Request, res: Response) => {
  const [services, parts] = await Promise.all([Service.distinct('category'), Part.distinct('category')])
  sendSuccess(res, { services, parts })
})
