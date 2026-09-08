/**
 * Paginacao das tabelas de listagem do tenant (/computers, /servers, /storage,
 * /processors, /network, /audit). Modulo PURO — nenhuma dependencia de React
 * nem de `next/navigation` — para que o recorte, a contagem e o parse de URL
 * possam ser testados sem montar componente.
 *
 * ============================================================================
 * O QUE ESTA PAGINACAO E, E O QUE ELA NAO E
 * ============================================================================
 *
 * E' paginacao de APRESENTACAO: a pagina nao renderiza 142 linhas de uma vez.
 * NAO e' ganho de escala — o Server Component continua carregando TODAS as
 * linhas do tenant no `findMany` e mandando todas ao navegador; o recorte
 * acontece sobre o array ja carregado e ja filtrado no cliente.
 *
 * Foi decidido assim de proposito, nesta ordem de motivos:
 *
 * 1. Paginacao server-side exigiria mover busca e filtros para a URL e para
 *    queries Prisma. Isso quebraria o filtro instantaneo e, principalmente,
 *    quebraria os cards de KPI (`/computers`, `/storage`, `/processors`), que
 *    contam sobre o conjunto INTEIRO e dobram como controle de filtro: eles
 *    passariam a precisar de queries de contagem separadas, e as invariantes
 *    de soma testadas na Sprint 15 (`total === ok + warning + critical`, "a
 *    soma da coluna Dispositivos das linhas visiveis == o numero do card")
 *    cairiam.
 * 2. Mexeria em `prisma.*.findMany`, ou seja, em escopo de tenant. Esta fase e'
 *    de apresentacao; risco de RBAC nao se justifica aqui.
 * 3. E' reversivel. Quando um tenant tiver volume que justifique, migrar para
 *    `skip`/`take` e' trabalho proprio, com teste proprio.
 *
 * A ORDEM E' SEMPRE: filtrar -> contar -> paginar. O rodape mostra o total do
 * conjunto FILTRADO ("Exibindo 1-25 de 37" com filtro ligado, nao de 142), e os
 * cards de KPI continuam contando exatamente o que ja contavam — nunca os 25 da
 * pagina.
 */

/** Catalogo fechado de itens por pagina. Qualquer outro valor cai no default. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export const DEFAULT_PAGE_SIZE: PageSize = 25

/** Substantivo do item contado no rodape. Parametrizavel porque as 6 tabelas
 * nao listam a mesma coisa: /computers lista computadores, /processors lista
 * MODELOS de CPU e /audit lista REGISTROS. Um rodape dizendo "dispositivos"
 * numa tabela de modelos seria mentira. */
export type ItemNoun = { one: string; other: string }

/** O que chega de `searchParams` (Next) ou de um `<select>`: string, array de
 * string quando o parametro se repete na URL, ou nada. */
export type RawParam = string | string[] | number | null | undefined

function firstValue(value: RawParam): string | number | null {
  if (Array.isArray(value)) return value[0] ?? null
  if (value === undefined) return null
  return value
}

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value)
}

/**
 * Converte so o que e' um inteiro decimal escrito de forma canonica. `Number()`
 * sozinho aceita coisa que uma URL nunca deveria carregar aqui — `'1e2'` vira
 * 100, `'0x19'` vira 25, `' '` vira 0 — e o resultado passaria pelo catalogo
 * como se fosse um valor legitimo. Qualquer outra forma vira `null` e cai no
 * default do chamador.
 */
function toIntegerOrNull(value: string | number): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null
  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/**
 * `?limit=` da URL e' entrada NAO CONFIAVEL, mesmo sendo so UI: qualquer coisa
 * fora do catalogo (`?limit=9999`, `?limit=abc`, `?limit=-1`, `?limit=25.5`)
 * cai no default de 25 em vez de virar um recorte arbitrario. Mesmo principio
 * de parse defensivo de `toDiscoveredDeviceType` em /network.
 */
export function parsePageSize(value: RawParam): PageSize {
  const raw = firstValue(value)
  if (raw === null) return DEFAULT_PAGE_SIZE
  const parsed = toIntegerOrNull(raw)
  return parsed !== null && isPageSize(parsed) ? parsed : DEFAULT_PAGE_SIZE
}

/** `?page=` invalida (nao inteira, zero, negativa, texto) cai na pagina 1. O
 * teto e' aplicado depois, por `getPageSlice`, que e' quem conhece o total. */
export function parsePageNumber(value: RawParam): number {
  const raw = firstValue(value)
  if (raw === null) return 1
  const parsed = toIntegerOrNull(raw)
  if (parsed === null || parsed < 1) return 1
  return parsed
}

export function getTotalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

export type PageSlice<T> = {
  /** As linhas da pagina atual — o que a tabela renderiza. */
  items: T[]
  /** Pagina ja limitada ao intervalo valido (ver `getPageSlice`). */
  page: number
  totalPages: number
  /** Tamanho EFETIVO da pagina (o default, se o pedido estiver fora do catalogo). */
  pageSize: PageSize
  /** Total do conjunto FILTRADO, nunca do conjunto bruto. */
  total: number
  /** Primeiro/ultimo indice 1-based exibidos. `from` e' 0 quando nao ha linha. */
  from: number
  to: number
}

/**
 * Recorta o conjunto JA FILTRADO. Limita a pagina ao intervalo valido em vez
 * de confiar no estado: com filtro trocado, dado recarregado ou `?page=99` numa
 * lista de 3 paginas, o usuario cai na ultima pagina existente e nunca numa
 * pagina vazia. Quem exibe o numero da pagina deve usar `slice.page`, nao o
 * estado cru — sao a mesma coisa no caso normal e diferentes exatamente nos
 * casos em que o estado ficou para tras.
 */
export function getPageSlice<T>(items: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const size = isPageSize(pageSize) ? pageSize : DEFAULT_PAGE_SIZE
  const total = items.length
  const totalPages = getTotalPages(total, size)
  const requested = Number.isInteger(page) && page >= 1 ? page : 1
  const safePage = Math.min(requested, totalPages)
  const start = (safePage - 1) * size
  const pageItems = items.slice(start, start + size)

  return {
    items: pageItems,
    page: safePage,
    totalPages,
    pageSize: size,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + pageItems.length,
  }
}

export type PageWindowEntry = number | 'ellipsis'

/**
 * Janela de pilulas com elipse. Uma listagem de 4200 linhas em paginas de 25 da
 * 168 paginas; renderizar 168 botoes seria pior do que nao paginar. A janela
 * mantem sempre a primeira e a ultima pagina visiveis (os dois destinos que o
 * usuario mais quer) e um bloco contiguo em volta da atual:
 *
 *   1 … 4 5 [6] 7 8 … 42
 *
 * `maxSlots` conta so as pilulas NUMERICAS; as elipses entram alem disso.
 */
export function getPageWindow(page: number, totalPages: number, maxSlots = 7): PageWindowEntry[] {
  if (totalPages <= 0) return []
  if (totalPages <= maxSlots) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  // Slots do bloco do meio: o total menos a primeira e a ultima, que sao fixas.
  const innerSlots = maxSlots - 2
  let start = page - Math.floor((innerSlots - 1) / 2)
  let end = start + innerSlots - 1

  if (start < 2) {
    start = 2
    end = start + innerSlots - 1
  }
  if (end > totalPages - 1) {
    end = totalPages - 1
    start = end - innerSlots + 1
  }

  const entries: PageWindowEntry[] = [1]
  if (start > 2) entries.push('ellipsis')
  for (let current = start; current <= end; current += 1) entries.push(current)
  if (end < totalPages - 1) entries.push('ellipsis')
  entries.push(totalPages)

  return entries
}

/**
 * "Exibindo 1-25 de 142 dispositivos". Meia-risca (en dash) entre os extremos
 * do intervalo, que e' o traco de intervalo em portugues — hifen ali e' erro
 * tipografico, nao estilo.
 */
export function formatPaginationRange(
  slice: Pick<PageSlice<unknown>, 'from' | 'to' | 'total'>,
  noun: ItemNoun
): string {
  const label = slice.total === 1 ? noun.one : noun.other
  return `Exibindo ${slice.from}–${slice.to} de ${slice.total} ${label}`
}

/**
 * Aplica atualizacoes sobre a query string ATUAL, preservando todo parametro
 * que ja estava la (`?fabricante=`, `?tipo=`, `?faixa=`, `?search=`, filtros de
 * auditoria). Valor `null` (ou string vazia) REMOVE o parametro — e' assim que
 * `page=1` e `limit=25` (os defaults) somem da URL em vez de sujar todo link
 * compartilhado com ruido que nao muda nada.
 */
export function applyQueryUpdates(currentSearch: string, updates: Record<string, string | null>): string {
  const params = new URLSearchParams(currentSearch)
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') params.delete(key)
    else params.set(key, value)
  }
  return params.toString()
}

/** Par `page`/`limit` como atualizacao de query: default some da URL. */
export function paginationQueryUpdates(page: number, pageSize: number): Record<string, string | null> {
  return {
    page: page > 1 ? String(page) : null,
    limit: pageSize !== DEFAULT_PAGE_SIZE ? String(pageSize) : null,
  }
}

/**
 * Escreve a query na barra de enderecos SEM navegar.
 *
 * `history.replaceState` (e nao `router.replace`) de proposito nas tabelas que
 * ainda nao tinham sincronizacao propria: o recorte e' 100% client-side, entao
 * um `router.replace` por clique de pagina dispararia um round-trip de RSC —
 * refazendo o `findMany` do tenant inteiro — para nada. `replaceState` tambem
 * nao empilha entrada de historico, entao o "voltar" do navegador continua
 * saindo da listagem em vez de desfazer 8 cliques de paginacao.
 *
 * As tabelas que JA sincronizavam via `router.replace` (/storage, /processors)
 * continuam com o mecanismo delas — `page`/`limit` entraram no `syncUrl` que ja
 * existia la, em vez de um segundo mecanismo sobrescrevendo o primeiro.
 */
export function replaceListQueryParams(updates: Record<string, string | null>): void {
  if (typeof window === 'undefined') return
  const query = applyQueryUpdates(window.location.search, updates)
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname
  window.history.replaceState(window.history.state, '', url)
}
