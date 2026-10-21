import { Skeleton } from '@/components/ui/skeleton'
import { KPI_ICON_CHIP_CLASS } from '@/lib/kpi-tone'
import { TABLE_HEAD_ROW_CLASS, TABLE_SHELL_CLASS } from '@/lib/table-styles'
import { cn } from '@/lib/utils'

/**
 * Esqueletos com a FORMA das superficies reais (Sprint V17).
 *
 * Cada `loading.tsx` do tenant desenhava a propria caixa a mao — `p-6` onde a
 * tela real tem `px-5`, `sm:grid-cols-2` onde ela tem `md:`, cartao empilhado
 * onde ela tem tabela — e a pagina pulava ao trocar de estado. Estes tres
 * espelham, medida por medida, `KpiCard`, `Panel` e a casca de tabela
 * (`TABLE_SHELL_CLASS`), e importam as mesmas constantes que eles usam: se a
 * superficie real mudar de recuo ou de chip, o esqueleto muda junto.
 */

/** Espelha `KpiCard`: px-5 py-4, cabecalho h-8 com chip de 32px, valor text-2xl (32px de linha). */
export function KpiCardSkeleton({ withSubtitle = false }: { withSubtitle?: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-surface-line bg-card px-5 py-4">
      <div className="flex h-8 shrink-0 items-center gap-3">
        <Skeleton className={cn(KPI_ICON_CHIP_CLASS, 'rounded-lg')} />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="mt-3 h-8 w-14" />
      {withSubtitle ? <Skeleton className="mt-1 h-3 w-32" /> : null}
    </div>
  )
}

/** Espelha `Panel` + `PanelHeader` (px-5 pt-5 pb-4) + `PanelBody` (px-5 pb-5). */
export function PanelSkeleton({
  withDescription = false,
  children,
}: {
  withDescription?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-surface-line bg-card">
      <div className="space-y-2 px-5 pb-4 pt-5">
        <Skeleton className="h-5 w-48" />
        {withDescription ? <Skeleton className="h-3 w-64" /> : null}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  )
}

/**
 * Espelha a casca de tabela do tenant: `TABLE_SHELL_CLASS`, cabecalho e celulas com px-5.
 * `flush` omite a casca — para tabela embutida num painel (`PanelBody flush`),
 * onde uma segunda borda seria card dentro de card.
 */
export function TableSkeleton({ columns, rows = 6, flush = false }: { columns: number; rows?: number; flush?: boolean }) {
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
  return (
    <div className={flush ? undefined : cn(TABLE_SHELL_CLASS, 'overflow-hidden')}>
      <div className={cn(TABLE_HEAD_ROW_CLASS, 'grid gap-4 px-5 py-3.5')} style={gridStyle}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-surface-line">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="grid items-center gap-4 px-5 py-4" style={gridStyle}>
            {Array.from({ length: columns }).map((_, column) => (
              <Skeleton key={column} className={column === 0 ? 'h-4 w-28' : 'h-4 w-20'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Espelha o cabecalho de pagina padrao: h1 text-2xl (32px de linha) + subtitulo text-base. */
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1.5 h-4 w-96 max-w-full" />
      </div>
      {action ? <Skeleton className="h-8 w-32" /> : null}
    </div>
  )
}
