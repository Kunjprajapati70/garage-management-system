import type { Request, Response } from 'express'
import { Customer } from '../models/Customer.js'
import { Vehicle } from '../models/Vehicle.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Mechanic } from '../models/Mechanic.js'
import { Invoice, Payment } from '../models/Invoice.js'
import { Part } from '../models/Part.js'
import { AuditLog } from '../models/Notification.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { lastMonths, monthsBetween, startOfDay, startOfMonth } from '../utils/helpers.js'
import { REQUEST_STATUSES } from '../constants.js'

function sum(rows: { total?: number }[]) {
  return rows[0]?.total || 0
}

export const overview = asyncHandler(async (req: Request, res: Response) => {
  const role = req.user!.role
  const financial = role === 'ADMIN' || role === 'MANAGER'
  const mechanicScope = role === 'MECHANIC' ? { assignedMechanic: req.user!.mechanicId } : {}
  const fallback = lastMonths(12)
  const queryFrom = typeof req.query.from === 'string' ? new Date(req.query.from) : fallback[0].start
  const queryTo = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date()
  const months = Number.isNaN(queryFrom.getTime()) || Number.isNaN(queryTo.getTime()) ? fallback : monthsBetween(queryFrom, queryTo)
  const rangeStart = months[0]?.start || fallback[0].start
  const rangeEnd = Number.isNaN(queryTo.getTime()) ? new Date() : queryTo
  const requestMatch = { ...mechanicScope }

  const [
    customers,
    vehicles,
    pending,
    diagnosing,
    waiting,
    inProgress,
    completed,
    cancelled,
    availableMechanics,
    busyMechanics,
    todayRevenue,
    monthRevenue,
    outstanding,
    lowStock,
    statusRows,
    workloadRows,
    revenueRows,
    completedRows,
    recentRequests,
    recentActivity,
  ] = await Promise.all([
    role === 'MECHANIC' ? Promise.resolve(0) : Customer.countDocuments({ isActive: true }),
    role === 'MECHANIC'
      ? ServiceRequest.distinct('vehicle', mechanicScope).then((ids) => ids.length)
      : Vehicle.countDocuments(),
    ServiceRequest.countDocuments({ ...requestMatch, status: 'pending' }),
    ServiceRequest.countDocuments({ ...requestMatch, status: 'diagnosing' }),
    ServiceRequest.countDocuments({ ...requestMatch, status: 'waiting_for_parts' }),
    ServiceRequest.countDocuments({ ...requestMatch, status: 'in_progress' }),
    ServiceRequest.countDocuments({ ...requestMatch, status: 'completed' }),
    ServiceRequest.countDocuments({ ...requestMatch, status: 'cancelled' }),
    financial ? Mechanic.countDocuments({ status: 'available' }) : Promise.resolve(0),
    financial ? Mechanic.countDocuments({ status: 'busy' }) : Promise.resolve(0),
    financial
      ? Payment.aggregate<{ total: number }>([{ $match: { paidAt: { $gte: startOfDay() } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
      : Promise.resolve([]),
    financial
      ? Payment.aggregate<{ total: number }>([{ $match: { paidAt: { $gte: startOfMonth() } } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
      : Promise.resolve([]),
    financial
      ? Invoice.aggregate<{ total: number }>([
          { $match: { status: { $nin: ['paid', 'cancelled'] } } },
          { $group: { _id: null, total: { $sum: '$balance' } } },
        ])
      : Promise.resolve([]),
    financial ? Part.countDocuments({ isActive: true, $expr: { $lte: ['$quantity', '$minStock'] } }) : Promise.resolve(0),
    ServiceRequest.aggregate<{ _id: string; count: number }>([{ $match: requestMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    financial
      ? ServiceRequest.aggregate<{ _id: string; assigned: number }>([
          { $match: { assignedMechanic: { $ne: null }, status: { $nin: ['completed', 'cancelled'] } } },
          { $group: { _id: '$mechanicName', assigned: { $sum: 1 } } },
          { $sort: { assigned: -1 } },
          { $limit: 8 },
        ])
      : Promise.resolve([]),
    financial
      ? Payment.aggregate<{ _id: string; revenue: number }>([
          { $match: { paidAt: { $gte: rangeStart, $lte: rangeEnd } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, revenue: { $sum: '$amount' } } },
        ])
      : Promise.resolve([]),
    ServiceRequest.aggregate<{ _id: string; count: number }>([
      { $match: { ...requestMatch, status: 'completed', completedAt: { $gte: rangeStart, $lte: rangeEnd } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } }, count: { $sum: 1 } } },
    ]),
    ServiceRequest.find(requestMatch).sort('-createdAt').limit(6).select('requestNumber customerName vehicleLabel status priority createdAt').lean(),
    AuditLog.find(role === 'MECHANIC' ? { user: req.user!.id } : {}).sort('-createdAt').limit(8).lean(),
  ])

  const statusMap = new Map(statusRows.map((row) => [row._id, row.count]))
  const revenueMap = new Map(revenueRows.map((row) => [row._id, row.revenue]))
  const completedMap = new Map(completedRows.map((row) => [row._id, row.count]))

  sendSuccess(res, {
    financial,
    cards: {
      customers,
      vehicles,
      activeRequests: pending + diagnosing + waiting + inProgress,
      pending,
      inProgress,
      diagnosing,
      waitingForParts: waiting,
      completed,
      cancelled,
      availableMechanics,
      busyMechanics,
      todayRevenue: sum(todayRevenue),
      monthlyRevenue: sum(monthRevenue),
      outstanding: sum(outstanding),
      lowStock,
    },
    statusBreakdown: REQUEST_STATUSES.map((status) => ({
      status,
      label: status.replaceAll('_', ' '),
      count: statusMap.get(status) || 0,
    })),
    revenueTrend: months.map((month) => ({
      month: month.label,
      revenue: Math.round(revenueMap.get(month.key) || 0),
    })),
    mechanicWorkload: workloadRows.map((row) => ({ name: row._id || 'Unassigned', assigned: row.assigned })),
    monthlyServices: months.map((month) => ({
      month: month.label,
      completed: completedMap.get(month.key) || 0,
    })),
    recentRequests,
    recentActivity,
  })
})

function reportRange(query: { from?: string; to?: string }) {
  const fallbackFrom = new Date()
  fallbackFrom.setMonth(fallbackFrom.getMonth() - 11)
  fallbackFrom.setDate(1)
  fallbackFrom.setHours(0, 0, 0, 0)
  const from = query.from ? new Date(query.from) : fallbackFrom
  const to = query.to ? new Date(query.to) : new Date()
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) to.setHours(23, 59, 59, 999)
  return {
    start: Number.isNaN(from.getTime()) ? fallbackFrom : from,
    end: Number.isNaN(to.getTime()) ? new Date() : to,
  }
}

export const suite = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'MANAGER') {
    throw new ApiError(403, 'You do not have permission to perform this action')
  }
  const { start, end } = reportRange({ from: typeof req.query.from === 'string' ? req.query.from : undefined, to: typeof req.query.to === 'string' ? req.query.to : undefined })
  const created = { createdAt: { $gte: start, $lte: end } }
  const [mechanics, customers, vehicles, parts, outstanding] = await Promise.all([
    ServiceRequest.aggregate<{ _id: string; completed: number }>([
      { $match: { status: 'completed', completedAt: { $gte: start, $lte: end }, mechanicName: { $nin: [null, ''] } } },
      { $group: { _id: '$mechanicName', completed: { $sum: 1 } } },
      { $sort: { completed: -1 } },
      { $limit: 12 },
    ]),
    ServiceRequest.aggregate<{ _id: string; requests: number; spend: number }>([
      { $match: created },
      { $group: { _id: '$customerName', requests: { $sum: 1 }, spend: { $sum: '$actualCost' } } },
      { $sort: { requests: -1 } },
      { $limit: 10 },
    ]),
    ServiceRequest.aggregate<{ _id: string; services: number }>([
      { $match: created },
      { $lookup: { from: 'vehicles', localField: 'vehicle', foreignField: '_id', as: 'vehicleDoc' } },
      { $unwind: '$vehicleDoc' },
      { $group: { _id: '$vehicleDoc.make', services: { $sum: 1 } } },
      { $sort: { services: -1 } },
      { $limit: 10 },
    ]),
    ServiceRequest.aggregate<{ _id: string; quantity: number }>([
      { $match: created },
      { $unwind: '$parts' },
      { $group: { _id: '$parts.name', quantity: { $sum: '$parts.quantity' } } },
      { $sort: { quantity: -1 } },
      { $limit: 12 },
    ]),
    Invoice.find({ status: { $in: ['issued', 'partial', 'overdue'] }, issuedAt: { $gte: start, $lte: end } })
      .sort('-balance')
      .limit(12)
      .select('invoiceNumber customerName balance status dueDate total')
      .lean(),
  ])

  sendSuccess(res, {
    mechanicPerformance: mechanics.map((row) => ({ name: row._id || 'Unassigned', completed: row.completed })),
    customers: customers.map((row) => ({ name: row._id || 'Unknown', requests: row.requests, spend: Math.round(row.spend || 0) })),
    vehiclesByMake: vehicles.map((row) => ({ make: row._id || 'Unknown', services: row.services })),
    partsUsage: parts.map((row) => ({ name: row._id || 'Part', quantity: row.quantity })),
    outstanding: outstanding.map((row) => ({
      _id: String(row._id),
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      balance: row.balance,
      status: row.status,
      dueDate: row.dueDate,
      total: row.total,
    })),
  })
})

function chartRange(req: Request) {
  const from = typeof req.query.startDate === 'string' ? req.query.startDate : typeof req.query.from === 'string' ? req.query.from : undefined
  const to = typeof req.query.endDate === 'string' ? req.query.endDate : typeof req.query.to === 'string' ? req.query.to : undefined
  return reportRange({ from, to })
}

export const dashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const role = req.user!.role
  const financial = role === 'ADMIN' || role === 'MANAGER'
  const mechanicScope = role === 'MECHANIC' ? { assignedMechanic: req.user!.mechanicId } : {}
  const [customers, vehicles, pending, diagnosing, waiting, inProgress, completed, availableMechanics, busyMechanics, todayRevenue, monthRevenue, outstanding, recentServices, recentActivity] = await Promise.all([
    role === 'MECHANIC' ? Promise.resolve(0) : Customer.countDocuments({ isActive: true }),
    role === 'MECHANIC' ? ServiceRequest.distinct('vehicle', mechanicScope).then((ids) => ids.length) : Vehicle.countDocuments(),
    ServiceRequest.countDocuments({ ...mechanicScope, status: 'pending' }),
    ServiceRequest.countDocuments({ ...mechanicScope, status: 'diagnosing' }),
    ServiceRequest.countDocuments({ ...mechanicScope, status: 'waiting_for_parts' }),
    ServiceRequest.countDocuments({ ...mechanicScope, status: 'in_progress' }),
    ServiceRequest.countDocuments({ ...mechanicScope, status: 'completed' }),
    financial ? Mechanic.countDocuments({ status: 'available' }) : Promise.resolve(0),
    financial ? Mechanic.countDocuments({ status: 'busy' }) : Promise.resolve(0),
    financial ? Payment.aggregate<{ total: number }>([{ $match: { paidAt: { $gte: startOfDay() } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]) : Promise.resolve([]),
    financial ? Payment.aggregate<{ total: number }>([{ $match: { paidAt: { $gte: startOfMonth() } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]) : Promise.resolve([]),
    financial ? Invoice.aggregate<{ total: number }>([{ $match: { status: { $nin: ['paid', 'cancelled'] } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]) : Promise.resolve([]),
    ServiceRequest.find(mechanicScope).sort('-createdAt').limit(6).select('requestNumber customerName vehicleLabel status priority createdAt').lean(),
    AuditLog.find(role === 'MECHANIC' ? { user: req.user!.id } : {}).sort('-createdAt').limit(8).select('summary userName action entity createdAt').lean(),
  ])
  sendSuccess(res, {
    totalCustomers: customers,
    totalVehicles: vehicles,
    activeServices: pending + diagnosing + waiting + inProgress,
    pendingServices: pending,
    completedServices: completed,
    availableMechanics,
    busyMechanics,
    todayRevenue: sum(todayRevenue),
    monthlyRevenue: sum(monthRevenue),
    outstandingPayments: sum(outstanding),
    recentServices,
    recentActivity,
  })
})

export const revenueReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const months = monthsBetween(start, end)
  const rows = await Payment.aggregate<{ _id: string; revenue: number }>([
    { $match: { paidAt: { $gte: start, $lte: end }, status: { $ne: 'failed' } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, revenue: { $sum: '$amount' } } },
  ])
  const map = new Map(rows.map((row) => [row._id, row.revenue]))
  sendSuccess(res, {
    xAxis: 'Month',
    yAxis: 'Revenue (₹)',
    series: months.map((month) => ({ label: month.label, revenue: Math.round(map.get(month.key) || 0) })),
  })
})

export const servicesReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const rows = await ServiceRequest.aggregate<{ _id: string; requests: number }>([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$status', requests: { $sum: 1 } } },
  ])
  const map = new Map(rows.map((row) => [row._id, row.requests]))
  sendSuccess(res, {
    xAxis: 'Status',
    yAxis: 'Number of Requests',
    series: REQUEST_STATUSES.map((status) => ({ label: status.replaceAll('_', ' '), requests: map.get(status) || 0 })),
  })
})

export const mechanicsReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const rows = await ServiceRequest.aggregate<{ _id: string; completed: number }>([
    { $match: { status: 'completed', completedAt: { $gte: start, $lte: end }, mechanicName: { $nin: [null, ''] } } },
    { $group: { _id: '$mechanicName', completed: { $sum: 1 } } },
    { $sort: { completed: -1 } },
    { $limit: 12 },
  ])
  sendSuccess(res, {
    xAxis: 'Mechanic',
    yAxis: 'Completed Jobs',
    series: rows.map((row) => ({ label: row._id, completed: row.completed })),
  })
})

export const customersReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const rows = await ServiceRequest.aggregate<{ _id: string; requests: number }>([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$customerName', requests: { $sum: 1 } } },
    { $sort: { requests: -1 } },
    { $limit: 10 },
  ])
  sendSuccess(res, {
    xAxis: 'Customer',
    yAxis: 'Number of Requests',
    series: rows.map((row) => ({ label: row._id, requests: row.requests })),
  })
})

export const vehiclesReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const rows = await ServiceRequest.aggregate<{ _id: string; requests: number }>([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $lookup: { from: 'vehicles', localField: 'vehicle', foreignField: '_id', as: 'vehicleDoc' } },
    { $unwind: '$vehicleDoc' },
    { $group: { _id: '$vehicleDoc.make', requests: { $sum: 1 } } },
    { $sort: { requests: -1 } },
    { $limit: 10 },
  ])
  sendSuccess(res, {
    xAxis: 'Make',
    yAxis: 'Number of Requests',
    series: rows.map((row) => ({ label: row._id, requests: row.requests })),
  })
})

export const partsReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const rows = await ServiceRequest.aggregate<{ _id: string; quantity: number }>([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $unwind: '$parts' },
    { $group: { _id: '$parts.name', quantity: { $sum: '$parts.quantity' } } },
    { $sort: { quantity: -1 } },
    { $limit: 12 },
  ])
  sendSuccess(res, {
    xAxis: 'Part Name',
    yAxis: 'Quantity Used',
    series: rows.map((row) => ({ label: row._id, quantity: row.quantity })),
  })
})

export const paymentsReport = asyncHandler(async (req: Request, res: Response) => {
  const { start, end } = chartRange(req)
  const months = monthsBetween(start, end)
  const rows = await Payment.aggregate<{ _id: string; amount: number }>([
    { $match: { paidAt: { $gte: start, $lte: end }, status: { $ne: 'failed' } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, amount: { $sum: '$amount' } } },
  ])
  const map = new Map(rows.map((row) => [row._id, row.amount]))
  sendSuccess(res, {
    xAxis: 'Month',
    yAxis: 'Payments (₹)',
    series: months.map((month) => ({ label: month.label, amount: Math.round(map.get(month.key) || 0) })),
  })
})
