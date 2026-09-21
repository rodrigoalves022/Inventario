'use client'

import { cn } from '@/lib/utils'
import {
  KPI_CARD_SHELL_CLASS,
  KPI_ICON_CHIP_CLASS,
  KPI_TONE_GLOW_CLASS,
  KPI_TONE_ICON_CLASS,
  KPI_TONE_RING_CLASS,
  KPI_TONE_VALUE_CLASS,
  normalizeKpiTone,
  type KpiToneInput,
} from '@/lib/kpi-tone'

/**
 * Card de resumo compacto (rótulo + valor + ícone), usado em grids de KPI
 * clicáveis do tenant (ex: TenantComputersTable, reusado por /computers,
 * /servers e /assets). Quando `onClick` é passado, o card é o próprio
 * controle de filtro (substitui um dropdown de criticidade — o número que o
 * usuário já olha é o botão que ele aperta, em vez de duas UIs mostrando o
 * mesmo dado).
 *
 * --- Overhaul visual, Fase 1 -------------------------------------------------
 *
 * - Elevacao declarada UMA vez. Em repouso o card e' `border-surface-line`
 *   (white/8%) sobre `bg-card`, SEM sombra; a sombra so existe no hover, como
 *   feedback de estado, e carrega offset + blur reais antes do halo colorido.
 * - `hover:scale-[1.02]` saiu em favor de `translateY(-2px)`: escala reamostra
 *   o texto do card (o numero fica meio pixel borrado durante a transicao),
 *   translacao nao.
 * - Nada de `backdrop-blur`: card opaco sobre fundo chapado nao tem o que
 *   desfocar; blur ali so custa GPU.
 * - Todo o movimento desliga sob `prefers-reduced-motion` (app/globals.css).
 *
 * --- Unificacao de anatomia (sprint de correcao da auditoria) ----------------
 *
 * A casca, o chip do icone e a tabela de tons sairam daqui para
 * `lib/kpi-tone.ts`, compartilhados com `StatCard`. Os dois cards de KPI do
 * sistema tinham anatomia OPOSTA — icone a esquerda aqui, a direita la — e
 * dois nomes para o mesmo tom de falha (`destructive` aqui, `danger` la).
 * Agora e' uma anatomia so. Ver o cabecalho de `lib/kpi-tone.ts`.
 */
export function SummaryCard({
  icon,
  label,
  value,
  tone,
  active,
  onClick,
  testId,
}: {
  icon: React.ReactNode
  label: string
  value: number
  /** Aceita `danger`/`default` como alias legado — ver `normalizeKpiTone`. */
  tone: KpiToneInput
  active?: boolean
  onClick?: () => void
  /** `data-testid` do card — usado quando o card e' o proprio controle de
   * filtro e o teste precisa clicar nele (ex: `usage-card-critical`). */
  testId?: string
}) {
  const resolvedTone = normalizeKpiTone(tone)
  const Comp = onClick ? 'button' : 'div'

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        // `justify-between` mantido para igualar a altura da fileira; o
        // alinhamento dos NUMEROS vem da ancoragem superior do rotulo, que
        // ocupa sempre uma linha.
        KPI_CARD_SHELL_CLASS,
        'justify-between',
        KPI_TONE_GLOW_CLASS[resolvedTone],
        // `surface-interactive` CONDICIONAL, igual ao StatCard: hoje as 13
        // instancias do sistema passam `onClick`, entao isto nao muda nada na
        // tela — fecha o defeito na origem, para que a proxima instancia sem
        // acao nao nasca levantando no hover sem ter para onde levar.
        onClick &&
          'surface-interactive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && `ring-2 ${KPI_TONE_RING_CLASS[resolvedTone]}`
      )}
    >
      <div className="mb-2 flex items-center gap-3">
        <div className={cn(KPI_ICON_CHIP_CLASS, KPI_TONE_ICON_CLASS[resolvedTone])}>{icon}</div>
        <p className="section-label">{label}</p>
      </div>
      <p
        data-testid={testId ? `${testId}-value` : undefined}
        className={cn('text-2xl font-bold tabular-nums tracking-tight', KPI_TONE_VALUE_CLASS[resolvedTone])}
      >
        {value}
      </p>
    </Comp>
  )
}
