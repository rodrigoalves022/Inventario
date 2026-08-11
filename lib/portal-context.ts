import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getSessionPermissionUser, isClientViewer } from '@/lib/permissions'

export type PortalContext = {
  clientId: string
  clientName: string
  clientSlug: string
  viewerName: string | null
  viewerEmail: string | null
}

/**
 * O portal deriva o cliente da SESSAO, nunca da URL. Sem slug na rota nao ha o
 * que enumerar nem adulterar — o visitante so pode alcancar o proprio parque.
 * Essa e a diferenca central para /tenant/[clientSlug]/*, que e a superficie
 * de operacao e aceita qualquer tenant que o usuario tenha permissao de ver.
 */
async function resolvePortalContext(): Promise<PortalContext | null> {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!session?.user) return null

  // Exclusivo de CLIENT_VIEWER. Um admin da plataforma nao tem clientId
  // vinculado, entao nao ha portal a resolver para ele — visualizar o portal
  // de um cliente exigiria um seletor de cliente, que ainda nao existe.
  if (!isClientViewer(user)) return null
  if (!user.clientId) return null

  const client = await prisma.client.findFirst({
    where: {
      id: user.clientId,
      isActive: true,
      organization: { is: { isActive: true } },
    },
    select: { id: true, name: true, slug: true },
  })

  if (!client) return null

  return {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    viewerName: session.user.name ?? null,
    viewerEmail: session.user.email ?? null,
  }
}

export const getPortalContext = cache(resolvePortalContext)

export async function requirePortalContext(): Promise<PortalContext> {
  const context = await getPortalContext()
  if (!context) {
    // Sem vinculo utilizavel: manda para o roteador de entrada em vez de
    // vazar a existencia ou nao de um cliente.
    redirect('/dashboard')
  }
  return context
}

/** Garante que o dispositivo pertence ao cliente do portal. */
export async function requirePortalDevice(deviceId: string, clientId: string) {
  const device = await prisma.device.findFirst({
    where: { id: deviceId, clientId },
    include: {
      hardware: true,
      disks: { orderBy: { unidade: 'asc' } },
      networks: { orderBy: [{ isPrimary: 'desc' }, { ip: 'asc' }] },
      software: { orderBy: { nome: 'asc' } },
      logs: { orderBy: { coletadoEm: 'desc' }, take: 1 },
    },
  })

  if (!device) notFound()
  return device
}
