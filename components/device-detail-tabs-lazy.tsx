'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * device-detail-tabs.tsx é um Client Component grande (abas + Recharts +
 * formulário de patrimônio + painel de comandos) sempre montado inteiro,
 * mesmo quando a aba visível não usa nada disso. `ssr: false` só é permitido
 * dentro de um Client Component — por isso o wrapper, chamado a partir das
 * páginas (Server Components) que renderizam o detalhe do dispositivo.
 */
function DeviceDetailTabsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border pb-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-24" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export const DeviceDetailTabs = dynamic(
  () => import('@/components/device-detail-tabs').then((mod) => mod.DeviceDetailTabs),
  { ssr: false, loading: DeviceDetailTabsSkeleton }
)
