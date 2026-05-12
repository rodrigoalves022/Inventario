import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import { canAccessGlobalAdmin, getSessionPermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { getCurrentServerUrl } from '@/lib/server-url'
import {
  createClientAction as createClientProvisioningAction,
  rotateEnrollmentKeyAction as rotateClientProvisioningAction,
} from './actions'
import { ClientsPanel } from './clients-panel'
import { type ProvisioningActionState } from './types'

async function getClients() {
  const clients = await prisma.client.findMany({
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
  if (!canAccessGlobalAdmin(getSessionPermissionUser(session))) {
    notFound()
  }

  return session
}

export default async function ClientsPage() {
  const session = await requireClientsAdminAccess()
  const [clients, serverUrl] = await Promise.all([getClients(), getCurrentServerUrl()])
  const user = getSessionPermissionUser(session)

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
      <Sidebar userRole={user.role} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
              <p className="text-muted-foreground">
                Cadastre empresas, gere instaladores e gerencie os agentes de cada cliente.
              </p>
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
