import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessOrganization, getSessionPermissionUser } from '@/lib/permissions'

/**
 * Usado pelo assistente de novo cliente para fechar o ciclo de provisionamento:
 * responde se alguma maquina daquele cliente ja fez check-in.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  const { id } = await context.params

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, organizationId: true },
  })

  if (!client || !canAccessOrganization(user, client.organizationId)) {
    return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
  }

  const [agentCount, device] = await Promise.all([
    prisma.agentAuth.count({ where: { clientId: client.id, isActive: true } }),
    prisma.device.findFirst({
      where: { clientId: client.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, hostname: true, updatedAt: true },
    }),
  ])

  return NextResponse.json({
    clientSlug: client.slug,
    agentCount,
    device: device
      ? { id: device.id, hostname: device.hostname, lastSeenAt: device.updatedAt.toISOString() }
      : null,
  })
}
