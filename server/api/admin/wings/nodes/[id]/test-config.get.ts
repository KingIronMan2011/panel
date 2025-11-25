import { createError, defineEventHandler } from 'h3'
import { getServerSession, isAdmin } from '~~/server/utils/session'
import { getWingsNodeConfigurationById, findWingsNode } from '~~/server/utils/wings/nodesStore'
import { useRuntimeConfig, getRequestURL } from '#imports'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  
  if (!isAdmin(session)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin access required',
    })
  }

  const { id } = event.context.params ?? {}
  if (!id || typeof id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing node id' })
  }

  const node = findWingsNode(id)
  if (!node) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }

  const runtimeConfig = useRuntimeConfig()
  const publicAppConfig = (runtimeConfig.public?.app ?? {}) as { baseUrl?: string }
  const requestUrl = getRequestURL(event)
  const panelUrl = publicAppConfig.baseUrl
    || `${requestUrl.protocol}//${requestUrl.host}`

  const encryptionKeyAvailable = !!(process.env.WINGS_ENCRYPTION_KEY 
    || process.env.NUXT_SESSION_PASSWORD
    || process.env.BETTER_AUTH_SECRET
    || process.env.AUTH_SECRET)

  try {
    const configuration = getWingsNodeConfigurationById(id, panelUrl)
    
    return {
      success: true,
      encryptionKeyAvailable,
      nodeId: id,
      tokenLength: configuration.token?.length || 0,
      tokenId: configuration.token_id,
      uuid: configuration.uuid,
      tokenPreview: configuration.token ? `${configuration.token.substring(0, 20)}...` : '(empty)',
      fullConfig: configuration,
    }
  }
  catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      encryptionKeyAvailable,
      nodeId: id,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    }
  }
})

