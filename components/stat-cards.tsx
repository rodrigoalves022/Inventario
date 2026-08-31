'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Monitor,
  Server,
  Wifi,
} from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  /** Opcional — cards de resumo sem ícone (ex: /reports) renderizam sem o bloco de ícone. */
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  /** O card que responde "quantos ativos no total" — mesma escala do sistema, um degrau acima. */
  featured?: boolean
  /** Quando presente, o card vira link pra listagem filtrada correspondente. */
  href?: string
  /** Override de cor do valor principal (ex: "text-destructive") para cards que
   * comunicam severidade pelo número, não só pela borda/ícone. */
  valueClassName?: string
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

export function StatCard({ title, value, subtitle, icon, trend, variant = 'default', featured = false, href, valueClassName }: StatCardProps) {
  const Comp = href ? Link : 'div'

  return (
    <Comp
      href={href as string}
      className={cn(
        'rounded-lg border bg-card shadow-sm transition-all hover:shadow-md hover:bg-accent/30 hover:border-accent/50',
        featured ? 'p-6' : 'p-5',
        variantStyles[variant],
        href && 'cursor-pointer hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className={cn('font-bold', featured ? 'text-4xl' : 'text-2xl', valueClassName ?? 'text-card-foreground')}>{value}</p>
          {subtitle && (
            <p className={cn('text-muted-foreground', featured ? 'text-sm' : 'text-xs')}>{subtitle}</p>
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
        {icon && (
          <div className={cn(
            'flex items-center justify-center rounded-lg',
            featured ? 'h-12 w-12' : 'h-10 w-10',
            iconStyles[variant]
          )}>
            {icon}
          </div>
        )}
      </div>
    </Comp>
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
  /** Caminho da listagem unificada de dispositivos do tenant
   * (getTenantPath(slug, 'assets')) — usado pelo card "Total de Máquinas",
   * que mostra o total de computadores + servidores num unico numero e
   * navega para a rota que os lista juntos (ver lib/tenant-device-rows.ts). */
  assetsPath?: string
  /** Caminho da listagem de maquinas do tenant (ex: getTenantPath(slug, 'computers')).
   * Sem essa prop os cards ficam so informativos, sem navegacao. */
  computersPath?: string
  /** Caminho da listagem de servidores (ex: getTenantPath(slug, 'servers')) — pagina
   * dedicada e ja sem filtro, ja que /computers exclui servidores por definicao. */
  serversPath?: string
}

export function StatsGrid({
  total,
  win10,
  win11,
  server,
  online,
  offline,
  warning,
  assetsPath,
  computersPath,
  serversPath,
}: StatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      <StatCard
        title="Total de Máquinas"
        value={total}
        subtitle={`${online} online agora`}
        icon={<Monitor className="h-6 w-6" />}
        variant="primary"
        href={assetsPath}
      />
      <StatCard
        title="Windows 10"
        value={win10}
        subtitle={formatPercent(win10, total)}
        icon={<Monitor className="h-5 w-5" />}
        variant="info"
        href={computersPath ? `${computersPath}?os=${encodeURIComponent('Windows 10')}` : undefined}
      />
      <StatCard
        title="Windows 11"
        value={win11}
        subtitle={formatPercent(win11, total)}
        icon={<Monitor className="h-5 w-5" />}
        variant="success"
        href={computersPath ? `${computersPath}?os=${encodeURIComponent('Windows 11')}` : undefined}
      />
      <StatCard
        title="Servidores"
        value={server}
        subtitle="Ativos na rede"
        icon={<Server className="h-5 w-5" />}
        variant="warning"
        href={serversPath}
      />
      <StatCard
        title="Status Online"
        value={online}
        subtitle={`${offline} offline, ${warning} alertas`}
        icon={<Wifi className="h-5 w-5" />}
        variant="success"
        href={computersPath ? `${computersPath}?status=online` : undefined}
      />
    </div>
  )
}
