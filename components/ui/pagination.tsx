'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/**
 * Primitivas do rodape de paginacao (Overhaul visual — Fase 3).
 *
 * ============================================================================
 * POR QUE ESTE ARQUIVO FOI REESCRITO EM VEZ DE REAPROVEITADO COMO ESTAVA
 * ============================================================================
 *
 * Ele existia desde o scaffold do shadcn e NUNCA foi importado por ninguem —
 * codigo morto, mesmo caso do `ui/table.tsx` (item 9 do Backlog). A versao
 * original nao servia como base porque:
 *
 * 1. Todo controle era `<a>` SEM `href`. Ancora sem href nao entra na ordem de
 *    tabulacao, nao dispara em Enter/Espaco, nao tem `:disabled` e nao expoe
 *    `role="button"` — ou seja, "Anterior" desabilitado nos extremos era
 *    impossivel de expressar. Nesta fase a paginacao e' CLIENT-SIDE: o controle
 *    e' um botao que muda estado, nao um link que navega.
 * 2. Os rotulos eram fixos em ingles ("Previous", "Next", "More pages",
 *    `aria-label="pagination"`) num produto inteiro em portugues.
 * 3. O ativo usava `variant="outline"`; o sistema pede o estado atual em ciano
 *    (`--primary`, DESIGN.md §2.2), com tinta ESCURA por cima — branco sobre
 *    `#0EA5E9` da 2.6:1 e reprovaria.
 *
 * Em vez de deixar duas paginacoes no repositorio (uma morta e uma viva), as
 * primitivas foram trocadas pelas que o rodape usa de fato, mantendo a
 * convencao `data-slot` do shadcn para o arquivo continuar reconhecivel.
 *
 * Composicao pronta: `components/ui/table-pagination.tsx`.
 */

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Paginação"
      data-slot="pagination"
      className={cn('flex items-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationButtonProps = React.ComponentProps<'button'> & {
  isActive?: boolean
  size?: 'sm' | 'icon-sm'
}

/**
 * Pilula de pagina. `aria-current="page"` (nao so a cor) e' o que diz a um
 * leitor de tela qual pagina esta aberta — cor nunca e' canal unico (DESIGN.md
 * §9). O ativo usa a variante `default` do Button: `bg-primary` com
 * `text-primary-foreground` (tinta escura), 6.9:1.
 */
function PaginationButton({ className, isActive = false, size = 'icon-sm', type = 'button', ...props }: PaginationButtonProps) {
  return (
    <button
      type={type}
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({ variant: isActive ? 'default' : 'ghost', size }),
        'tabular-nums',
        className
      )}
      {...props}
    />
  )
}

/** Nos extremos o controle fica `disabled` — e nao escondido. Sumir com o botao
 * faz a barra inteira reposicionar entre a pagina 1 e a 2, e o usuario perde a
 * referencia de onde clicar. */
function PaginationPrevious({ className, ...props }: PaginationButtonProps) {
  return (
    <PaginationButton
      aria-label="Página anterior"
      size="sm"
      className={cn('gap-1 px-2 sm:px-2.5', className)}
      {...props}
    >
      <ChevronLeft className="size-4" />
      <span className="hidden sm:inline">Anterior</span>
    </PaginationButton>
  )
}

function PaginationNext({ className, ...props }: PaginationButtonProps) {
  return (
    <PaginationButton
      aria-label="Próxima página"
      size="sm"
      className={cn('gap-1 px-2 sm:px-2.5', className)}
      {...props}
    >
      <span className="hidden sm:inline">Próxima</span>
      <ChevronRight className="size-4" />
    </PaginationButton>
  )
}

/** Icone `lucide-react`, nao o glifo "…": DESIGN.md §10 proibe glifo Unicode no
 * lugar de icone, e o traco unico casa com o resto da barra. */
function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      data-slot="pagination-ellipsis"
      className={cn('flex size-8 items-center justify-center text-muted-foreground', className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationButton,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
