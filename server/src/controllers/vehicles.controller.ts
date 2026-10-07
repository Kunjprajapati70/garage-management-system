import type { Request, Response } from 'express'
import { Vehicle } from '../models/Vehicle.js'
import { Customer } from '../models/Customer.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { blankToUndefined, escapeRegex, pageMeta, parseSort } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { emitOperational } from '../sockets/io.js'
import { Events } from '../constants.js'

async function refreshVehicleCount(customerId: unknown) {
  const count = await Vehicle.countDocuments({ customer: customerId })
  await Customer.findByIdAndUpdate(customerId, { vehicleCount: count })
}

function vehicleLabel(vehicle: { make: string; model: string; licensePlate: string }) {
  return `${vehicle.make} ${vehicle.model} · ${vehicle.licensePlate}`
}

export const listVehicles = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery as {
    page: number
    limit: number
    sort?: string
    search?: string
    customer?: string
    make?: string
    plate?: string
    vin?: string
  }
  const page = query.page
  const limit = query.limit
  const filter: Record<string, unknown> = {}
  if (req.user!.role === 'MECHANIC') {
    const vehicleIds = await ServiceRequest.distinct('vehicle', { assignedMechanic: req.user!.mechanicId })
    filter._id = { $in: vehicleIds }
  }
  if (query.customer) filter.customer = query.customer
  if (query.make) filter.make = new RegExp(`^${escapeRegex(query.make)}$`, 'i')
  if (query.plate) filter.licensePlate = new RegExp(escapeRegex(query.plate), 'i')
  if (query.vin) filter.vin = new RegExp(escapeRegex(query.vin), 'i')
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ licensePlate: pattern }, { vin: pattern }, { make: pattern }, { model: pattern }, { customerName: pattern }]
  }
  const sort = parseSort(query.sort, ['licensePlate', 'make', 'year', 'mileage', 'createdAt', 'customerName'])
  const [items, total] = await Promise.all([
    Vehicle.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Vehicle.countDocuments(filter),
  ])
  sendSuccess(res, items, 'Vehicles', 200, pageMeta(page, limit, total))
})

export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role === 'MECHANIC') throw new ApiError(403, 'You do not have permission to perform this action')
  const customer = await Customer.findById(req.body.customer)
  if (!customer) throw new ApiError(400, 'Customer not found', [{ field: 'customer', message: 'Select a valid customer' }])
  const vehicle = await Vehicle.create({
    ...req.body,
    licensePlate: String(req.body.licensePlate).toUpperCase().replace(/\s+/g, ''),
    vin: blankToUndefined(req.body.vin)?.toUpperCase(),
    color: blankToUndefined(req.body.color),
    customerName: customer.name,
  })
  await refreshVehicleCount(customer._id)
  await writeAudit(req, 'CREATE', 'Vehicle', `Added ${vehicleLabel(vehicle)} for ${customer.name}`, vehicle._id.toString())
  emitOperational(Events.vehicleCreated, { id: vehicle._id, label: vehicleLabel(vehicle) })
  sendSuccess(res, vehicle, 'Vehicle created', 201)
})

export const getVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await Vehicle.findById(req.params.id).lean()
  if (!vehicle) throw new ApiError(404, 'Vehicle not found')
  if (req.user!.role === 'MECHANIC') {
    const allowed = await ServiceRequest.exists({ vehicle: vehicle._id, assignedMechanic: req.user!.mechanicId })
    if (!allowed) throw new ApiError(403, 'This vehicle is not part of your assigned work')
  }
  const history = await ServiceRequest.find({ vehicle: vehicle._id }).sort('-createdAt').limit(50).select('requestNumber status priority description actualCost createdAt completedAt mechanicName').lean()
  sendSuccess(res, { ...vehicle, history })
})

export const updateVehicle = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role === 'MECHANIC') throw new ApiError(403, 'You do not have permission to perform this action')
  const vehicle = await Vehicle.findById(req.params.id)
  if (!vehicle) throw new ApiError(404, 'Vehicle not found')
  if (req.body.customer && req.body.customer !== vehicle.customer.toString()) {
    const customer = await Customer.findById(req.body.customer)
    if (!customer) throw new ApiError(400, 'Customer not found')
    const previous = vehicle.customer
    vehicle.customer = customer._id
    vehicle.customerName = customer.name
    await vehicle.save()
    await refreshVehicleCount(previous)
    await refreshVehicleCount(customer._id)
  }
  const customer = await Customer.findById(req.body.customer || vehicle.customer)
  Object.assign(vehicle, {
    ...req.body,
    customer: vehicle.customer,
    customerName: customer?.name || vehicle.customerName,
    licensePlate: String(req.body.licensePlate).toUpperCase().replace(/\s+/g, ''),
    vin: blankToUndefined(req.body.vin)?.toUpperCase(),
    color: blankToUndefined(req.body.color),
  })
  await vehicle.save()
  const label = vehicleLabel(vehicle)
  await ServiceRequest.updateMany({ vehicle: vehicle._id }, { vehicleLabel: label, licensePlate: vehicle.licensePlate, customer: vehicle.customer, customerName: vehicle.customerName })
  await writeAudit(req, 'UPDATE', 'Vehicle', `Updated ${label}`, vehicle._id.toString())
  emitOperational(Events.vehicleUpdated, { id: vehicle._id, label })
  sendSuccess(res, vehicle, 'Vehicle updated')
})

export const deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
  const vehicle = await Vehicle.findById(req.params.id)
  if (!vehicle) throw new ApiError(404, 'Vehicle not found')
  const jobs = await ServiceRequest.countDocuments({ vehicle: vehicle._id })
  if (jobs > 0) throw new ApiError(409, 'This vehicle has service history and cannot be deleted')
  const customerId = vehicle.customer
  await vehicle.deleteOne()
  await refreshVehicleCount(customerId)
  await writeAudit(req, 'DELETE', 'Vehicle', `Deleted vehicle ${vehicle.licensePlate}`, vehicle._id.toString())
  sendSuccess(res, null, 'Vehicle deleted')
})
