import type { NextFunction, Request, Response } from 'express'
import { ZodError, type ZodTypeAny } from 'zod'
import { ApiError } from '../utils/ApiError.js'

type Source = 'body' | 'query' | 'params'

export const validate =
  (schema: ZodTypeAny, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const issues = result.error instanceof ZodError ? result.error.issues : []
      return next(
        new ApiError(
          400,
          'Validation failed',
          issues.map((issue) => ({
            field: issue.path.join('.') || source,
            message: issue.message,
          })),
        ),
      )
    }
    if (source === 'body' || source === 'params') {
      req[source] = result.data
    } else {
      Object.assign(req.query, result.data)
      ;(req as Request & { validatedQuery?: unknown }).validatedQuery = result.data
    }
    next()
  }
