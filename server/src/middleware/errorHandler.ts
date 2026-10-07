import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { ApiError } from '../utils/ApiError.js'
import { sendError } from '../utils/apiResponse.js'
import { env } from '../config/env.js'

export function notFound(req: Request, res: Response) {
  sendError(res, 404, `Route ${req.method} ${req.originalUrl} was not found`)
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return sendError(res, err.statusCode, err.message, err.errors)
  }

  if (err instanceof ZodError) {
    return sendError(
      res,
      400,
      'Validation failed',
      err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    )
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }))
    return sendError(res, 400, 'Validation failed', errors)
  }

  if (err instanceof mongoose.Error.CastError) {
    return sendError(res, 400, `Invalid ${err.path}`)
  }

  const duplicate = err as { code?: number; keyValue?: Record<string, unknown> }
  if (duplicate.code === 11000) {
    const field = Object.keys(duplicate.keyValue || {})[0] || 'field'
    return sendError(res, 409, `A record with this ${field} already exists`, [
      { field, message: 'Must be unique' },
    ])
  }

  const status = (err as { status?: number; statusCode?: number }).status || (err as { statusCode?: number }).statusCode
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 429) {
    return sendError(res, status, err instanceof Error ? err.message : 'Request failed')
  }

  console.error(err)
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err instanceof Error ? err.message : 'Internal server error'
  return sendError(res, 500, message)
}
