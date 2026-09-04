'use client'

import { cn } from '@/lib/utils'

/**
 * Tom do card. Cada tom aponta `--surface-glow` para o SEU token de cor, e a
 * classe `surface-interactive` (app/globals.css) usa essa variavel para pintar
 * a borda reativa e o halo do hover. E' assim que o glow do card critico e'
 * vermelho e o do card de saude e' verde sem nenhum rgba() literal no
 * componente — a cor entra por token, sempre.
 */
const SUMMARY_TONE = {
  primary: {
    icon: 'bg-primary/12 text-primary',
    value: 'text-foreground',
    ring: 'ring-primary/50 border-primary/45',
    glow: '[--surface-glow:var(--color-primary)]',
  },
  warning: {
    icon: 'bg-warning/12 text-warning',
    value: 'text-warning',
    ring: 'ring-warning/50 border-warning/45',
    glow: '[--surface-glow:var(--color-warning)]',
  },
  destructive: {
    icon: 'bg-destructive/12 text-destructive',
    value: 'text-destructive',
    ring: 'ring-destructive/50 border-destructive/45',
    glow: '[--surface-glow:var(--color-destructive)]',
  },
  // Sprint 15: tons novos, exigidos pelos grids de /processors (Intel -> info) e
  // /storage (faixa "Normal" -> success). Usam os mesmos tokens de tema que o
  // resto do app ja usa (--color-success / --color-info em app/globals.css),
  // nao cor solta — a correcao vive aqui uma vez so, nao em cada instancia.
  success: {
    icon: 'bg-success/12 text-success',
    value: 'text-success',
    ring: 'ring-success/50 border-success/45',
    glow: '[--surface-glow:var(--color-success)]',
  },
  info: {
    icon: 'bg-info/12 text-info',
    value: 'text-info',
    ring: 'ring-info/50 border-info/45',
    glow: '[--surface-glow:var(--color-info)]',
  },
} as const

/**
 * Card de resumo compacto (label + valor + ícone), usado em grids de KPI
 * clicáveis do tenant (ex: TenantComputersTable, reusado por /computers,
 * /servers e /assets). Quando `onClick` é passado, o card é o próprio
 * controle de filtro (substitui um dropdown de criticidade — o número que o
 * usuário já olha é o botão que ele aperta, em vez de duas UIs mostrando o
 * mesmo dado).
 *
 * Extraído de components/tenant-computers-table.tsx para components/ui/ por
 * ser reusado fora do arquivo onde nasceu — correção de hover feita aqui uma
 * vez só, não em cada instância avulsa.
 *
 * --- Overhaul visual, Fase 1 -------------------------------------------------
 *
 * - Elevacao declarada UMA vez. Em repouso o card e' `border-surface-line`
 *   (white/8%) sobre `bg-card`, SEM sombra; a sombra so existe no hover, como
 *   feedback de estado, e carrega offset + blur reais antes do halo colorido.
 *   Sairam `shadow-md`, `hover:bg-accent/30` e `hover:border-accent/50`.
 * - `hover:scale-[1.02]` saiu em favor de `translateY(-2px)`: escala reamostra
 *   o texto do card (o numero fica meio pixel borrado durante a transicao),
 *   translacao nao. O deslocamento tambem e' o pedido no escopo
 *   (`hover:-translate-y-0.5`).
 * - Nada de `backdrop-blur`: card opaco sobre fundo chapado nao tem o que
 *   desfocar; blur ali so custa GPU.
 * - Todo o movimento desliga sob `prefers-reduced-motion` (regra em
 *   app/globals.css).
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
  tone: keyof typeof SUMMARY_TONE
  active?: boolean
  onClick?: () => void
  /** `data-testid` do card — usado quando o card e' o proprio controle de
   * filtro e o teste precisa clicar nele (ex: `usage-card-critical`). */
  testId?: string
}) {
  const tones = SUMMARY_TONE[tone]
  const Comp = onClick ? 'button' : 'div'

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      aria-pressed={onClick ? active : undefined}
      className={cn(
        // `h-full flex flex-col justify-between` resolve um desalinhamento real
        // e visivel: os rotulos tem comprimentos muito diferentes ("Total de
        // Dispositivos" vs "Critico (Acima de 80% usado)"), quebram em numero
        // diferente de linhas, e sem isso os NUMEROS ficavam em alturas
        // diferentes ao longo da mesma fileira. Com altura cheia e o valor
        // empurrado para a base, os numeros da fileira se alinham entre si.
        // (Nao e correcao de "zona morta de clique": um <button> filho direto
        // de grid ja recebe align-self: stretch e ja preenchia a celula.)
        // `select-none` evita selecao de texto ao clicar repetido num card que
        // e, ele proprio, o controle de filtro.
        'surface-interactive flex h-full w-full select-none flex-col justify-between rounded-xl border border-surface-line bg-card p-4 text-left',
        tones.glow,
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && `ring-2 ${tones.ring}`
      )}
    >
      <div className="mb-2 flex items-center gap-3">
        <div className={cn('rounded-lg p-2', tones.icon)}>{icon}</div>
        <p className="section-label">{label}</p>
      </div>
      <p
        data-testid={testId ? `${testId}-value` : undefined}
        className={cn('text-2xl font-bold tabular-nums tracking-tight', tones.value)}
      >
        {value}
      </p>
    </Comp>
  )
}
