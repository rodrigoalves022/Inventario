/**
 * Tokens de hover para linhas de tabela do tenant, centralizados para não
 * reimplementar a mesma string em cada tabela (computers, servers, storage,
 * processors, audit, network, dashboard). Dois conceitos distintos:
 *
 * - CLICKABLE_ROW_CLASS: a linha inteira navega ao clicar (role="button" +
 *   onClick + onKeyDown no <tr>, com um <Link> interno para o hostname que
 *   chama stopPropagation — ver tenant-computers-table.tsx). Usa a família de
 *   cor "accent" com opacidade alta (40%) e cursor-pointer, sinalizando
 *   interatividade real.
 * - STATIC_ROW_HOVER_CLASS: a linha não navega (só pode ter um link interno
 *   pontual, ex: hostname ou "Abrir ativo"). Usa o token neutro "muted" (o
 *   mesmo do cabeçalho da própria tabela) em vez de "accent" — "accent" é
 *   ciano bem saturado (mesma faixa de croma do verde de "--success" e do
 *   laranja de "--warning"), e brigava visualmente com barras de progresso e
 *   badges de status coloridos na mesma linha. "muted" é neutro (croma ~0.01)
 *   e não compete com nenhuma cor de conteúdo. Nunca inclui cursor-pointer.
 */
export const CLICKABLE_ROW_CLASS = 'cursor-pointer transition-colors duration-150 hover:bg-accent/40'

export const STATIC_ROW_HOVER_CLASS = 'transition-colors hover:bg-muted/60'
