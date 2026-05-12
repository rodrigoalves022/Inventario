import prisma from '@/lib/prisma'
import { Header, Sidebar } from '@/components/sidebar'
import { auth } from '@/auth'
import { requireTenantContext } from '@/lib/tenant-context'
import { getSessionPermissionUser } from '@/lib/permissions'
import { getTenantCollectionLogWhere } from '@/lib/tenant-scope'

async function getLastCollectionTime(tenantSlug: string): Promise<string | null> {
  const log = await prisma.collectionLog.findFirst({
    where: getTenantCollectionLogWhere(tenantSlug),
    orderBy: { coletadoEm: 'desc' },
    select: { coletadoEm: true },
  })
  return log?.coletadoEm?.toISOString() ?? null
}

export default async function TenantLayout({ children, params }: LayoutProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const session = await auth()
  const lastCollection = await getLastCollectionTime(tenant.slug)
  const user = getSessionPermissionUser(session)

  return (
    <div className="flex min-h-screen">
      <Sidebar tenant={tenant} userRole={user.role} />
      <div className="flex-1 pl-64">
        <Header tenant={tenant} lastCollectionAt={lastCollection} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
