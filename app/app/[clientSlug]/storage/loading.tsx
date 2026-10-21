import { Skeleton } from '@/components/ui/skeleton'
import { KpiCardSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeleton-shapes'

/** Mesma forma da pagina real (Sprint V17): cabecalho, fileira de 4 KPI, badges de tipo e tabela de 5 colunas. */
export default function StorageLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <KpiCardSkeleton key={index} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-24 rounded-full" />
          ))}
        </div>

        <TableSkeleton columns={5} />
      </div>
    </div>
  )
}
