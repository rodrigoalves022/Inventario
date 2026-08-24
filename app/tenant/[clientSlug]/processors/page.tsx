import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { getTenantPath } from '@/lib/tenant-links'
import { TenantProcessorsTable } from '@/components/tenant-processors-table'

function inferVendor(processorName: string) {
  const normalized = processorName.toLowerCase()
  if (normalized.includes('intel')) return 'Intel'
  if (normalized.includes('amd')) return 'AMD'
  if (normalized.includes('xeon')) return 'Intel Xeon'
  return 'Nao identificado'
}

export default async function TenantProcessorsPage({ params, searchParams }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const resolvedSearchParams = (await searchParams) ?? {}
  const vendorParam = resolvedSearchParams.fabricante
  const initialVendor = typeof vendorParam === 'string' ? vendorParam : (vendorParam?.[0] ?? 'all')

  const devices = await prisma.device.findMany({
    where: {
      ...getTenantDeviceWhere(tenantSlug),
      hardware: { is: { processador: { not: null } } },
    },
    select: {
      id: true,
      hostname: true,
      usuario: true,
      hardware: { select: { processador: true } },
    },
    orderBy: { hostname: 'asc' },
  })

  const processorMap = new Map<
    string,
    { name: string; vendor: string; devices: Array<{ id: string; hostname: string; usuario: string | null }> }
  >()

  for (const device of devices) {
    const name = device.hardware?.processador?.trim()
    if (!name) continue
    const entry = processorMap.get(name) ?? { name, vendor: inferVendor(name), devices: [] }
    entry.devices.push({ id: device.id, hostname: device.hostname, usuario: device.usuario })
    processorMap.set(name, entry)
  }

  const processors = Array.from(processorMap.values())
    .map((entry) => ({ ...entry, count: entry.devices.length }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Processadores</h1>
        <p className="text-muted-foreground">
          {processors.length} modelo{processors.length !== 1 ? 's' : ''} encontrado{processors.length !== 1 ? 's' : ''} no inventário da empresa selecionada.
        </p>
      </div>

      <TenantProcessorsTable
        processors={processors}
        initialVendor={initialVendor}
        computersPath={getTenantPath(tenantSlug, 'computers')}
      />
    </div>
  )
}
