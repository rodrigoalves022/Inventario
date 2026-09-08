# DESIGN.md — Inventário Enterprise

> Sistema de design do produto. Documento de referência: descreve o que **está no
> código** (`app/globals.css`, `lib/table-styles.ts`, `lib/disk-usage.ts`,
> `components/ui/`), não uma intenção. Onde este documento e o código divergirem, o
> código está certo e este documento está desatualizado — corrija-o.
>
> Escrito no **Overhaul visual — Fase 1** (2026-09-04). Companheiro de
> [`docs/PRODUCT.md`](./docs/PRODUCT.md) (verdade de produto) e
> [`docs/SPRINTS.md`](./docs/SPRINTS.md) (histórico de entrega).

---

## 1. O que este produto é, visualmente

Painel de operação de TI. O usuário **está numa tarefa**: descobrir qual máquina está
offline, qual disco vai encher, quem instalou o quê. No vocabulário de modo, é
**Operate** — varredura, densidade, consistência e affordance familiar vencem
expressão. A marca vive na precisão do detalhe, não em ornamento.

Consequência operacional: familiaridade é *feature*. Um administrador de TI que já usa
Datadog, Vercel ou SentinelOne tem que conseguir confiar nesta tela imediatamente, sem
parar em cada componente sutilmente estranho.

**Dark-only, e não por moda.** A cena real de uso é NOC / mesa de suporte, muitas horas
por dia, frequentemente em sala com pouca luz e frequentemente com a tela em segundo
monitor ao lado de um terminal. `:root` e `.dark` carregam valores idênticos de
propósito, e `color-scheme: dark` fica em `:root` — sem ele, controle nativo do
navegador (spinner de `<input type="number">`, popup de `<select>`, date picker)
renderiza com chrome claro do SO.

> **Nota de implementação**: o `<html>` **não** recebe a classe `dark`
> (`app/layout.tsx`). Portanto **toda variante `dark:` do Tailwind neste repositório é
> código morto** — ela nunca casa. O bloco `.dark { … }` em `globals.css` é mantido em
> sincronia com `:root` por segurança, mas hoje não é aplicado. Não escreva estilo novo
> atrás de `dark:`.

---

## 2. Cor

### 2.1 Regra dura

**Zero valor de cor literal em componente.** Cor entra por token. `app/globals.css` é o
único arquivo do repositório onde um hex, `oklch()` ou `rgb()` literal é legítimo.

Isso não é preciosismo: é o que fez a repaginação de 15 telas caber num arquivo. Um
`rgba(14,165,233,0.15)` colado num card é uma decisão que a próxima mudança de paleta
não alcança.

Quando um componente precisa variar a cor de um efeito por tom, ele **aponta uma
variável para um token** — nunca escreve a cor:

```tsx
// components/stat-cards.tsx
success: 'border-success/25 [--surface-glow:var(--color-success)]'
```

### 2.2 Paleta

Todos os valores estão em OKLCH. A coluna "origem" traz o hex pedido no escopo do
overhaul; o OKLCH é a **conversão exata** dele (sRGB → OKLab → OKLCH), não uma
aproximação a olho.

#### Chão e superfícies — família "Void Obsidian", hue ~266

| Token | OKLCH | ≈ hex | Papel |
|---|---|---|---|
| `--sidebar` | `oklch(0.14 0.02 266)` | `#060911` | Segunda camada neutra, um degrau **abaixo** do conteúdo |
| `--background` | `oklch(0.16 0.02 266)` | `#090D16` | Chão da aplicação (origem: `#090D16`) |
| `--card` | `oklch(0.18 0.026 270)` | `#0D111D` | Superfície de conteúdo (origem: `#0D111D`) |
| `--popover` | `oklch(0.205 0.026 268)` | `#121723` | Superfície que **flutua** sobre o card |
| `--sidebar-accent` | `oklch(0.215 0.024 266)` | `#141925` | Item ativo/hover da sidebar |
| `--secondary` / `--input` | `oklch(0.235 0.024 266)` / `oklch(0.29 0.022 266)` | `#191E2A` / `#262B37` | Trilho de barra, botão secundário / aresta de campo |
| `--muted` | `oklch(0.255 0.022 266)` | `#1E232E` | Bloco neutro |
| `--accent` | `oklch(0.255 0.035 240)` | `#122532` | **Superfície de hover** (ver 2.3) |
| `--border` | `oklch(0.27 0.02 266)` | `#222630` | Linha opaca padrão |

Cinco degraus de luminosidade separados por ~0.02–0.03 em L. Não invente um sexto: se
uma superfície precisa "de um degrau", ela provavelmente precisa é de uma borda.

#### Texto

| Token | OKLCH | ≈ hex | Contraste |
|---|---|---|---|
| `--foreground` | `oklch(0.965 0.005 260)` | `#F1F3F7` | 17.5:1 no fundo, 17.0:1 no card |
| `--secondary-foreground` / `--sidebar-foreground` | `oklch(0.87 0.01 260)` | `#D0D4DB` | 11.2:1 no `--secondary` |
| `--muted-foreground` | `oklch(0.735 0.018 258)` | `#A2AAB5` | **8.3:1** no fundo, **8.0:1** no card |

Ambos carregam croma (não são cinza puro): sobre superfície tingida, texto secundário
cinza-neutro "suja". A tintura vem da própria família do chão.

#### Acentos e semântica

| Token | OKLCH | origem | Papel | Contraste no card |
|---|---|---|---|---|
| `--primary` | `oklch(0.685 0.148 237)` | `#0EA5E9` Cyan Elétrico | Ação primária, foco, seleção, estado atual | 6.8:1 |
| `--info` | `oklch(0.715 0.126 215)` | `#06B6D4` Neon Teal | Informativo, segunda categoria | 7.8:1 |
| `--success` | `oklch(0.696 0.149 163)` | `#10B981` Emerald Cyber | Saúde, online, disco ≤60% | 7.4:1 |
| `--warning` | `oklch(0.769 0.165 70)` | `#F59E0B` Amber | Atenção, ausente, disco >60% | 8.8:1 |
| `--destructive` | `oklch(0.637 0.208 25)` | `#EF4444` Crimson | Falha, offline, disco >80% | 5.0:1 |
| `--destructive-solid` | `oklch(0.565 0.195 25)` | derivado | **Preenchimento** de controle destrutivo | branco a 5.0:1 |

**Tinta sobre acento é escura**, não branca: `--primary-foreground`,
`--success-foreground`, `--warning-foreground` e `--info-foreground` são todos
`oklch(0.17 0.03 250)`. Branco sobre `#0EA5E9` dá 2.6:1 e reprova em qualquer critério;
tinta escura dá 6.9:1. Botão ciano com tinta escura é o padrão da categoria.

**Por que Crimson tem dois valores.** `--destructive` (`#EF4444`, o hex pedido) é
**sinal sobre fundo escuro** — texto, ícone, borda, ponto, barra — e ali passa em AA.
Mas branco sobre `#EF4444` dá 3.4:1, e o vermelho anterior dava 5.4:1: adotar o hex
pedido como preenchimento sólido seria **regressão de contraste**. `--destructive-solid`
é um degrau de luminosidade abaixo, no mesmo vermelho, e devolve 5.0:1. Usado só em
`Button variant="destructive"` e `Badge variant="destructive"`.

#### Linhas e superfícies translúcidas

| Token | Valor | Papel |
|---|---|---|
| `--surface-line` | `rgb(255 255 255 / 0.08)` | Borda de card, casca de tabela, faixa de cabeçalho |
| `--surface-line-strong` | `rgb(255 255 255 / 0.16)` | Marcação de limiar dentro de barra |
| `--surface-hover` | `rgb(255 255 255 / 0.03)` | Hover de linha de tabela |
| `--surface-raise` | `rgb(255 255 255 / 0.025)` | Faixa de cabeçalho de tabela |

São os valores literais do escopo (`white/[0.08]`, `white/[0.03]`) promovidos a token.
Expostos como utilitário Tailwind: `border-surface-line`, `bg-surface-hover`,
`bg-surface-raise`.

**Por que translúcido em vez de opaco**: compõe certo sobre *qualquer* fundo — card,
popover, sidebar, faixa de cabeçalho — que é exatamente o que um valor opaco não faz.
`--border` (opaco) continua existindo para o default do `*` e para arestas de campo,
onde a linha precisa ser um valor fechado.

#### Séries de dados

| Token | OKLCH | Hue |
|---|---|---|
| `--chart-1` | `oklch(0.685 0.148 237)` | ciano (= primary) |
| `--chart-2` | `oklch(0.696 0.149 163)` | esmeralda (= success) |
| `--chart-3` | `oklch(0.769 0.165 70)` | âmbar (= warning) |
| `--chart-4` | `oklch(0.637 0.208 25)` | carmim (= destructive) |
| `--chart-5` | `oklch(0.72 0.15 310)` | magenta |

As quatro primeiras são as semânticas do sistema — um gráfico de "online vs. alerta vs.
offline" pinta com as mesmas cores que a tabela ao lado, sem legenda de tradução. A
quinta ocupa o único buraco grande que sobra na roda (237 → 25 são 148°; o meio é ~310).
**Magenta aqui é hue de dado, nunca de chrome**: nenhum botão, borda, estado ou
superfície do app usa 310. Todas as cinco passam de 5:1 sobre o card.

### 2.3 `--accent` não é cor de marca

No vocabulário shadcn, `--accent` é a **superfície de hover** (`hover:bg-accent`,
`data-[state=open]:bg-accent`, range do calendário), não um acento cromático. Antes deste
overhaul ela carregava ciano saturado, e por isso todo hover de linha e de botão fantasma
brigava com badge e barra colorida na mesma linha — o comentário antigo em
`lib/table-styles.ts` documentava exatamente esse sintoma.

Agora `--accent` é um degrau de elevação com um leve puxão pro ciano
(`oklch(0.255 0.035 240)`). A cor de marca vive em `--primary` e `--info`.

---

## 3. Tipografia

Duas famílias, ambas já carregadas via `next/font/google` em `app/layout.tsx`:

- **Inter** (`--font-sans`) — interface inteira: título, rótulo, botão, corpo.
- **JetBrains Mono** (`--font-mono`) — **dado técnico**.

Uma família de UI basta para produto; par display/corpo é vocabulário de superfície de
marca, não de painel. Base do corpo: `0.9375rem / 1.5` — um degrau acima da densidade de
site de conteúdo, que é o que um painel de dados pede.

### 3.1 Quando é monoespaçado

`.data-mono` (utilitário do sistema) = `font-family: var(--font-mono)` +
`letter-spacing: -0.02em` + `tabular-nums` + ligadura desligada.

Aplica-se a **dado técnico**: IP, hostname, MAC, serial, porta, gateway, subnet, versão,
id, modelo de CPU, chave. Não se aplica a rótulo, título, mensagem, nome de pessoa nem
descrição — monoespaçado como fantasia de "isso é técnico" é ruído.

- `tracking-tight` (−0.02em) porque JetBrains Mono ao lado de Inter, sem isso, parece
  espaçada demais na mesma linha.
- `tabular-nums` para a coluna não "dançar" entre linhas.
- Ligadura desligada porque `->` num hostname não é uma seta.

Em tabela, entra pelo token `TABLE_DATA_CELL_CLASS` (`lib/table-styles.ts`), não pela
string solta.

### 3.2 Rótulo de bloco

`.section-label` = `11px / 700 / uppercase / letter-spacing 0.1em / --muted-foreground`.

Uma regra só para **três** coisas, porque no sistema elas são a mesma: título de seção,
cabeçalho de coluna de tabela (`TABLE_HEAD_CLASS`) e rótulo de card de KPI. Todas
respondem "o que é o bloco abaixo/ao lado disto".

### 3.3 Números

Valor de KPI: `font-bold tabular-nums tracking-tight`, `text-2xl` (`text-4xl` no card
`featured`). Toda tabela e célula já herda `tabular-nums` da regra base em
`globals.css`.

---

## 4. Superfície e elevação

**Elevação é declarada UMA vez.** Ou borda, ou sombra — nunca borda fina de 1px sob
sombra larga, que é o "card fantasma".

No sistema, a escolha é a **borda**:

| Superfície | Em repouso |
|---|---|
| Card (`components/ui/card.tsx`) | `bg-card border border-surface-line rounded-xl` — sem sombra |
| Card de KPI (`SummaryCard`, `StatCard`) | idem, `p-4`, `rounded-xl` |
| Casca de tabela (`TABLE_SHELL_CLASS`) | `rounded-xl border border-surface-line bg-card` |
| Pílula de status | borda tingida no tom, `bg-<tom>/10` — sem sombra |

A sombra só existe como **feedback de hover** (§5), e quando existe carrega offset e
blur reais antes do halo colorido. Halo colorido de offset zero sozinho é decoração, não
profundidade.

Raio: cards e cascas em `rounded-xl` (12px). Pílula (`rounded-full`) é para controle
pequeno.

### 4.1 Onde `backdrop-blur` é permitido

**Só em superfície que se sobrepõe a conteúdo.** Blur num card opaco sobre fundo chapado
não desfoca nada e só custa GPU.

Implementado uma vez em `globals.css`, por `data-slot`, sem tocar componente:

```
popover-content · dropdown-menu-content · dropdown-menu-sub-content ·
context-menu-content · select-content · dialog-content · alert-dialog-content ·
sheet-content · drawer-content · .glass-surface
```

Receita: `background-color: color-mix(in oklab, var(--popover) 84%, transparent)` +
`backdrop-filter: blur(14px) saturate(140%)` + `border-color: var(--surface-line)`. Os
overlays de fundo (`*-overlay`) levam `blur(3px)`.

Esse bloco fica **fora de `@layer`** de propósito: precisa vencer o `bg-popover` que os
componentes shadcn já aplicam como utilitário.

**Proibido**: blur em card de KPI, card de tabela, linha, badge, sidebar não flutuante.

---

## 5. Estados de interação

Todo componente interativo tem: default, hover, focus-visible, active/pressed, disabled.
Não envie metade.

### 5.1 `.surface-interactive` — card de KPI e tile clicável

```css
transition: color, background-color, border-color, box-shadow, transform
            200ms cubic-bezier(0.16, 1, 0.3, 1);   /* ease-out exponencial */

:hover {
  border-color: color-mix(in oklab, var(--surface-glow) 40%, transparent);
  box-shadow: 0 10px 24px -14px rgb(0 0 0 / 0.75),          /* profundidade real */
              0 0 20px -4px color-mix(in oklab,
                            var(--surface-glow) 30%, transparent);  /* halo */
  transform: translateY(-2px);
}
```

- `--surface-glow` é definido pelo componente **apontando para um token**
  (`[--surface-glow:var(--color-warning)]`). É assim que o card crítico brilha vermelho e
  o card de saúde brilha verde sem um único `rgba()` no componente.
- `translateY(-2px)` em vez de `scale()`: escala reamostra o texto do card (o número fica
  meio pixel borrado durante a transição), translação não.
- A sombra tem offset e blur; o halo ciano/tom é acento **por cima** da profundidade,
  nunca a profundidade inteira.

### 5.2 Foco

`--ring` = `--primary`. Anel de foco visível em todo controle
(`focus-visible:ring-2 ring-ring`), e `outline-ring/50` no default global. Card clicável
também escurece/tinge a borda no `:focus-visible`.

### 5.3 Linha de tabela

| Token | Comportamento |
|---|---|
| `STATIC_ROW_HOVER_CLASS` | `hover:bg-surface-hover` (white 3%). Sem cursor-pointer. |
| `CLICKABLE_ROW_CLASS` | o mesmo lavado **mais** `.row-interactive`: gradiente curto em `--primary` a 12% partindo da borda esquerda, apagando em 45%. Com `cursor-pointer`. |

O gradiente é o que diz, sem legenda, que a linha inteira é alvo de navegação — e não
apenas uma linha com um link dentro.

---

## 6. Movimento

**Movimento comunica estado. Nunca decora.**

- 150–250 ms na maioria das transições. O usuário está em fluxo; ninguém quer esperar
  coreografia para ver uma tabela.
- Ease-out exponencial a partir de um estado já visível. Nada de sequência de entrada de
  página.
- **`animate-ping` nunca entra em linha de tabela.** Uma listagem de 142 máquinas
  renderizaria 142 animações simultâneas — custo de render real e ruído visual numa
  tabela densa. O ponto de status em linha é **estático** (`.status-dot`: círculo de 7px
  com halo de 3px em `currentColor`, via `box-shadow`, sem segundo elemento animado). Ping
  animado fica reservado a indicador **único por tela**.
- **`prefers-reduced-motion: reduce` desliga tudo**, globalmente
  (`animation-duration`/`transition-duration` → 0.01ms, `scroll-behavior: auto`) e
  explicitamente o `translateY` do hover. A **cor** de estado permanece: quem pediu menos
  movimento não pediu menos informação.

---

## 7. Componentes de dado

### 7.1 Pílula de status (`components/ui/status-pill.tsx`)

Forma: `rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide`,
ponto de estado à esquerda, sem sombra.

**O componente unifica a FORMA, não o VOCABULÁRIO.** Duas medidas diferentes e não
intercambiáveis convivem no produto:

- **Presença** (`online | ausente | offline`) — de `getDevicePresence`, derivada da última
  coleta, **nunca** do `Device.status` bruto (**RN010**). Usada em `/storage` e no
  dashboard.
- **Status efetivo** (`online | warning | offline`) — de `getEffectiveDeviceStatus`,
  presença combinada com alertas de disco/RAM. Usado em `/computers` e `/servers`.

"ausente" **não** é "warning". Cada chamador traduz o **seu** enum para (tom, rótulo) e
passa o resultado. Consequência deliberada: o tom `neutral` existe só para o "offline" de
*presença* (ausência de sinal), enquanto o "offline" de *status efetivo* é `destructive`
(falha ativa) — a mesma palavra com dois pesos, porque são duas medidas.

Tons: `success` · `warning` · `destructive` · `neutral`.

### 7.2 Barra de uso de disco

O gradiente é de **escala**, não de estado.

`.disk-usage-scale` pinta a faixa **inteira** 0–100% com Emerald → Amber → Crimson,
trocando de cor exatamente sobre os limiares, e a barra é um **recorte** dessa escala no
percentual do disco (`clipPath: inset(0 <100−pct>% 0 0)`, não `width`).

Efeito: **a cor numa posição significa sempre a mesma coisa**, entre discos e entre
linhas. É um medidor, não um badge esticado. Um disco a 30% mostra só verde; a 90% mostra
a escala inteira até o vermelho, e a aresta de leitura fica no vermelho.

Duas marcações verticais (`.disk-usage-mark`, 1px em `--surface-line-strong`) ficam em
**60%** e **80%** — lidas de `DISK_USAGE_THRESHOLDS` em `lib/disk-usage.ts`, a **mesma
fonte de verdade** de `getDiskUsageTier`. Marca e cor não podem divergir do tier
calculado porque saem do mesmo número. Branco translúcido porque a marca precisa aparecer
tanto sobre o trilho escuro quanto sobre a parte preenchida saturada.

O `tier` continua governando a cor do **número** ao lado
(`DISK_USAGE_TIER_TEXT_CLASS`) e o filtro por faixa dos cards de KPI.

A barra leva `role="img"` + `aria-label` com unidade e percentual — cor sozinha nunca é o
único canal.

### 7.3 Tabela de listagem (`lib/table-styles.ts`)

| Token | Valor |
|---|---|
| `TABLE_SHELL_CLASS` | `rounded-xl border border-surface-line bg-card` (o chamador adiciona seu `overflow-*`) |
| `TABLE_HEAD_ROW_CLASS` | `border-b border-surface-line bg-surface-raise text-muted-foreground` — no `<tr>` do `<thead>`, **não** em cada `<th>` |
| `TABLE_HEAD_CLASS` | `section-label px-5 py-3.5 text-left` |
| `TABLE_CELL_CLASS` | `px-5 py-4 align-top` |
| `TABLE_DATA_CELL_CLASS` | `px-5 py-4 align-top data-mono` |

Fundo e borda inferior são propriedades da **faixa** de cabeçalho, não da célula:
repetir background por célula é redundante e deixa emenda visível entre células
adjacentes. `align-top` porque várias colunas têm conteúdo de duas linhas.

**Exceção deliberada**: `components/device-detail-tabs.tsx` **não** usa estes tokens e
continua com `px-4 py-2`. São sub-tabelas densas aninhadas dentro das abas de detalhe de
um dispositivo (softwares instalados, discos, interfaces), com dezenas de linhas dentro
de um painel; subir para `py-4` incharia a aba inteira. Escopo diferente, densidade
diferente, de propósito.

---

## 8. Superfícies do navegador

As partes que ninguém desenha ainda carregam o design. Tematizadas em `globals.css` a
partir dos mesmos tokens:

- `::selection` — `--primary` a 32%, texto em `--foreground`.
- `caret-color` e `accent-color` — `--primary` (o `accent-color` cobre checkbox/radio
  nativos).
- Scrollbar — 10px, trilho transparente, polegar `--border` com borda de 2px transparente
  e `background-clip: padding-box` (dá o efeito de folga), `--muted-foreground` no hover.
  `scrollbar-color` para Firefox.
- Autofill do Chrome — texto forçado para `--foreground`, fundo neutralizado.

---

## 9. Acessibilidade — piso, não aspiração

- **Texto de interface ≥ 4.5:1.** Toda combinação da §2.2 foi medida, não estimada. O
  mínimo do sistema é `--destructive` sobre card (5.0:1).
- Cor nunca é o único canal: status tem rótulo textual além do tom; barra de disco tem
  `aria-label` com o percentual; card de KPI ativo tem `aria-pressed`.
- Foco visível em todo controle. Nunca `outline: none` sem substituto.
- `prefers-reduced-motion` respeitado globalmente (§6).
- O ponto de status leva `aria-hidden` — o rótulo ao lado já é o texto acessível.

---

## 10. Proibido

- **Hex, `rgb()` ou `oklch()` literal em componente.** Só `app/globals.css`.
- **`animate-ping` (ou qualquer animação contínua) em linha de listagem.**
- **`backdrop-blur` fora de superfície flutuante.**
- **Borda colorida de mais de 1px num lado só** de card, item de lista ou alerta. É o
  adesivo que se cola num card genérico para ele parecer categorizado. A borda de 1px
  reagindo no perímetro inteiro diz a mesma coisa e ainda serve de estado de hover.
  **Exceção única: o indicador de rota ativa da sidebar** (Fase 2). Ali a barra vertical
  não categoriza nada — ela responde "onde eu estou", que é a única pergunta que a
  navegação existe para responder, e é convenção estabelecida de menu lateral. Repare
  que ela é implementada como `<span>` posicionado, **não** como `border-l-2`: borda
  real somaria 2px à caixa do item e faria o texto andar na horizontal ao navegar de
  uma rota para outra.
- **Borda de 1px sob sombra larga** (card fantasma). Elevação declarada uma vez.
- **`hover:scale()` em card com texto** — reamostra o número. Use `translateY`.
- **Monoespaçado como fantasia de "técnico"** em rótulo, título ou mensagem.
- **Texto em gradiente.** Ênfase vem de peso ou tamanho.
- **Emoji ou glifo Unicode no lugar de ícone.** Ícone vem de `lucide-react`, um traço só.
- **Variantes `dark:` novas** — nunca casam neste app (§1).
- **Cores de série de dados (`--chart-*`) em chrome de UI**, e vice-versa: `--chart-5`
  (magenta) não pinta botão, borda nem estado.
- Modal como primeiro pensamento. Esgote inline/progressivo antes.

---

## 11. Cobertura por fase

As 4 fases do overhaul estão **concluídas**. O que cada uma passou a governar:

- **Fase 1** — tokens, tipografia, superfície/elevação, estados, movimento (este documento).
- **Fase 2** — sidebar, header, breadcrumb, paleta de comando (`Ctrl/⌘+K`).
  Fonte única de rota→nome: `lib/shell-navigation.ts`, que alimenta menu, trilha e paleta.
- **Fase 3** — rodapé de paginação (`lib/table-pagination.ts` + `components/ui/table-pagination.tsx`).
  É paginação de **apresentação**, não de escala: o Server Component continua carregando
  o conjunto inteiro. Server-side (`skip`/`take`) está no Backlog.
- **Fase 4** — dashboard: hero de conformidade, grid de KPI navegável, painéis duplos.

Ainda **não** redesenhado — herda os tokens sem tratamento próprio:

- `app/admin/clients/**` e `app/users/page.tsx` — fora de escopo por decisão explícita do
  usuário; recebem a paleta nova pelos tokens, sem edição de arquivo.
- `app/portal/**` — superfície separada (visão do cliente final).
- `components/device-detail-tabs.tsx` — sub-tabelas densas de detalhe, com densidade
  própria deliberada (ver `lib/table-styles.ts`).
