import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import { canManageTenant, getSessionPermissionUser } from '@/lib/permissions'
import prisma from '@/lib/prisma'
import { revokeAgentAuthAction } from '../../actions'
import { getClientAgents } from '../../queries'
import { ClientAgentsPanel } from './client-agents-panel'

/**
 * Sprint A3 (RF029, RF030, UC 3.12). Instalacoes de agente de UM cliente.
 *
 * Guard proprio, de proposito diferente do de /admin/clients (que so olha o
 * papel): aqui o cliente e carregado e `canManageTenant(user, client)` decide,
 * entao um ORG_ADMIN de outra organizacao nao entra. Inexistente e sem
 * permissao recebem o MESMO notFound(), sem oraculo de existencia (RNF004).
 * O proxy.ts ja barra ORG_OPERATOR e CLIENT_VIEWER em /admin/clients/*; esta
 * checagem e a segunda camada e a unica que olha a organizacao.
 */
export default async function ClientAgentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const user = getSessionPermissionUser(session)

  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, organizationId: true, isActive: true },
  })

  if (!client || !canManageTenant(user, client)) {
    notFound()
  }

  const agents = await getClientAgents(client.id)

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      {/* Mesma casca de /admin/clients (page.tsx): recuo so a partir de lg e
          `min-w-0` para o overflow-x-auto da tabela funcionar. */}
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header />
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
              <div>
                <h1 className="text-2xl font-bold text-foreground">Agentes de {client.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Cada linha é uma instalação do agente, identificada pela própria credencial. Revogue a
                  instalação de uma máquina que saiu da empresa ou foi reinstalada.
                </p>
              </div>
            </div>

            <ClientAgentsPanel
              client={{ id: client.id, name: client.name, isActive: client.isActive }}
              agents={agents}
              revokeAgentAuthAction={revokeAgentAuthAction}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
