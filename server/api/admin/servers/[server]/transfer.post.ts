import { initiateServerTransfer } from '~~/server/utils/transfers/initiate'
import { requireAdminPermission } from '~~/server/utils/permission-middleware'
import { serverTransferSchema } from '~~/shared/schema/admin/server'
import { validateBody } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const serverId = getRouterParam(event, 'server')
  if (!serverId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Server identifier is required',
    })
  }

  await requireAdminPermission(event)

  const body = await validateBody(event, serverTransferSchema)
  const { nodeId: targetNodeId, allocationId, additionalAllocationIds, startOnCompletion } = body

  try {
    const result = await initiateServerTransfer(serverId, targetNodeId, {
      allocationId,
      additionalAllocationIds,
      startOnCompletion,
    })

    return {
      success: true,
      data: {
        transferId: result.transferId,
        server: result.server,
        sourceNodeId: result.sourceNodeId,
        targetNodeId: result.targetNodeId,
        newAllocationId: result.newAllocationId,
      },
    }
  } catch (error) {
    console.error('Failed to initiate server transfer:', error)
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to initiate server transfer',
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
  }
})
