import { createError, getQuery, type H3Event } from 'h3'
import { remoteListServerDirectory } from '~~/server/utils/wings/registry'
import { resolveServerRequest } from '~~/server/utils/http/serverAccess'
import { debugError } from '~~/server/utils/logger'

export default defineEventHandler(async (event: H3Event) => {
  const context = await resolveServerRequest(event, {
    requiredPermissions: ['file.read'],
  })

  const query = getQuery(event)
  const directory = typeof query.directory === 'string' ? query.directory : '/'

  try {
    const nodeId = context.node?.id ? String(context.node.id) : undefined
    const listing = await remoteListServerDirectory(context.server.uuid, directory, nodeId)
    return { data: listing }
  }
  catch (error) {
    let errorMessage = 'Unable to list server directory.'
    let statusCode = 502
    let errorData: Record<string, unknown> = {}

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const h3Error = error as { statusCode: number; message?: string; data?: unknown }
      statusCode = h3Error.statusCode
      errorMessage = h3Error.message || errorMessage
      if (h3Error.data && typeof h3Error.data === 'object') {
        errorData = h3Error.data as Record<string, unknown>
      }
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    debugError('[Files List] Failed to list directory:', {
      serverUuid: context.server.uuid,
      serverStatus: context.server.status,
      directory,
      error: errorMessage,
      statusCode,
    })

    if (context.server.status === 'installing') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Server not ready',
        message: 'The server is currently installing. Please wait for installation to complete.',
        data: {
          serverUuid: context.server.uuid,
          status: context.server.status,
          wingsError: errorMessage,
        },
      })
    }
    
    if (context.server.status === 'install_failed' && (errorMessage.includes('directory') || errorMessage.includes('not found') || statusCode === 404)) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Server directory not found',
        message: 'The server directory does not exist. This usually happens when installation fails. Please try installing the server again using the "Install on Wings" button.',
        data: {
          serverUuid: context.server.uuid,
          status: context.server.status,
          wingsError: errorMessage,
        },
      })
    }

    if (statusCode === 403) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Wings Authentication Failed',
        message: 'Unable to authenticate with Wings daemon. The Wings node token may be incorrect. Please update your Wings configuration with the token from Admin → Wings → Nodes → [Your Node] → Configuration.',
        data: {
          serverUuid: context.server.uuid,
          directory,
          nodeId: context.node?.id,
          wingsError: errorMessage,
          ...errorData,
        },
        cause: error,
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode,
      statusMessage: 'Wings request failed',
      message: errorMessage,
      data: {
        serverUuid: context.server.uuid,
        directory,
        ...errorData,
      },
      cause: error,
    })
  }
})
