import { Header, Sidebar } from '@/components/sidebar'
import { requireTenantContext } from '@/lib/tenant-context'

type TenantParams = Promise<{ clientSlug: string }> | { clientSlug: string }

export default async function TenantLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: TenantParams
}>) {
  const { clientSlug } = await Promise.resolve(params)
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
