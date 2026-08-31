import prisma from '@/lib/prisma'
import { Header, Sidebar } from '@/components/sidebar'
import { auth } from '@/auth'
import { requireTenantContext } from '@/lib/tenant-context'
import { getSessionPermissionUser, isOrgAdmin, isOrgOperator } from '@/lib/permissions'
import { getTenantCollectionLogWhere } from '@/lib/tenant-scope'

/** So busca os clientes-irmaos quando o papel realmente usa o switcher (ver
 * componentes/sidebar.tsx) — evita query a toa pra quem nunca ve o controle. */
async function getSwitchableClients(organizationId: string) {
  return prisma.client.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  })
}

async function getLastCollectionTime(tenantSlug: string): Promise<string | null> {
  const log = await prisma.collectionLog.findFirst({
    where: getTenantCollectionLogWhere(tenantSlug),
    orderBy: { coletadoEm: 'desc' },
    select: { coletadoEm: true },
  })
  return log?.coletadoEm?.toISOString() ?? null
}

export default async function TenantLayout({ children, params }: LayoutProps<'/app/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const session = await auth()
  const user = getSessionPermissionUser(session)
  const canSwitchClient = isOrgAdmin(user) || isOrgOperator(user)

  const [lastCollection, switchableClients] = await Promise.all([
    getLastCollectionTime(tenant.slug),
    canSwitchClient ? getSwitchableClients(tenant.organizationId) : Promise.resolve([]),
  ])

  return (
    <div className="flex min-h-screen">
      <Sidebar
        tenant={tenant}
        user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }}
        switchableClients={canSwitchClient ? switchableClients : undefined}
      />
      <div className="flex-1 lg:pl-64">
        <Header tenant={tenant} lastCollectionAt={lastCollection} now={new Date().toISOString()} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
