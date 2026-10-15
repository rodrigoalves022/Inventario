import { isPlatformAdmin, type PermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'

export type ClientListRow = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  /** Todas as credenciais AgentAuth do cliente, revogadas inclusive (coluna "Agentes"). */
  agentCount: number
  /**
   * Credenciais AgentAuth com isActive: true. E o numero de maquinas que
   * continuam fazendo check-in depois de uma rotacao da chave de instalacao
   * (a rotacao nao toca AgentAuth). Mesmo criterio de
   * app/api/clients/[id]/status/route.ts.
   */
  activeAgentCount: number
}

export async function getClients(user: PermissionUser): Promise<ClientListRow[]> {
  const clients = await prisma.client.findMany({
    // PLATFORM_ADMIN ve todas as contas; qualquer outro papel fica restrito
    // a propria organizacao. Sem este filtro, um ORG_ADMIN veria clientes alheios.
    where: isPlatformAdmin(user) ? undefined : { organizationId: user.organizationId ?? '__sem_organizacao__' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          agents: true,
        },
      },
    },
  })

  // Contagem escopada aos clientes ja filtrados por organizacao acima (RNF004).
  const activeCounts =
    clients.length === 0
      ? []
      : await prisma.agentAuth.groupBy({
          by: ['clientId'],
          where: { clientId: { in: clients.map((client) => client.id) }, isActive: true },
          _count: { _all: true },
        })
  const activeByClient = new Map(activeCounts.map((row) => [row.clientId, row._count._all]))

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    isActive: client.isActive,
    createdAt: client.createdAt.toISOString(),
    agentCount: client._count.agents,
    activeAgentCount: activeByClient.get(client.id) ?? 0,
  }))
}
