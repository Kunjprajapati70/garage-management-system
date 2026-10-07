import jwt, { type SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import type { Role } from '../constants.js'

export interface AccessPayload {
  sub: string
  role: Role
  name: string
  email: string
}

export function signAccessToken(payload: AccessPayload) {
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn'] }
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options)
}

export function signRefreshToken(userId: string) {
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn'] }
  return jwt.sign({ sub: userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, options)
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string; type: string }
}

export function hashToken(token: string) {
  return bcrypt.hash(token, 8)
}

export function compareToken(token: string, hash: string) {
  return bcrypt.compare(token, hash)
}
