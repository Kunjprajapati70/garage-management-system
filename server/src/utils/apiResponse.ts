import type { Response } from 'express'

export function sendSuccess(
  res: Response,
  data: unknown = null,
  message = 'OK',
  status = 200,
  meta?: Record<string, unknown>,
) {
  const body: Record<string, unknown> = { success: true, message, data }
  if (meta) body.meta = meta
  return res.status(status).json(body)
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  errors: { field?: string; message: string }[] = [],
) {
  return res.status(status).json({ success: false, message, errors })
}
