import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardSkeleton, PanelSkeleton } from '@/components/ui/skeleton-shapes'

/** Barra rotulada dos paineis de distribuicao: linha de texto + trilho h-2. */
function BarRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row}>
          <div className="mb-1 flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

/** Mesma forma da pagina real (Sprints V17 e V20 — todo bloco com subtitulo): cabecalho com 2 botoes, 4 KPI e duas fileiras de 2 paineis. */
export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1.5 h-4 w-96 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton withDescription>
          <BarRowsSkeleton rows={4} />
        </PanelSkeleton>
        <PanelSkeleton withDescription>
          <BarRowsSkeleton rows={4} />
        </PanelSkeleton>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton withDescription>
          <BarRowsSkeleton rows={4} />
        </PanelSkeleton>
        <div className="rounded-xl border border-surface-line bg-card">
          <div className="space-y-2 px-5 pb-4 pt-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="divide-y divide-surface-line border-t border-surface-line">
            {Array.from({ length: 3 }).map((_, row) => (
              <div key={row} className="space-y-2 px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-56" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
