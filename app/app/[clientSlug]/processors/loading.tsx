import { Skeleton } from '@/components/ui/skeleton'

export default function ProcessorsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-border bg-card p-6">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="mt-2 h-3 w-24" />
            <div className="mt-4 border-t border-border pt-4">
              <Skeleton className="h-7 w-10" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
