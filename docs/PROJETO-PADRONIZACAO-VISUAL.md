# Projeto: Padronização Visual, Visão Geral e Conta

Sprints 16 a 22. Documento de modelagem UX/UI — **não é especificação de implementação**.
Cada sprint tem um prompt pronto na seção 9, para ser despachado um de cada vez.

Precede: `DESIGN.md` (sistema visual, Fase 1) e `docs/SPRINTS.md` (histórico).
Base de código auditada: commit `02aae3b`.

---

## 1. O pedido

> "Não achei feio o front. Mas gostaria de ter ainda mais profissional. Cards padronizados
> totalmente. Bem alinhado. Validar informações do layout, validar melhor a questão de
> relatórios e itens dispostos na aba de visão geral. Ser algo mais clean, limpo, fácil
> visualização."

E, na sequência:

> "Muda esse nome, frota n tem nada a ver. No menu de usuário, coloca as opções que sempre
> tem nesses painéis, editar, mudar email, sei lá. Faltou também a questão de mudar o tema,
> só tem o escuro."

Decisões já tomadas pelo usuário:

1. **Visão Geral em duas faixas separadas** — uma faixa superior curta de ação (só o que
   exige decisão) e, abaixo, o retrato do parque. Separadas por hierarquia, não misturadas
   na mesma grid.
2. **Cards = família fechada de 3 tipos** — KPI, Painel e Hero. Regra rígida compartilhada.
   Nenhuma `div` solta virando card.
3. **"Relatórios" = os blocos de dado DENTRO da Visão Geral**, não a aba `/reports`.
4. **"Frota" sai do vocabulário.** Ver seção 6.
5. **Menu de usuário ganha as opções de conta** que qualquer painel tem. Ver seção 7.
6. **Tema alternável.** Ver seção 8.

Os itens 1 a 4 são refinamento: a identidade visual da Fase 1 (paleta OKLCH, tokens,
superfícies) permanece, muda geometria e arranjo. Os itens 5 e 6 são **funcionalidade nova**,
não acabamento — e por isso viram sprints próprias, com trabalho de backend.

---

## 2. Diagnóstico visual

Auditoria estática de classes Tailwind, linha a linha, sobre 18 superfícies-card.
Os achados que sustentam sprints inteiras foram reverificados manualmente.

### 2.1 Existem dois componentes de KPI com anatomia oposta

|  | `StatCard` (`components/stat-cards.tsx`) | `SummaryCard` (`components/ui/summary-card.tsx`) |
|---|---|---|
| Onde | Visão Geral, /audit, /reports | /computers, /servers, /assets, /storage, /processors |
| Ícone | à **direita**, chip 40px (48px no `featured`) | à **esquerda**, chip 32px |
| Borda | tingida pela variante (`border-primary/25`) | sempre `border-surface-line` |
| Subtítulo | sim | **não existe** |
| Tom de falha | chamado `danger` | chamado `destructive` |
| Alinhamento | por `justify-between` (defeituoso, ver 2.2) | por ordem natural (correto) |

O mesmo conceito de severidade tem **dois nomes**, e a fileira de KPI **inverte a leitura**
ao navegar de /computers para a Visão Geral. Esta é a causa raiz de "cards não padronizados".

### 2.2 O alinhamento por `justify-between` não resolve o caso que importa

`stat-cards.tsx` documenta que `h-full flex flex-col justify-between` mantém os números na
mesma altura. Isso é verdade para o **título**, ancorado no topo. É **falso para o
subtítulo**: valor e subtítulo vivem no mesmo bloco ancorado na base, então cada linha extra
de subtítulo empurra o número para cima.

Na Visão Geral os subtítulos têm comprimentos muito desiguais na mesma fileira:

| Card | Subtítulo | Linhas em coluna de ~200px |
|---|---|---|
| Online agora | "94% de disponibilidade" | 1 |
| Em atenção | "Disco abaixo de 10 GB livres ou RAM abaixo do limiar" | 2 a 3 |
| Sem coleta recente | "Sem contato há 24h ou mais" | 1 a 2 |

É exatamente o desalinhamento que o usuário enxerga.

### 2.3 A Visão Geral é a única tela sem `<h1>`

O código justifica a ausência com "o título fica no cabeçalho fixo". **Não fica.** O
`<header>` do shell renderiza apenas breadcrumbs, paleta de comando, seletor de cliente e
menu de perfil. Nenhum título de página.

As outras **11 telas do tenant** têm `<h1 class="text-2xl font-bold text-foreground">`.
A tela principal é a única que começa direto no hero de 36px.

### 2.4 A tela repete o mesmo número até três vezes

| Dado | Aparece como | E também como | E ainda como |
|---|---|---|---|
| `summary.online` | card de KPI | fatia do gráfico Status | — |
| `summary.warning` | card de KPI | fatia do gráfico Status | — |
| `summary.offline` | card de KPI | fatia do gráfico Status | base do painel crítico |
| disco crítico | card de KPI (pior disco > 80%) | painel crítico (livre < limiar GB) | gráfico de uso |

O gráfico de Status é um donut de 3 fatias mostrando os mesmos três números que já estão
acima, maiores e clicáveis. E "disco crítico" é contado por **dois critérios diferentes** na
mesma tela, o que produz dois números para a mesma pergunta.

### 2.5 Inventário numérico da divergência

Sobre 18 superfícies-card auditadas:

| Propriedade | Valores distintos em uso |
|---|---|
| Raio | 2 — 8px e 12px |
| Padding de card | 3 — 16px, 20px, 24px |
| Família de borda | 3 — `border-surface-line`, `border-border`, `border` sem token |
| Chip de ícone | 3 — 32px, 40px, 48px |
| Escala de valor | 5 — 14, 18, 24, 30, 36px |
| Escala de título de bloco | 3 — 14, 16, 18px |
| Regra de grid de KPI | 4 comportamentos diferentes na faixa 1024–1279px |

### 2.6 Defeitos pontuais confirmados

- **`servers/page.tsx`** — `div` vazio contendo só um comentário, dentro de `space-y-6`.
  Injeta 48px entre cabeçalho e tabela, contra 24px nas telas irmãs.
- **`reports/page.tsx`** — o card "Taxa de disponibilidade" recebe `surface-interactive`
  (levanta 2px e ganha halo no hover) mas **não tem destino**. Card que se move e não clica,
  ao lado de três que clicam.
- **Esqueletos de carregamento** de /storage, /processors e /reports têm forma diferente da
  página real. A tela pula ao carregar, que é justamente o que o comentário no topo desses
  arquivos diz querer evitar.
- **`StatsGrid`** é código morto: exportado, zero consumidores fora de testes. Duplica —
  divergindo — a fileira da Visão Geral.

---

## 3. A régua única de superfície

Não é padrão novo. É a régua que **`lib/table-styles.ts` já venceu** e que as demais
superfícies não seguiram:

```
TABLE_SHELL_CLASS = 'rounded-xl border border-surface-line bg-card'
TABLE_CELL_CLASS  = 'px-5 py-4 align-top'
```

Toda superfície-card passa a obedecer:

| Propriedade | Valor | De onde vem |
|---|---|---|
| Raio | `rounded-xl` (12px) | `TABLE_SHELL_CLASS`, `DESIGN.md` |
| Borda | `border border-surface-line` | `TABLE_SHELL_CLASS` |
| Fundo | `bg-card` | incumbente |
| **Recuo horizontal** | **20px (`px-5`)** | `TABLE_CELL_CLASS` |
| Elevação | borda em repouso, sombra só no hover | `DESIGN.md` |
| Rótulo de bloco | `.section-label` — 11px / 700 / 0.1em | `globals.css` |
| Título de painel | `text-base font-semibold` (16px) | maioria já usa |
| Valor de KPI | `text-2xl font-bold tabular-nums` (24px) | `DESIGN.md` |
| Valor de hero | `text-4xl` (36px) — **exclusivo do hero** | — |

O recuo de 20px é o que faz a tela virar uma peça só: hoje o hero começa o texto a 24px da
borda e os painéis logo abaixo a 20px, na mesma largura, um em cima do outro.

---

## 4. A família fechada de 3 tipos

### Tipo 1 — `KpiCard`

Substitui `StatCard` **e** `SummaryCard`. Um número, um rótulo, um contexto opcional.

Anatomia — três faixas, ancoragem **superior**:

```
+-- px-5 py-4 -----------------------+
| [chip 32px]  ROTULO EM CAIXA ALTA  |   faixa 1 -- altura FIXA, 1 linha
|                                    |
| 142                                |   faixa 2 -- valor, text-2xl
| 94% de disponibilidade             |   faixa 3 -- subtitulo, cresce p/ baixo
+------------------------------------+
```

**A regra de alinhamento é a mudança central deste projeto:**

> O número alinha por **ancoragem superior com rótulo de altura fixa** (uma linha,
> `line-clamp-1`), nunca por `justify-between`.

Consequência: o valor fica sempre no mesmo deslocamento vertical a partir do topo do card,
qualquer que seja o comprimento do rótulo ou do subtítulo. O subtítulo, que é imprevisível,
cresce para baixo e **não desloca mais o número**. `h-full` continua igualando a altura da
fileira, mas o alinhamento dos números não depende mais disso.

Adota-se a anatomia do `SummaryCard` (ícone à esquerda) porque é a usada em 5 telas contra 3,
e é a que já não tem o defeito.

Contrato:

- Tons: `neutral | primary | info | success | warning | destructive` — **um** vocabulário.
  `danger` deixa de existir.
- O chip de ícone tem tamanho fixo **dentro** do componente. O chamador passa o nó do ícone,
  nunca a classe de tamanho. Isso encerra a divergência de 32/40/48px na origem.
- **Sem `featured`.** Uma fileira de KPI não tem card maior que os outros. Destaque é papel
  do Hero.
- **Sem `trend`.** A prop existe, ninguém usa, e `DESIGN.md` proíbe micro-tendência
  fabricada — não há série temporal agregada nesta base.
- `surface-interactive` só quando o card é de fato clicável. Card que levanta no hover e não
  navega é uma promessa falsa.

### Tipo 2 — `Panel`

Todo bloco com cabeçalho e conteúdo: gráficos, painel de críticos, atividade recente,
tabelas embutidas, blocos de relatório.

```
+-- rounded-xl border-surface-line bg-card --+
| px-5 pt-5 pb-4                             |  cabecalho
|   Titulo   text-base font-semibold         |
|   Descricao   text-sm muted                |
+--------------------------------------------+
| px-5 pb-5   (ou p-0 quando e tabela)       |  corpo
+-- border-t border-surface-line ------------+
| px-5 py-3                                  |  rodape opcional
+--------------------------------------------+
```

**Regra dura: um Painel não contém outro card.** Borda dentro de borda é elevação declarada
duas vezes. Listas dentro de painel usam linhas com `divide-y`, não cartõezinhos.

### Tipo 3 — `Hero`

**No máximo um por tela.** É o único lugar do sistema onde `text-4xl` é permitido — é isso
que faz dele um hero.

- Mesma casca e mesmo recuo de 20px dos painéis, para alinhar a margem esquerda do texto.
- Estados sem dado renderizam na **mesma escala** do número. Hoje "Sem dado" cai para 30px
  enquanto um percentual usa 36px, e a diferença sobe o medidor daquela coluna,
  desalinhando as três barras da faixa.
- Todas as colunas terminam na mesma altura, mesmo quando uma não tem nota de rodapé.

### Regra de grid

> Fileira de KPI tem **3 ou 4 cards. Nunca 5.**

Cinco cards em grid de 4 colunas sempre deixam um órfão sozinho ocupando 1/4 da largura.
Padrão único: 4 cards → `md:grid-cols-2 lg:grid-cols-4`; 3 cards → `md:grid-cols-3`.
`gap-4` entre cards de KPI, `gap-6` entre painéis. Sem exceção por tela.

---

## 5. Visão Geral: o modelo de duas faixas

```
================================================================
  h1  Visao geral
      Monitoramento dos ativos de TI da empresa <Nome>.
=== FAIXA 1 - ACAO =============================================

   [Em atencao]   [Sem coleta recente]   [Disco critico]

   +-- Dispositivos em alerta critico -------------------+
   |   lista + rodape "ver todos"                        |
   +-----------------------------------------------------+

=== separador ==================================================
   RETRATO DO PARQUE                        (section-label)

   +-- Hero de conformidade -----------------------------+
   |   Antivirus  ·  BitLocker  ·  Firewall              |
   +-----------------------------------------------------+

   [Maquinas monitoradas]   [Online agora]

   [Distribuicao por SO]  [RAM]  [Uso de disco]

   +-- Atividade recente ---+  +-- Ultimas coletas ------+
   +------------------------+  +-------------------------+
================================================================
```

**Por que os 5 KPIs se dividem 3 + 2:** os três da faixa de ação são os que exigem decisão
(atenção, sem coleta, disco crítico). Os dois da faixa de retrato são contexto
(total monitorado, online agora). A divisão resolve o órfão do grid de 5
**estruturalmente**, sem inventar um sexto card só para fechar a linha.

**Remoções propostas** — cada uma precisa de OK explícito, nenhuma é obrigatória:

| O quê | Por quê |
|---|---|
| Gráfico de Status (donut Online/Offline/Warning) | Repete exatamente os três números dos KPIs, que já estão maiores e clicáveis na mesma tela |
| `StatsGrid` em `stat-cards.tsx` | Código morto sem consumidor, pronto para reintroduzir divergência |
| Um dos dois critérios de "disco crítico" | Dois números para a mesma pergunta na mesma tela. Ou unifica o critério, ou rotula cada um explicitamente |

**Um único pico tipográfico.** Hoje `text-4xl` aparece quatro vezes na primeira dobra: três
no hero e uma no card `featured`. Não existe "número principal" — existem quatro empatados.
Com `featured` removido, o hero passa a ser o único pico.

---

## 6. "Frota" sai do vocabulário

O usuário está certo: frota é vocabulário de veículos. Aqui se fala de **parque de máquinas**
ou **parque de TI**, que é o termo corrente em gestão de ativos no Brasil.

O termo está espalhado em texto de interface **e** em identificadores de código:

| Hoje | Passa a ser |
|---|---|
| "conformidade da frota", "agregados de frota" (texto) | "conformidade do parque", "agregados do parque" |
| `components/fleet-security-hero.tsx` | `components/inventory-security-hero.tsx` |
| `FleetSecurityHero` | `InventorySecurityHero` |
| `buildFleetSecurityIndicators` | `buildSecurityIndicators` |
| `FleetSecurityIndicator`, `FleetComplianceTone` | `SecurityIndicator`, `ComplianceTone` |
| `FLEET_COMPLIANCE_TONE_THRESHOLDS` | `COMPLIANCE_TONE_THRESHOLDS` |
| `lib/dashboard/fleet-overview.ts` | `lib/dashboard/inventory-overview.ts` |

`inventory` em vez de `fleet` nos identificadores mantém o código alinhado ao nome do próprio
produto. Nos textos em português, **parque**.

Renomeação mecânica, sem mudança de comportamento. Entra na Sprint 18, junto com a
reestruturação da tela onde o termo mais aparece.

---

## 7. Menu de usuário: o que falta

Estado atual do `ProfileMenu` no cabeçalho: nome, papel e **"Sair da conta"**. Só isso.

**Não existe nenhuma tela de perfil ou conta no sistema.** Não há rota de troca de senha,
nem de alteração de e-mail, nem de edição de nome. O que existe é `/api/auth/signup`, que
cria usuário, e nada mais.

Ou seja: isto **não é acabamento de menu**. É funcionalidade nova com trabalho de backend —
validação Zod, guardas de sessão, hash de senha, registro em `AuditLog` (RNF009) e
reemissão do token JWT quando o e-mail muda. Por isso é uma sprint própria.

Escopo proposto para o menu:

| Item | O que faz | Peso |
|---|---|---|
| **Meu perfil** | Diálogo ou tela: editar nome de exibição | leve |
| **Alterar e-mail** | Exige senha atual. Muda o identificador de login, então precisa reemitir a sessão | **pesado** |
| **Alterar senha** | Senha atual + nova + confirmação. Invalida sessões? Decisão do usuário | médio |
| **Aparência** | Tema claro / escuro / sistema. Depende da Sprint 22 | — |
| **Preferências do tenant** | Atalho para `/settings`, que já existe | trivial |
| Sair da conta | Já existe | — |

Ponto de atenção de segurança, a ser resolvido no plano da sprint: e-mail é o identificador
de login. Trocá-lo sem confirmação por e-mail permite que uma sessão sequestrada mude o
dono da conta. As opções são exigir senha atual (mínimo), ou implementar confirmação por
e-mail (correto, mas exige infraestrutura de envio que o projeto não tem).

---

## 8. Tema: hoje não existe segundo estado

Estado atual, verificado:

- `next-themes` está instalado e `components/theme-provider.tsx` existe — mas **nunca é
  montado na árvore da aplicação**. O único consumidor de `useTheme` é o componente de
  notificações.
- Em `app/globals.css`, `:root` e `.dark` têm **os mesmos valores**, com o comentário
  explicando que isso é proposital porque o app é dark-only. `color-scheme: dark` está fixo.

Portanto não há tema claro para alternar. Colocar um seletor hoje seria um botão com um
estado só.

O trabalho real é:

1. Autorar a **paleta clara completa** — todos os tokens OKLCH de `globals.css`, não só
   inverter fundo e texto. São superfícies, bordas, tons semânticos (success, warning,
   destructive, info), estados de hover e o halo de `surface-interactive`.
2. Verificar **contraste WCAG AA** no lado claro. No escuro isso já foi feito e o token mais
   apertado ficou em 5.00:1, acima do piso de 4.5. A paleta clara precisa do mesmo exame,
   e é onde `muted-foreground` costuma falhar.
3. Tornar `color-scheme` dinâmico, senão os controles nativos (select, date picker, barra de
   rolagem) continuam escuros num tema claro.
4. Montar o `ThemeProvider`, persistir a escolha e **evitar o flash** de tema errado na
   primeira pintura.
5. Revisar os gráficos Recharts, que hoje recebem cor por classe e por `contentStyle`
   inline, e o esqueleto de carregamento.

Recomendação: fazer por último, depois que a família de cards estiver fechada. Trocar tema
com dois componentes de KPI divergentes significa acertar a paleta duas vezes.

---

## 9. As sete sprints

| # | Nome | Entrega | Depende de |
|---|---|---|---|
| 16 | Família fechada de cards | `KpiCard`, `Panel`, `Hero` unificados; `StatCard`/`SummaryCard`/`StatsGrid` extintos | — |
| 17 | Alinhamento, grid e cabeçalho | Régua de 20px, regra de grid, `h1` na Visão Geral, esqueletos com a forma real | 16 |
| 18 | Visão Geral em duas faixas | Reestruturação da tela principal + fim do termo "frota" | 16, 17 |
| 19 | Blocos de dado da Visão Geral | Gráficos e painéis: altura estável, redundância resolvida | 18 |
| 20 | Telas remanescentes | /reports, /alerts, /settings, /audit sob a régua | 16, 17 |
| 21 | Conta e menu de usuário | Perfil, e-mail, senha — com backend, guardas e auditoria | 16 |
| 22 | Tema claro | Paleta clara completa, contraste verificado, seletor no menu | 16, 21 |

**Fora de escopo em todas as sprints, sem exceção:**
`app/admin/clients/**` e `app/users/page.tsx`.
`app/portal/**` e `components/device-detail-tabs.tsx` seguem não-redesenhados (`DESIGN.md`).

---

## 10. Prompts

Um por sprint. Despachar em ordem — cada um assume o anterior concluído e commitado.

---

### PROMPT — SPRINT 16 · Família fechada de cards

```
SPRINT 16 — SISTEMA DE CARDS: A FAMILIA FECHADA DE TRES TIPOS

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md, secoes 3 e 4. Leia antes de planejar.

OBJETIVO
Encerrar a existencia de dois componentes de KPI com anatomia oposta e estabelecer
uma familia fechada de tres tipos de superficie-card.

ENTREGAS

1. components/ui/kpi-card.tsx — novo, substitui StatCard E SummaryCard.
   - Anatomia de tres faixas com ANCORAGEM SUPERIOR: chip de icone 32px a esquerda +
     rotulo .section-label em line-clamp-1 (altura fixa de 1 linha); valor
     text-2xl font-bold tabular-nums; subtitulo text-xs opcional que cresce para baixo.
   - O numero DEVE ficar no mesmo deslocamento vertical a partir do topo,
     independentemente do comprimento do rotulo ou do subtitulo. Nao use
     justify-between para alinhar: essa e exatamente a tecnica defeituosa que estamos
     removendo (secao 2.2 do projeto).
   - Casca: 'rounded-xl border border-surface-line bg-card px-5 py-4'.
   - Tons: neutral | primary | info | success | warning | destructive.
     O nome 'danger' deixa de existir no sistema.
   - O tamanho do chip e do icone e fixo DENTRO do componente. O chamador passa o
     no do icone, nunca a classe de tamanho.
   - Sem prop 'featured'. Sem prop 'trend'.
   - surface-interactive e cursor-pointer SOMENTE quando href ou onClick existirem.
   - Suporta href (Link), onClick (button com aria-pressed), active, testId.

2. components/ui/panel.tsx — novo. Panel, PanelHeader, PanelBody, PanelFooter.
   - Casca 'rounded-xl border border-surface-line bg-card'.
   - Cabecalho px-5 pt-5 pb-4, titulo text-base font-semibold, descricao text-sm muted.
   - Corpo px-5 pb-5, com variante sem padding para tabelas.
   - Rodape px-5 py-3 com border-t border-surface-line.

3. Migrar TODOS os consumidores atuais:
   - StatCard: app/app/[clientSlug]/page.tsx, audit/page.tsx, reports/page.tsx
   - SummaryCard: tenant-computers-table.tsx, tenant-storage-table.tsx,
     tenant-processors-table.tsx
   - Paineis: fleet-security-hero.tsx, critical-devices-panel.tsx,
     recent-activity-panel.tsx, dashboard-charts.tsx, e o card "Ultimas atualizacoes"
     em page.tsx.
   Preserve rotulos, numeros, destinos, tons e comportamento de filtro EXATAMENTE como
   estao. Esta sprint nao muda dado nem navegacao — so a casca.

4. Deletar components/stat-cards.tsx por completo (StatCard, StatsGrid, formatPercent).
   StatsGrid e codigo morto: so tests/stat-cards.test.tsx o consome. Reescreva ou
   remova esse teste conforme o que sobreviver.
   Deletar components/ui/summary-card.tsx apos a migracao.

5. Corrigir, ao migrar, dois defeitos ja confirmados:
   - reports/page.tsx: o card "Taxa de disponibilidade" tem hover interativo sem
     destino. Ou ganha destino, ou perde o hover. Nao pode continuar prometendo clique.
   - Substituir 'border-border' e 'border' sem token por 'border-surface-line' em toda
     superficie-card migrada.

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos, nao abra.
- app/portal/** e components/device-detail-tabs.tsx — nao redesenhados nesta sprint.
- Nenhuma mudanca de layout de tela. A Visao Geral continua com a mesma ordem de blocos;
  a reestruturacao e a Sprint 18.

CRITERIOS DE ACEITE
- Zero ocorrencias de StatCard, SummaryCard ou StatsGrid no repositorio.
- Zero ocorrencias do tom 'danger'.
- Nenhuma superficie-card usa rounded-lg, border-border ou border sem token.
- Teste que prova a invariante de alinhamento: dois KpiCard na mesma fileira, um com
  rotulo curto e subtitulo de 1 linha, outro com rotulo longo e subtitulo de 3 linhas,
  tem o valor no mesmo deslocamento a partir do topo.
- Teste que prova que KpiCard sem href e sem onClick nao renderiza classe interativa.
- npx tsc --noEmit, npm run lint, npm run build e npx vitest run todos limpos.
  A suite tem 575 testes hoje; nenhum pode regredir.

Governanca: planeje com sprint-planner, implemente com implementation-agent, e registre
a entrada em docs/SPRINTS.md.
```

---

### PROMPT — SPRINT 17 · Alinhamento, grid e cabeçalho de página

```
SPRINT 17 — ALINHAMENTO, GRID E CABECALHO DE PAGINA

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md, secoes 3 e 4. Depende da Sprint 16.

OBJETIVO
Uma regua de espacamento, uma regra de grid e um cabecalho de pagina para as 12 telas
do tenant.

ENTREGAS

1. RECUO HORIZONTAL UNICO DE 20px em toda superficie-card.
   A regua nao e nova: lib/table-styles.ts ja usa px-5 nas celulas e
   'rounded-xl border border-surface-line bg-card' na casca. Estenda-a.
   Hoje o hero comeca o texto a 24px da borda e os dois paineis logo abaixo a 20px,
   na mesma largura, verticalmente adjacentes. Corrija para 20px em todos.

2. REGRA UNICA DE GRID DE KPI: uma fileira tem 3 ou 4 cards, nunca 5.
   - 4 cards: grid gap-4 md:grid-cols-2 lg:grid-cols-4
   - 3 cards: grid gap-4 md:grid-cols-3
   - gap-4 entre cards de KPI, gap-6 entre paineis. Sem excecao por tela.
   Hoje ha quatro comportamentos diferentes na faixa 1024-1279px: a Visao Geral mostra
   4+1, /computers mostra 2+2+1, /storage e /processors mostram 4 em linha.
   Onde uma tela tiver 5 cards hoje, proponha no plano qual vira 4 — e ESPERE
   aprovacao antes de remover qualquer card. Nao decida sozinho o que sai.

3. h1 NA VISAO GERAL.
   O comentario em app/app/[clientSlug]/page.tsx afirma que "o titulo fica no cabecalho
   fixo". Isso e falso: o header em components/sidebar.tsx renderiza so breadcrumbs,
   paleta, seletor de cliente e perfil. As outras 11 telas do tenant tem
   h1 text-2xl font-bold text-foreground. Adicione o h1 na Visao Geral e corrija
   o comentario mentiroso.

4. PADRAO UNICO DE CABECALHO DE PAGINA nas 12 telas:
   flex flex-wrap items-start justify-between gap-4, com h1 text-2xl font-bold e
   subtitulo herdando a escala do body. Hoje /audit usa items-center sem flex-wrap
   (o botao comprime o titulo em telas estreitas) e subtitulo text-sm, sendo a unica
   com escala menor.

5. ESQUELETOS COM A FORMA REAL.
   Os loading.tsx de /storage, /processors e /reports tem colunas, raio e padding
   diferentes da pagina real, entao a tela pula ao carregar — justamente o que o
   comentario no topo desses arquivos diz querer evitar. Alinhe cada esqueleto a
   grid, ao raio e a altura reais. O grafico do dashboard reserva 224px e o real
   tem 180px.

6. DEFEITO PONTUAL: app/app/[clientSlug]/servers/page.tsx tem um div vazio contendo so
   um comentario, dentro de space-y-6. Injeta 48px entre cabecalho e tabela contra
   24px nas telas irmas. Remova.

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos.
- Nenhuma reestruturacao de conteudo. Ordem e composicao da Visao Geral sao a Sprint 18.
- Nenhum card removido sem aprovacao explicita (ver entrega 2).

CRITERIOS DE ACEITE
- Nenhuma fileira de KPI com 5 cards.
- Todas as 12 telas do tenant com h1 e cabecalho no mesmo padrao.
- Teste que prova que a Visao Geral renderiza um h1.
- tsc, lint, build e vitest limpos, sem regressao nos 575 testes.

Governanca: sprint-planner, depois implementation-agent, com entrada em docs/SPRINTS.md.
```

---

### PROMPT — SPRINT 18 · Visão Geral em duas faixas

```
SPRINT 18 — VISAO GERAL EM DUAS FAIXAS, E O FIM DO TERMO "FROTA"

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md, secoes 5 e 6. Depende das Sprints 16 e 17.

OBJETIVO
Reorganizar app/app/[clientSlug]/page.tsx em duas faixas com hierarquia explicita:
o que exige acao hoje, e o retrato do parque. Hoje sao seis blocos empilhados em
space-y-6, com 16 superficies de dado num unico scroll e tres grids consecutivos com
proporcoes e gaps diferentes.

ESTRUTURA ALVO

  h1 "Visao geral" + subtitulo

  FAIXA 1 — ACAO
    3 KPIs: Em atencao · Sem coleta recente · Disco critico
    Painel "Dispositivos em alerta critico" em largura cheia

  separador visual + rotulo de secao "RETRATO DO PARQUE"

  FAIXA 2 — RETRATO
    Hero de conformidade (antivirus, BitLocker, firewall)
    2 KPIs: Maquinas monitoradas · Online agora
    Graficos
    Painel "Atividade recente" + painel "Ultimas coletas"

A divisao 3+2 dos cinco KPIs resolve o orfao do grid de 5 estruturalmente, sem inventar
um sexto card para fechar a linha.

RENOMEACAO: "FROTA" SAI DO VOCABULARIO
Frota e vocabulario de veiculos. Aqui se fala de PARQUE de maquinas.
  - Textos em portugues: "frota" -> "parque".
  - Identificadores de codigo passam de 'fleet' para 'inventory':
    components/fleet-security-hero.tsx -> components/inventory-security-hero.tsx
    FleetSecurityHero -> InventorySecurityHero
    buildFleetSecurityIndicators -> buildSecurityIndicators
    FleetSecurityIndicator -> SecurityIndicator
    FleetComplianceTone -> ComplianceTone
    FLEET_COMPLIANCE_TONE_THRESHOLDS -> COMPLIANCE_TONE_THRESHOLDS
    lib/dashboard/fleet-overview.ts -> lib/dashboard/inventory-overview.ts
  Renomeacao mecanica, sem mudanca de comportamento. Atualize imports e testes.
  Ao terminar, grep por 'fleet' e por 'frota' deve voltar vazio em app/, components/
  e lib/.

DECISOES QUE PRECISAM DE APROVACAO ANTES DE EXECUTAR — traga no plano, nao implemente:

  a) Remover o grafico de Status (donut Online/Offline/Warning). Ele mostra exatamente
     os tres numeros que ja estao como KPI na mesma tela, maiores e clicaveis.
  b) "Disco critico" e contado por dois criterios diferentes na mesma tela: o card de
     KPI usa pior disco acima de 80% usado, e o painel de criticos usa espaco livre
     abaixo do limiar em GB do tenant. Dois numeros para a mesma pergunta. Proponha
     unificar o criterio OU rotular cada um explicitamente, e explique o trade-off.
  c) A tabela "Ultimas atualizacoes" (10 linhas) e o painel "Atividade recente" ocupam
     o mesmo territorio semantico. Proponha o arranjo, sem remover nada por conta
     propria.

REGRAS
- Um unico pico tipografico. text-4xl e exclusivo do hero. Hoje aparece quatro vezes na
  primeira dobra: tres no hero e uma no card featured, que a Sprint 16 ja removeu.
- Nenhum numero novo, nenhuma metrica inventada, nenhuma micro-tendencia. Todo dado
  exibido continua vindo de getDeviceReportRows / buildDeviceReportSummary.
- Todo card de KPI continua navegando para a listagem que mostra EXATAMENTE a populacao
  que ele conta. O comentario que hoje esta acima da grid de KPI explica por que os
  cards de status apontam para /assets e nao /computers. Preserve esse contrato.
- Multi-tenant: nenhuma consulta nova fora de getTenantDeviceWhere(tenantSlug) ou
  tenant.id. O estado vazio (totalDevices === 0) continua curto-circuitando a tela.

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos.
- A aba /reports nao faz parte desta sprint.

CRITERIOS DE ACEITE
- grep por 'fleet' e 'frota' vazio em app/, components/ e lib/.
- Testes que provam que cada KPI aponta para a rota que lista a populacao que conta.
- Teste do estado vazio preservado.
- tsc, lint, build e vitest limpos, sem regressao.

Governanca: sprint-planner, depois implementation-agent, com entrada em docs/SPRINTS.md.
```

---

### PROMPT — SPRINT 19 · Blocos de dado da Visão Geral

```
SPRINT 19 — BLOCOS DE DADO DA VISAO GERAL

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md. Depende da Sprint 18.

OBJETIVO
Os graficos e paineis da Visao Geral com altura estavel e leitura previsivel.

ENTREGAS

1. ALTURA ESTAVEL DOS GRAFICOS.
   Em components/dashboard-charts.tsx a area do grafico e fixa em 180px, mas a legenda
   e uma lista sem limite de itens. Num parque com muitos sistemas operacionais o card
   de SO cresce e o vizinho estica com vazio no fundo. Limite a legenda com um "e mais
   N" ou de altura previsivel ao bloco.

2. HERO DE CONFORMIDADE ALINHADO.
   Em components/inventory-security-hero.tsx (renomeado na Sprint 18), o estado
   "Sem dado" renderiza em text-3xl enquanto um percentual usa text-4xl. Os 8px de
   diferenca sobem o medidor daquela coluna e as tres barras deixam de ficar na mesma
   horizontal. Iguale a escala.
   Alem disso, a nota de rodape existe para BitLocker e antivirus mas e nula para
   firewall, entao a terceira coluna termina antes e o divisor vertical mostra o vazio.
   Reserve o espaco ou remova o divisor.

3. PAINEIS SIMETRICOS.
   critical-devices-panel.tsx e recent-activity-panel.tsx ficam lado a lado mas tem
   padding de cabecalho diferente (pb-4 contra pb-3), entao os titulos ficam a
   distancias diferentes da primeira linha da lista. Unifique pela casca Panel da
   Sprint 16.

4. NENHUM CARD DENTRO DE PAINEL. Listas usam linhas com divide-y, nao cartoezinhos
   com borda propria. Borda dentro de borda e elevacao declarada duas vezes.

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos.
- Nenhuma metrica nova. Nenhuma mudanca de consulta.

CRITERIOS DE ACEITE
- Teste que prova que o hero renderiza "Sem dado" na mesma escala tipografica de um
  valor numerico.
- tsc, lint, build e vitest limpos, sem regressao.

Governanca: sprint-planner, depois implementation-agent, com entrada em docs/SPRINTS.md.
```

---

### PROMPT — SPRINT 20 · Telas remanescentes sob a régua

```
SPRINT 20 — TELAS REMANESCENTES SOB A REGUA

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md, secao 3. Depende das Sprints 16 e 17.

OBJETIVO
Fechar as telas que ainda violam a regua de superficie.

ENTREGAS

1. /reports, /alerts e /settings usam rounded-lg (8px), p-6 e h2 text-lg, contra
   rounded-xl (12px), px-5 e text-base no resto do tenant. DESIGN.md ja define
   rounded-xl como a regra; essas tres telas violam o proprio documento.
   Migre para a casca Panel da Sprint 16.

2. /reports: os quatro blocos de conteudo tem padroes de titulo diferentes entre si —
   tres usam h2 seguido direto do conteudo, um usa h2 mais paragrafo explicativo.
   E as barras de progresso usam tres cores diferentes para o mesmo elemento
   (primary no bloco de SO, destructive/primary no de disco, info no de RAM) sem regra
   semantica declarada. Unifique ou documente o criterio.

3. /reports: o bloco "Ultimas coletas" aninha cards dentro de card, e usa font-mono
   cru em vez da classe .data-mono que os demais hostnames do app usam.

4. /audit: a barra de filtro usa shadow-sm sob borda de 1px, que DESIGN.md lista
   explicitamente como proibido. E a unica superficie da esteira do tenant que ainda
   carrega isso.

5. Rotulos de card que reimplementam .section-label a mao devem passar a usar a classe.
   Ha quatro variantes aproximadas espalhadas — 10px/700/widest, 12px/medium/wide,
   12px sem caixa alta — contra a regra unica de 11px/700/0.1em em globals.css.

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos, nao abra.
- app/portal/** e components/device-detail-tabs.tsx seguem nao-redesenhados, conforme
  DESIGN.md. Se quiser inclui-los, e decisao sua e vira uma sprint separada.
- Nenhuma mudanca de dado, consulta ou navegacao.

CRITERIOS DE ACEITE
- Nenhuma superficie-card do tenant fora de rounded-xl + border-surface-line + px-5.
- Nenhum shadow-sm sob borda de 1px.
- tsc, lint, build e vitest limpos, sem regressao.

Governanca: sprint-planner, depois implementation-agent, com entrada em docs/SPRINTS.md.
```

---

### PROMPT — SPRINT 21 · Conta e menu de usuário

```
SPRINT 21 — CONTA E MENU DE USUARIO

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md, secao 7. Depende da Sprint 16.

ATENCAO: esta NAO e uma sprint de acabamento visual. Nao existe hoje nenhuma tela de
perfil ou conta no sistema, nenhuma rota de troca de senha e nenhuma de troca de e-mail.
O menu de usuario no cabecalho tem apenas nome, papel e "Sair da conta". Isto e
funcionalidade nova, com backend, guardas e auditoria.

OBJETIVO
Dar ao usuario as opcoes de conta que qualquer painel tem, sem abrir brecha de
seguranca.

ENTREGAS

1. Tela ou dialogo de conta com tres operacoes:
   a) Editar nome de exibicao.
   b) Alterar e-mail — EXIGE senha atual. E o identificador de login, entao a sessao
      precisa ser reemitida apos a troca, e o e-mail novo precisa ser unico.
   c) Alterar senha — senha atual + nova + confirmacao.

2. Server Actions ou rotas para as tres, com:
   - Validacao Zod em toda entrada.
   - Guarda de sessao: o usuario so altera A PROPRIA conta. O id vem da sessao,
     NUNCA do payload (RNF004).
   - Hash de senha pelo mesmo mecanismo que lib/auth-credentials.ts ja usa.
   - Registro em AuditLog para as tres operacoes (RNF009), com o e-mail antigo e o
     novo no metadata da troca de e-mail.

3. ProfileMenu no cabecalho ganha os itens: "Minha conta", "Alterar senha",
   "Preferencias" (atalho para /settings, que ja existe) e o separador antes de
   "Sair da conta". O item de tema entra na Sprint 22.

DECISAO QUE PRECISA DE APROVACAO — traga no plano, nao implemente:
   E-mail e o identificador de login. Troca-lo sem confirmacao por e-mail permite que
   uma sessao sequestrada mude o dono da conta. Exigir a senha atual e o minimo
   aceitavel; confirmacao por e-mail e o correto, mas o projeto nao tem infraestrutura
   de envio. Apresente as duas opcoes com o risco de cada uma e espere a decisao.

   Decida tambem, com o usuario: trocar a senha invalida as outras sessoes ativas?

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos, nao abra. A gestao de OUTROS
  usuarios ja vive la e nao faz parte desta sprint. Aqui e so a propria conta.
- Nenhuma mudanca de papel ou permissao. O usuario nao altera o proprio role.

CRITERIOS DE ACEITE
- Teste que prova que um usuario nao consegue alterar a conta de outro, mesmo forjando
  o id no payload.
- Teste que prova que a troca de e-mail sem senha correta e rejeitada.
- Teste que prova que as tres operacoes gravam AuditLog.
- Auditoria com security-auditor antes do aceite.
- tsc, lint, build e vitest limpos, sem regressao.

Governanca: rode security-auditor antes de planejar. Depois sprint-planner,
implementation-agent, e entrada em docs/SPRINTS.md.
```

---

### PROMPT — SPRINT 22 · Tema claro

```
SPRINT 22 — TEMA CLARO

Contexto: docs/PROJETO-PADRONIZACAO-VISUAL.md, secao 8. Depende das Sprints 16 e 21.

ATENCAO: hoje NAO EXISTE segundo tema. Verificado:
  - next-themes esta instalado e components/theme-provider.tsx existe, mas NUNCA e
    montado na arvore da aplicacao. O unico consumidor de useTheme e o componente de
    notificacoes.
  - Em app/globals.css, :root e .dark tem OS MESMOS VALORES, com comentario dizendo
    que isso e proposital porque o app e dark-only. color-scheme: dark e fixo.
Colocar um seletor hoje seria um botao com um estado so. O trabalho e autorar a paleta.

OBJETIVO
Tema claro completo, alternavel, sem regressao de contraste nem flash na primeira
pintura.

ENTREGAS

1. Paleta clara completa em app/globals.css: TODOS os tokens OKLCH, nao so inverter
   fundo e texto. Inclui superficies, --surface-line, --surface-hover, os tons
   semanticos (success, warning, destructive, info) e o halo de surface-interactive.

2. Verificacao de contraste WCAG AA no lado claro, com os numeros no relatorio.
   No escuro isso ja foi feito: o token mais apertado ficou em 5.00:1, acima do piso
   de 4.5. A paleta clara precisa do mesmo exame — muted-foreground sobre card e onde
   costuma falhar.

3. color-scheme dinamico. Sem isso os controles nativos (select, date picker, barra de
   rolagem) continuam escuros no tema claro.

4. Montar o ThemeProvider de verdade, persistir a escolha e EVITAR O FLASH de tema
   errado na primeira pintura.

5. Seletor no ProfileMenu: Claro / Escuro / Sistema.

6. Revisar os graficos Recharts, que hoje recebem cor por classe e por contentStyle
   inline, e os esqueletos de carregamento.

FORA DE ESCOPO
- app/admin/clients/** e app/users/page.tsx — proibidos, nao abra.
- Nenhuma mudanca de layout, dado ou navegacao. So cor e o mecanismo de tema.

CRITERIOS DE ACEITE
- Relatorio com as razoes de contraste medidas no tema claro, par a par, e nenhuma
  abaixo de 4.5:1 para texto normal.
- Nenhum valor de cor literal (hex ou rgba) fora de globals.css.
- Teste que prova que a escolha de tema persiste.
- Auditoria com designer-ui antes do aceite.
- tsc, lint, build e vitest limpos, sem regressao.

Governanca: sprint-planner, depois implementation-agent, com entrada em docs/SPRINTS.md.
```

---

## 11. O que este projeto deliberadamente NÃO faz

- **Não troca a paleta escura.** A identidade OKLCH da Fase 1 fica. O usuário disse que não
  achou feio; o problema é consistência e arranjo, não cor.
- **Não introduz biblioteca nova.** A família de cards sai de Tailwind e dos tokens que já
  existem em `app/globals.css`. O tema usa `next-themes`, que já é dependência.
- **Não inventa métrica.** Nenhum sparkline, nenhuma micro-tendência, nenhum percentual
  novo. Não existe série temporal agregada nesta base — `MetricSample` é por dispositivo.
- **Não mexe em `/admin/clients` nem em `/users`.** Restrição permanente.
- **Não faz o usuário alterar o próprio papel.** A Sprint 21 é sobre a própria conta, não
  sobre permissões.
- **Não pagina no servidor.** Continua sendo paginação de apresentação, como registrado no
  Backlog item 10.
