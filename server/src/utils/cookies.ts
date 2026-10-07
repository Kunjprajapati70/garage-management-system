import type { CookieOptions, Response } from 'express'
import { cookieSecure } from '../config/env.js'
import { durationToMs } from './helpers.js'
import { env } from '../config/env.js'

const base: CookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSecure ? 'none' : 'lax',
  partitioned: cookieSecure,
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('gms_access', accessToken, {
    ...base,
    path: '/',
    maxAge: durationToMs(env.JWT_ACCESS_EXPIRES),
  })
  res.cookie('gms_refresh', refreshToken, {
    ...base,
    path: '/api/auth',
    maxAge: durationToMs(env.JWT_REFRESH_EXPIRES),
  })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('gms_access', { ...base, path: '/' })
  res.clearCookie('gms_refresh', { ...base, path: '/api/auth' })
}
