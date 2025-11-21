import { getServerSession } from '#auth'
import { createError } from 'h3'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { getSessionUser } from '~~/server/utils/session'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { createEmailVerificationToken } from '~~/server/utils/email-verification'
import { sendEmailVerificationEmail } from '~~/server/utils/email'

interface EmailVerificationBody {
  action: 'mark-verified' | 'mark-unverified' | 'resend-link'
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

  const body = await readBody<EmailVerificationBody>(event)
  const action = body.action

  if (!action) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Action is required' })
  }

  const db = useDrizzle()

  const user = db
    .select({
      id: tables.users.id,
      email: tables.users.email,
      username: tables.users.username,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  const now = new Date()

  switch (action) {
    case 'mark-verified':
      db.update(tables.users)
        .set({ emailVerified: now, updatedAt: now })
        .where(eq(tables.users.id, userId))
        .run()
      break
    case 'mark-unverified':
      db.update(tables.users)
        .set({ emailVerified: null, updatedAt: now })
        .where(eq(tables.users.id, userId))
        .run()
      break
    case 'resend-link':
      {
        if (!user.email) {
          throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User is missing an email address' })
        }

        const { token, expiresAt } = await createEmailVerificationToken(user.id)
        await sendEmailVerificationEmail({
          to: user.email,
          token,
          expiresAt,
          username: user.username,
        })
        break
      }
  }

  await recordAuditEventFromRequest(event, {
    actor: admin.username,
    actorType: 'user',
    action: `admin.user.email.${action}`,
    targetType: 'user',
    targetId: userId,
  })

  return {
    success: true,
    action,
  }
})
