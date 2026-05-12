import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import { buildProvisioningArtifacts } from '@/lib/provisioning'
import { decryptProvisioningSecret } from '@/lib/provisioning-credentials'
import { getCurrentServerUrl } from '@/lib/server-url'

const querySchema = z.object({
  serverUrl: z.string().trim().url().optional(),
})

function unauthorized() {
  return NextResponse.json({ error: 'Acesso administrativo nao autorizado.' }, { status: 401 })
}

export async function GET(req: NextRequest, context: RouteContext<'/api/clients/[id]/credentials'>) {
  const session = await auth()
  if (!canAccessGlobalAdmin(getSessionPermissionUser(session))) {
    return unauthorized()
  }
  if (!session?.user) {
    return unauthorized()
  }
  const actor = getSessionAuditActor(session.user as { id?: string | null; email?: string | null; role?: string | null; clientId?: string | null })

  const { id } = await context.params
  const parsedQuery = querySchema.safeParse({
    serverUrl: req.nextUrl.searchParams.get('serverUrl') ?? undefined,
  })

  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'URL do servidor invalida.' }, { status: 400 })
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string
    name: string
    slug: string
    activeProvisioningKeyEnc: string | null
    activeProvisioningSetAt: Date | null
  }>>`
    SELECT "id", "name", "slug", "activeProvisioningKeyEnc", "activeProvisioningSetAt"
    FROM "clients"
    WHERE "id" = ${id}
    LIMIT 1
  `

  const client = rows[0]

  if (!client) {
    return NextResponse.json({ error: 'Cliente nao encontrado.' }, { status: 404 })
  }

  if (!client.activeProvisioningKeyEnc) {
    await recordAuditLog({
      action: 'credentials.view',
      targetType: 'client',
      targetId: client.id,
      clientId: client.id,
      actor,
      metadata: {
        clientSlug: client.slug,
        status: 'unavailable',
        reason: 'legacy',
      },
    })
    return NextResponse.json(
      {
        status: 'unavailable',
        reason: 'legacy',
        message: 'Credencial ativa indisponivel para este cliente legado. Emita um novo pacote para estabelecer um pacote exibivel.',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const serverUrl = parsedQuery.data.serverUrl ?? (await getCurrentServerUrl())
    const { enrollmentKey } = decryptProvisioningSecret(client.activeProvisioningKeyEnc)
    const artifacts = buildProvisioningArtifacts(serverUrl, client.slug, enrollmentKey)
    await recordAuditLog({
      action: 'credentials.view',
      targetType: 'client',
      targetId: client.id,
      clientId: client.id,
      actor,
      metadata: {
        clientSlug: client.slug,
        status: 'available',
      },
    })

    return NextResponse.json(
      {
        status: 'available',
        generatedAt: client.activeProvisioningSetAt?.toISOString() ?? null,
        package: {
          clientId: client.id,
          clientName: client.name,
          clientSlug: client.slug,
          enrollmentKey,
          ...artifacts,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[clients/credentials] Erro:', error)
    return NextResponse.json({ error: 'Nao foi possivel recuperar o pacote ativo.' }, { status: 500 })
  }
}
