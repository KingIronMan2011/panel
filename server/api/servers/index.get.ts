import { createError, getQuery } from 'h3'
import { requireAuth } from '~~/server/utils/security'
import { useDrizzle, tables, eq, isNotNull, and, desc } from '~~/server/utils/drizzle'

import type { ServerListEntry, ServersResponse } from '#shared/types/server'

export default defineEventHandler(async (event): Promise<ServersResponse> => {
  try {
    const session = await requireAuth(event)
    const user = session.user

    const query = getQuery(event)
    const scopeParam = typeof query.scope === 'string' ? query.scope : 'own'
    const scope = scopeParam === 'all' ? 'all' : 'own'
    const includeAll = scope === 'all'

    if (includeAll) {
      const userRole = (user as { role?: string }).role
      if (userRole !== 'admin') {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Admin access required to view all servers' })
      }
    }

    const db = useDrizzle()

    const whereConditions = [isNotNull(tables.servers.nodeId)]
    if (!includeAll) {
      whereConditions.push(eq(tables.servers.ownerId, user.id))
    }

    const servers = db
      .select({
        server: tables.servers,
        node: tables.wingsNodes,
      })
      .from(tables.servers)
      .leftJoin(tables.wingsNodes, eq(tables.servers.nodeId, tables.wingsNodes.id))
      .where(and(...whereConditions))
      .orderBy(desc(tables.servers.updatedAt)) 
      .all()

    const records: ServerListEntry[] = servers
      .map(({ server, node }) => ({
        uuid: server.uuid,
        identifier: server.identifier,
        name: server.name,
        nodeId: server.nodeId!,
        nodeName: node?.name || 'Unknown Node',
        description: server.description || null,
        limits: null,
        featureLimits: null,
        status: server.status || 'unknown',
        ownership: includeAll ? 'shared' : 'mine',
        suspended: server.suspended || false,
        isTransferring: false,
      }))

    return {
      data: records,
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[GET] /api/servers: Error fetching servers:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Failed to fetch servers',
    })
  }
})
