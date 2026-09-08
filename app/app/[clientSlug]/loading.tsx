import { Skeleton } from '@/components/ui/skeleton'

/**
 * O esqueleto acompanha a estrutura real da pagina (Overhaul visual — Fase 4):
 * hero de postura de seguranca, grid de KPI, graficos, painel duplo e a tabela
 * de ultimas atualizacoes. Um esqueleto com outra forma faz a pagina "pular"
 * ao trocar de estado, que e' pior do que nao ter esqueleto nenhum.
 */
export default function TenantDashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-96" />

      <div className="rounded-xl border border-surface-line bg-card">
        <div className="space-y-2 px-6 pb-4 pt-6">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-3 w-full max-w-xl" />
        </div>
        <div className="grid grid-cols-1 divide-y divide-surface-line border-t border-surface-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="px-6 py-5">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-surface-line bg-card p-4">
            <div className="mb-2 flex items-start justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-14" />
            <Skeleton className="mt-1.5 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-surface-line bg-card p-6">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-64" />
            <Skeleton className="mt-6 h-56 w-full" />
          </div>
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
        <div className="border-b border-surface-line p-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-surface-line">
          {Array.from({ length: 6 }).map((_, row) => (
            <div key={row} className="grid grid-cols-6 items-center gap-4 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
