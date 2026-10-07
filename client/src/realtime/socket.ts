import axios from 'axios'
import { io, type Socket } from 'socket.io-client'
import { apiBase, apiOrigin } from '@/api/origin'
import { store } from '@/store'
import { setConnection } from '@/store/uiSlice'

const ALIASES: Record<string, string> = {
  'customer-created': 'customer:created',
  'customer-updated': 'customer:updated',
  'vehicle-created': 'vehicle:created',
  'vehicle-updated': 'vehicle:updated',
  'service-created': 'service:created',
  'service-updated': 'service:updated',
  'mechanic-assigned': 'serviceRequest:assigned',
  'service-status-changed': 'serviceRequest:status',
  'parts-updated': 'parts:updated',
  'inventory-low': 'parts:updated',
  'billing-updated': 'billing:updated',
  'payment-updated': 'billing:updated',
  'invoice-created': 'invoice:created',
  'notification-created': 'notification:created',
  'dashboard-updated': 'dashboard:updated',
}

const EVENTS = [
  'customer:created',
  'customer:updated',
  'vehicle:created',
  'vehicle:updated',
  'serviceRequest:created',
  'serviceRequest:updated',
  'serviceRequest:assigned',
  'serviceRequest:status',
  'serviceRequest:parts',
  'billing:updated',
  'invoice:created',
  'notification:created',
  'dashboard:updated',
  'service:created',
  'service:updated',
  'parts:updated',
  ...Object.keys(ALIASES),
]

let socket: Socket | null = null
const listeners = new Set<(event: string, payload?: unknown) => void>()
const recent = new Map<string, number>()
let refreshing = false

function publish(name: string, payload?: unknown) {
  const canonical = ALIASES[name] || name
  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const key = `${canonical}:${String(body.id || body.invoiceId || body.sku || '')}`
  const now = Date.now()
  if (now - (recent.get(key) || 0) < 400) return
  recent.set(key, now)
  if (recent.size > 80) {
    for (const [entry, at] of recent) {
      if (now - at > 1000) recent.delete(entry)
    }
  }
  listeners.forEach((listener) => listener(canonical, payload))
}

export function connectSocket() {
  if (socket) return socket
  store.dispatch(setConnection('reconnecting'))
  socket = io(apiOrigin || undefined, { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'], reconnection: true })
  EVENTS.forEach((event) => {
    socket?.on(event, (payload: unknown) => publish(event, payload))
  })
  socket.on('connect', () => store.dispatch(setConnection('connected')))
  socket.on('disconnect', (reason) => {
    store.dispatch(setConnection(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting'))
  })
  socket.io.on('reconnect_attempt', () => store.dispatch(setConnection('retrying')))
  socket.io.on('reconnect', () => store.dispatch(setConnection('connected')))
  socket.on('connect_error', async (error) => {
    store.dispatch(setConnection(refreshing ? 'retrying' : 'reconnecting'))
    if (!String(error.message).toLowerCase().includes('unauthorized') || refreshing) return
    refreshing = true
    socket?.disconnect()
    try {
      await axios.post(`${apiBase}/auth/refresh`, {}, { withCredentials: true })
      socket?.connect()
    } catch {
      socket?.disconnect()
      socket = null
      store.dispatch(setConnection('disconnected'))
    } finally {
      refreshing = false
    }
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
  store.dispatch(setConnection('disconnected'))
}

export function subscribeRealtime(listener: (event: string, payload?: unknown) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function joinRequestRoom(id: string) {
  socket?.emit('room:join', { type: 'serviceRequest', id })
}

export function leaveRequestRoom(id: string) {
  socket?.emit('room:leave', { type: 'serviceRequest', id })
}
