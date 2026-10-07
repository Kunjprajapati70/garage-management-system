import request from 'supertest'
import { beforeAll, afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { createApp } from '../src/app.js'
import { User } from '../src/models/User.js'
import { Mechanic } from '../src/models/Mechanic.js'
import { Customer } from '../src/models/Customer.js'
import { Vehicle } from '../src/models/Vehicle.js'
import { Service } from '../src/models/Service.js'
import { Part } from '../src/models/Part.js'
import { clearCollections, startMemoryDb, stopMemoryDb } from './db.js'

const app = createApp()

async function makeUser(role: 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'MECHANIC', email: string) {
  const user = await User.create({
    name: role.toLowerCase(),
    email,
    password: 'Password@123',
    phone: `98${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    role,
    isActive: true,
  })
  if (role === 'MECHANIC') {
    await Mechanic.create({
      user: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      employeeId: `EMP-${email.slice(0, 4)}`,
      specialization: 'Brakes',
      experienceYears: 4,
      hourlyRate: 500,
      status: 'available',
    })
  }
  return user
}

describe('Apex Motors API', () => {
  beforeAll(async () => {
    await startMemoryDb()
  })

  afterAll(async () => {
    await stopMemoryDb()
  })

  beforeEach(async () => {
    await clearCollections()
  })

  it('returns a consistent validation error', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' })
    expect(response.status).toBe(400)
    expect(response.body.success).toBe(false)
    expect(Array.isArray(response.body.errors)).toBe(true)
  })

  it('registers a customer portal account that can sign in but not open the staff desk', async () => {
    const created = await request(app).post('/api/auth/register').send({
      name: 'New Customer',
      email: 'new@apexmotors.local',
      phone: '9811111111',
      password: 'Password@123',
    })
    expect(created.status).toBe(201)
    expect(created.body.data.role).toBe('CUSTOMER')
    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({ email: 'new@apexmotors.local', password: 'Password@123' })
    expect(login.status).toBe(200)
    const portal = await agent.get('/api/portal')
    expect(portal.status).toBe(200)
    expect(portal.body.data.customer.phone).toBe('9811111111')
    const users = await agent.get('/api/users')
    expect(users.status).toBe(403)
  })

  it('authenticates with cookies and rejects a mechanic from user administration', async () => {
    await makeUser('MECHANIC', 'mech@apexmotors.local')
    const agent = request.agent(app)
    const login = await agent.post('/api/auth/login').send({ email: 'mech@apexmotors.local', password: 'Password@123' })
    expect(login.status).toBe(200)
    expect(login.headers['set-cookie']).toBeDefined()
    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.data.role).toBe('MECHANIC')
    expect(me.body.data.password).toBeUndefined()
    const users = await agent.get('/api/users')
    expect(users.status).toBe(403)
    expect(users.body.success).toBe(false)
  })

  it('runs a service request through assignment, parts, completion, and payment', async () => {
    const admin = await makeUser('ADMIN', 'admin@apexmotors.local')
    const mechanicUser = await makeUser('MECHANIC', 'tech@apexmotors.local')
    const mechanic = await Mechanic.findOne({ user: mechanicUser._id })
    const customer = await Customer.create({ name: 'Anita Rao', phone: '9822222222', email: 'anita@example.com', city: 'Mumbai' })
    const vehicle = await Vehicle.create({
      customer: customer._id,
      customerName: customer.name,
      make: 'Honda',
      model: 'City',
      year: 2020,
      licensePlate: 'MH01AB1234',
      mileage: 42000,
      fuelType: 'Petrol',
      transmission: 'Manual',
    })
    const service = await Service.create({ name: 'Brake inspection', category: 'Brakes', basePrice: 700, estimatedHours: 1, isActive: true })
    const part = await Part.create({ sku: 'BRK-01', name: 'Brake pad set', category: 'Brakes', quantity: 4, minStock: 1, unitPrice: 1800, isActive: true })

    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'admin@apexmotors.local', password: 'Password@123' })
    const created = await agent.post('/api/service-requests').send({
      customer: customer._id.toString(),
      vehicle: vehicle._id.toString(),
      description: 'Grinding noise from the front brakes.',
      priority: 'high',
    })
    expect(created.status).toBe(201)
    const id = created.body.data._id as string

    const mechanicAgent = request.agent(app)
    await mechanicAgent.post('/api/auth/login').send({ email: 'tech@apexmotors.local', password: 'Password@123' })
    const forbidden = await mechanicAgent.get(`/api/service-requests/${id}`)
    expect(forbidden.status).toBe(403)

    const assigned = await agent.patch(`/api/service-requests/${id}/assign`).send({ mechanicId: mechanic!._id.toString() })
    expect(assigned.status).toBe(200)
    const visible = await mechanicAgent.get(`/api/service-requests/${id}`)
    expect(visible.status).toBe(200)

    const withService = await mechanicAgent.post(`/api/service-requests/${id}/services`).send({ serviceId: service._id.toString(), quantity: 1 })
    expect(withService.status).toBe(200)
    const withPart = await mechanicAgent.post(`/api/service-requests/${id}/parts`).send({ partId: part._id.toString(), quantity: 1 })
    expect(withPart.status).toBe(200)
    const stock = await Part.findById(part._id)
    expect(stock?.quantity).toBe(3)

    await mechanicAgent.patch(`/api/service-requests/${id}/status`).send({ status: 'in_progress' })
    const completed = await mechanicAgent.patch(`/api/service-requests/${id}/status`).send({ status: 'completed', note: 'Road tested.' })
    expect(completed.status).toBe(200)
    expect(completed.body.data.status).toBe('completed')

    const invoice = await agent.post('/api/invoices').send({ serviceRequestId: id, discount: 0, dueInDays: 7 })
    expect(invoice.status).toBe(201)
    expect(invoice.body.data.total).toBeGreaterThan(0)
    const payment = await agent.post(`/api/invoices/${invoice.body.data._id}/payments`).send({ amount: invoice.body.data.total, method: 'upi', reference: 'UPI123' })
    expect(payment.status).toBe(201)
    expect(payment.body.data.invoice.status).toBe('paid')

    const other = request.agent(app)
    await makeUser('MECHANIC', 'other@apexmotors.local')
    await other.post('/api/auth/login').send({ email: 'other@apexmotors.local', password: 'Password@123' })
    const hidden = await other.get(`/api/service-requests/${id}`)
    expect(hidden.status).toBe(403)
    expect(admin).toBeTruthy()
  })

  it('paginates customers on the server', async () => {
    await makeUser('RECEPTIONIST', 'desk@apexmotors.local')
    await Customer.insertMany(
      Array.from({ length: 25 }, (_, index) => ({
        name: `Customer ${index}`,
        phone: `970000${String(index).padStart(4, '0')}`,
        city: index % 2 ? 'Pune' : 'Mumbai',
      })),
    )
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'desk@apexmotors.local', password: 'Password@123' })
    const page = await agent.get('/api/customers?page=2&limit=10&search=Customer')
    expect(page.status).toBe(200)
    expect(page.body.data).toHaveLength(10)
    expect(page.body.meta.total).toBe(25)
    expect(page.body.meta.page).toBe(2)
    const sorted = await agent.get('/api/customers?limit=5&sortBy=name&sortOrder=asc')
    expect(sorted.status).toBe(200)
    expect(sorted.body.meta.limit).toBe(5)
    const names = (sorted.body.data as { name: string }[]).map((row) => row.name)
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  })

  it('exposes dashboard stats and labelled revenue report data', async () => {
    await makeUser('ADMIN', 'boss@apexmotors.local')
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'boss@apexmotors.local', password: 'Password@123' })
    const stats = await agent.get('/api/dashboard/stats')
    expect(stats.status).toBe(200)
    expect(stats.body.data).toEqual(expect.objectContaining({
      totalCustomers: expect.any(Number),
      totalVehicles: expect.any(Number),
      activeServices: expect.any(Number),
      pendingServices: expect.any(Number),
      completedServices: expect.any(Number),
      todayRevenue: expect.any(Number),
      monthlyRevenue: expect.any(Number),
      outstandingPayments: expect.any(Number),
    }))
    const revenue = await agent.get('/api/reports/revenue?startDate=2026-01-01&endDate=2026-03-31')
    expect(revenue.status).toBe(200)
    expect(revenue.body.data.xAxis).toBe('Month')
    expect(revenue.body.data.yAxis).toBe('Revenue (₹)')
    expect(revenue.body.data.series[0]).toEqual(expect.objectContaining({ label: expect.any(String), revenue: expect.any(Number) }))
    const denied = request.agent(app)
    await makeUser('RECEPTIONIST', 'front@apexmotors.local')
    await denied.post('/api/auth/login').send({ email: 'front@apexmotors.local', password: 'Password@123' })
    expect((await denied.get('/api/reports/revenue')).status).toBe(403)
  })

  it('calculates invoices on the server, blocks negative stock, and accepts waiting_parts', async () => {
    await makeUser('ADMIN', 'billing@apexmotors.local')
    const customer = await Customer.create({ name: 'Ravi Shah', phone: '9833333333' })
    const vehicle = await Vehicle.create({
      customer: customer._id,
      customerName: customer.name,
      make: 'Maruti',
      model: 'Swift',
      year: 2019,
      licensePlate: 'GJ01CD4321',
      mileage: 18000,
      fuelType: 'Petrol',
      transmission: 'Manual',
    })
    const service = await Service.create({ name: 'Oil service', category: 'Maintenance', basePrice: 700, estimatedHours: 1, isActive: true })
    const part = await Part.create({ sku: 'OIL-1', name: 'Engine oil', category: 'Fluids', quantity: 1, minStock: 1, unitPrice: 1800, isActive: true })
    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ email: 'billing@apexmotors.local', password: 'Password@123' })
    const created = await agent.post('/api/service-requests').send({
      customer: customer._id.toString(),
      vehicle: vehicle._id.toString(),
      description: 'Engine oil is overdue.',
      priority: 'medium',
    })
    expect(created.body.data.requestNumber).toMatch(/^SR-\d{8}-\d{6}$/)
    const id = created.body.data._id as string
    await agent.patch(`/api/service-requests/${id}/status`).send({ status: 'diagnosing' })
    const waiting = await agent.patch(`/api/service-requests/${id}/status`).send({ status: 'waiting_parts' })
    expect(waiting.status).toBe(200)
    expect(waiting.body.data.status).toBe('waiting_for_parts')
    const shortage = await agent.post(`/api/service-requests/${id}/parts`).send({ partId: part._id.toString(), quantity: 5 })
    expect(shortage.status).toBe(400)
    expect((await Part.findById(part._id))?.quantity).toBe(1)
    await agent.post(`/api/service-requests/${id}/services`).send({ serviceId: service._id.toString(), quantity: 1 })
    await agent.post(`/api/service-requests/${id}/parts`).send({ partId: part._id.toString(), quantity: 1 })
    const invoice = await agent.post('/api/invoices').send({ serviceRequestId: id, discount: 0, dueInDays: 7, total: 1 })
    expect(invoice.status).toBe(201)
    expect(invoice.body.data.subtotal).toBe(2500)
    expect(invoice.body.data.total).toBe(2950)
    const removed = await agent.delete(`/api/service-requests/${id}`)
    expect(removed.status).toBe(409)
  })

  it('lets an admin create a mechanic and refuses an SMTP test without configuration', async () => {
    await makeUser('ADMIN', 'owner@apexmotors.local')
    await makeUser('RECEPTIONIST', 'desk2@apexmotors.local')
    const admin = request.agent(app)
    await admin.post('/api/auth/login').send({ email: 'owner@apexmotors.local', password: 'Password@123' })
    const created = await admin.post('/api/mechanics').send({
      name: 'Kiran Patel',
      email: 'kiran@apexmotors.local',
      phone: '9844444444',
      password: 'Password@123',
      specialization: 'Electrical',
    })
    expect(created.status).toBe(201)
    expect(created.body.data.password).toBeUndefined()
    const desk = request.agent(app)
    await desk.post('/api/auth/login').send({ email: 'desk2@apexmotors.local', password: 'Password@123' })
    expect((await desk.post('/api/mechanics').send({ name: 'Nope', email: 'nope@apexmotors.local', phone: '9855555555', password: 'Password@123' })).status).toBe(403)
    const smtp = await admin.post('/api/settings/email/test').send({ recipientEmail: 'not-an-email' })
    expect(smtp.status).toBe(400)
    const unconfigured = await admin.post('/api/settings/email/test').send({ recipientEmail: 'owner@apexmotors.local' })
    expect(unconfigured.status).toBe(400)
    expect(unconfigured.body.message).toMatch(/SMTP/i)
    expect(JSON.stringify(unconfigured.body)).not.toMatch(/SMTP_PASSWORD/)
  })
})
