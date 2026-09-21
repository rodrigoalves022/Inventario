'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Monitor,
  Server,
  Wifi,
} from 'lucide-react'
import {
  KPI_CARD_SHELL_CLASS,
  KPI_ICON_CHIP_CLASS,
  KPI_TONE_GLOW_CLASS,
  KPI_TONE_ICON_CLASS,
  normalizeKpiTone,
  type KpiToneInput,
} from '@/lib/kpi-tone'

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
  /**
   * Tom do card. `danger` e `default` continuam aceitos como ALIAS LEGADO
   * (traduzidos por `normalizeKpiTone` para `destructive` e `neutral`) — a
   * renomeacao nao quebra nenhum chamador existente.
   */
  variant?: KpiToneInput
  /** O card que responde "quantos ativos no total" — mesma escala do sistema, um degrau acima. */
  featured?: boolean
  /** Quando presente, o card vira link pra listagem filtrada correspondente. */
  href?: string
  /** Override de cor do valor principal (ex: "text-destructive") para cards que
   * comunicam severidade pelo número, não só pela borda/ícone. */
  valueClassName?: string
}

function formatPercent(part: number, total: number) {
  if (total <= 0) return '0% do total'
  return `${Math.round((part / total) * 100)}% do total`
}

/**
 * Card de KPI das telas de visao geral, /audit e /reports.
 *
 * --- Unificacao de anatomia (sprint de correcao da auditoria) ----------------
 *
 * Este componente e o `SummaryCard` (components/ui/summary-card.tsx) eram os
 * DOIS cards de KPI do sistema, com anatomia oposta: aqui o icone ficava a
 * DIREITA num chip de 40px (48px no `featured`), la ficava a ESQUERDA num chip
 * de 32px; e o mesmo tom de falha se chamava `danger` aqui e `destructive` la.
 * Auditoria apontou que a fileira de KPI invertia a leitura ao trocar de tela.
 *
 * Tres mudancas, todas retrocompativeis:
 *
 * 1. ICONE A ESQUERDA, na anatomia do `SummaryCard` — a que ja era usada em 5
 *    telas contra 3, e a que nao tinha o defeito de alinhamento.
 * 2. TOM UNICO por `lib/kpi-tone.ts`. `danger` e `default` viram alias.
 * 3. CHIP DE TAMANHO FIXO definido no componente, nao pelo chamador. Os call
 *    sites continuam passando `<Icon className="h-5 w-5" />`; o chip normaliza
 *    com `[&>svg]:size-4`, entao nenhum arquivo consumidor precisou mudar.
 *
 * Alem disso, `surface-interactive` passou a ser CONDICIONAL. Antes era
 * aplicado incondicionalmente, entao o card "Taxa de disponibilidade" de
 * /reports — que nao tem `href` — levantava 2px e ganhava halo no hover sem
 * ser clicavel nem focalizavel, ao lado de tres cards que eram. Card que se
 * move e nao clica e' promessa falsa.
 *
 * A borda tingida por variante (`border-primary/25` etc.) saiu em favor de
 * `border-surface-line`, que e' a borda da casca compartilhada. O tom continua
 * legivel pelo chip do icone e pela cor do numero.
 */
export function StatCard({ title, value, subtitle, icon, trend, variant = 'default', featured = false, href, valueClassName }: StatCardProps) {
  const tone = normalizeKpiTone(variant)
  const Comp = href ? Link : 'div'

  return (
    <Comp
      href={href as string}
      className={cn(
        // `justify-between` iguala a altura da fileira; o alinhamento dos
        // NUMEROS vem da ancoragem superior do bloco de rotulo, que ocupa
        // sempre uma linha.
        KPI_CARD_SHELL_CLASS,
        'justify-between gap-3',
        KPI_TONE_GLOW_CLASS[tone],
        href && 'surface-interactive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="mb-2 flex items-center gap-3">
        {icon && <div className={cn(KPI_ICON_CHIP_CLASS, KPI_TONE_ICON_CLASS[tone])}>{icon}</div>}
        <p className="section-label">{title}</p>
      </div>
      <div className="space-y-1">
        <p
          className={cn(
            'font-bold tabular-nums tracking-tight',
            featured ? 'text-4xl' : 'text-2xl',
            // NAO cai para KPI_TONE_VALUE_CLASS[tone] de proposito. Aqui o tom
            // e' decorativo e quem decide se o NUMERO alarma e' o chamador, via
            // `valueClassName` — ver o card "Em atenção" do dashboard, que so
            // passa `text-warning` quando a contagem e' maior que zero. Herdar
            // o tom pintaria um zero de ambar, afirmando alerta onde nao ha.
            // (`SummaryCard` tinge por tom porque la o tom E' a severidade do
            // proprio balde que o card conta.)
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
