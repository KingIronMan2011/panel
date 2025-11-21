import { getServerSession } from '#auth'
import { createError, getRequestURL } from 'h3'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { getSessionUser } from '~~/server/utils/session'
import { generateImpersonationToken } from '~~/server/utils/impersonation'
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

  if (userId === admin.id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Cannot impersonate yourself' })
  }

  const db = useDrizzle()

  const user = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      suspended: tables.users.suspended,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  if (user.suspended) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Cannot impersonate a suspended user' })
  }

  const { token, expiresAt } = generateImpersonationToken(userId, admin.id)

  await recordAuditEventFromRequest(event, {
    actor: admin.username,
    actorType: 'user',
    action: 'admin.user.impersonate',
    targetType: 'user',
    targetId: userId,
    metadata: {
      expiresAt: expiresAt.toISOString(),
    },
  })

  const runtimeConfig = useRuntimeConfig()
  const requestUrl = getRequestURL(event)
  const baseUrl = runtimeConfig.public?.panelBaseUrl || requestUrl.origin
  const impersonateUrl = `${baseUrl}/auth/impersonate?token=${encodeURIComponent(token)}`

  return {
    success: true,
    impersonateUrl,
    expiresAt: expiresAt.toISOString(),
  }
})
