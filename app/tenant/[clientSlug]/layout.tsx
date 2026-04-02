import { Header, Sidebar } from '@/components/sidebar'
import { requireTenantContext } from '@/lib/tenant-context'

export default async function TenantLayout({ children, params }: LayoutProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)

  return (
    <div className="flex min-h-screen">
      <Sidebar tenant={tenant} />
      <div className="flex-1 pl-64">
        <Header tenant={tenant} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
