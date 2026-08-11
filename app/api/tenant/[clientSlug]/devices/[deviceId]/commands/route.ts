import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'
import { canAccessTenant, canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { agentCommandInputSchema, toParamsJson, AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'

type Params = { clientSlug: string; deviceId: string }

async function resolveDevice(clientSlug: string, deviceId: string) {
  return prisma.device.findFirst({
    where: {
      id: deviceId,
      ...getTenantDeviceWhere(clientSlug),
    },
    select: { id: true, hostname: true, agentAuthId: true, agentAuth: { select: { clientId: true } } },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  const { clientSlug, deviceId } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(clientSlug)

  if (!session?.user || !tenant || !canOperateTenant(user, tenant)) {
    return NextResponse.json({ error: 'Você não pode enfileirar comandos neste tenant.' }, { status: 403 })
  }

  const device = await resolveDevice(clientSlug, deviceId)
  if (!device || !device.agentAuth.clientId) {
    return NextResponse.json({ error: 'Máquina não encontrada.' }, { status: 404 })
  }

  const rawBody = await req.json().catch(() => null)
  const parsed = agentCommandInputSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Comando inválido.', details: parsed.error.flatten() }, { status: 400 })
  }

  const actor = getSessionAuditActor(user)

  const command = await prisma.agentCommand.create({
    data: {
      agentAuthId: device.agentAuthId,
      clientId: device.agentAuth.clientId,
      type: parsed.data.type,
      paramsJson: toParamsJson(parsed.data),
      status: 'pending',
      requestedByUserId: actor.userId ?? null,
      expiresAt: new Date(Date.now() + AGENT_COMMAND_TTL_MS),
    },
  })

  await recordAuditLog({
    action: 'command.enqueue',
    targetType: 'device',
    targetId: device.id,
    clientId: device.agentAuth.clientId,
    actor,
    metadata: {
      commandId: command.id,
      type: parsed.data.type,
      hostname: device.hostname,
      tenantSlug: clientSlug,
    },
  })

  return NextResponse.json({ ok: true, command: { id: command.id, type: command.type, status: command.status } }, { status: 201 })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<Params> }) {
  const { clientSlug, deviceId } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)

  const tenant = await getTenantContext(clientSlug)

  // Leitura do historico: qualquer um que possa ver o tenant (inclui portal read-only).
  if (!session?.user || !tenant || !canAccessTenant(user, tenant)) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 })
  }

  const device = await resolveDevice(clientSlug, deviceId)
  if (!device) {
    return NextResponse.json({ error: 'Máquina não encontrada.' }, { status: 404 })
  }

  const commands = await prisma.agentCommand.findMany({
    where: { agentAuthId: device.agentAuthId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ commands })
}
