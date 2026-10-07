import bcrypt from 'bcryptjs'
import { faker } from '@faker-js/faker/locale/en_IN'
import { Types } from 'mongoose'
import { connectDB, disconnectDB } from '../config/db.js'
import { User } from '../models/User.js'
import { Customer } from '../models/Customer.js'
import { Vehicle } from '../models/Vehicle.js'
import { Mechanic } from '../models/Mechanic.js'
import { Service } from '../models/Service.js'
import { Part } from '../models/Part.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Invoice, Payment } from '../models/Invoice.js'
import { AuditLog, Notification } from '../models/Notification.js'
import { Counter, EmailLog, Setting } from '../models/Setting.js'

faker.seed(20260928)

const RESET = process.argv.includes('--reset')
const CONFIRM = process.argv.includes('--confirm')

const SERVICE_DEFS: [string, string, number, number][] = [
  ['Periodic service 10,000 km', 'Maintenance', 3499, 2.5],
  ['Periodic service 20,000 km', 'Maintenance', 5499, 3],
  ['Engine oil and filter', 'Maintenance', 1899, 0.8],
  ['Brake inspection', 'Brakes', 699, 0.6],
  ['Front brake pad replacement', 'Brakes', 2499, 1.4],
  ['Rear brake shoe replacement', 'Brakes', 2199, 1.6],
  ['Brake disc skim', 'Brakes', 1599, 1.2],
  ['Wheel alignment', 'Tyres', 999, 0.8],
  ['Wheel balancing', 'Tyres', 599, 0.5],
  ['Tyre rotation', 'Tyres', 399, 0.4],
  ['AC performance check', 'Climate', 799, 0.7],
  ['AC gas recharge', 'Climate', 2499, 1.2],
  ['AC condenser cleaning', 'Climate', 1499, 1],
  ['Battery test and replacement', 'Electrical', 899, 0.5],
  ['Alternator diagnosis', 'Electrical', 1299, 1],
  ['Starter motor overhaul', 'Electrical', 3499, 2.5],
  ['Full diagnostics scan', 'Diagnostics', 1499, 1],
  ['Check engine light diagnosis', 'Diagnostics', 999, 0.8],
  ['Clutch inspection', 'Transmission', 799, 0.7],
  ['Clutch assembly replacement', 'Transmission', 8999, 5],
  ['Gearbox oil change', 'Transmission', 1899, 1],
  ['Suspension inspection', 'Chassis', 699, 0.6],
  ['Shock absorber replacement', 'Chassis', 4599, 2.2],
  ['Lower arm bush replacement', 'Chassis', 2799, 2],
  ['Radiator flush', 'Cooling', 1499, 1],
  ['Coolant leak repair', 'Cooling', 2199, 1.6],
  ['Water pump replacement', 'Cooling', 4299, 3],
  ['Spark plug replacement', 'Engine', 1299, 0.8],
  ['Injector cleaning', 'Engine', 2499, 1.5],
  ['Timing belt replacement', 'Engine', 7499, 4.5],
  ['Headlamp restoration', 'Body', 1299, 1],
  ['Dent and paint panel', 'Body', 6500, 8],
  ['Windshield replacement', 'Body', 8500, 2],
  ['Wiper blade replacement', 'Body', 499, 0.2],
  ['Premium interior detail', 'Detailing', 2999, 3],
  ['Underbody rust treatment', 'Detailing', 3499, 2.5],
  ['Hybrid system inspection', 'Diagnostics', 2499, 1.5],
  ['EV cabin filter service', 'Maintenance', 1799, 0.6],
  ['CNG kit safety inspection', 'Maintenance', 1599, 1],
  ['Power steering fluid service', 'Chassis', 1299, 0.8],
  ['Exhaust mount repair', 'Engine', 1899, 1.3],
  ['Fuel pump replacement', 'Engine', 5699, 2.4],
  ['Throttle body cleaning', 'Engine', 1699, 1],
  ['ABS sensor replacement', 'Brakes', 2899, 1.4],
  ['Cabin blower motor', 'Climate', 3299, 1.8],
  ['Door lock actuator', 'Electrical', 2199, 1.2],
  ['Infotainment diagnosis', 'Electrical', 999, 0.7],
  ['Alloy wheel refurbish', 'Tyres', 1999, 2],
  ['Pre-delivery inspection', 'Maintenance', 1499, 1.5],
  ['Monsoon underbody wash', 'Detailing', 799, 0.6],
  ['Road-trip safety check', 'Maintenance', 1299, 1],
  ['Fleet brake service', 'Brakes', 3999, 2],
  ['Premium ceramic coat', 'Detailing', 8999, 6],
]

const PART_FAMILIES: [string, string, number][] = [
  ['Oil filter', 'Filters', 320],
  ['Air filter', 'Filters', 480],
  ['Cabin filter', 'Filters', 540],
  ['Fuel filter', 'Filters', 690],
  ['Brake pad set', 'Brakes', 1850],
  ['Brake shoe set', 'Brakes', 1420],
  ['Brake disc', 'Brakes', 2640],
  ['Brake fluid', 'Brakes', 380],
  ['Spark plug', 'Engine', 220],
  ['Ignition coil', 'Engine', 1450],
  ['Engine oil 4L', 'Lubricants', 2100],
  ['Coolant 1L', 'Cooling', 260],
  ['Radiator hose', 'Cooling', 640],
  ['Thermostat', 'Cooling', 890],
  ['Wiper blade', 'Body', 350],
  ['Headlamp bulb', 'Electrical', 280],
  ['Battery 12V', 'Electrical', 6200],
  ['Alternator belt', 'Electrical', 540],
  ['AC compressor', 'Climate', 9800],
  ['AC gas can', 'Climate', 1250],
  ['Clutch plate', 'Transmission', 3400],
  ['Clutch bearing', 'Transmission', 980],
  ['Shock absorber', 'Chassis', 2750],
  ['Stabilizer link', 'Chassis', 760],
  ['Wheel bearing', 'Chassis', 1540],
  ['Tyre valve', 'Tyres', 80],
  ['Wheel weight', 'Tyres', 40],
  ['Oxygen sensor', 'Engine', 2100],
  ['Fuel pump', 'Engine', 4600],
  ['Door latch', 'Body', 1320],
]

const BRANDS = ['Bosch', 'Mann', 'NGK', 'TVS', 'Valeo', 'Mobil', 'Minda']
const MAKES = [
  { make: 'Maruti Suzuki', models: ['Swift', 'Baleno', 'Brezza', 'Wagon R', 'Ertiga'] },
  { make: 'Hyundai', models: ['i20', 'Creta', 'Venue', 'Verna'] },
  { make: 'Tata', models: ['Nexon', 'Punch', 'Harrier', 'Altroz'] },
  { make: 'Honda', models: ['City', 'Amaze', 'Elevate'] },
  { make: 'Toyota', models: ['Innova', 'Glanza', 'Hyryder'] },
  { make: 'Mahindra', models: ['XUV700', 'Scorpio N', 'Thar'] },
  { make: 'Kia', models: ['Seltos', 'Sonet', 'Carens'] },
  { make: 'Skoda', models: ['Slavia', 'Kushaq'] },
]
const STATES = [
  ['MH', 'Mumbai', 'Maharashtra'],
  ['GJ', 'Ahmedabad', 'Gujarat'],
  ['DL', 'New Delhi', 'Delhi'],
  ['KA', 'Bengaluru', 'Karnataka'],
  ['TN', 'Chennai', 'Tamil Nadu'],
  ['TS', 'Hyderabad', 'Telangana'],
  ['RJ', 'Jaipur', 'Rajasthan'],
  ['KL', 'Kochi', 'Kerala'],
  ['UP', 'Lucknow', 'Uttar Pradesh'],
  ['WB', 'Kolkata', 'West Bengal'],
] as const
const SPECIALIZATIONS = ['Engine', 'Brakes', 'Electrical', 'Transmission', 'Climate', 'Diagnostics', 'Body', 'General Service']
const COMPLAINTS = [
  'Customer reports a grinding noise while braking from highway speed.',
  'Air conditioning blows warm air after ten minutes of city driving.',
  'Engine takes two attempts to start in the morning.',
  'Steering pulls to the left after a recent pothole impact.',
  'Check-engine lamp is steady and fuel economy has dropped.',
  'Clutch bites very high and slips under load.',
  'Suspension knocks over speed breakers on the front left.',
  'Battery warning appeared twice on the school run this week.',
  'Periodic service is due and the customer wants a full inspection.',
  'Coolant level drops every few days with no visible leak on the driveway.',
  'Wipers smear and the headlamps have faded.',
  'Gear changes feel notchy when the transmission is cold.',
]
const DIAGNOSES = [
  'Front pads are below the wear limit and the discs are lipped.',
  'Cabin filter is blocked and the AC gas charge is low.',
  'Battery fails a load test. Alternator output is within range.',
  'Front alignment is out of specification after lower-arm play.',
  'Stored misfire on cylinder 2. One coil and the plugs are due.',
  'Clutch disc is glazed. Release bearing is noisy.',
  'Left front damper is leaking. Bushings are perished.',
  'No fault codes. Customer authorised the scheduled service.',
  'Thermostat is sticking and the upper hose is swollen.',
  'Waiting on a matched pair of discs from the supplier.',
]

function pick<T>(items: readonly T[]) {
  return items[faker.number.int({ min: 0, max: items.length - 1 })]
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

function withoutEmpty<T extends Record<string, unknown>>(documents: T[]) {
  return documents.map((document) =>
    Object.fromEntries(Object.entries(document).filter(([, value]) => value !== undefined && value !== null)),
  )
}

function statusFor(roll: number) {
  if (roll < 0.1) return 'pending'
  if (roll < 0.18) return 'diagnosing'
  if (roll < 0.26) return 'waiting_for_parts'
  if (roll < 0.4) return 'in_progress'
  if (roll < 0.95) return 'completed'
  return 'cancelled'
}

function priorityFor(roll: number) {
  if (roll < 0.28) return 'low'
  if (roll < 0.68) return 'medium'
  if (roll < 0.88) return 'high'
  return 'urgent'
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  const userPassword = process.env.SEED_USER_PASSWORD
  if (!adminPassword || adminPassword.length < 8 || !userPassword || userPassword.length < 8) {
    console.error('Set SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD (at least 8 characters) before seeding.')
    process.exit(1)
  }

  await connectDB()
  const models = [User, Customer, Vehicle, Mechanic, Service, Part, ServiceRequest, Invoice, Payment, Notification, AuditLog, EmailLog, Counter, Setting] as unknown as {
    modelName: string
    deleteMany: (filter: object) => Promise<{ deletedCount?: number }>
    syncIndexes: () => Promise<unknown>
    countDocuments: () => Promise<number>
  }[]
  const existing = await User.countDocuments()
  if (RESET) {
    if (!CONFIRM) {
      console.error('Refusing to erase data. Re-run with: npm run seed:reset -- --confirm')
      await disconnectDB()
      process.exit(1)
    }
    for (const model of models) {
      const deleted = await model.deleteMany({})
      console.info(`Cleared ${model.modelName}: ${deleted.deletedCount}`)
    }
  } else if (existing > 0) {
    console.error('Database already contains users. Refusing to seed over existing data.')
    console.error('To wipe seedable collections and reseed, run: npm run seed:reset -- --confirm')
    await disconnectDB()
    process.exit(1)
  }

  console.info('Preparing records…')
  const adminHash = await bcrypt.hash(adminPassword, 10)
  const userHash = await bcrypt.hash(userPassword, 10)
  const now = new Date()
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@apexmotors.local').toLowerCase()

  const users: Record<string, unknown>[] = []
  const pushUser = (input: { name: string; email: string; role: string; phone: string; password: string; createdAt: Date }) => {
    const _id = new Types.ObjectId()
    users.push({
      _id,
      name: input.name,
      email: input.email.toLowerCase(),
      password: input.password,
      phone: input.phone,
      role: input.role,
      isActive: true,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    })
    return _id
  }

  const staffCreated = faker.date.between({ from: new Date(now.getFullYear() - 2, 0, 1), to: new Date(now.getFullYear() - 1, 5, 1) })
  pushUser({ name: process.env.SEED_ADMIN_NAME || 'Apex Admin', email: adminEmail, role: 'ADMIN', phone: '9800000001', password: adminHash, createdAt: staffCreated })
  pushUser({ name: 'Meera Shah', email: 'manager@apexmotors.local', role: 'MANAGER', phone: '9800000002', password: userHash, createdAt: staffCreated })
  const receptionistId = pushUser({ name: 'Rahul Desai', email: 'receptionist@apexmotors.local', role: 'RECEPTIONIST', phone: '9800000003', password: userHash, createdAt: staffCreated })
  const knownMechanicUser = pushUser({ name: 'Imran Qureshi', email: 'mechanic@apexmotors.local', role: 'MECHANIC', phone: '9800000004', password: userHash, createdAt: staffCreated })

  const usedEmails = new Set(users.map((user) => String(user.email)))
  const usedPhones = new Set(users.map((user) => String(user.phone)))
  const phone = () => {
    let value = ''
    do {
      value = `9${faker.string.numeric(9)}`
    } while (usedPhones.has(value))
    usedPhones.add(value)
    return value
  }
  const emailFor = (name: string) => {
    let value = ''
    do {
      value = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ').slice(1).join('') || 'workshop' }).toLowerCase()
    } while (usedEmails.has(value))
    usedEmails.add(value)
    return value
  }

  for (let index = 0; index < 4; index += 1) {
    const name = faker.person.fullName()
    pushUser({ name, email: emailFor(name), role: 'MANAGER', phone: phone(), password: userHash, createdAt: faker.date.past({ years: 2 }) })
  }
  for (let index = 0; index < 12; index += 1) {
    const name = faker.person.fullName()
    pushUser({ name, email: emailFor(name), role: 'RECEPTIONIST', phone: phone(), password: userHash, createdAt: faker.date.past({ years: 2 }) })
  }

  const mechanicUsers: { _id: Types.ObjectId; name: string; email: string; phone: string; createdAt: Date }[] = [
    { _id: knownMechanicUser, name: 'Imran Qureshi', email: 'mechanic@apexmotors.local', phone: '9800000004', createdAt: staffCreated },
  ]
  for (let index = 0; index < 84; index += 1) {
    const name = faker.person.fullName()
    const createdAt = faker.date.past({ years: 3 })
    const userPhone = phone()
    const userEmail = emailFor(name)
    const _id = pushUser({ name, email: userEmail, role: 'MECHANIC', phone: userPhone, password: userHash, createdAt })
    mechanicUsers.push({ _id, name, email: userEmail, phone: userPhone, createdAt })
  }

  const mechanics = mechanicUsers.map((user, index) => ({
    _id: new Types.ObjectId(),
    user: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    employeeId: `EMP-${String(index + 1).padStart(4, '0')}`,
    specialization: SPECIALIZATIONS[index % SPECIALIZATIONS.length],
    experienceYears: faker.number.int({ min: 1, max: 22 }),
    hourlyRate: faker.number.int({ min: 280, max: 900 }),
    status: index < 6 ? 'off_duty' : 'available',
    activeJobs: 0,
    createdAt: user.createdAt,
    updatedAt: user.createdAt,
  }))

  const receptionists = users.filter((user) => user.role === 'RECEPTIONIST' || user.role === 'MANAGER' || user.role === 'ADMIN')

  const customers = Array.from({ length: 320 }, () => {
    const region = pick(STATES)
    const name = faker.person.fullName()
    const createdAt = faker.date.between({ from: new Date(now.getFullYear() - 2, 0, 1), to: now })
    const creator = pick(receptionists)
    return {
      _id: new Types.ObjectId(),
      name,
      email: emailFor(name),
      phone: phone(),
      alternatePhone: Math.random() > 0.7 ? phone() : undefined,
      address: faker.location.streetAddress(),
      city: region[1],
      state: region[2],
      postalCode: faker.location.zipCode('######'),
      notes: Math.random() > 0.75 ? 'Prefers WhatsApp updates before additional work is approved.' : undefined,
      vehicleCount: 0,
      isActive: Math.random() > 0.04,
      createdBy: creator._id,
      createdByName: creator.name,
      createdAt,
      updatedAt: createdAt,
    }
  })

  const plates = new Set<string>()
  const vins = new Set<string>()
  const vehicles: Record<string, unknown>[] = []
  const addVehicle = (customer: (typeof customers)[number]) => {
    const spec = pick(MAKES)
    const region = STATES.find((item) => item[1] === customer.city) || pick(STATES)
    let plate = ''
    do {
      plate = `${region[0]}${faker.number.int({ min: 1, max: 32 }).toString().padStart(2, '0')}${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.number.int({ min: 1000, max: 9999 })}`
    } while (plates.has(plate))
    plates.add(plate)
    let vin: string | undefined
    if (Math.random() > 0.08) {
      do {
        vin = faker.vehicle.vin()
      } while (vins.has(vin))
      vins.add(vin)
    }
    const createdAt = faker.date.between({ from: customer.createdAt as Date, to: now })
    const vehicle = {
      _id: new Types.ObjectId(),
      customer: customer._id,
      customerName: customer.name,
      make: spec.make,
      model: pick(spec.models),
      year: faker.number.int({ min: 2012, max: now.getFullYear() }),
      color: faker.color.human(),
      licensePlate: plate,
      ...(vin ? { vin } : {}),
      mileage: faker.number.int({ min: 8000, max: 92000 }),
      fuelType: pick(['Petrol', 'Diesel', 'CNG', 'Petrol', 'Petrol', 'Electric', 'Hybrid'] as const),
      transmission: Math.random() > 0.62 ? 'Automatic' : 'Manual',
      notes: undefined,
      createdAt,
      updatedAt: createdAt,
    }
    vehicles.push(vehicle)
    customer.vehicleCount += 1
    return vehicle
  }

  customers.forEach((customer) => addVehicle(customer))
  customers.slice(0, 180).forEach((customer) => addVehicle(customer))
  customers.slice(0, 40).forEach((customer) => addVehicle(customer))

  const services = SERVICE_DEFS.map((item, index) => ({
    _id: new Types.ObjectId(),
    name: item[0],
    description: `${item[0]} carried out to Apex Motors workshop standard.`,
    category: item[1],
    basePrice: item[2],
    estimatedHours: item[3],
    isActive: index % 17 !== 0,
    createdAt: staffCreated,
    updatedAt: staffCreated,
  }))

  const parts = PART_FAMILIES.flatMap((family, familyIndex) =>
    BRANDS.map((brand, brandIndex) => ({
      _id: new Types.ObjectId(),
      sku: `${family[1].slice(0, 3).toUpperCase()}-${String(familyIndex + 1).padStart(2, '0')}${brand.slice(0, 2).toUpperCase()}${brandIndex}`,
      name: `${brand} ${family[0]}`,
      description: `${brand} ${family[0].toLowerCase()} stocked for passenger vehicles.`,
      category: family[1],
      quantity: faker.number.int({ min: 24, max: 90 }),
      minStock: faker.number.int({ min: 6, max: 12 }),
      unitPrice: family[2] + brandIndex * 35,
      supplier: `${brand} Distributor`,
      location: `Bay ${String.fromCharCode(65 + (familyIndex % 6))}-${faker.number.int({ min: 1, max: 12 })}`,
      isActive: true,
      createdAt: staffCreated,
      updatedAt: staffCreated,
    })),
  )

  type VehicleRecord = (typeof vehicles)[number]
  const plans: { vehicle: VehicleRecord; createdAt: Date }[] = []
  vehicles.forEach((vehicle) => {
    plans.push({ vehicle, createdAt: faker.date.between({ from: vehicle.createdAt as Date, to: now }) })
  })
  while (plans.length < 1050) {
    const vehicle = pick(vehicles)
    plans.push({ vehicle, createdAt: faker.date.between({ from: vehicle.createdAt as Date, to: now }) })
  }
  const byVehicle = new Map<string, { vehicle: VehicleRecord; createdAt: Date }[]>()
  plans.forEach((plan) => {
    const key = String(plan.vehicle._id)
    const list = byVehicle.get(key) || []
    list.push(plan)
    byVehicle.set(key, list)
  })

  const requestSeq = new Map<string, number>()
  const requests: Record<string, unknown>[] = []
  const activeByMechanic = new Map<string, number>()

  byVehicle.forEach((list) => {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    let mileage = Number(list[0].vehicle.mileage) - list.length * 1500
    if (mileage < 500) mileage = 500
    list.forEach((plan) => {
      mileage += faker.number.int({ min: 400, max: 3500 })
      const roll = Math.random()
      const status = statusFor(roll)
      const priority = priorityFor(Math.random())
      const stamp = `${plan.createdAt.getFullYear()}${String(plan.createdAt.getMonth() + 1).padStart(2, '0')}${String(plan.createdAt.getDate()).padStart(2, '0')}`
      const seq = (requestSeq.get(stamp) || 0) + 1
      requestSeq.set(stamp, seq)
      const assignable = mechanics.filter((item) => item.status !== 'off_duty')
      const mechanic = status === 'pending' ? undefined : pick(assignable)
      const chosenServices = faker.helpers.arrayElements(services.filter((item) => item.isActive), faker.number.int({ min: 1, max: 3 }))
      const chosenParts = status === 'pending' ? [] : faker.helpers.arrayElements(parts, faker.number.int({ min: 0, max: 4 }))
      const serviceLines = chosenServices.map((service) => ({
        _id: new Types.ObjectId(),
        service: service._id,
        name: service.name,
        quantity: 1,
        unitPrice: service.basePrice,
      }))
      const partLines = chosenParts.map((part) => {
        const quantity = faker.number.int({ min: 1, max: 2 })
        part.quantity = Math.max(0, part.quantity - quantity)
        return { _id: new Types.ObjectId(), part: part._id, sku: part.sku, name: part.name, quantity, unitPrice: part.unitPrice }
      })
      const actual = money([...serviceLines, ...partLines].reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))
      const creator = pick(receptionists)
      const completedAt = status === 'completed' ? new Date(plan.createdAt.getTime() + faker.number.int({ min: 4, max: 96 }) * 3600_000) : undefined
      if (completedAt && completedAt > now) completedAt.setTime(now.getTime() - 3600_000)
      const estimatedCompletion = new Date(plan.createdAt.getTime() + faker.number.int({ min: 1, max: 5 }) * 86400_000)
      if (mechanic && ['diagnosing', 'waiting_for_parts', 'in_progress'].includes(status)) {
        activeByMechanic.set(String(mechanic._id), (activeByMechanic.get(String(mechanic._id)) || 0) + 1)
      }
      const vehicle = plan.vehicle
      requests.push({
        _id: new Types.ObjectId(),
        requestNumber: `SR-${stamp}-${String(seq).padStart(6, '0')}`,
        customer: vehicle.customer,
        customerName: vehicle.customerName,
        vehicle: vehicle._id,
        vehicleLabel: `${vehicle.make} ${vehicle.model} · ${vehicle.licensePlate}`,
        licensePlate: vehicle.licensePlate,
        assignedMechanic: mechanic?._id,
        mechanicName: mechanic?.name,
        description: pick(COMPLAINTS),
        diagnosis: status === 'pending' ? undefined : pick(DIAGNOSES),
        priority,
        status,
        estimatedCost: money(actual * faker.number.float({ min: 0.9, max: 1.15, fractionDigits: 2 }) || faker.number.int({ min: 1500, max: 8000 })),
        actualCost: actual,
        estimatedCompletion,
        completedAt,
        services: serviceLines,
        parts: partLines,
        notes: status === 'pending' ? [] : [{ _id: new Types.ObjectId(), text: 'Customer approved the estimate on the phone.', authorName: String(creator.name), createdAt: plan.createdAt }],
        createdBy: creator._id,
        createdByName: creator.name,
        mileageAtService: mileage,
        createdAt: plan.createdAt,
        updatedAt: completedAt || plan.createdAt,
      })
      vehicle.mileage = mileage
      vehicle.lastServiceAt = plan.createdAt
      vehicle.updatedAt = plan.createdAt
    })
  })

  mechanics.forEach((mechanic) => {
    const active = activeByMechanic.get(String(mechanic._id)) || 0
    mechanic.activeJobs = active
    if (mechanic.status !== 'off_duty') mechanic.status = active > 0 ? 'busy' : 'available'
  })

  const invoiceSeq = new Map<number, number>()
  const invoices: Record<string, unknown>[] = []
  const payments: Record<string, unknown>[] = []
  requests
    .filter((request) => request.status === 'completed')
    .forEach((request) => {
      const issuedAt = (request.completedAt as Date) || (request.createdAt as Date)
      const year = issuedAt.getFullYear()
      const seq = (invoiceSeq.get(year) || 0) + 1
      invoiceSeq.set(year, seq)
      const items = [
        ...(request.services as { name: string; quantity: number; unitPrice: number }[]).map((line) => ({
          kind: 'service',
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: money(line.quantity * line.unitPrice),
        })),
        ...(request.parts as { name: string; sku: string; quantity: number; unitPrice: number }[]).map((line) => ({
          kind: 'part',
          name: line.name,
          sku: line.sku,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: money(line.quantity * line.unitPrice),
        })),
      ]
      if (!items.length) return
      const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0))
      const discount = seq % 8 === 0 ? money(subtotal * 0.05) : 0
      const taxable = money(subtotal - discount)
      const taxAmount = money(taxable * 0.18)
      const total = money(taxable + taxAmount)
      const dueDate = new Date(issuedAt.getTime() + 7 * 86400_000)
      const mode = seq % 10
      const amountPaid = mode < 7 ? total : mode < 9 ? money(total * 0.45) : 0
      const balance = money(total - amountPaid)
      const status = balance <= 0 ? 'paid' : amountPaid > 0 ? (dueDate < now ? 'overdue' : 'partial') : dueDate < now ? 'overdue' : 'issued'
      const invoiceId = new Types.ObjectId()
      const customer = customers.find((item) => String(item._id) === String(request.customer))
      invoices.push({
        _id: invoiceId,
        invoiceNumber: `INV-${year}-${String(seq).padStart(5, '0')}`,
        serviceRequest: request._id,
        requestNumber: request.requestNumber,
        customer: request.customer,
        customerName: request.customerName,
        customerEmail: customer?.email,
        customerPhone: customer?.phone,
        vehicleLabel: request.vehicleLabel,
        items,
        subtotal,
        taxRate: 18,
        taxAmount,
        discount,
        total,
        amountPaid,
        balance,
        status,
        dueDate,
        issuedAt,
        createdBy: receptionistId,
        createdAt: issuedAt,
        updatedAt: issuedAt,
      })
      if (amountPaid > 0) {
        const paidAt = new Date(Math.min(now.getTime(), issuedAt.getTime() + 2 * 86400_000))
        payments.push({
          _id: new Types.ObjectId(),
          invoice: invoiceId,
          invoiceNumber: `INV-${year}-${String(seq).padStart(5, '0')}`,
          customer: request.customer,
          amount: amountPaid,
          method: pick(['cash', 'card', 'upi', 'bank'] as const),
          reference: `RCPT-${seq}`,
          paidAt,
          receivedBy: receptionistId,
          receivedByName: 'Rahul Desai',
          createdAt: paidAt,
          updatedAt: paidAt,
        })
      }
    })

  parts.slice(0, 18).forEach((part) => {
    part.quantity = faker.number.int({ min: 0, max: 4 })
    part.minStock = 8
  })

  const notifications = Array.from({ length: 1000 }, (_, index) => {
    const request = requests[index % requests.length]
    const user = users[index % users.length]
    const createdAt = faker.date.recent({ days: 180 })
    const read = createdAt.getTime() < now.getTime() - 10 * 86400_000 || index % 4 !== 0
    return {
      _id: new Types.ObjectId(),
      user: user._id,
      role: user.role,
      title: index % 5 === 0 ? 'Invoice generated' : index % 5 === 1 ? 'Job assigned' : 'Service status changed',
      message: `${request.requestNumber} · ${request.customerName} · ${String(request.status).replaceAll('_', ' ')}.`,
      type: index % 5 === 0 ? 'invoice' : index % 5 === 1 ? 'assignment' : 'status',
      link: `/service-requests/${String(request._id)}`,
      read,
      readAt: read ? createdAt : undefined,
      entityType: 'ServiceRequest',
      entityId: request._id,
      createdAt,
      updatedAt: createdAt,
    }
  })

  const audits = Array.from({ length: 500 }, (_, index) => {
    const request = requests[index % requests.length]
    const actor = pick(receptionists)
    const createdAt = request.createdAt as Date
    return {
      _id: new Types.ObjectId(),
      user: actor._id,
      userName: actor.name,
      role: actor.role,
      action: index % 4 === 0 ? 'STATUS_CHANGE' : index % 4 === 1 ? 'CREATE' : 'UPDATE',
      entity: 'ServiceRequest',
      entityId: String(request._id),
      summary: `${actor.name} updated ${request.requestNumber}`,
      createdAt,
      updatedAt: createdAt,
    }
  })

  const emailLogs = Array.from({ length: 40 }, (_, index) => ({
    _id: new Types.ObjectId(),
    to: customers[index].email,
    subject: `Service request update ${index + 1}`,
    template: index % 2 === 0 ? 'service-status' : 'invoice',
    status: 'skipped',
    error: 'Seed sample recorded before SMTP was configured',
    preview: 'Workshop notification prepared for the customer.',
    relatedModel: 'ServiceRequest',
    createdAt: faker.date.recent({ days: 60 }),
    updatedAt: now,
  }))

  console.info(`Writing ${users.length} users, ${customers.length} customers, ${vehicles.length} vehicles, ${requests.length} requests, ${invoices.length} invoices…`)
  await User.collection.insertMany(withoutEmpty(users))
  await Mechanic.collection.insertMany(withoutEmpty(mechanics))
  await Customer.collection.insertMany(withoutEmpty(customers))
  await Vehicle.collection.insertMany(withoutEmpty(vehicles))
  await Service.collection.insertMany(withoutEmpty(services))
  await Part.collection.insertMany(withoutEmpty(parts))
  await ServiceRequest.collection.insertMany(withoutEmpty(requests))
  await Invoice.collection.insertMany(withoutEmpty(invoices))
  if (payments.length) await Payment.collection.insertMany(withoutEmpty(payments))
  await Notification.collection.insertMany(withoutEmpty(notifications))
  await AuditLog.collection.insertMany(withoutEmpty(audits))
  await EmailLog.collection.insertMany(withoutEmpty(emailLogs))

  const counters = [
    ...[...requestSeq.entries()].map(([stamp, seq]) => ({ key: `request-${stamp}`, seq })),
    ...[...invoiceSeq.entries()].map(([year, seq]) => ({ key: `invoice-${year}`, seq })),
    { key: 'employee', seq: mechanics.length },
  ]
  await Counter.collection.insertMany(counters.map((item) => ({ ...item, _id: new Types.ObjectId() })))
  await Setting.collection.replaceOne(
    { key: 'general' },
    {
      key: 'general',
      garageName: 'Apex Motors',
      tagline: 'Workshop management for modern service bays',
      address: '14 Industrial Estate, Andheri East',
      city: 'Mumbai',
      phone: '+91 22 4000 1200',
      email: 'service@apexmotors.local',
      gstin: '27AABCU9603R1ZM',
      taxPercent: 18,
      currency: 'INR',
      emailNotifications: { welcome: true, serviceRequest: true, assignment: true, status: true, completed: true, invoice: true },
      createdAt: staffCreated,
      updatedAt: now,
    },
    { upsert: true },
  )

  await Promise.all(models.map((model) => model.syncIndexes()))
  console.info('Seed complete.')
  console.info(`Admin email: ${adminEmail}`)
  console.info('Admin password is the SEED_ADMIN_PASSWORD environment value.')
  console.info('Other seeded staff share SEED_USER_PASSWORD. Known accounts: manager@apexmotors.local, receptionist@apexmotors.local, mechanic@apexmotors.local')
  console.info(`Counts → users ${users.length}, mechanics ${mechanics.length}, customers ${customers.length}, vehicles ${vehicles.length}, services ${services.length}, parts ${parts.length}, requests ${requests.length}, invoices ${invoices.length}, payments ${payments.length}, notifications ${notifications.length}, audit ${audits.length}`)
  await disconnectDB()
}

main().catch(async (error) => {
  console.error(error)
  await disconnectDB().catch(() => undefined)
  process.exit(1)
})
