import { getServerSession } from '#auth'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { createError } from 'h3'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { getSessionUser } from '~~/server/utils/session'
import { createPasswordResetToken, markPasswordResetUsed } from '~~/server/utils/password-reset'
import { sendPasswordResetEmail, resolvePanelBaseUrl } from '~~/server/utils/email'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

interface ResetPasswordBody {
  mode?: 'link' | 'temporary'
  password?: string
  notify?: boolean
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const admin = getSessionUser(session)

  if (!admin || admin.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin privileges required',
    })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'User ID is required',
    })
  }

  const body = await readBody<ResetPasswordBody>(event)
  const mode = body.mode ?? 'link'
  const notify = body.notify !== false

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

  if (mode === 'link') {
    const { token } = await createPasswordResetToken(userId)
    if (notify && user.email) {
      const resetBaseUrl = `${resolvePanelBaseUrl()}/auth/password/reset`
      await sendPasswordResetEmail(user.email, token, resetBaseUrl)
    }

    await recordAuditEventFromRequest(event, {
      actor: admin.username,
      actorType: 'user',
      action: 'admin.user.reset_password_link',
      targetType: 'user',
      targetId: userId,
      metadata: {
        notify,
      },
    })

    return {
      success: true,
      mode,
    }
  }

  const temporaryPassword = body.password?.trim() || randomBytes(9).toString('base64url')
  const hashed = await bcrypt.hash(temporaryPassword, 12)
  const now = new Date()

  db.update(tables.users)
    .set({
      password: hashed,
      passwordResetRequired: true,
      updatedAt: now,
    })
    .where(eq(tables.users.id, userId))
    .run()

  db.delete(tables.sessions)
    .where(eq(tables.sessions.userId, userId))
    .run()

  const pending = db
    .select({ id: tables.passwordResets.id })
    .from(tables.passwordResets)
    .where(eq(tables.passwordResets.userId, userId))
    .all()

  for (const entry of pending) {
    markPasswordResetUsed(entry.id, userId)
  }

  await recordAuditEventFromRequest(event, {
    actor: admin.username,
    actorType: 'user',
    action: 'admin.user.reset_password_temporary',
    targetType: 'user',
    targetId: userId,
    metadata: {
      notify,
    },
  })

  return {
    success: true,
    mode,
    temporaryPassword,
    notify,
  }
})
