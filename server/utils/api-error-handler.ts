import type { H3Event } from 'h3'
import { createError } from 'h3'

/**
 * Ensures API endpoints always return JSON, even on errors
 * This prevents Nitro from returning HTML error pages
 */
export function ensureJsonResponse(event: H3Event) {
  const acceptHeader = event.node.req.headers.accept || ''
  if (acceptHeader && acceptHeader.includes('text/html')) {
    event.node.req.headers.accept = acceptHeader
      .split(',')
      .map(h => h.trim())
      .filter(h => !h.includes('text/html'))
      .join(',') || 'application/json'
  }
  
  event.node.res.setHeader('Content-Type', 'application/json')
}

export function createJsonError(
  statusCode: number,
  statusMessage: string,
  message: string,
  data?: unknown
) {
  return createError({
    statusCode,
    statusMessage,
    message,
    data,
  })
}



