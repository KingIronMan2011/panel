import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'

const IMPERSONATION_TOKEN_TTL_MINUTES = 10

function hashTokenSecret(secret: Buffer | string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function generateImpersonationToken(userId: string, issuedBy: string) {
  const db = useDrizzle()
  const rawToken = randomBytes(24).toString('base64url')
  const tokenHash = hashTokenSecret(Buffer.from(rawToken))
  const now = new Date()
  const expiresAt = new Date(now.getTime() + IMPERSONATION_TOKEN_TTL_MINUTES * 60 * 1000)
  const id = randomUUID()

  db.insert(tables.userImpersonationTokens)
    .values({
      id,
      userId,
      issuedBy,
      tokenHash,
      expiresAt,
      consumedAt: null,
      createdAt: now,
    })
    .run()

  return {
    id,
    token: `${id}.${rawToken}`,
    expiresAt,
  }
}

export function consumeImpersonationToken(rawToken: string) {
  const db = useDrizzle()
  const [id, secret] = rawToken.split('.')
  if (!id || !secret) {
    return null
  }

  const tokenHash = hashTokenSecret(Buffer.from(secret))

  const record = db
    .select({
      id: tables.userImpersonationTokens.id,
      userId: tables.userImpersonationTokens.userId,
      issuedBy: tables.userImpersonationTokens.issuedBy,
      tokenHash: tables.userImpersonationTokens.tokenHash,
      expiresAt: tables.userImpersonationTokens.expiresAt,
      consumedAt: tables.userImpersonationTokens.consumedAt,
    })
    .from(tables.userImpersonationTokens)
    .where(eq(tables.userImpersonationTokens.id, id))
    .get()

  if (!record || record.tokenHash !== tokenHash) {
    return null
  }

  const now = new Date()
  if (record.consumedAt || (record.expiresAt && new Date(record.expiresAt) < now)) {
    return null
  }

  db.update(tables.userImpersonationTokens)
    .set({ consumedAt: now })
    .where(eq(tables.userImpersonationTokens.id, id))
    .run()

  return {
    userId: record.userId,
    issuedBy: record.issuedBy,
  }
}
