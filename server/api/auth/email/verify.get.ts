import { createError, defineEventHandler, getQuery } from 'h3'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { recordAuditEvent } from '~~/server/utils/audit'
import { consumeEmailVerificationToken } from '~~/server/utils/email-verification'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tokenParam = typeof query.token === 'string' ? query.token : null

  if (!tokenParam || tokenParam.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Verification token is required.' })
  }

  const tokenRecord = consumeEmailVerificationToken(tokenParam)
  if (!tokenRecord) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Invalid or expired verification token.' })
  }

  const db = useDrizzle()

  const user = db
    .select({ id: tables.users.id, username: tables.users.username, email: tables.users.email, emailVerified: tables.users.emailVerified })
    .from(tables.users)
    .where(eq(tables.users.id, tokenRecord.userId))
    .get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found for token.' })
  }

  if (user.emailVerified) {
    return {
      success: true,
      alreadyVerified: true,
    }
  }

  const now = new Date()

  db.update(tables.users)
    .set({ emailVerified: now, updatedAt: now })
    .where(eq(tables.users.id, tokenRecord.userId))
    .run()

  await recordAuditEvent({
    actor: user.email || user.username,
    actorType: 'user',
    action: 'account.email.verify',
    targetType: 'user',
    targetId: user.id,
  })

  return {
    success: true,
    verifiedAt: now.toISOString(),
  }
})
