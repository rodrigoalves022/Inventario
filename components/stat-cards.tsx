import { cn } from '@/lib/utils'
import {
  Monitor,
  Server,
  Wifi,
  AlertTriangle,
  HardDrive,
  MemoryStick,
} from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

const variantStyles = {
  default: 'border-border',
  primary: 'border-l-4 border-l-primary border-t-0 border-r-0 border-b-0',
  success: 'border-l-4 border-l-success border-t-0 border-r-0 border-b-0',
  warning: 'border-l-4 border-l-warning border-t-0 border-r-0 border-b-0',
  danger: 'border-l-4 border-l-destructive border-t-0 border-r-0 border-b-0',
  info: 'border-l-4 border-l-info border-t-0 border-r-0 border-b-0',
}

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
}

function formatPercent(part: number, total: number) {
  if (total <= 0) return '0% do total'
  return `${Math.round((part / total) * 100)}% do total`
}

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-lg border bg-card p-5 shadow-sm transition-all hover:shadow-md',
      variantStyles[variant]
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              'text-xs font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}% em relação ao mês anterior
            </p>
          )}
        </div>
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-lg',
          iconStyles[variant]
        )}>
          {icon}
        </div>
      </div>
    </div>
  )
}

interface StatsGridProps {
  total: number
  win10: number
  win11: number
  server: number
  online: number
  offline: number
  warning: number
  totalRam: number
  totalStorage: number
}

export function StatsGrid({
  total,
  win10,
  win11,
  server,
  online,
  offline,
  warning,
}: StatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      <StatCard
        title="Total de Máquinas"
        value={total}
        subtitle={`${online} online agora`}
        icon={<Monitor className="h-5 w-5" />}
        variant="primary"
      />
      <StatCard
        title="Windows 10"
        value={win10}
        subtitle={formatPercent(win10, total)}
        icon={<Monitor className="h-5 w-5" />}
        variant="info"
      />
      <StatCard
        title="Windows 11"
        value={win11}
        subtitle={formatPercent(win11, total)}
        icon={<Monitor className="h-5 w-5" />}
        variant="success"
      />
      <StatCard
        title="Servidores"
        value={server}
        subtitle="Ativos na rede"
        icon={<Server className="h-5 w-5" />}
        variant="warning"
      />
      <StatCard
        title="Status Online"
        value={online}
        subtitle={`${offline} offline, ${warning} alertas`}
        icon={<Wifi className="h-5 w-5" />}
        variant="success"
      />
    </div>
  )
}

export function SecondaryStats({ totalRam, totalStorage }: { totalRam: number; totalStorage: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        title="Memória RAM Total"
        value={`${totalRam} GB`}
        subtitle="Soma de todos os dispositivos"
        icon={<MemoryStick className="h-5 w-5" />}
        variant="default"
      />
      <StatCard
        title="Armazenamento Total"
        value={`${(totalStorage / 1000).toFixed(1)} TB`}
        subtitle="Capacidade combinada"
        icon={<HardDrive className="h-5 w-5" />}
        variant="default"
      />
      <StatCard
        title="Alertas Ativos"
        value={3}
        subtitle="Requerem atenção"
        icon={<AlertTriangle className="h-5 w-5" />}
        variant="danger"
      />
    </div>
  )
}
