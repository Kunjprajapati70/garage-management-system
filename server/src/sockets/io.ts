import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { clientOrigins } from '../config/env.js'
import { verifyAccessToken } from '../utils/tokens.js'
import { ServiceRequest } from '../models/ServiceRequest.js'
import { Mechanic } from '../models/Mechanic.js'
import { Events } from '../constants.js'

let io: Server | null = null

function parseCookie(header?: string) {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (!key) continue
    out[key] = decodeURIComponent(rest.join('='))
  }
  return out
}

export function initIO(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: clientOrigins, credentials: true },
  })

  io.use((socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie)
      const token = cookies.gms_access || (socket.handshake.auth?.token as string | undefined)
      if (!token) return next(new Error('Unauthorized'))
      const payload = verifyAccessToken(token)
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as { sub: string; role: string }
    socket.join(`user:${user.sub}`)
    socket.join(`role:${user.role}`)

    socket.on('room:join', async (payload: { type?: string; id?: string }) => {
      if (payload?.type !== 'serviceRequest' || !payload.id) return
      const request = await ServiceRequest.findById(payload.id).select('assignedMechanic')
      if (!request) return
      if (user.role === 'MECHANIC') {
        const mechanic = await Mechanic.findOne({ user: user.sub }).select('_id')
        if (!mechanic || request.assignedMechanic?.toString() !== mechanic._id.toString()) return
      }
      socket.join(`request:${payload.id}`)
    })

    socket.on('room:leave', (payload: { type?: string; id?: string }) => {
      if (payload?.type === 'serviceRequest' && payload.id) {
        socket.leave(`request:${payload.id}`)
      }
    })
  })

  return io
}

export function getIO() {
  return io
}

const SPEC_EVENT: Record<string, string> = {
  'customer:created': 'customer-created',
  'customer:updated': 'customer-updated',
  'vehicle:created': 'vehicle-created',
  'vehicle:updated': 'vehicle-updated',
  'serviceRequest:created': 'service-created',
  'serviceRequest:updated': 'service-updated',
  'serviceRequest:assigned': 'mechanic-assigned',
  'serviceRequest:status': 'service-status-changed',
  'serviceRequest:parts': 'parts-updated',
  'service:created': 'service-created',
  'service:updated': 'service-updated',
  'parts:updated': 'parts-updated',
  'billing:updated': 'payment-updated',
  'invoice:created': 'invoice-created',
  'notification:created': 'notification-created',
  'dashboard:updated': 'dashboard-updated',
}

export function emit(event: string, payload: unknown, rooms: string[]) {
  if (!io || rooms.length === 0) return
  io.to(rooms).emit(event, payload)
  const alias = SPEC_EVENT[event]
  if (alias) io.to(rooms).emit(alias, payload)
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  emit(event, payload, [`user:${userId}`])
}

export function emitToRole(role: string, event: string, payload: unknown) {
  emit(event, payload, [`role:${role}`])
}

export function emitOperational(event: string, payload: unknown, extraRooms: string[] = []) {
  emit(event, payload, ['role:ADMIN', 'role:MANAGER', 'role:RECEPTIONIST', ...extraRooms])
  emit(Events.dashboardUpdated, { reason: event }, ['role:ADMIN', 'role:MANAGER', 'role:RECEPTIONIST'])
}

export function emitMechanic(mechanicUserId: string | undefined, event: string, payload: unknown) {
  if (!mechanicUserId) return
  emitToUser(mechanicUserId, event, payload)
  emit(Events.dashboardUpdated, { reason: event }, [`user:${mechanicUserId}`])
}
