import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="mb-1 h-5 w-24" />
        <Skeleton className="mb-4 h-4 w-full max-w-md" />
        <div className="divide-y rounded-xl border">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 p-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
