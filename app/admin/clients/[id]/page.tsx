import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import { canManageTenant, getSessionPermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { getCurrentServerUrl } from '@/lib/server-url'
import { getClientUsers } from '../queries'
import { ClientManagementPanel } from './client-management-panel'

/**
 * Central de gerenciamento de UM cliente. Mesmo guard de ../agents/page.tsx:
 * o cliente e carregado e `canManageTenant` decide; inexistente e sem permissao
 * recebem o MESMO notFound() (sem oraculo de existencia, RNF004).
 */
export default async function ClientManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      organizationId: true,
      isActive: true,
      discoveryEnabled: true,
      metricsRetentionDays: true,
      alertsEnabled: true,
      alertWebhookEnabled: true,
      alertWebhookUrl: true,
      alertOfflineHours: true,
      alertDiskThresholdGb: true,
      alertRamThresholdGb: true,
    },
  })

  if (!client || !canManageTenant(user, client)) {
    notFound()
  }

  const [users, serverUrl, activeAgentCount, totalAgentCount] = await Promise.all([
    getClientUsers(client.id),
    getCurrentServerUrl(),
    prisma.agentAuth.count({ where: { clientId: client.id, isActive: true } }),
    prisma.agentAuth.count({ where: { clientId: client.id } }),
  ])

  const sessionUser = { name: session?.user?.name, email: session?.user?.email, role: user.role }

  return (
    <div className="flex min-h-screen">
      <Sidebar user={sessionUser} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={sessionUser} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Link
                href="/admin/clients"
                className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Clientes
              </Link>
              <h1 className="text-2xl font-bold text-foreground">Gerenciar {client.name}</h1>
              <p className="text-sm text-muted-foreground">
                Pacote de instalação, usuários, alertas, rede e agentes deste cliente em um só lugar.
              </p>
            </div>

            <ClientManagementPanel
              client={client}
              users={users}
              serverUrl={serverUrl}
              activeAgentCount={activeAgentCount}
              totalAgentCount={totalAgentCount}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
