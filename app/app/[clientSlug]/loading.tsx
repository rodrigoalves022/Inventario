import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardSkeleton, PanelSkeleton, TableSkeleton } from '@/components/ui/skeleton-shapes'

/**
 * O esqueleto acompanha a estrutura real da pagina (Overhaul visual — Fase 4):
 * hero de postura de seguranca, grid de KPI, graficos, painel duplo e a tabela
 * de ultimas atualizacoes. Um esqueleto com outra forma faz a pagina "pular"
 * ao trocar de estado, que e' pior do que nao ter esqueleto nenhum.
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

      {/* 5 cards ate a decisao da Sprint V17 sobre qual sai (ver docs/SPRINTS.md). */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <KpiCardSkeleton key={index} withSubtitle />
        ))}
      </div>

      {/* Os graficos reais reservam 180px (dashboard-charts.tsx) — antes eram 224px aqui. */}
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <PanelSkeleton key={index} withDescription>
            <Skeleton className="h-[180px] w-full" />
          </PanelSkeleton>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, panel) => (
          <div key={panel} className="rounded-xl border border-surface-line bg-card">
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
        ))}
      </div>

      <div className="rounded-xl border border-surface-line bg-card">
        <div className="space-y-2 px-5 pb-4 pt-5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <TableSkeleton columns={6} flush />
      </div>
    </div>
  )
}
