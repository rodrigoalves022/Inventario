'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  KPI_ICON_CHIP_CLASS,
  KPI_TONE_GLOW_CLASS,
  KPI_TONE_ICON_CLASS,
  KPI_TONE_VALUE_CLASS,
  type KpiTone,
} from '@/lib/kpi-tone'

/**
 * KpiCard — tipo 1 da familia fechada de superficies (Sprint 16).
 *
 * Substitui `StatCard` e `SummaryCard`, que eram os DOIS cards de KPI do
 * sistema e tinham anatomia oposta: icone a direita num chip de 40/48px contra
 * icone a esquerda num chip de 32px, e dois nomes para o mesmo tom de falha
 * (`danger` contra `destructive`). A fileira de KPI invertia a leitura ao
 * trocar de tela.
 *
 * ---------------------------------------------------------------------------
 * A REGRA DE ALINHAMENTO
 * ---------------------------------------------------------------------------
 *
 * O numero alinha por ANCORAGEM SUPERIOR — o subtitulo nao pode desloca-lo.
 *
 * Dois blocos, distribuidos por `justify-between` (Sprint V23):
 *
 *   1. Topo — cabecalho de altura FIXA (`h-8`: rotulo a esquerda em
 *      `line-clamp-1`, icone em badge 32px no canto direito) e, logo abaixo
 *      (`mt-3`), o valor. Fixa mesmo SEM icone, para o numero de um card sem
 *      icone cair no mesmo deslocamento que os vizinhos: 16px (py-4) + 32px
 *      (h-8) + 12px (mt-3).
 *   2. Base — o subtitulo, empurrado para o rodape do card.
 *
 * O defeito antigo era `justify-between` com valor e subtitulo JUNTOS na
 * base: cada linha extra de subtitulo empurrava o numero para cima. Agora o
 * valor esta no bloco do topo, e o subtitulo so ocupa o espaco que sobra.
 * `h-full` iguala a altura dos cards da fileira.
 */
export function KpiCard({
  icon,
  label,
  value,
  subtitle,
  tone = 'neutral',
  emphasizeValue = false,
  href,
  onClick,
  active,
  testId,
}: {
  /** O NO do icone. O tamanho e' imposto pelo chip — ver KPI_ICON_CHIP_CLASS. */
  icon?: React.ReactNode
  label: string
  value: string | number
  subtitle?: string
  tone?: KpiTone
  /**
   * Tinge o NUMERO com a cor do tom.
   *
   * Desligado por padrao de proposito. Num card cujo tom e' decorativo, herdar
   * a cor pintaria um ZERO de ambar — afirmando alerta onde nao ha. O card
   * "Em atenção" do dashboard liga isto so quando a contagem e' maior que
   * zero; os cards de balde (/storage, /processors) ligam sempre, porque la o
   * tom E' a severidade do balde que o card conta.
   */
  emphasizeValue?: boolean
  /** Navega. Renderiza `<Link>`. Mutuamente exclusivo com `onClick` na pratica. */
  href?: string
  /** Filtra. Renderiza `<button>` com `aria-pressed`. */
  onClick?: () => void
  active?: boolean
  testId?: string
}) {
  const interactive = Boolean(href || onClick)
  const Comp = href ? Link : onClick ? 'button' : 'div'

  return (
    <Comp
      href={href as string}
      type={onClick && !href ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      aria-pressed={onClick && !href ? active : undefined}
      className={cn(
        'flex h-full w-full select-none flex-col justify-between rounded-xl border border-surface-line bg-card px-5 py-4 text-left',
        KPI_TONE_GLOW_CLASS[tone],
        // Elevacao e cursor SO quando o card leva a algum lugar. Um card que
        // levanta no hover e nao clica e' promessa falsa — era o defeito do
        // card "Taxa de disponibilidade" em /reports.
        interactive &&
          'surface-interactive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'border-primary shadow-[0_0_24px_-8px_var(--primary)]'
      )}
    >
      <div data-kpi-top>
        {/* Cabecalho — altura fixa, com ou sem icone. Ver o cabecalho do arquivo. */}
        <div className="flex h-8 shrink-0 items-center justify-between gap-3" data-kpi-header>
          <p className="section-label line-clamp-1">{label}</p>
          {icon && <div className={cn(KPI_ICON_CHIP_CLASS, KPI_TONE_ICON_CLASS[tone])}>{icon}</div>}
        </div>

        {/* Valor — deslocamento constante a partir do topo. */}
        <p
          data-kpi-value
          data-testid={testId ? `${testId}-value` : undefined}
          className={cn(
            'mt-3 text-2xl font-bold tabular-nums tracking-tight',
            emphasizeValue ? KPI_TONE_VALUE_CLASS[tone] : 'text-card-foreground'
          )}
        >
          {value}
        </p>
      </div>

      {/* Base — fora do bloco do topo, entao nao tem como deslocar o valor. */}
      {subtitle && (
        <p data-kpi-subtitle className="mt-1 text-xs text-muted-foreground">
          {subtitle}
        </p>
      )}
    </Comp>
  )
}
