'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Cpu, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { SummaryCard } from '@/components/ui/summary-card'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS, TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_HEAD_ROW_CLASS } from '@/lib/table-styles'
import { getVendorGroup } from '@/lib/processor-vendor'

export type TenantProcessorRow = {
  name: string
  vendor: string
  count: number
  devices: Array<{ id: string; hostname: string; usuario: string | null }>
}

/** Sprint 15: 'Intel Xeon' saiu daqui junto com o colapso de `inferVendor` —
 * era um rotulo que so aparecia por acidente de formatacao da string. */
const VENDOR_BADGE_CLASS: Record<string, string> = {
  Intel: 'border-info/40 bg-info/5 text-info hover:bg-info/10',
  AMD: 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  'Nao identificado': 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
}

function getVendorBadgeClass(vendor: string) {
  return VENDOR_BADGE_CLASS[getVendorGroup(vendor)]
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

  /**
   * Contagem em DISPOSITIVOS (nao em modelos) nos 4 cards, de proposito: um
   * grid de 4 numeros lado a lado convida o usuario a somar, entao os 4
   * precisam somar. `total` e' exatamente Intel + AMD + outros. A contagem de
   * MODELOS nao se perde — segue no subtitulo da pagina, logo acima do grid
   * ("N modelos encontrados..."), que e' onde ela nao se confunde com estas.
   */
  const summary = useMemo(() => {
    const counts = { total: 0, Intel: 0, AMD: 0, 'Nao identificado': 0 }
    for (const processor of processors) {
      counts.total += processor.count
      counts[getVendorGroup(processor.vendor)] += processor.count
    }
    return counts
  }, [processors])

  const filteredProcessors = useMemo(() => {
    if (vendorFilter === 'all') return processors
    // Compara por GRUPO, nao pela string crua: e' o que garante que a soma da
    // coluna "Dispositivos" das linhas exibidas seja exatamente o numero do
    // card clicado, mesmo que uma linha chegue com um rotulo fora dos 3.
    return processors.filter((processor) => getVendorGroup(processor.vendor) === vendorFilter)
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
    <div className="space-y-6">
      {/* Cards de KPI — os 3 de fabricante dobram como filtro (?fabricante=) e o
          card "Total" limpa o filtro, mesmo padrao de TenantComputersTable. Nao
          existe fileira de badges de fabricante aqui: seriam duas UIs para o
          mesmo dado (ver doc de SummaryCard). */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          testId="vendor-card-all"
          icon={<Cpu className="h-4 w-4" />}
          label="Total de Máquinas"
          value={summary.total}
          tone="primary"
          active={vendorFilter === 'all'}
          onClick={() => applyVendorFilter('all')}
        />
        <SummaryCard
          testId="vendor-card-Intel"
          icon={<Cpu className="h-4 w-4" />}
          label="Intel"
          value={summary.Intel}
          tone="info"
          active={vendorFilter === 'Intel'}
          onClick={() => applyVendorFilter('Intel')}
        />
        <SummaryCard
          testId="vendor-card-AMD"
          icon={<Cpu className="h-4 w-4" />}
          label="AMD"
          value={summary.AMD}
          tone="destructive"
          active={vendorFilter === 'AMD'}
          onClick={() => applyVendorFilter('AMD')}
        />
        <SummaryCard
          testId="vendor-card-Nao identificado"
          icon={<Cpu className="h-4 w-4" />}
          label="Outros / Não Identificados"
          value={summary['Nao identificado']}
          tone="warning"
          active={vendorFilter === 'Nao identificado'}
          onClick={() => applyVendorFilter('Nao identificado')}
        />
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
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th className={TABLE_HEAD_CLASS}>Processador</th>
                  <th className={TABLE_HEAD_CLASS}>Fabricante</th>
                  <th className={TABLE_HEAD_CLASS}>Dispositivos</th>
                  <th className={TABLE_HEAD_CLASS}>Hostnames / último usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProcessors.map((processor) => (
                  <tr key={processor.name} className={STATIC_ROW_HOVER_CLASS}>
                    <td className={TABLE_CELL_CLASS}>
                      <Link
                        href={`${computersPath}?search=${encodeURIComponent(processor.name)}`}
                        className="flex items-center gap-2 font-medium text-foreground hover:text-primary transition-colors"
                        title="Ver máquinas com este processador em /computers"
                      >
                        <Cpu className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {processor.name}
                      </Link>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      {/* Exibe o GRUPO, nao a string crua: a badge da linha, o
                          card do topo e o filtro da URL falam o mesmo
                          vocabulario de 3 fabricantes (Sprint 15). */}
                      <Badge variant="outline" className={cn('px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', getVendorBadgeClass(processor.vendor))}>
                        {getVendorGroup(processor.vendor)}
                      </Badge>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
                      <Link
                        href={`${computersPath}?search=${encodeURIComponent(processor.name)}`}
                        className="text-lg font-bold text-primary hover:underline"
                      >
                        {processor.count}
                      </Link>
                    </td>
                    <td className={TABLE_CELL_CLASS}>
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
