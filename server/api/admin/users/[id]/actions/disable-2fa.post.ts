import { getServerSession } from '#auth'
import { createError } from 'h3'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { getSessionUser } from '~~/server/utils/session'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

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

  const db = useDrizzle()

  const existing = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      useTotp: tables.users.useTotp,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  const now = new Date()

  db.update(tables.users)
    .set({
      useTotp: false,
      totpSecret: null,
      totpAuthenticatedAt: null,
      updatedAt: now,
    })
    .where(eq(tables.users.id, userId))
    .run()

  db.delete(tables.recoveryTokens)
    .where(eq(tables.recoveryTokens.userId, userId))
    .run()

  await recordAuditEventFromRequest(event, {
    actor: admin.username,
    actorType: 'user',
    action: 'admin.user.disable_2fa',
    targetType: 'user',
    targetId: userId,
  })

  return {
    success: true,
    message: existing.useTotp
      ? 'Two-factor authentication has been disabled for the user.'
      : 'Two-factor authentication was already disabled.',
  }
})
