import { createError, getQuery, type H3Event } from 'h3'
import { remoteGetFileContents } from '~~/server/utils/wings/registry'
import { resolveServerRequest } from '~~/server/utils/http/serverAccess'

export default defineEventHandler(async (event: H3Event) => {
  setHeader(event, 'Content-Type', 'application/json')

  const context = await resolveServerRequest(event, {
    requiredPermissions: ['file.read'],
  })

  // Allow file access regardless of server status (offline, online, etc.)
  // Users need to access files even when the server is stopped
  // Only Wings connectivity issues will prevent access

  const query = getQuery(event)
  const file = typeof query.file === 'string' ? query.file : null

  if (!file) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Missing file path',
    })
  }

  try {
    const result = await remoteGetFileContents(context.server.uuid, file, context.node?.id ?? undefined)
    return { data: result }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unable to read file contents.'
    
    console.error('[Files Content] Error fetching file:', {
      serverUuid: context.server.uuid,
      filePath: file,
      error: errorMessage,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    
    throw createError({
      statusCode: 502,
      statusMessage: 'Wings request failed',
      message: errorMessage,
      cause: error,
    })
  }
})
