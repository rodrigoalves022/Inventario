import { Skeleton } from '@/components/ui/skeleton'

export default function NetworkLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      <div className="rounded-xl border border-surface-line bg-card">
        <div className="border-b border-surface-line bg-secondary/50 p-3">
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-16" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="grid grid-cols-6 items-center gap-4 p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
