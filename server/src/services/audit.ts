import type { Request } from 'express'
import { AuditLog } from '../models/Notification.js'

export async function writeAudit(
  req: Request | undefined,
  action: string,
  entity: string,
  summary: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  await AuditLog.create({
    user: req?.user?.id,
    userName: req?.user?.name,
    role: req?.user?.role,
    action,
    entity,
    entityId,
    summary,
    details,
    ip: req?.ip,
  })
}
