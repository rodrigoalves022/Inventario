import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardSkeleton, TableSkeleton } from '@/components/ui/skeleton-shapes'

/** Mesma regua da pagina real (Sprint V20): KPI, barra de filtros px-5 sem sombra, casca de tabela. */
export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <KpiCardSkeleton key={index} />
        ))}
      </div>

      <div className="rounded-xl border border-surface-line bg-card px-5 py-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>

      <TableSkeleton columns={5} />
    </div>
  )
}
