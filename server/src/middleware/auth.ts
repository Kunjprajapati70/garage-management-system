import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError.js'
import { verifyAccessToken } from '../utils/tokens.js'
import { User } from '../models/User.js'
import { Mechanic } from '../models/Mechanic.js'
import type { Role } from '../constants.js'

export interface AuthUser {
  id: string
  role: Role
  name: string
  email: string
  mechanicId?: string
  customerId?: string
}

declare global {
  // Express augments Request through the namespace merge.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser
      validatedQuery?: unknown
    }
  }
}

function readToken(req: Request) {
  const cookieToken = req.cookies?.gms_access as string | undefined
  if (cookieToken) return cookieToken
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readToken(req)
    if (!token) throw new ApiError(401, 'Authentication required')
    const payload = verifyAccessToken(token)
    const user = await User.findById(payload.sub).select('name email role isActive customer')
    if (!user || !user.isActive) throw new ApiError(401, 'Session is no longer valid')
    const authUser: AuthUser = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    }
    if (user.role === 'MECHANIC') {
      const mechanic = await Mechanic.findOne({ user: user._id }).select('_id')
      if (!mechanic) throw new ApiError(403, 'Mechanic profile is not configured')
      authUser.mechanicId = mechanic._id.toString()
    }
    if (user.role === 'CUSTOMER') {
      if (!user.customer) throw new ApiError(403, 'Customer profile is not configured')
      authUser.customerId = user.customer.toString()
    }
    req.user = authUser
    next()
  } catch (error) {
    if (error instanceof ApiError) return next(error)
    next(new ApiError(401, 'Authentication required'))
  }
}

export const protect = requireAuth

export const authorize =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const allowed = new Set(roles.map((role) => role.toUpperCase()))
    if (!req.user || !allowed.has(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to perform this action'))
    }
    next()
  }
