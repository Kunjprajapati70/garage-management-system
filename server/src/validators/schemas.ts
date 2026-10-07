import { z } from 'zod'
import { INVOICE_STATUSES, PAYMENT_METHODS, PRIORITIES, REQUEST_STATUSES } from '../constants.js'

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(300).default(20),
  sort: z.string().optional(),
  search: z.string().trim().max(100).optional().or(z.literal('')),
})

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
  password: passwordSchema,
})

export const portalVehicleSchema = z.object({
  make: z.string().trim().min(2).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(2100),
  licensePlate: z.string().trim().min(4).max(20),
  fuelType: z.enum(['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid']).default('Petrol'),
  transmission: z.enum(['Manual', 'Automatic']).default('Manual'),
  mileage: z.coerce.number().min(0).default(0),
})

export const appointmentSchema = z.object({
  vehicleId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1, 'Choose at least one service'),
  preferredDate: z.string().min(8),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
})

export const forgotSchema = z.object({ email: z.string().trim().email() })

export const resetSchema = z.object({
  token: z.string().min(10),
  password: passwordSchema,
})

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal('')),
})

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

export const userCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20).optional().or(z.literal('')),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC']),
  isActive: z.boolean().default(true),
  specialization: z.string().trim().max(80).optional(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
})

export const userUpdateSchema = userCreateSchema.partial().omit({ password: true }).extend({
  password: passwordSchema.optional(),
})

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(140),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().min(8).max(20),
  alternatePhone: z.string().trim().max(20).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  postalCode: z.string().trim().max(12).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export const vehicleSchema = z.object({
  customer: z.string().min(1),
  make: z.string().trim().min(2).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.coerce.number().int().min(1980).max(2100),
  color: z.string().trim().max(40).optional().or(z.literal('')),
  licensePlate: z.string().trim().min(4).max(16),
  vin: z.string().trim().max(17).optional().or(z.literal('')),
  mileage: z.coerce.number().min(0).default(0),
  fuelType: z.enum(['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid']),
  transmission: z.enum(['Manual', 'Automatic']),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
})

export const mechanicCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8).max(20),
  password: passwordSchema,
  specialization: z.string().trim().min(2).max(80).default('General Service'),
  experienceYears: z.coerce.number().min(0).max(60).default(1),
  hourlyRate: z.coerce.number().min(0).default(450),
})

export const mechanicUpdateSchema = z.object({
  specialization: z.string().trim().min(2).max(80),
  experienceYears: z.coerce.number().min(0).max(60),
  hourlyRate: z.coerce.number().min(0),
  status: z.enum(['available', 'busy', 'off_duty']),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
})

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  category: z.string().trim().min(2).max(80),
  basePrice: z.coerce.number().min(0),
  estimatedHours: z.coerce.number().min(0),
  isActive: z.boolean().optional(),
})

export const partSchema = z.object({
  sku: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  category: z.string().trim().min(2).max(80),
  quantity: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  unitPrice: z.coerce.number().min(0),
  supplier: z.string().trim().max(120).optional().or(z.literal('')),
  location: z.string().trim().max(80).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
}).transform((body) => ({
  ...body,
  minStock: body.minStock ?? body.lowStockThreshold ?? 5,
}))

export const stockAdjustSchema = z.object({
  quantity: z.coerce.number().int(),
  reason: z.string().trim().min(3).max(200),
})

export const requestSchema = z.object({
  customer: z.string().min(1),
  vehicle: z.string().min(1),
  description: z.string().trim().min(5).max(4000),
  priority: z.enum(PRIORITIES).default('medium'),
  estimatedCost: z.coerce.number().min(0).optional(),
  estimatedCompletion: z.string().datetime().optional().or(z.literal('')),
  assignedMechanic: z.string().optional().or(z.literal('')),
})

export const requestUpdateSchema = z.object({
  description: z.string().trim().min(5).max(4000).optional(),
  diagnosis: z.string().trim().max(4000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  estimatedCompletion: z.string().optional().or(z.literal('')),
})

const statusValues = [...REQUEST_STATUSES, 'waiting_parts'] as const

export const statusSchema = z.object({
  status: z.enum(statusValues).transform((value) => (value === 'waiting_parts' ? 'waiting_for_parts' : value)),
  note: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const assignSchema = z.object({ mechanicId: z.string().min(1) })

export const noteSchema = z.object({ text: z.string().trim().min(2).max(2000) })

export const serviceLineSchema = z.object({
  serviceId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  unitPrice: z.coerce.number().min(0).optional(),
})

export const partLineSchema = z.object({
  partId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100),
  unitPrice: z.coerce.number().min(0).optional(),
})

export const messageSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(5).max(4000),
})

export const invoiceCreateSchema = z.object({
  serviceRequestId: z.string().min(1),
  discount: z.coerce.number().min(0).default(0),
  dueInDays: z.coerce.number().int().min(0).max(90).default(7),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const paymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80).optional().or(z.literal('')),
  paidAt: z.string().optional(),
})

export const settingsSchema = z.object({
  garageName: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(180).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  gstin: z.string().trim().max(20).optional().or(z.literal('')),
  taxPercent: z.coerce.number().min(0).max(28),
  emailNotifications: z.object({
    welcome: z.boolean(),
    serviceRequest: z.boolean(),
    assignment: z.boolean(),
    status: z.boolean(),
    completed: z.boolean(),
    invoice: z.boolean(),
  }),
})

export const testEmailSchema = z
  .object({
    to: z.string().trim().email().optional(),
    recipientEmail: z.string().trim().email().optional(),
  })
  .refine((value) => Boolean(value.to || value.recipientEmail), { message: 'Enter a recipient email', path: ['recipientEmail'] })
  .transform((value) => ({ to: (value.to || value.recipientEmail) as string }))

export const reportQuerySchema = paginationSchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
})

export const listQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  priority: z.string().optional(),
  city: z.string().optional(),
  customer: z.string().optional(),
  make: z.string().trim().max(60).optional(),
  plate: z.string().trim().max(16).optional(),
  vin: z.string().trim().max(17).optional(),
  vehicle: z.string().optional(),
  mechanic: z.string().optional(),
  category: z.string().optional(),
  active: z.string().optional(),
  lowStock: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  action: z.string().optional(),
  entity: z.string().optional(),
  template: z.string().optional(),
  unread: z.string().optional(),
  sortBy: z.string().trim().max(40).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).transform((query) => {
  const sort = query.sort || (query.sortBy ? `${query.sortOrder === 'asc' ? '' : '-'}${query.sortBy}` : undefined)
  return { ...query, sort, from: query.from || query.startDate, to: query.to || query.endDate }
})

export { INVOICE_STATUSES }
