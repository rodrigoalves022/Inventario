import { isPlatformAdmin, type PermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'

export type ClientListRow = {
  id: string
  name: string
  slug: string
  isActive: boolean
  createdAt: string
  /**
   * Credenciais AgentAuth com isActive: true. Alimenta a coluna "Agentes"
   * (RN020, Sprint A3: revogados nao contam) e o dialogo de rotacao (maquinas
   * que continuam fazendo check-in se a rotacao nao revogar os agentes).
   * Mesmo criterio de app/api/clients/[id]/status/route.ts.
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
    activeAgentCount: activeByClient.get(client.id) ?? 0,
  }))
}

/**
 * Uma instalacao de agente do cliente (Sprint A3, RF029). A identidade da
 * linha e o `id` do AgentAuth; `name` e `hostname` sao so exibicao (duas
 * linhas de mesmo nome sao uma reinstalacao).
 */
export type ClientAgentRow = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  revokedAt: string | null
  /** O AgentAuth tem Device (ja fez check-in e a maquina nao foi excluida). */
  hasDevice: boolean
  hostname: string | null
  agentVersion: string | null
  /**
   * CollectionLog mais recente, com fallback em Device.updatedAt (mesmo padrao
   * de lib/tenant-device-rows.ts). Null sem Device. AgentCheckLog nao serve:
   * so grava em erro.
   */
  lastCollectionAt: string | null
}

/**
 * Todos os AgentAuth (ativos e revogados) de UM cliente. O chamador ja
 * autorizou o cliente com canManageTenant; o escopo aqui e so o clientId dele
 * (RNF004). Ativos primeiro, depois os mais recentes (decisao 6 do usuario).
 */
export async function getClientAgents(clientId: string): Promise<ClientAgentRow[]> {
  const agents = await prisma.agentAuth.findMany({
    where: { clientId },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      revokedAt: true,
      device: {
        select: {
          hostname: true,
          agentVersion: true,
          updatedAt: true,
          logs: { orderBy: { coletadoEm: 'desc' }, take: 1, select: { coletadoEm: true } },
        },
      },
    },
  })

  return agents.map((agent) => {
    const device = agent.device
    const lastCollectionAt = device ? (device.logs[0]?.coletadoEm ?? device.updatedAt) : null

    return {
      id: agent.id,
      name: agent.name,
      isActive: agent.isActive,
      createdAt: agent.createdAt.toISOString(),
      revokedAt: agent.revokedAt ? agent.revokedAt.toISOString() : null,
      hasDevice: Boolean(device),
      hostname: device?.hostname ?? null,
      agentVersion: device?.agentVersion ?? null,
      lastCollectionAt: lastCollectionAt ? lastCollectionAt.toISOString() : null,
    }
  })
}
