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

/**
 * Tom da variante. Duas mudancas do Overhaul visual, Fase 1:
 *
 * 1. Saiu a barra colorida de 4px em `border-l`. Uma borda colorida grossa num
 *    dos lados e' o adesivo que se cola num card generico para ele parecer
 *    categorizado; a borda de 1px reagindo em TODO o perimetro diz a mesma
 *    coisa e ainda serve de estado de hover. O tom continua legivel em repouso
 *    pela borda tingida e pelo chip do icone.
 * 2. `--surface-glow` aponta para o token da variante, e `surface-interactive`
 *    (app/globals.css) usa a variavel para pintar borda e halo do hover. Assim
 *    o card de alerta brilha ambar e o de falha brilha vermelho, sem um unico
 *    rgba() literal no componente.
 */
const variantStyles = {
  default: 'border-surface-line [--surface-glow:var(--color-primary)]',
  primary: 'border-primary/25 [--surface-glow:var(--color-primary)]',
  success: 'border-success/25 [--surface-glow:var(--color-success)]',
  warning: 'border-warning/25 [--surface-glow:var(--color-warning)]',
  danger: 'border-destructive/25 [--surface-glow:var(--color-destructive)]',
  info: 'border-info/25 [--surface-glow:var(--color-info)]',
}

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/12 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-info/12 text-info',
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
        // Mesma casca do SummaryCard (components/ui/summary-card.tsx): mesmo
        // raio, mesmo padding, mesma transicao, mesma regra de elevacao
        // (borda de 1px em repouso; sombra + halo so no hover). `h-full flex flex-col
        // justify-between` separa o card em duas faixas — titulo+icone em cima,
        // valor+subtitulo embaixo — para que os NUMEROS fiquem na mesma altura
        // ao longo da fileira mesmo quando os titulos quebram em numero
        // diferente de linhas ("Taxa de disponibilidade" vs "Status warning").
        'surface-interactive flex h-full w-full select-none flex-col justify-between gap-3 rounded-xl border bg-card p-4',
        variantStyles[variant],
        href && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="section-label">{title}</p>
        {icon && (
          <div className={cn(
            'flex shrink-0 items-center justify-center rounded-lg',
            featured ? 'h-12 w-12' : 'h-10 w-10',
            iconStyles[variant]
          )}>
            {icon}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p
          className={cn(
            'font-bold tabular-nums tracking-tight',
            featured ? 'text-4xl' : 'text-2xl',
            valueClassName ?? 'text-card-foreground'
          )}
        >
          {value}
        </p>
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
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
