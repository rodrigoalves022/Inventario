import prisma from '@/lib/prisma'
import { requireTenantContext } from '@/lib/tenant-context'
import { getTenantHardwareWhere } from '@/lib/tenant-scope'

function inferVendor(processorName: string) {
  const normalized = processorName.toLowerCase()
  if (normalized.includes('intel')) return 'Intel'
  if (normalized.includes('amd')) return 'AMD'
  if (normalized.includes('xeon')) return 'Intel Xeon'
  return 'Nao identificado'
}

export default async function TenantProcessorsPage({ params }: PageProps<'/tenant/[clientSlug]'>) {
  const { clientSlug } = await params
  const tenant = await requireTenantContext(clientSlug)
  const tenantSlug = tenant.slug

  const hardware = await prisma.hardware.findMany({
    where: {
      ...getTenantHardwareWhere(tenantSlug),
      processador: { not: null },
    },
    select: { processador: true },
  })

  const processorMap = new Map<string, number>()
  for (const item of hardware) {
    const name = item.processador?.trim()
    if (!name) continue
    processorMap.set(name, (processorMap.get(name) ?? 0) + 1)
  }

  const processors = Array.from(processorMap.entries())
    .map(([name, count]) => ({ name, count, vendor: inferVendor(name) }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Processadores</h1>
        <p className="text-muted-foreground">
          {processors.length} modelo{processors.length !== 1 ? 's' : ''} encontrado{processors.length !== 1 ? 's' : ''} no inventário da empresa selecionada.
        </p>
      </div>

      <div className="space-y-4">
        {processors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            Nenhum processador reportado ainda para este cliente.
          </div>
        ) : (
          processors.map((processor) => (
            <div key={processor.name} className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{processor.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{processor.vendor}</p>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-2xl font-bold text-primary">{processor.count}</p>
                <p className="text-xs text-muted-foreground">Dispositivos</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
