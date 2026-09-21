/**
 * Vocabulario UNICO de severidade dos cards de KPI.
 *
 * Antes desta sprint o sistema tinha DOIS vocabularios para o mesmo conceito:
 * `StatCard` chamava a falha de `danger` e `SummaryCard` chamava de
 * `destructive`, e cada um mantinha sua propria tabela de classes. Auditoria
 * apontou que o mesmo tom de severidade tinha dois nomes no mesmo produto.
 *
 * O nome canonico e' `destructive`, porque e' o que o token de tema ja usa
 * (`--destructive` / `--color-destructive` em app/globals.css). `danger` e
 * `default` continuam sendo aceitos como ALIAS LEGADO — `normalizeKpiTone` os
 * traduz — para que nenhum chamador existente quebre.
 */

export const KPI_TONES = ['neutral', 'primary', 'info', 'success', 'warning', 'destructive'] as const

export type KpiTone = (typeof KPI_TONES)[number]

/**
 * Aliases legados aceitos na fronteira dos componentes.
 * `danger` -> `destructive` (renomeacao desta sprint).
 * `default` -> `neutral` (era o nome do tom sem cor no `StatCard`).
 */
export type KpiToneInput = KpiTone | 'danger' | 'default'

export function normalizeKpiTone(tone: KpiToneInput): KpiTone {
  if (tone === 'danger') return 'destructive'
  if (tone === 'default') return 'neutral'
  return tone
}

/** Chip do icone. Fundo tingido a 12% e icone na cor cheia do tom. */
export const KPI_TONE_ICON_CLASS: Record<KpiTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/12 text-primary',
  info: 'bg-info/12 text-info',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/12 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
}

/**
 * Cor do numero. `neutral` e `primary` deixam o valor na cor de texto do card
 * — um total nao e' um alerta. Os tons de severidade tingem o numero, porque
 * ali a cor E' a informacao.
 */
export const KPI_TONE_VALUE_CLASS: Record<KpiTone, string> = {
  neutral: 'text-card-foreground',
  primary: 'text-card-foreground',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
}

/**
 * Aponta `--surface-glow` para o token do tom. `surface-interactive`
 * (app/globals.css) le essa variavel para pintar borda e halo do hover, o que
 * mantem zero rgba() literal nos componentes.
 */
export const KPI_TONE_GLOW_CLASS: Record<KpiTone, string> = {
  neutral: '[--surface-glow:var(--color-primary)]',
  primary: '[--surface-glow:var(--color-primary)]',
  info: '[--surface-glow:var(--color-info)]',
  success: '[--surface-glow:var(--color-success)]',
  warning: '[--surface-glow:var(--color-warning)]',
  destructive: '[--surface-glow:var(--color-destructive)]',
}

/** Anel de card ativo — usado quando o card e' o proprio controle de filtro. */
export const KPI_TONE_RING_CLASS: Record<KpiTone, string> = {
  neutral: 'ring-muted-foreground/40 border-muted-foreground/40',
  primary: 'ring-primary/50 border-primary/45',
  info: 'ring-info/50 border-info/45',
  success: 'ring-success/50 border-success/45',
  warning: 'ring-warning/50 border-warning/45',
  destructive: 'ring-destructive/50 border-destructive/45',
}

/**
 * Casca compartilhada pelos dois cards de KPI. Mesmo raio, mesmo padding,
 * mesma borda e mesma regra de elevacao (borda de 1px em repouso; sombra e
 * halo so no hover, via `surface-interactive`).
 */
export const KPI_CARD_SHELL_CLASS =
  'flex h-full w-full select-none flex-col rounded-xl border border-surface-line bg-card p-4 text-left'

/**
 * Chip do icone: tamanho FIXO, definido aqui e nao pelo chamador.
 *
 * Antes existiam tres tamanhos no sistema (32px no `SummaryCard` via `p-2`,
 * 40px e 48px no `StatCard` via `h-10 w-10` / `h-12 w-12`), porque cada
 * chamador passava a classe de tamanho no proprio icone. `[&>svg]:size-4`
 * normaliza o SVG recebido sem exigir edicao de cada call site.
 */
export const KPI_ICON_CHIP_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4'
