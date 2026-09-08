'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  PAGE_SIZE_OPTIONS,
  formatPaginationRange,
  getPageWindow,
  parsePageSize,
  type ItemNoun,
  type PageSize,
  type PageSlice,
} from '@/lib/table-pagination'

/**
 * Rodape de paginacao UNICO das 6 listagens do tenant (/computers, /servers,
 * /storage, /processors, /network, /audit) — mesmo principio de
 * `lib/table-styles.ts` e de `components/ui/status-pill.tsx`: a forma e' do
 * sistema, o vocabulario e' de cada chamador.
 *
 * ============================================================================
 * ISTO E' PAGINACAO DE APRESENTACAO, NAO DE ESCALA
 * ============================================================================
 * O recorte acontece sobre o array que o Server Component ja carregou INTEIRO e
 * que o componente cliente ja filtrou. A pagina deixa de renderizar 142 linhas
 * de uma vez; o servidor continua carregando e mandando as 142. Paginacao
 * server-side (`skip`/`take`) quando o volume justificar e' trabalho proprio —
 * a decisao e os motivos estao em `lib/table-pagination.ts`.
 *
 * Contrato de uso, sempre nesta ordem: FILTRAR -> CONTAR -> PAGINAR.
 *
 *   const filtered = useMemo(() => rows.filter(...), [...])       // filtrar
 *   const summary  = useMemo(() => count(filtered), [filtered])   // contar (KPI)
 *   const slice    = getPageSlice(filtered, page, pageSize)       // paginar
 *
 * O rodape conta o conjunto FILTRADO (`slice.total`), nunca o bruto e nunca as
 * 25 da pagina; os cards de KPI seguem contando o que ja contavam. Trocar
 * filtro ou busca precisa chamar `setPage(1)` no chamador — sem isso o usuario
 * cai numa pagina que o novo filtro nao tem.
 *
 * Nao renderiza nada com `total === 0`: quem fala por uma lista vazia e' o
 * estado vazio da propria tabela, e um rodape dizendo "Exibindo 0-0 de 0" ao
 * lado dele seria a segunda voz dizendo a mesma coisa pior.
 */
export type TablePaginationProps = {
  /** Resultado de `getPageSlice(...)` — a MESMA fonte que produziu as linhas
   * renderizadas. Passar o slice inteiro (em vez de page/total soltos) e' o que
   * impede o rodape de dizer um numero e a tabela mostrar outro. */
  slice: PageSlice<unknown>
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: PageSize) => void
  /** "142 dispositivos" em /computers, "37 modelos" em /processors, "200
   * registros" em /audit. Obrigatorio de proposito: nao ha default honesto. */
  itemNoun: ItemNoun
  /** Distingue a `<nav>` quando houver mais de uma listagem na mesma pagina. */
  navLabel?: string
  /** Nota curta ao lado da contagem (ex.: teto de resultados atingido). */
  note?: React.ReactNode
  className?: string
}

export function TablePagination({
  slice,
  onPageChange,
  onPageSizeChange,
  itemNoun,
  navLabel = 'Paginação da listagem',
  note,
  className,
}: TablePaginationProps) {
  const selectId = React.useId()

  if (slice.total === 0) return null

  const pages = getPageWindow(slice.page, slice.totalPages)
  const label = slice.total === 1 ? itemNoun.one : itemNoun.other

  return (
    <div
      data-slot="table-pagination"
      className={cn(
        // Faixa de rodape com o mesmo tratamento da faixa de CABECALHO da
        // tabela (`TABLE_HEAD_ROW_CLASS`): `bg-surface-raise` + linha em
        // `--surface-line`. Os dois viram as bordas do mesmo bloco, em vez de
        // um segundo card flutuando abaixo da casca.
        'flex flex-col gap-3 border-t border-surface-line bg-surface-raise px-5 py-3 text-xs',
        'sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="space-y-0.5">
        {/* `formatPaginationRange` monta a MESMA string; aqui ela e' quebrada em
            spans so para dar peso aos numeros. Os dois tem que dizer a mesma
            coisa — o teste compara o `textContent` deste `<p>` com o retorno da
            funcao pura. */}
        <p data-testid="table-pagination-summary" className="text-muted-foreground">
          {'Exibindo '}
          <span className="font-semibold tabular-nums text-foreground">{`${slice.from}–${slice.to}`}</span>
          {' de '}
          <span className="font-semibold tabular-nums text-foreground">{slice.total}</span>
          {` ${label}`}
        </p>
        {note ? <p className="text-muted-foreground/80">{note}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          {/* `<label htmlFor>` + `<select>` nativo. Nativo de proposito: o
              `color-scheme: dark` de `:root` ja tematiza o popup do SO
              (DESIGN.md §1), e um Select do Radix exigiria `aria-labelledby`
              manual para um controle que o `<label>` resolve sozinho. */}
          <label htmlFor={selectId} className="whitespace-nowrap text-muted-foreground">
            Itens por página
          </label>
          <select
            id={selectId}
            data-testid="table-pagination-page-size"
            value={slice.pageSize}
            onChange={(event) => onPageSizeChange(parsePageSize(event.target.value))}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs tabular-nums text-foreground transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Com uma pagina so, "Anterior"/"Proxima"/pilula "1" sao chrome que
            nunca pode fazer nada. O contador e o seletor ficam — eles continuam
            informando e continuam agindo. */}
        {slice.totalPages > 1 ? (
          <Pagination aria-label={navLabel}>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  disabled={slice.page <= 1}
                  onClick={() => onPageChange(slice.page - 1)}
                />
              </PaginationItem>

              {pages.map((entry, index) =>
                entry === 'ellipsis' ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={entry}>
                    <PaginationButton
                      isActive={entry === slice.page}
                      aria-label={`Página ${entry}`}
                      onClick={() => onPageChange(entry)}
                    >
                      {entry}
                    </PaginationButton>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <PaginationNext
                  disabled={slice.page >= slice.totalPages}
                  onClick={() => onPageChange(slice.page + 1)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>
    </div>
  )
}

/** Reexportado para o chamador nao precisar importar de dois lugares. */
export { formatPaginationRange }
