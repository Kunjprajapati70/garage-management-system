import type { Request, Response } from 'express'
import { Customer } from '../models/Customer.js'
import { Vehicle } from '../models/Vehicle.js'
import { Service } from '../models/Service.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Invoice, Payment } from '../models/Invoice.js'
import { ensureSettings, nextSequence } from '../models/Setting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { roundMoney } from '../utils/helpers.js'
import { writeAudit } from '../services/audit.js'
import { notifyRoles } from '../services/notify.js'
import { deliverEmail } from '../services/email.js'
import { emitOperational } from '../sockets/io.js'
import { Events } from '../constants.js'

function customerId(req: Request) {
  const id = req.user?.customerId
  if (!id) throw new ApiError(403, 'Customer profile is not configured')
  return id
}

export const portalHome = asyncHandler(async (req: Request, res: Response) => {
  const id = customerId(req)
  const customer = await Customer.findById(id).lean()
  if (!customer) throw new ApiError(404, 'Customer profile not found')
  const [vehicles, appointments, invoices, services, openAppointments, outstandingRows] = await Promise.all([
    Vehicle.find({ customer: id }).sort({ createdAt: -1 }).lean(),
    ServiceRequest.find({ customer: id }).sort({ createdAt: -1 }).limit(80).select('requestNumber vehicleLabel status priority description diagnosis mechanicName estimatedCompletion createdAt actualCost estimatedCost services').lean(),
    Invoice.find({ customer: id }).sort({ createdAt: -1 }).limit(40).select('invoiceNumber total balance status dueDate issuedAt vehicleLabel requestNumber').lean(),
    Service.find({ isActive: true }).sort({ name: 1 }).select('name category basePrice estimatedHours').lean(),
    ServiceRequest.countDocuments({ customer: id, status: { $nin: ['completed', 'cancelled'] } }),
    Invoice.aggregate<{ balance: number }>([
      { $match: { customer: customer._id, status: { $nin: ['cancelled', 'paid'] } } },
      { $group: { _id: null, balance: { $sum: '$balance' } } },
    ]),
  ])
  const upcoming = appointments.find((item) => !['completed', 'cancelled'].includes(item.status))
  sendSuccess(res, {
    customer,
    vehicles,
    appointments,
    invoices,
    services,
    summary: {
      vehicles: vehicles.length,
      openAppointments,
      outstanding: outstandingRows[0]?.balance || 0,
      nextDate: upcoming?.estimatedCompletion || null,
    },
  })
})

export const portalRequest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findOne({ _id: req.params.id, customer: customerId(req) }).lean()
  if (!doc) throw new ApiError(404, 'Appointment not found')
  sendSuccess(res, doc)
})

export const cancelPortalRequest = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ServiceRequest.findOne({ _id: req.params.id, customer: customerId(req) })
  if (!doc) throw new ApiError(404, 'Appointment not found')
  if (doc.status !== 'pending') throw new ApiError(400, 'Only a pending appointment can be cancelled')
  doc.status = 'cancelled'
  await doc.save()
  await writeAudit(req, 'STATUS', 'ServiceRequest', `Customer cancelled ${doc.requestNumber}`, doc._id.toString())
  emitOperational(Events.requestStatus, { id: doc._id, requestNumber: doc.requestNumber, status: doc.status })
  await notifyRoles(['ADMIN', 'MANAGER', 'RECEPTIONIST'], {
    title: 'Appointment cancelled',
    message: `${doc.customerName} cancelled ${doc.requestNumber}.`,
    type: 'service-request',
    link: `/service-requests/${doc._id}`,
    entityId: doc._id,
    entityType: 'ServiceRequest',
  })
  sendSuccess(res, doc, 'Appointment cancelled')
})

export const portalInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, customer: customerId(req) }).lean()
  if (!invoice) throw new ApiError(404, 'Invoice not found')
  const [payments, garage] = await Promise.all([
    Payment.find({ invoice: invoice._id }).sort('-paidAt').lean(),
    ensureSettings(),
  ])
  sendSuccess(res, { ...invoice, payments, garage })
})

export const addPortalVehicle = asyncHandler(async (req: Request, res: Response) => {
  const id = customerId(req)
  const customer = await Customer.findById(id)
  if (!customer) throw new ApiError(404, 'Customer profile not found')
  const plate = String(req.body.licensePlate).toUpperCase().replace(/\s+/g, '')
  const taken = await Vehicle.findOne({ licensePlate: plate })
  if (taken) throw new ApiError(409, 'A vehicle with this plate is already registered')
  const vehicle = await Vehicle.create({
    customer: customer._id,
    customerName: customer.name,
    make: req.body.make,
    model: req.body.model,
    year: req.body.year,
    licensePlate: plate,
    mileage: req.body.mileage ?? 0,
    fuelType: req.body.fuelType,
    transmission: req.body.transmission,
  })
  customer.vehicleCount = await Vehicle.countDocuments({ customer: customer._id })
  await customer.save()
  emitOperational(Events.vehicleCreated, { id: vehicle._id })
  await writeAudit(req, 'CREATE', 'Vehicle', `${customer.name} added ${vehicle.licensePlate}`, vehicle._id.toString())
  sendSuccess(res, vehicle, 'Vehicle added', 201)
})

export const bookAppointment = asyncHandler(async (req: Request, res: Response) => {
  const id = customerId(req)
  const customer = await Customer.findById(id)
  if (!customer) throw new ApiError(404, 'Customer profile not found')
  const vehicle = await Vehicle.findById(req.body.vehicleId)
  if (!vehicle || vehicle.customer.toString() !== customer._id.toString()) {
    throw new ApiError(400, 'Choose one of your vehicles')
  }
  const preferred = new Date(req.body.preferredDate)
  if (Number.isNaN(preferred.getTime())) throw new ApiError(400, 'Choose a valid date')
  const services = await Service.find({ _id: { $in: req.body.serviceIds }, isActive: true })
  if (!services.length) throw new ApiError(400, 'Choose at least one available service')
  const opened = new Date()
  const stamp = `${opened.getFullYear()}${String(opened.getMonth() + 1).padStart(2, '0')}${String(opened.getDate()).padStart(2, '0')}`
  const seq = await nextSequence(`request-${stamp}`)
  const requestNumber = `SR-${stamp}-${String(seq).padStart(6, '0')}`
  const note = req.body.notes ? String(req.body.notes) : 'Booked from the customer portal.'
  const doc = await ServiceRequest.create({
    requestNumber,
    customer: customer._id,
    customerName: customer.name,
    vehicle: vehicle._id,
    vehicleLabel: `${vehicle.make} ${vehicle.model} · ${vehicle.licensePlate}`,
    licensePlate: vehicle.licensePlate,
    description: note,
    priority: 'medium',
    status: 'pending',
    estimatedCost: roundMoney(services.reduce((sum, service) => sum + service.basePrice, 0)),
    estimatedCompletion: preferred,
    createdBy: req.user!.id,
    createdByName: req.user!.name,
    mileageAtService: vehicle.mileage,
    actualCost: roundMoney(services.reduce((sum, service) => sum + service.basePrice, 0)),
    services: services.map((service) => ({ service: service._id, name: service.name, quantity: 1, unitPrice: service.basePrice })),
  })
  vehicle.lastServiceAt = new Date()
  await vehicle.save()
  await writeAudit(req, 'CREATE', 'ServiceRequest', `Customer booked ${doc.requestNumber}`, doc._id.toString())
  emitOperational(Events.requestCreated, { id: doc._id, requestNumber: doc.requestNumber, status: doc.status })
  await notifyRoles(['ADMIN', 'MANAGER', 'RECEPTIONIST'], {
    title: 'Appointment booked',
    message: `${customer.name} booked ${doc.requestNumber} for ${doc.vehicleLabel}.`,
    type: 'service-request',
    link: `/service-requests/${doc._id}`,
    entityId: doc._id,
    entityType: 'ServiceRequest',
  })
  if (customer.email) {
    void deliverEmail({
      to: customer.email,
      subject: `Appointment ${doc.requestNumber}`,
      title: 'Your service appointment is booked',
      intro: `Hello ${customer.name}, the workshop has your appointment. We will confirm it on the desk.`,
      rows: [
        { label: 'Request', value: doc.requestNumber },
        { label: 'Vehicle', value: doc.vehicleLabel },
        { label: 'Preferred date', value: preferred.toDateString() },
        { label: 'Services', value: services.map((service) => service.name).join(', ') },
      ],
      template: 'appointment-booked',
      flag: 'serviceRequest',
      relatedModel: 'ServiceRequest',
      relatedId: doc._id.toString(),
    })
  }
  sendSuccess(res, doc, 'Appointment booked', 201)
})
