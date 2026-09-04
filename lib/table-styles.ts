/**
 * Tokens de superficie das tabelas de listagem do tenant, centralizados para
 * não reimplementar a mesma string em cada tabela (computers, servers, storage,
 * processors, audit, network, dashboard).
 *
 * Atualizado no Overhaul visual — Fase 1. Ver DESIGN.md na raiz.
 */

/**
 * Hover de linha. Dois conceitos distintos, e agora tambem duas LEITURAS
 * visuais distintas:
 *
 * - CLICKABLE_ROW_CLASS: a linha inteira navega ao clicar (role="button" +
 *   onClick + onKeyDown no <tr>, com um <Link> interno para o hostname que
 *   chama stopPropagation — ver tenant-computers-table.tsx). Alem do lavado
 *   branco de 3%, ganha `row-interactive`: um gradiente curto em ciano
 *   primario partindo da borda esquerda (app/globals.css). E' o que diz, sem
 *   legenda, que a linha e' um alvo de navegacao.
 * - STATIC_ROW_HOVER_CLASS: a linha não navega (só pode ter um link interno
 *   pontual, ex: hostname ou "Abrir ativo"). So o lavado branco. Nunca inclui
 *   cursor-pointer.
 *
 * `bg-surface-hover` e' o `white/[0.03]` do escopo promovido a token
 * (--surface-hover em app/globals.css). Substituiu `bg-accent/40` e
 * `bg-muted/60`: o branco translucido compoe sobre QUALQUER fundo (card,
 * popover, faixa de cabecalho) e nao briga com barra de progresso nem badge
 * colorido na mesma linha, que era o motivo do comentario antigo sobre
 * "accent e' ciano bem saturado".
 */
export const CLICKABLE_ROW_CLASS =
  'row-interactive cursor-pointer transition-colors duration-150 hover:bg-surface-hover'

export const STATIC_ROW_HOVER_CLASS = 'transition-colors duration-150 hover:bg-surface-hover'

/**
 * Tokens de estrutura das tabelas de listagem. As 10 tabelas importam daqui em
 * vez de repetir ~60 vezes a mesma classe.
 *
 * - TABLE_HEAD_ROW_CLASS: vai no <tr> do <thead>, NAO em cada <th>. O fundo e
 *   a borda inferior sao propriedades da FAIXA de cabecalho, nao da celula:
 *   repetir background por celula e redundante e deixa emenda visivel entre
 *   celulas adjacentes. Por isso TABLE_HEAD_CLASS abaixo nao inclui fundo nem
 *   `border-b`. `bg-surface-raise` (white 2.5%) trocou `bg-muted/50`: o
 *   cabecalho passa a ser um degrau de elevacao sobre o card, nao um bloco de
 *   cor propria.
 * - TABLE_HEAD_CLASS: o que e mesmo por celula de cabecalho. Usa
 *   `section-label` — a MESMA regra de titulo de secao e de rotulo de card de
 *   KPI (11px / 700 / 0.1em, app/globals.css). No sistema os tres sao a mesma
 *   coisa: o nome do bloco que vem abaixo. Antes era `text-xs font-semibold
 *   tracking-wider` colado aqui.
 * - TABLE_CELL_CLASS: celula de dados. `align-top` porque varias colunas
 *   tem conteudo de duas linhas (hostname + sistema, usuario + role, barras de
 *   uso por disco) e alinhar pelo meio desalinhava a primeira linha de texto
 *   entre colunas vizinhas.
 * - TABLE_DATA_CELL_CLASS: celula de DADO TECNICO (IP, hostname, MAC, serial,
 *   porta, versao). Composicao de TABLE_CELL_CLASS com `data-mono`
 *   (JetBrains Mono + tracking-tight + tabular-nums). Existe para que "dado
 *   tecnico e' monoespacado" seja uma regra do sistema e nao uma decisao
 *   repetida — e diferente — em cada tabela.
 *
 * EXCECAO DELIBERADA — `components/device-detail-tabs.tsx` NAO usa estes
 * tokens e continua com `px-4 py-2`. As tabelas de la sao sub-tabelas densas
 * aninhadas dentro das abas de detalhe de um dispositivo (softwares
 * instalados, discos, interfaces), com dezenas de linhas dentro de um painel;
 * subir para `py-4` incharia a aba inteira. Sao tabelas de detalhe, nao de
 * listagem — escopo diferente, densidade diferente, de proposito.
 */
export const TABLE_HEAD_ROW_CLASS = 'border-b border-surface-line bg-surface-raise text-muted-foreground'

export const TABLE_HEAD_CLASS = 'section-label px-5 py-3.5 text-left'

export const TABLE_CELL_CLASS = 'px-5 py-4 align-top'

export const TABLE_DATA_CELL_CLASS = 'px-5 py-4 align-top data-mono'

/**
 * Casca da tabela de listagem (o <div> que envolve o <table>). Elevacao
 * declarada UMA vez: a borda de 1px carrega a superficie, sem sombra por baixo
 * — borda fina sob sombra larga e' o "card fantasma" que o sistema evita.
 * Antes conviviam `rounded-lg border border-border`, `rounded-lg border` e
 * `rounded-xl border … shadow-sm` entre as 8 listagens.
 *
 * Nao inclui `overflow-*` de proposito: umas cascas precisam de
 * `overflow-hidden` (clipar a faixa de cabecalho no raio) e outras de
 * `overflow-x-auto` (rolagem horizontal na propria casca), e as duas nao
 * convivem na mesma classe. Cada chamador adiciona a sua.
 */
export const TABLE_SHELL_CLASS = 'rounded-xl border border-surface-line bg-card'
