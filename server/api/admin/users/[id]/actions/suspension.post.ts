import { getServerSession } from '#auth'
import { createError } from 'h3'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { getSessionUser } from '~~/server/utils/session'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

interface SuspensionBody {
  action: 'suspend' | 'unsuspend'
  reason?: string | null
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const admin = getSessionUser(session)

  if (!admin || admin.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Admin privileges required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  const body = await readBody<SuspensionBody>(event)
  if (!body?.action) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Action is required' })
  }

  const db = useDrizzle()
  const existing = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      suspended: tables.users.suspended,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  const now = new Date()

  if (body.action === 'suspend') {
    const reason = (body.reason ?? '').trim()

    db.update(tables.users)
      .set({
        suspended: true,
        suspendedAt: now,
        suspensionReason: reason.length > 0 ? reason : null,
        updatedAt: now,
      })
      .where(eq(tables.users.id, userId))
      .run()

    db.delete(tables.sessions)
      .where(eq(tables.sessions.userId, userId))
      .run()

    await recordAuditEventFromRequest(event, {
      actor: admin.username,
      actorType: 'user',
      action: 'admin.user.suspend',
      targetType: 'user',
      targetId: userId,
      metadata: {
        reason: reason.length > 0 ? reason : undefined,
      },
    })

    return {
      success: true,
      suspended: true,
      reason: reason.length > 0 ? reason : null,
    }
  }

  db.update(tables.users)
    .set({
      suspended: false,
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: now,
    })
    .where(eq(tables.users.id, userId))
    .run()

  await recordAuditEventFromRequest(event, {
    actor: admin.username,
    actorType: 'user',
    action: 'admin.user.unsuspend',
    targetType: 'user',
    targetId: userId,
  })

  return {
    success: true,
    suspended: false,
  }
})
