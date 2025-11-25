import { createError } from 'h3'
import { getServerSession, isAdmin  } from '~~/server/utils/session'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  if (!isAdmin(session)) {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const identifier = getRouterParam(event, 'id')
  if (!identifier) {
    throw createError({
      statusCode: 400,
      message: 'Server ID is required',
    })
  }

  const { findServerByIdentifier } = await import('~~/server/utils/serversStore')
  const server = await findServerByIdentifier(identifier)

  if (!server) {
    throw createError({
      statusCode: 404,
      message: 'Server not found',
    })
  }

  const db = useDrizzle()
  const [limits] = db.select()
    .from(tables.serverLimits)
    .where(eq(tables.serverLimits.serverId, server.id))
    .limit(1)
    .all()

  if (!limits) {
    return {
      data: {
        cpu: 0,
        memory: 0,
        swap: 0,
        disk: 0,
        io: 500,
        threads: null,
        databaseLimit: null,
        allocationLimit: null,
        backupLimit: null,
      },
    }
  }

  return {
    data: limits,
  }
})
