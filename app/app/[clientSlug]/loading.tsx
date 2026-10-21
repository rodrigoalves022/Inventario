import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardSkeleton, PanelSkeleton, TableSkeleton } from '@/components/ui/skeleton-shapes'

/** Painel de lista: cabecalho + 4 linhas, a forma do painel critico e da atividade recente. */
function ListPanelSkeleton() {
  return (
    <div className="rounded-xl border border-surface-line bg-card">
      <div className="space-y-2 px-5 pb-4 pt-5">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="divide-y divide-surface-line border-t border-surface-line">
        {Array.from({ length: 4 }).map((_, row) => (
          <div key={row} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * O esqueleto acompanha a estrutura real da pagina — as duas faixas da Sprint
 * V18: acao (3 KPIs + painel critico em largura total) e, abaixo do separador,
 * o retrato do parque (hero, 2 KPIs, 3 graficos, atividade + ultimas coletas).
 * Um esqueleto com outra forma faz a pagina "pular" ao trocar de estado, que
 * e' pior do que nao ter esqueleto nenhum.
 */
export default function TenantDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-1.5 h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <KpiCardSkeleton key={index} withSubtitle />
          ))}
        </div>
        <ListPanelSkeleton />
      </div>

      <div className="space-y-6 border-t border-surface-line pt-6">
        <Skeleton className="h-3 w-36" />

        <div className="rounded-xl border border-surface-line bg-card">
          <div className="space-y-2 px-5 pb-4 pt-5">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3 w-full max-w-xl" />
          </div>
          <div className="grid grid-cols-1 divide-y divide-surface-line border-t border-surface-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="px-5 py-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="mt-4 h-9 w-28" />
                <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
                <Skeleton className="mt-2.5 h-3 w-48" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <KpiCardSkeleton key={index} withSubtitle />
          ))}
        </div>

        {/* Os graficos reais reservam 180px (dashboard-charts.tsx). */}
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={index === 2 ? 'lg:col-span-2 xl:col-span-1' : undefined}>
              <PanelSkeleton withDescription>
                <Skeleton className="h-[180px] w-full" />
              </PanelSkeleton>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ListPanelSkeleton />
          <div className="rounded-xl border border-surface-line bg-card">
            <div className="space-y-2 px-5 pb-4 pt-5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <TableSkeleton columns={6} flush />
          </div>
        </div>
      </div>
    </div>
  )
}
