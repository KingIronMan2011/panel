import { createError, defineEventHandler } from 'h3'
import { getServerSession, isAdmin } from '~~/server/utils/session'
import { getWingsNodeConfigurationById, findWingsNode } from '~~/server/utils/wings/nodesStore'
import { isH3Error } from '~~/server/utils/wings/http'
import { useRuntimeConfig, getRequestURL } from '#imports'

export default defineEventHandler(async (event) => {
  const { id: requestedId } = event.context.params ?? {}
  if (requestedId !== undefined && typeof requestedId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing node id' })
  }

  const session = await getServerSession(event)
  
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'API key authentication required. Provide a valid API key via Authorization: Bearer <key> header.',
    })
  }

  if (!isAdmin(session)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'This account does not have permission to access the API.',
    })
  }

  const nodeId = requestedId || ''
  const node = findWingsNode(nodeId)
  
  if (!node) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }

  const runtimeConfig = useRuntimeConfig()
  const publicAppConfig = (runtimeConfig.public?.app ?? {}) as { baseUrl?: string }
  const requestUrl = getRequestURL(event)
  const panelUrl = publicAppConfig.baseUrl
    || `${requestUrl.protocol}//${requestUrl.host}`

  try {
    const configuration = getWingsNodeConfigurationById(nodeId, panelUrl)
    
    if (!configuration.token || configuration.token.trim().length === 0) {
      console.error(`[Wings Config] Node ${nodeId} configuration has empty token field`)
      console.error(`[Wings Config] Token ID:`, configuration.token_id)
      console.error(`[Wings Config] UUID:`, configuration.uuid)
      throw createError({
        statusCode: 500,
        statusMessage: 'Node configuration error',
        message: `Node ${nodeId} has an invalid or empty token. Please regenerate the node token in the admin panel.`,
      })
    }
    
    console.log(`[Wings Config] Successfully generated configuration for node ${nodeId}, token length: ${configuration.token.length}`)
    return { data: configuration }
  }
  catch (error: unknown) {
    if (isH3Error(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Failed to build node configuration'
    console.error(`[Wings Config] Error generating configuration for node ${nodeId}:`, message)
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
