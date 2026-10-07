export type Role = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'MECHANIC' | 'CUSTOMER'

export interface User {
  _id: string
  name: string
  email: string
  phone?: string
  role: Role
  isActive: boolean
  avatarUrl?: string
  lastLoginAt?: string
}

export interface Meta {
  page: number
  limit: number
  total: number
  totalPages: number
  unread?: number
}

export interface Customer {
  _id: string
  name: string
  email?: string
  phone: string
  alternatePhone?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  notes?: string
  vehicleCount: number
  isActive: boolean
  createdAt: string
  vehicles?: Vehicle[]
  requests?: ServiceRequest[]
}

export interface Vehicle {
  _id: string
  customer: string
  customerName: string
  make: string
  model: string
  year: number
  color?: string
  licensePlate: string
  vin?: string
  mileage: number
  fuelType: string
  transmission: string
  notes?: string
  lastServiceAt?: string
  createdAt: string
  history?: ServiceRequest[]
}

export interface Mechanic {
  _id: string
  user: string
  name: string
  email: string
  phone?: string
  employeeId: string
  specialization: string
  experienceYears: number
  hourlyRate: number
  status: 'available' | 'busy' | 'off_duty'
  activeJobs: number
  completedJobs?: number
  jobs?: ServiceRequest[]
}

export interface CatalogService {
  _id: string
  name: string
  description?: string
  category: string
  basePrice: number
  estimatedHours: number
  isActive: boolean
}

export interface Part {
  _id: string
  sku: string
  name: string
  description?: string
  category: string
  quantity: number
  minStock: number
  unitPrice: number
  supplier?: string
  location?: string
  isActive: boolean
}

export interface LineItem {
  _id: string
  name: string
  sku?: string
  quantity: number
  unitPrice: number
  service?: string
  part?: string
}

export interface Note {
  _id: string
  text: string
  authorName: string
  createdAt: string
}

export interface ServiceRequest {
  _id: string
  requestNumber: string
  customer: string
  customerName: string
  vehicle: string
  vehicleLabel: string
  licensePlate: string
  assignedMechanic?: string
  mechanicName?: string
  description: string
  diagnosis?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'diagnosing' | 'waiting_for_parts' | 'in_progress' | 'completed' | 'cancelled'
  estimatedCost: number
  actualCost: number
  estimatedCompletion?: string
  completedAt?: string
  services?: LineItem[]
  parts?: LineItem[]
  notes?: Note[]
  createdByName?: string
  mileageAtService?: number
  createdAt: string
  updatedAt: string
}

export interface InvoiceItem {
  kind: 'service' | 'part'
  name: string
  sku?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface Payment {
  _id: string
  amount: number
  method: 'cash' | 'card' | 'upi' | 'bank'
  reference?: string
  paidAt: string
  receivedByName?: string
}

export interface Invoice {
  _id: string
  invoiceNumber: string
  serviceRequest?: string
  requestNumber?: string
  customer: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  vehicleLabel?: string
  items: InvoiceItem[]
  subtotal: number
  taxRate: number
  taxAmount: number
  discount: number
  total: number
  amountPaid: number
  balance: number
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled'
  dueDate: string
  issuedAt: string
  notes?: string
  payments?: Payment[]
  garage?: WorkshopSettings
}

export interface WorkshopSettings {
  garageName: string
  tagline?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  gstin?: string
  taxPercent: number
  currency: string
  logoUrl?: string
  emailNotifications: {
    welcome: boolean
    serviceRequest: boolean
    assignment: boolean
    status: boolean
    completed: boolean
    invoice: boolean
  }
  smtp?: {
    configured: boolean
    host: string
    port: number
    secure: boolean
    fromName: string
    fromEmail: string
    userConfigured: boolean
    missing: string[]
  }
}

export interface AppNotification {
  _id: string
  title: string
  message: string
  type: string
  link?: string
  read: boolean
  createdAt: string
}

export interface AuditEntry {
  _id: string
  userName?: string
  role?: string
  action: string
  entity: string
  entityId?: string
  summary: string
  ip?: string
  createdAt: string
}

export interface EmailEntry {
  _id: string
  to: string
  subject: string
  template: string
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  preview?: string
  createdAt: string
}

export interface DashboardData {
  financial: boolean
  cards: {
    customers: number
    vehicles: number
    activeRequests: number
    pending: number
    inProgress: number
    diagnosing: number
    waitingForParts: number
    completed: number
    cancelled: number
    availableMechanics: number
    busyMechanics: number
    todayRevenue: number
    monthlyRevenue: number
    outstanding: number
    lowStock: number
  }
  statusBreakdown: { status: string; label: string; count: number }[]
  revenueTrend: { month: string; revenue: number }[]
  mechanicWorkload: { name: string; assigned: number }[]
  monthlyServices: { month: string; completed: number }[]
  recentRequests: ServiceRequest[]
  recentActivity: AuditEntry[]
}

export interface ReportSuite {
  mechanicPerformance: { name: string; completed: number }[]
  customers: { name: string; requests: number; spend: number }[]
  vehiclesByMake: { make: string; services: number }[]
  partsUsage: { name: string; quantity: number }[]
  outstanding: {
    _id: string
    invoiceNumber: string
    customerName: string
    balance: number
    status: string
    dueDate: string
    total: number
  }[]
}
