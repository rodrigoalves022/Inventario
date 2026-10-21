'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Recharts só faz sentido no cliente (ResponsiveContainer mede o DOM real) e é
 * pesado o bastante para valer a pena tirar do bundle/SSR inicial da página do
 * dashboard. `ssr: false` só é permitido dentro de um Client Component — por
 * isso este wrapper existe separado de `dashboard-charts.tsx`, que continua
 * sendo importado normalmente por quem já está no cliente.
 */
function ChartSkeleton() {
  return <Skeleton className="h-56 w-full" />
}

export const OsDistributionChart = dynamic(
  () => import('@/components/dashboard-charts').then((mod) => mod.OsDistributionChart),
  { ssr: false, loading: ChartSkeleton }
)

export const RamDistributionChart = dynamic(
  () => import('@/components/dashboard-charts').then((mod) => mod.RamDistributionChart),
  { ssr: false, loading: ChartSkeleton }
)
