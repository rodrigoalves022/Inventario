'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Cpu, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS } from '@/lib/table-styles'

export type TenantProcessorRow = {
  name: string
  vendor: string
  count: number
  devices: Array<{ id: string; hostname: string; usuario: string | null }>
}

const VENDOR_BADGE_CLASS: Record<string, string> = {
  Intel: 'border-info/40 bg-info/5 text-info hover:bg-info/10',
  'Intel Xeon': 'border-info/40 bg-info/5 text-info hover:bg-info/10',
  AMD: 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  'Nao identificado': 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
}

function getVendorBadgeClass(vendor: string) {
  return VENDOR_BADGE_CLASS[vendor] ?? VENDOR_BADGE_CLASS['Nao identificado']
}

/** Mostra so os primeiros N hostnames + "usuario" (snapshot da ultima coleta,
 * NAO presenca ao vivo) — a lista completa fica visivel clicando no processador
 * (leva para /computers?search=<nome>, filtrado pelo mesmo nome). */
const MAX_VISIBLE_DEVICES = 4

export function TenantProcessorsTable({
  processors,
  initialVendor = 'all',
  computersPath,
}: {
  processors: TenantProcessorRow[]
  initialVendor?: string
  computersPath: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [vendorFilter, setVendorFilter] = useState(initialVendor)

  const vendors = useMemo(() => {
    const unique = new Set(processors.map((processor) => processor.vendor))
    return Array.from(unique).sort()
  }, [processors])

  const filteredProcessors = useMemo(() => {
    if (vendorFilter === 'all') return processors
    return processors.filter((processor) => processor.vendor === vendorFilter)
  }, [processors, vendorFilter])

  function applyVendorFilter(vendor: string) {
    const next = vendorFilter === vendor ? 'all' : vendor
    setVendorFilter(next)

    const params = new URLSearchParams()
    if (next !== 'all') params.set('fabricante', next)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className="space-y-4">
      {/* Filtro por fabricante — clicavel, refletido na URL (?fabricante=) */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          role="button"
          tabIndex={0}
          onClick={() => applyVendorFilter('all')}
          className={cn(
            'cursor-pointer px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
            vendorFilter === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
          )}
        >
          Todos os fabricantes
        </Badge>
        {vendors.map((vendor) => (
          <Badge
            key={vendor}
            data-testid={`vendor-filter-${vendor}`}
            variant="outline"
            role="button"
            tabIndex={0}
            onClick={() => applyVendorFilter(vendor)}
            className={cn(
              'cursor-pointer px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors',
              vendorFilter === vendor ? 'ring-2 ring-offset-1' : '',
              getVendorBadgeClass(vendor)
            )}
          >
            {vendor}
          </Badge>
        ))}
      </div>

      {filteredProcessors.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <Search className="h-6 w-6 opacity-30" />
          {processors.length === 0
            ? 'Nenhum processador reportado ainda para este cliente.'
            : 'Nenhum processador encontrado para o filtro selecionado.'}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Processador</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Fabricante</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Dispositivos</th>
                  <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider">Hostnames / último usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProcessors.map((processor) => (
                  <tr key={processor.name} className={STATIC_ROW_HOVER_CLASS}>
                    <td className="px-5 py-4 align-top">
                      <Link
                        href={`${computersPath}?search=${encodeURIComponent(processor.name)}`}
                        className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                        title="Ver máquinas com este processador em /computers"
                      >
                        <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {processor.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <Badge variant="outline" className={cn('px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', getVendorBadgeClass(processor.vendor))}>
                        {processor.vendor}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <Link
                        href={`${computersPath}?search=${encodeURIComponent(processor.name)}`}
                        className="text-lg font-bold text-primary hover:underline"
                      >
                        {processor.count}
                      </Link>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {processor.devices.slice(0, MAX_VISIBLE_DEVICES).map((device) => (
                          <span key={device.id} className="font-mono">
                            {device.hostname}
                            <span className="ml-1.5 font-sans text-muted-foreground/80">
                              {device.usuario ? `— ${device.usuario} (snapshot)` : ''}
                            </span>
                          </span>
                        ))}
                        {processor.devices.length > MAX_VISIBLE_DEVICES ? (
                          <Link
                            href={`${computersPath}?search=${encodeURIComponent(processor.name)}`}
                            className="text-primary hover:underline"
                          >
                            +{processor.devices.length - MAX_VISIBLE_DEVICES} outra(s)
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
