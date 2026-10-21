import { Skeleton } from '@/components/ui/skeleton'
import { PanelSkeleton } from '@/components/ui/skeleton-shapes'

/** Mesma forma da pagina real (Sprint V20): um Panel com titulo, subtitulo e linhas divide-y. */
export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>

      <PanelSkeleton withDescription>
        <div className="divide-y divide-surface-line">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </PanelSkeleton>
    </div>
  )
}
