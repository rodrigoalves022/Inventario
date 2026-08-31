import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import {
  getSessionPermissionUser,
  isOrgAdmin,
  isPlatformAdmin,
  type PermissionUser,
} from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { getCurrentServerUrl } from '@/lib/server-url'
import {
  createClientAction as createClientProvisioningAction,
  rotateEnrollmentKeyAction as rotateClientProvisioningAction,
} from './actions'
import { ClientsPanel } from './clients-panel'
import { type ProvisioningActionState } from './types'

async function getClients(user: PermissionUser) {
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

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    slug: client.slug,
    isActive: client.isActive,
    createdAt: client.createdAt.toISOString(),
    agentCount: client._count.agents,
  }))
}

async function requireClientsAdminAccess() {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!isPlatformAdmin(user) && !isOrgAdmin(user)) {
    notFound()
  }

  return { session, user }
}

export default async function ClientsPage() {
  const { session, user } = await requireClientsAdminAccess()
  const [clients, serverUrl] = await Promise.all([getClients(user), getCurrentServerUrl()])

  async function createClientAction(state: ProvisioningActionState, formData: FormData) {
    'use server'
    return createClientProvisioningAction(state, formData)
  }

  async function rotateEnrollmentKeyAction(state: ProvisioningActionState, formData: FormData) {
    'use server'
    return rotateClientProvisioningAction(state, formData)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            {/* Sem h1 aqui: o cabecalho fixo ja exibe "Clientes". Repetir o
                titulo logo abaixo dele gastava altura util sem informar nada. */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Cadastre empresas, gere instaladores e gerencie os agentes de cada cliente.
              </p>
              <Button asChild size="sm" className="gap-2">
                <Link href="/admin/clients/novo">
                  <Plus className="h-4 w-4" />
                  Novo cliente
                </Link>
              </Button>
            </div>

            <ClientsPanel
              clients={clients}
              serverUrl={serverUrl}
              createClientAction={createClientAction}
              rotateEnrollmentKeyAction={rotateEnrollmentKeyAction}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
