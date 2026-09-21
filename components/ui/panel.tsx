import { cn } from '@/lib/utils'

/**
 * Panel — tipo 2 da familia fechada de superficies (Sprint 16).
 *
 * Todo bloco com cabecalho e conteudo: graficos, painel de criticos,
 * atividade recente, tabelas embutidas, blocos de relatorio.
 *
 * O que ele encerra: antes conviviam tres paddings de cabecalho
 * (`px-6 pb-4 pt-6`, `px-5 pb-4 pt-5`, `px-5 pb-3 pt-5`) e tres escalas de
 * titulo (14, 16 e 18px) para o mesmo papel. Superficies verticalmente
 * adjacentes e da mesma largura comecavam o texto a distancias diferentes da
 * borda esquerda — 24px numa, 20px na de baixo.
 *
 * O recuo de 20px (`px-5`) nao e' invencao: e' o que `lib/table-styles.ts` ja
 * usa em `TABLE_CELL_CLASS`, e a casca e' a mesma de `TABLE_SHELL_CLASS`.
 * O Panel estende para os cards a regua que as tabelas ja seguiam.
 *
 * REGRA DURA: um Panel nao contem outro card. Borda dentro de borda e'
 * elevacao declarada duas vezes. Listas dentro de painel usam linhas com
 * `divide-y`, nao cartoezinhos com borda propria.
 */
export function Panel({
  children,
  className,
  ...props
}: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-xl border border-surface-line bg-card', className)}
      {...props}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  /** Titulo do bloco. Renderizado como `<h2>` — ver a nota sobre hierarquia. */
  title?: React.ReactNode
  description?: React.ReactNode
  /** Acao a direita do titulo (link "ver todos", botao, badge de contagem). */
  action?: React.ReactNode
  className?: string
  /** Cabecalho totalmente customizado. Quando presente, ignora title/description. */
  children?: React.ReactNode
}) {
  return (
    <div className={cn('px-5 pt-5 pb-4', className)}>
      {children ?? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {/*
              `<h2>` e nao `<h3>`: a pagina abre em `<h1>` e os blocos sao seus
              filhos diretos na hierarquia semantica. Nao ha nivel intermediario.
            */}
            {title && <h2 className="text-base font-semibold text-card-foreground">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
    </div>
  )
}

export function PanelBody({
  children,
  className,
  flush = false,
}: {
  children: React.ReactNode
  className?: string
  /**
   * Remove o recuo horizontal do corpo. Para tabelas e listas com `divide-y`,
   * que precisam sangrar ate a borda do painel — o recuo de 20px passa a ser
   * responsabilidade das CELULAS (`TABLE_CELL_CLASS` ja usa `px-5`), senao o
   * conteudo ganha 40px de recuo e a linha divisoria nao alcanca a borda.
   */
  flush?: boolean
}) {
  return <div className={cn(flush ? 'pb-0' : 'px-5 pb-5', className)}>{children}</div>
}

export function PanelFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('border-t border-surface-line px-5 py-3', className)}>{children}</div>
  )
}
