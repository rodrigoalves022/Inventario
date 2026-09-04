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

/**
 * Tokens de estrutura das tabelas de listagem (ajuste pos-Sprint 15). Mesmo
 * principio dos dois tokens de hover acima: a string vive num lugar so, e as
 * 10 tabelas de listagem importam daqui em vez de repetir ~60 vezes a mesma
 * classe. Antes deste ajuste conviviam 6 variantes diferentes de <th>
 * (px-4/px-5, py-3/py-4, font-medium/font-semibold, com e sem uppercase,
 * bg-muted/50 vs bg-secondary/50), o que aparecia lado a lado ao navegar entre
 * /servers, /computers e /network.
 *
 * - TABLE_HEAD_ROW_CLASS: vai no <tr> do <thead>, NAO em cada <th>. O fundo e
 *   a borda inferior sao propriedades da FAIXA de cabecalho, nao da celula:
 *   repetir background por celula e redundante e deixa emenda visivel entre
 *   celulas adjacentes. Por isso TABLE_HEAD_CLASS abaixo nao inclui
 *   `bg-muted/50` nem `border-b`.
 * - TABLE_HEAD_CLASS: o que e mesmo por celula de cabecalho. `text-xs` e
 *   explicito de proposito — sem ele, o <th> herda o `text-sm` da
 *   <table className="w-full text-sm"> e o cabecalho de /computers,
 *   /processors e /storage fica maior que o de /dashboard.
 * - TABLE_CELL_CLASS: celula de dados. `align-top` porque varias colunas
 *   tem conteudo de duas linhas (hostname + sistema, usuario + role, barras de
 *   uso por disco) e alinhar pelo meio desalinhava a primeira linha de texto
 *   entre colunas vizinhas.
 *
 * EXCECAO DELIBERADA — `components/device-detail-tabs.tsx` NAO usa estes
 * tokens e continua com `px-4 py-2`. As tabelas de la sao sub-tabelas densas
 * aninhadas dentro das abas de detalhe de um dispositivo (softwares
 * instalados, discos, interfaces), com dezenas de linhas dentro de um painel;
 * subir para `py-4` incharia a aba inteira. Sao tabelas de detalhe, nao de
 * listagem — escopo diferente, densidade diferente, de proposito.
 */
export const TABLE_HEAD_ROW_CLASS = 'border-b bg-muted/50 text-muted-foreground'

export const TABLE_HEAD_CLASS = 'px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider'

export const TABLE_CELL_CLASS = 'px-5 py-4 align-top'
