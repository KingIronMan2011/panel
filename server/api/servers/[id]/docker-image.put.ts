import { resolveServerRequest } from '~~/server/utils/http/serverAccess'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { updateDockerImageSchema } from '~~/shared/schema/server/operations'

export default defineEventHandler(async (event) => {
  console.log('🐳🐳🐳 [Docker Image PUT] CLIENT ENDPOINT HIT!!!', {
    path: event.path,
    method: event.method,
    params: event.context.params,
    timestamp: new Date().toISOString(),
  })

  const identifier = event.context.params?.id
  if (!identifier) {
    throw createError({
      statusCode: 400,
      message: 'Server identifier is required',
    })
  }

  const context = await resolveServerRequest(event, {
    identifier,
    requiredPermissions: ['startup.update'],
  })

  const body = await readBody(event)
  const validation = updateDockerImageSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request body',
      data: validation.error.issues,
    })
  }

  const { dockerImage } = validation.data
  const db = useDrizzle()

  const egg = context.server.eggId
    ? db
        .select()
        .from(tables.eggs)
        .where(eq(tables.eggs.id, context.server.eggId))
        .get()
    : null

  if (egg?.dockerImages) {
    let dockerImages: Record<string, string> = {}
    try {
      dockerImages = typeof egg.dockerImages === 'string'
        ? JSON.parse(egg.dockerImages)
        : egg.dockerImages
    } catch (e) {
      console.warn('[Docker Image PUT] Failed to parse egg dockerImages:', e)
    }

    const validImages = Object.values(dockerImages)
    if (validImages.length > 0 && !validImages.includes(dockerImage)) {
      throw createError({
        statusCode: 400,
        message: 'This server\'s Docker image can only be changed to one from the egg\'s list.',
      })
    }
  }

  console.log('[Docker Image PUT] Updating Docker image:', {
    serverId: context.server.id,
    serverUuid: context.server.uuid,
    oldDockerImage: context.server.dockerImage,
    oldImage: context.server.image,
    newDockerImage: dockerImage,
  })

  db.update(tables.servers)
    .set({
      dockerImage: dockerImage,
      image: dockerImage, 
      updatedAt: new Date(),
    })
    .where(eq(tables.servers.id, context.server.id))
    .run()

  console.log('[Docker Image PUT] Docker image updated successfully')

  return {
    success: true,
    message: 'Docker image updated successfully. Restart your server for changes to take effect.',
  }
})
