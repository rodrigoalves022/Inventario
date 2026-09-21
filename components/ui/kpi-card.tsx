'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  KPI_ICON_CHIP_CLASS,
  KPI_TONE_GLOW_CLASS,
  KPI_TONE_ICON_CLASS,
  KPI_TONE_RING_CLASS,
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
 * O numero alinha por ANCORAGEM SUPERIOR, nunca por `justify-between`.
 *
 * Tres faixas, de cima para baixo:
 *
 *   1. Cabecalho — altura FIXA (`h-8`), com o chip de 32px e o rotulo em
 *      `line-clamp-1`. Fixa mesmo SEM icone: um card sem icone numa fileira
 *      com cards que tem icone precisa reservar a mesma altura, senao o numero
 *      dele sobe.
 *   2. Valor — `mt-3` a partir do cabecalho. Como as duas medidas acima sao
 *      constantes, o valor cai sempre no MESMO deslocamento a partir do topo
 *      do card: 16px (py-4) + 32px (h-8) + 12px (mt-3).
 *   3. Subtitulo — vem DEPOIS do valor, e cresce para baixo.
 *
 * Por que isso importa: `justify-between` (a tecnica anterior) ancorava valor
 * e subtitulo juntos na BASE. Como o subtitulo tem comprimento imprevisivel
 * ("94% de disponibilidade" contra "Disco abaixo de 10 GB livres ou RAM abaixo
 * do limiar"), cada linha extra empurrava o numero para cima e os numeros da
 * fileira deixavam de se alinhar. Ancorando no topo, o subtitulo nao tem como
 * deslocar o valor — ele esta abaixo dele na ordem do documento.
 *
 * `h-full` continua igualando a ALTURA dos cards da fileira, mas o alinhamento
 * dos numeros nao depende mais disso.
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
        'flex h-full w-full select-none flex-col rounded-xl border border-surface-line bg-card px-5 py-4 text-left',
        KPI_TONE_GLOW_CLASS[tone],
        // Elevacao e cursor SO quando o card leva a algum lugar. Um card que
        // levanta no hover e nao clica e' promessa falsa — era o defeito do
        // card "Taxa de disponibilidade" em /reports.
        interactive &&
          'surface-interactive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && `ring-2 ${KPI_TONE_RING_CLASS[tone]}`
      )}
    >
      {/* Faixa 1 — altura fixa, com ou sem icone. Ver o cabecalho do arquivo. */}
      <div className="flex h-8 shrink-0 items-center gap-3" data-kpi-header>
        {icon && <div className={cn(KPI_ICON_CHIP_CLASS, KPI_TONE_ICON_CLASS[tone])}>{icon}</div>}
        <p className="section-label line-clamp-1">{label}</p>
      </div>

      {/* Faixa 2 — deslocamento constante a partir do topo. */}
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

      {/* Faixa 3 — cresce para baixo, sem tocar no valor. */}
      {subtitle && (
        <p data-kpi-subtitle className="mt-1 text-xs text-muted-foreground">
          {subtitle}
        </p>
      )}
    </Comp>
  )
}
