import { Router } from 'express'
import { authorize, requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { avatarUpload, logoUpload } from '../middleware/upload.js'
import * as auth from '../controllers/auth.controller.js'
import * as users from '../controllers/users.controller.js'
import * as customers from '../controllers/customers.controller.js'
import * as vehicles from '../controllers/vehicles.controller.js'
import * as mechanics from '../controllers/mechanics.controller.js'
import * as catalog from '../controllers/catalog.controller.js'
import * as requests from '../controllers/requests.controller.js'
import * as invoices from '../controllers/invoices.controller.js'
import * as reports from '../controllers/reports.controller.js'
import * as system from '../controllers/system.controller.js'
import * as portal from '../controllers/portal.controller.js'
import {
  appointmentSchema,
  assignSchema,
  customerSchema,
  forgotSchema,
  invoiceCreateSchema,
  listQuerySchema,
  loginSchema,
  mechanicCreateSchema,
  mechanicUpdateSchema,
  messageSchema,
  noteSchema,
  partLineSchema,
  partSchema,
  portalVehicleSchema,
  passwordChangeSchema,
  paymentSchema,
  profileSchema,
  registerSchema,
  requestSchema,
  requestUpdateSchema,
  resetSchema,
  serviceLineSchema,
  serviceSchema,
  settingsSchema,
  statusSchema,
  stockAdjustSchema,
  testEmailSchema,
  userCreateSchema,
  userUpdateSchema,
  vehicleSchema,
} from '../validators/schemas.js'

const staff = ['ADMIN', 'MANAGER', 'RECEPTIONIST'] as const
const catalogEditors = ['ADMIN', 'MANAGER'] as const
const billing = ['ADMIN', 'MANAGER', 'RECEPTIONIST'] as const
const readers = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'] as const

export const api = Router()

api.get('/health', (_req, res) => {
  res.json({ success: true, message: 'OK', data: { service: 'apex-motors-api' } })
})

const authRouter = Router()
authRouter.post('/register', validate(registerSchema), auth.register)
authRouter.post('/login', validate(loginSchema), auth.login)
authRouter.post('/refresh', auth.refresh)
authRouter.post('/forgot-password', validate(forgotSchema), auth.forgotPassword)
authRouter.post('/reset-password', validate(resetSchema), auth.resetPassword)
authRouter.post('/logout', requireAuth, auth.logout)
authRouter.get('/me', requireAuth, auth.me)
authRouter.put('/profile', requireAuth, validate(profileSchema), auth.updateProfile)
authRouter.put('/password', requireAuth, validate(passwordChangeSchema), auth.changePassword)
authRouter.post('/avatar', requireAuth, avatarUpload.single('avatar'), auth.uploadAvatar)
api.use('/auth', authRouter)

api.get('/settings/public', system.publicSettings)

api.get('/portal', requireAuth, authorize('CUSTOMER'), portal.portalHome)
api.post('/portal/vehicles', requireAuth, authorize('CUSTOMER'), validate(portalVehicleSchema), portal.addPortalVehicle)
api.post('/portal/appointments', requireAuth, authorize('CUSTOMER'), validate(appointmentSchema), portal.bookAppointment)
api.get('/portal/appointments/:id', requireAuth, authorize('CUSTOMER'), portal.portalRequest)
api.post('/portal/appointments/:id/cancel', requireAuth, authorize('CUSTOMER'), portal.cancelPortalRequest)
api.get('/portal/invoices/:id', requireAuth, authorize('CUSTOMER'), portal.portalInvoice)

api.use(requireAuth)

api.get('/search', system.search)
api.get('/reports/overview', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'), reports.overview)
api.get('/reports/suite', authorize('ADMIN', 'MANAGER'), reports.suite)
api.get('/reports/revenue', authorize('ADMIN', 'MANAGER'), reports.revenueReport)
api.get('/reports/services', authorize('ADMIN', 'MANAGER'), reports.servicesReport)
api.get('/reports/mechanics', authorize('ADMIN', 'MANAGER'), reports.mechanicsReport)
api.get('/reports/customers', authorize('ADMIN', 'MANAGER'), reports.customersReport)
api.get('/reports/vehicles', authorize('ADMIN', 'MANAGER'), reports.vehiclesReport)
api.get('/reports/parts', authorize('ADMIN', 'MANAGER'), reports.partsReport)
api.get('/reports/payments', authorize('ADMIN', 'MANAGER'), reports.paymentsReport)
api.get('/dashboard/stats', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'), reports.dashboardStats)

api.get('/users', authorize('ADMIN'), validate(listQuerySchema, 'query'), users.listUsers)
api.post('/users', authorize('ADMIN'), validate(userCreateSchema), users.createUser)
api.put('/users/:id', authorize('ADMIN'), validate(userUpdateSchema), users.updateUser)
api.delete('/users/:id', authorize('ADMIN'), users.deactivateUser)

api.get('/customers', authorize(...staff), validate(listQuerySchema, 'query'), customers.listCustomers)
api.post('/customers', authorize(...staff), validate(customerSchema), customers.createCustomer)
api.get('/customers/:id', authorize(...staff), customers.getCustomer)
api.put('/customers/:id', authorize(...staff), validate(customerSchema), customers.updateCustomer)
api.delete('/customers/:id', authorize('ADMIN', 'MANAGER'), customers.deleteCustomer)
api.post('/customers/:id/email', authorize(...staff), validate(messageSchema), customers.emailCustomer)

api.get('/vehicles', authorize(...readers), validate(listQuerySchema, 'query'), vehicles.listVehicles)
api.post('/vehicles', authorize(...staff), validate(vehicleSchema), vehicles.createVehicle)
api.get('/vehicles/:id', authorize(...readers), vehicles.getVehicle)
api.put('/vehicles/:id', authorize(...staff), validate(vehicleSchema), vehicles.updateVehicle)
api.delete('/vehicles/:id', authorize('ADMIN', 'MANAGER'), vehicles.deleteVehicle)

api.get('/mechanics/options', authorize(...staff), mechanics.mechanicOptions)
api.get('/mechanics', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST'), validate(listQuerySchema, 'query'), mechanics.listMechanics)
api.post('/mechanics', authorize('ADMIN'), validate(mechanicCreateSchema), mechanics.createMechanic)
api.get('/mechanics/:id/jobs', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'), validate(listQuerySchema, 'query'), mechanics.listJobs)
api.get('/mechanics/:id', authorize('ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC'), mechanics.getMechanic)
api.put('/mechanics/:id', authorize('ADMIN', 'MANAGER'), validate(mechanicUpdateSchema), mechanics.updateMechanic)
api.delete('/mechanics/:id', authorize('ADMIN', 'MANAGER'), mechanics.deactivateMechanic)

api.get('/catalog/categories', authorize(...readers), catalog.catalogCategories)
api.get('/services', authorize(...readers), validate(listQuerySchema, 'query'), catalog.listServices)
api.post('/services', authorize(...catalogEditors), validate(serviceSchema), catalog.createService)
api.put('/services/:id', authorize(...catalogEditors), validate(serviceSchema), catalog.updateService)
api.delete('/services/:id', authorize('ADMIN'), catalog.deleteService)

api.get('/parts', authorize(...readers), validate(listQuerySchema, 'query'), catalog.listParts)
api.post('/parts', authorize(...catalogEditors), validate(partSchema), catalog.createPart)
api.put('/parts/:id', authorize(...catalogEditors), validate(partSchema), catalog.updatePart)
api.post('/parts/:id/stock', authorize(...catalogEditors), validate(stockAdjustSchema), catalog.adjustStock)
api.delete('/parts/:id', authorize('ADMIN'), catalog.deletePart)

api.get('/service-requests', authorize(...readers), validate(listQuerySchema, 'query'), requests.listRequests)
api.post('/service-requests', authorize(...staff), validate(requestSchema), requests.createRequest)
api.get('/service-requests/:id', authorize(...readers), requests.getRequest)
api.put('/service-requests/:id', authorize(...readers), validate(requestUpdateSchema), requests.updateRequest)
api.delete('/service-requests/:id', authorize('ADMIN', 'MANAGER'), requests.deleteRequest)
api.patch('/service-requests/:id/status', authorize(...readers), validate(statusSchema), requests.changeStatus)
api.patch('/service-requests/:id/assign', authorize(...staff), validate(assignSchema), requests.assignMechanic)
api.post('/service-requests/:id/notes', authorize(...readers), validate(noteSchema), requests.addNote)
api.post('/service-requests/:id/services', authorize(...readers), validate(serviceLineSchema), requests.addServiceLine)
api.delete('/service-requests/:id/services/:lineId', authorize(...readers), requests.removeServiceLine)
api.post('/service-requests/:id/parts', authorize(...readers), validate(partLineSchema), requests.addPartLine)
api.delete('/service-requests/:id/parts/:lineId', authorize(...readers), requests.removePartLine)
api.post('/service-requests/:id/notify', authorize(...staff), validate(messageSchema), requests.notifyCustomer)

api.get('/invoices', authorize(...billing), validate(listQuerySchema, 'query'), invoices.listInvoices)
api.post('/invoices', authorize(...billing), validate(invoiceCreateSchema), invoices.createInvoice)
api.get('/invoices/:id', authorize(...billing), invoices.getInvoice)
api.post('/invoices/:id/payments', authorize(...billing), validate(paymentSchema), invoices.recordPayment)
api.post('/invoices/:id/email', authorize(...billing), invoices.emailInvoice)
api.post('/invoices/:id/cancel', authorize('ADMIN', 'MANAGER'), invoices.cancelInvoice)

api.get('/notifications', validate(listQuerySchema, 'query'), system.listNotifications)
api.patch('/notifications/read-all', system.markAllRead)
api.patch('/notifications/:id/read', system.markRead)
api.get('/audit-logs', authorize('ADMIN'), validate(listQuerySchema, 'query'), system.listAudit)

api.get('/settings', authorize('ADMIN'), system.getSettings)
api.put('/settings', authorize('ADMIN'), validate(settingsSchema), system.updateSettings)
api.post('/settings/logo', authorize('ADMIN'), logoUpload.single('logo'), system.uploadLogo)
api.post('/settings/email/test', authorize('ADMIN'), validate(testEmailSchema), system.testEmail)
api.get('/email-logs', authorize('ADMIN'), validate(listQuerySchema, 'query'), system.listEmails)
