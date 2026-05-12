import prisma from '@/lib/prisma'

type AuditDb = Pick<typeof prisma, '$executeRaw'>

export type AuditActor = {
  userId?: string | null
  email?: string | null
  role?: string | null
  clientId?: string | null
}

export type AuditLogInput = {
  action: string
  targetType: string
  targetId?: string | null
  clientId?: string | null
  actor?: AuditActor | null
  metadata?: Record<string, unknown> | null
}

export type AuditLogListItem = {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  actorRole: string | null
  clientId: string | null
  clientName: string | null
  clientSlug: string | null
  action: string
  targetType: string
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

type RawAuditLogRow = {
  id: string
  actorUserId: string | null
  actorEmail: string | null
  actorRole: string | null
  clientId: string | null
  action: string
  targetType: string
  targetId: string | null
  metadataJson: string | null
  createdAt: Date
}

function toJson(value: AuditLogInput['metadata']) {
  if (!value) return null
  return JSON.stringify(value)
}

export async function recordAuditLog(
  input: AuditLogInput,
  db: AuditDb = prisma
) {
  await db.$executeRaw`
    INSERT INTO "audit_logs" (
      "actorUserId",
      "actorEmail",
      "actorRole",
      "clientId",
      "action",
      "targetType",
      "targetId",
      "metadataJson",
      "createdAt"
    )
    VALUES (
      ${input.actor?.userId ?? null},
      ${input.actor?.email ?? null},
      ${input.actor?.role ?? null},
      ${input.clientId ?? input.actor?.clientId ?? null},
      ${input.action},
      ${input.targetType},
      ${input.targetId ?? null},
      ${toJson(input.metadata)},
      ${new Date()}
    )
  `
}

export function getSessionAuditActor(
  user:
    | {
        id?: string | null
        email?: string | null
        role?: string | null
        clientId?: string | null
      }
    | null
    | undefined
): AuditActor {
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: user?.role ?? null,
    clientId: user?.clientId ?? null,
  }
}

function parseMetadata(metadataJson: string | null) {
  if (!metadataJson) return null

  try {
    const parsed = JSON.parse(metadataJson)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export async function listAuditLogs(filters: {
  clientId?: string | null
  action?: string | null
  actorEmail?: string | null
  from?: Date | null
  to?: Date | null
  limit?: number
}) {
  const logs = await prisma.$queryRaw<RawAuditLogRow[]>`
    SELECT
      "id",
      "actorUserId",
      "actorEmail",
      "actorRole",
      "clientId",
      "action",
      "targetType",
      "targetId",
      "metadataJson",
      "createdAt"
    FROM "audit_logs"
    WHERE (${filters.clientId ?? null} IS NULL OR "clientId" = ${filters.clientId ?? null})
      AND (${filters.action ?? null} IS NULL OR "action" = ${filters.action ?? null})
      AND (${filters.actorEmail ?? null} IS NULL OR LOWER(COALESCE("actorEmail", '')) LIKE ${`%${(filters.actorEmail ?? '').toLowerCase()}%`})
      AND (${filters.from ?? null} IS NULL OR "createdAt" >= ${filters.from ?? null})
      AND (${filters.to ?? null} IS NULL OR "createdAt" <= ${filters.to ?? null})
    ORDER BY "createdAt" DESC
    LIMIT ${filters.limit ?? 100}
  `

  const clientIds: string[] = [...new Set(logs.map((log) => log.clientId).filter((value): value is string => Boolean(value)))]
  const clients = clientIds.length
    ? await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, slug: true },
      })
    : []

  const clientMap = new Map(clients.map((client) => [client.id, client]))

  return logs.map<AuditLogListItem>((log) => {
    const client = log.clientId ? clientMap.get(log.clientId) : null

    return {
      id: log.id,
      actorUserId: log.actorUserId,
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      clientId: log.clientId,
      clientName: client?.name ?? null,
      clientSlug: client?.slug ?? null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: parseMetadata(log.metadataJson),
      createdAt: log.createdAt.toISOString(),
    }
  })
}
