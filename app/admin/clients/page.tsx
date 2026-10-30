import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download, Plus } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
import { auth } from '@/auth'
import { getSessionPermissionUser, isOrgAdmin, isPlatformAdmin } from '@/lib/permissions'
import { getCurrentServerUrl } from '@/lib/server-url'
import { rotateEnrollmentKeyAction as rotateClientProvisioningAction } from './actions'
import { ClientsPanel } from './clients-panel'
import { getClients } from './queries'
import { type ProvisioningActionState } from './types'

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

  async function rotateEnrollmentKeyAction(state: ProvisioningActionState, formData: FormData) {
    'use server'
    return rotateClientProvisioningAction(state, formData)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      {/* Casca igual a do tenant (app/app/[clientSlug]/layout.tsx): abaixo de
          lg a Sidebar vira drawer, entao o recuo de 256 px so vale a partir de
          lg. `min-w-0` impede que o min-content da tabela alargue o item flex
          e anule o overflow-x-auto do painel. */}
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
                <p className="text-sm text-muted-foreground">
                  Cadastre empresas, gere instaladores e gerencie os agentes de cada cliente.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href="/api/admin/clients/csv">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar CSV
                  </a>
                </Button>
                <Button asChild size="sm" className="gap-2">
                  <Link href="/admin/clients/novo">
                    <Plus className="h-4 w-4" />
                    Novo cliente
                  </Link>
                </Button>
              </div>
            </div>

            <ClientsPanel
              clients={clients}
              serverUrl={serverUrl}
              rotateEnrollmentKeyAction={rotateEnrollmentKeyAction}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
