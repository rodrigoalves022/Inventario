import { KpiCardSkeleton, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeleton-shapes'

/** Mesma forma da pagina real (Sprint V17): cabecalho, fileira de 4 KPI e tabela de 4 colunas. */
export default function ProcessorsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <KpiCardSkeleton key={index} />
          ))}
        </div>

        <TableSkeleton columns={4} />
      </div>
    </div>
  )
}
