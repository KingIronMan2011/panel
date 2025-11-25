import { createError, getRouterParam, setResponseHeader } from 'h3'
import { resolveServerRequest } from '~~/server/utils/http/serverAccess'
import { generateWingsJWT } from '~~/server/utils/wings/jwt'

interface WebSocketToken {
  token: string
  socket: string
}

export default defineEventHandler(async (event): Promise<WebSocketToken> => {
  const id = getRouterParam(event, 'server')
  if (!id || typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Missing server identifier',
    })
  }

  const context = await resolveServerRequest(event, {
    identifier: id,
    requiredPermissions: ['websocket.connect'],
  })

  if (!context.node || !context.nodeConnection) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Node not available',
      message: 'Server has no resolved Wings node',
    })
  }

  const { node, nodeConnection, user, server, permissions } = context

  const baseUrl = `${node.scheme}://${node.fqdn}:${node.daemonListen}`
  
  const token = await generateWingsJWT(
    {
      tokenSecret: nodeConnection.tokenSecret,
      baseUrl,
    },
    {
      server: { uuid: server.uuid },
      user: user.id ? { id: user.id, uuid: user.id } : undefined,
      permissions,
      identifiedBy: `${user.id ?? 'anonymous'}:${server.uuid}`,
      expiresIn: 900,
    },
  )

  const protocol = node.scheme === 'https' ? 'wss' : 'ws'
  const socketUrl = `${protocol}://${node.fqdn}:${node.daemonListen}/api/servers/${server.uuid}/ws`

  const response: WebSocketToken = {
    token,
    socket: socketUrl,
  }
  
  setResponseHeader(event, 'Content-Type', 'application/json')
  
  return response
})
