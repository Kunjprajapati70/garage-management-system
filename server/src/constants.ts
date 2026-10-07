export const ROLES = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'MECHANIC', 'CUSTOMER'] as const
export type Role = (typeof ROLES)[number]

export const REQUEST_STATUSES = [
  'pending',
  'diagnosing',
  'waiting_for_parts',
  'in_progress',
  'completed',
  'cancelled',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export const INVOICE_STATUSES = ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank'] as const

export const MECHANIC_STATUSES = ['available', 'busy', 'off_duty'] as const

export const STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ['diagnosing', 'cancelled'],
  diagnosing: ['waiting_for_parts', 'in_progress', 'cancelled'],
  waiting_for_parts: ['diagnosing', 'in_progress', 'cancelled'],
  in_progress: ['waiting_for_parts', 'completed', 'cancelled'],
  completed: ['in_progress'],
  cancelled: ['pending'],
}

export const Events = {
  customerCreated: 'customer:created',
  customerUpdated: 'customer:updated',
  vehicleCreated: 'vehicle:created',
  vehicleUpdated: 'vehicle:updated',
  requestCreated: 'serviceRequest:created',
  requestUpdated: 'serviceRequest:updated',
  requestAssigned: 'serviceRequest:assigned',
  requestStatus: 'serviceRequest:status',
  requestParts: 'serviceRequest:parts',
  billingUpdated: 'billing:updated',
  invoiceCreated: 'invoice:created',
  notificationCreated: 'notification:created',
  dashboardUpdated: 'dashboard:updated',
  serviceCreated: 'service:created',
  serviceUpdated: 'service:updated',
  partsUpdated: 'parts:updated',
} as const
