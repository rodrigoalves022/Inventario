import { Sidebar, Header } from '@/components/sidebar'
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

export default async function ClientsPage() {
  const [clients, serverUrl] = await Promise.all([getClients(), getCurrentServerUrl()])

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
      <Sidebar />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
              <p className="text-muted-foreground">
                Provisione tenants, gere instaladores e controle o bootstrap do agente pela web.
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
