/**
 * Vocabulario UNICO de severidade dos cards de KPI.
 *
 * Antes da Sprint 16 o sistema tinha DOIS vocabularios para o mesmo conceito:
 * `StatCard` chamava a falha de `danger` e `SummaryCard` de `destructive`, e
 * cada um mantinha sua propria tabela de classes.
 *
 * O nome canonico e' `destructive`, porque e' o que o token de tema ja usa
 * (`--destructive` / `--color-destructive` em app/globals.css). O nome `danger`
 * foi ELIMINADO do sistema — nao ha alias, porque um alias mantido indefinidamente
 * e' o mesmo vocabulario duplo com uma camada de traducao por cima.
 */

export const KPI_TONES = ['neutral', 'primary', 'info', 'success', 'warning', 'destructive'] as const

export type KpiTone = (typeof KPI_TONES)[number]

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
 * Cor do numero quando o card pede enfase (`emphasizeValue`). Sem enfase o
 * valor fica em `text-card-foreground` — ver a prop no KpiCard para o motivo.
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
 * Chip do icone: tamanho FIXO, definido aqui e nao pelo chamador.
 *
 * Antes existiam tres tamanhos no sistema (32px via `p-2`, 40px via
 * `h-10 w-10`, 48px via `h-12 w-12`), porque cada chamador passava a classe de
 * tamanho no proprio icone. `[&>svg]:size-4` normaliza o SVG recebido sem
 * exigir edicao de cada call site.
 */
export const KPI_ICON_CHIP_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:size-4'
