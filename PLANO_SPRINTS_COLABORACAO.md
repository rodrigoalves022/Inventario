# Plano de Sprints — Colaboração Gerente (Antigravity) × Executor (Claude Code)

Status: **decisões D1–D6 fechadas — pronto para executar a S0** (aprovação do escopo de cada sprint seguinte continua sendo sua)
Criado em: 2026-10-13 · Base de código: commit `f89d97f` (Sprint 16 concluída)

> Este arquivo é o **plano de trabalho da colaboração**. Ele **não substitui**
> `docs/SPRINTS.md` (registro canônico de sprints) nem `docs/PRODUTO.md`. Quando uma sprint
> daqui for aprovada, o `sprint-planner` registra a entrada oficial em `docs/SPRINTS.md`,
> com número definitivo.

---

## 1. Papéis

| Quem | Papel | Faz | Não faz |
|---|---|---|---|
| **Usuário** | Dono do produto | Aprova escopo, aprova critérios de aceite, decide commit | — |
| **Antigravity (eu)** | Gerente | Escreve os prompts, revisa relatórios e diffs, confere escopo e DoD, aponta risco | Não implementa código de produto |
| **Claude Code** | Executor | Planeja com `sprint-planner`, implementa com `implementation-agent`, roda os 4 portões | Não amplia escopo, não faz commit sem pedido |

### Ciclo de cada sprint

```
1. Gerente escreve o prompt da sprint (seção 6 deste arquivo)
2. Usuário revisa/aprova o prompt e o cola no Claude Code
3. Claude Code: auditores relevantes -> sprint-planner -> plano em docs/SPRINTS.md
4. Gerente revisa o PLANO (antes de qualquer código) e devolve ajustes
5. Usuário aprova explicitamente -> implementation-agent executa
6. Claude Code devolve relatório (4 portões + DoD + screenshots)
7. Gerente revisa com o checklist da seção 5 -> aprova ou devolve com prompt de correção
8. Usuário confirma critérios de aceite -> commit
```

> [!IMPORTANT]
> O passo 4 é onde mais se economiza: corrigir um plano custa uma mensagem, corrigir código
> pronto custa uma sprint. O `implementation-agent` só pode agir depois de aprovação
> **explícita na conversa** (`.claude/agents/implementation-agent.md`).

---

## 2. Como o agente funciona hoje (resumo verificado no código)

**Fluxo de geração (lado painel):**

1. `ORG_ADMIN`/`PLATFORM_ADMIN` abre `/admin/clients` → **Novo cliente** → `/admin/clients/novo`
   ([new-client-wizard.tsx](file:///e:/Inventario/app/admin/clients/novo/new-client-wizard.tsx)).
2. `createClientAction` ([actions.ts](file:///e:/Inventario/app/admin/clients/actions.ts)) cria `Client`,
   gera `enrollmentKey` (guarda só o **hash** em `enrollmentKeyHash`), **e também persiste a chave
   cifrada** (`persistActiveProvisioningKey`, AES-256-GCM) para poder reexibi-la.
3. [lib/provisioning.ts](file:///e:/Inventario/lib/provisioning.ts) monta 3 artefatos: URL de bootstrap,
   comando PowerShell de uma linha (`irm '<url>' | iex`) e comando `install` manual.
4. [AgentInstallPackage](file:///e:/Inventario/components/agent-install-package.tsx) mostra: botão
   **Baixar instalador para Windows** (`/api/agent/download-exe?client&key`), a chave em caixa âmbar e
   "Outras formas de instalar" recolhido.
5. Passo 3 do assistente faz polling a cada 5 s em `/api/clients/[id]/status` até o primeiro check-in.

**Lado agente (Go, `agent-go/`):** `install` → `POST /api/agent/register` (troca `enrollmentKey` por
`apiKey` única, guardada com DPAPI no Windows) → serviço com 3 ciclos (inventário 1 h, métricas ~10 min,
comandos 90 s) → auto-update só com SHA-256 conferido. Linux via systemd; macOS não suportado.

---

## 3. Achados — fluxo "Gerar agente" (a validar nas auditorias da Sprint A0)

Itens marcados **[confirmado]** foram verificados lendo o código; **[hipótese]** precisa de
auditor/Playwright. Nenhum foi corrigido ainda.

### 3.1 Funcionais e de confiança

| # | Achado | Estado | Onde |
|---|---|---|---|
| F1 | **Rotacionar chave não mostra nada.** `const [, rotateAction] = useActionState(...)` descarta o resultado; o botão "Emitir novo pacote" muda o hash da chave (invalida instaladores antigos) e não exibe o pacote novo nem o aviso "Revise os instaladores antigos". Também **não há confirmação** antes de invalidar. | [confirmado] | `clients-panel.tsx:166,385-389` · `actions.ts:265` |
| F2 | **Formulário inline morto.** `setShowCreateForm(true)` nunca é chamado (o botão virou `Link` para `/novo`). ~50 linhas de JSX inacessíveis, com o mesmo formulário do assistente, mais um campo `slug` que o assistente não tem. | [confirmado] | `clients-panel.tsx:161,275-327` |
| F3 | **Copy contraditória sobre a chave.** O assistente diz "não será exibida novamente"; o diálogo "Credenciais ativas" a reexibe "a qualquer momento". O código guarda a chave cifrada, e `docs/PRODUTO.md` §4.2 invariante 3 diz "segredos só existem em plaintext uma vez". Decisão de produto, não só de texto — ver D3. | [confirmado] | `agent-install-package.tsx:40-45` · `PRODUTO.md` |
| F4 | **Só Windows na UI.** O agente Linux é "Suportado", mas a UI só oferece `.exe`. Quem tem servidor Linux precisa descobrir o comando por fora. | [confirmado] | `agent-install-package.tsx` |
| F5 | **Nenhuma tela lista/revoga agentes de um cliente.** `revokeAgentAuthAction` existe e **não é usada por nenhum componente** em `app/`. A lista mostra só `agentCount`. | [confirmado] | `actions.ts:282` · grep em `app/` |
| F6 | **Passo 3 sem saída de erro.** O polling engole falhas (`catch` vazio) e fica "Aguardando…" para sempre; não há dica do tipo "não conectou? verifique firewall / URL do servidor / execute como Administrador". | [confirmado] | `new-client-wizard.tsx:85-87,207-217` |
| F7 | **`serverUrl` digitado à mão sem teste.** Um endereço inacessível pela rede do cliente só é descoberto quando a máquina nunca aparece. | [hipótese] | `new-client-wizard.tsx:142` |
| F8 | Bootstrap e download carregam a **chave na query string** (`?client=&key=`); rotas sem credencial, só `rateLimit` em memória. Auditoria anterior classificou como não-vulnerabilidade, mas é superfície a reavaliar se a chave for reexibível. | [hipótese] | `auditoria_sistema.md` §2.2–2.3 |

### 3.2 Estéticos

| # | Achado | Estado | Onde |
|---|---|---|---|
| E1 | **Cor crua `emerald-500/600`** no estado "conectou" — viola a regra "zero cor literal em componente" (`DESIGN.md` §2.1) e ignora `--success`. | [confirmado] | `new-client-wizard.tsx:181,187,188` |
| E2 | **Casca sem token**: `rounded-xl border bg-card` (sem `border-surface-line`); `Card` do shadcn e `<table>` sem `TABLE_*` de `lib/table-styles.ts`; cabeçalho de tabela com `font-medium` em vez de `section-label`. Sprint 16 não tocou aqui (fora de escopo). | [confirmado] | `clients-panel.tsx:72,329,337-346` |
| E3 | **Sem `<h1>`** em `/admin/clients` (comentário diz que o cabeçalho "já exibe Clientes") e `/admin/clients/novo` — mesma classe de erro corrigida na Sprint 17 para o tenant. | [confirmado] | `clients/page.tsx:84-85` |
| E4 | **Layout de página divergente**: `/admin/clients` repete `Sidebar`+`Header`+`pl-64` manualmente em vez de um layout compartilhado; `main p-6`. | [hipótese] | `clients/page.tsx:78-107` |
| E5 | **Stepper sem semântica**: sem `aria-current="step"`, rótulos somem abaixo de `sm` (só números). Mensagens de sucesso/erro sem `role="status"`/`role="alert"`. | [confirmado] | `new-client-wizard.tsx:30-57` |
| E6 | **Diálogo como primeiro recurso** para "Credenciais ativas" (`sm:max-w-3xl`) — `DESIGN.md` §10 pede esgotar inline/progressivo antes de modal. | [confirmado] | `clients-panel.tsx:95-139` |
| E7 | Estado vazio e botões sem hierarquia: ações por linha (Ver credenciais / Emitir novo pacote / Abrir painel) com 3 pesos visuais no mesmo nível; status `ativo/inativo` em minúsculas sem `StatusPill`. | [hipótese] | `clients-panel.tsx:349-391` |
| E8 | Textos misturam português com e sem acento (`"Cliente criado e pacote de instalacao emitido."`, `"Enrollment key rotacionada"`). | [confirmado] | `actions.ts:182,265` |

### 3.3 Visão geral do que já está planejado (não repetir)

`docs/PROJETO-PADRONIZACAO-VISUAL.md` já define as Sprints **17–22** (alinhamento/grid/`h1`, Visão Geral
em duas faixas, blocos de dado, telas remanescentes, conta/menu de usuário, tema claro) e traz os
prompts prontos em §10. Este plano **reaproveita** esses prompts em vez de reescrevê-los.

---

## 4. Agentes e skills

### 4.1 Já instalados no projeto (usar primeiro)

**Agentes** (`.claude/agents/`): `requirements-auditor`, `security-auditor`, `database-auditor`,
`backend-auditor`, `test-auditor`, `designer-ui` (somente leitura) · `sprint-planner` (só escreve
`docs/SPRINTS.md`) · `implementation-agent` (único que altera código).

**Skills** (`.agents/skills/`, via `skills-lock.json`): `impeccable` (design — `shape`, `critique`,
`audit`, `polish`, `harden`, `onboard`, `clarify`, `adapt`, `layout`, `typeset`, `optimize`…),
`tdd`, `diagnosing-bugs`, `domain-modeling`, `codebase-design`, `improve-codebase-architecture`,
`research`, `to-spec`. Atalhos em `.claude/commands/`.

**Hooks**: `.codex/hooks.json` roda o detector do `impeccable` após edições de UI (`Edit|Write`) e no `Stop`.
Confirmar se o Claude Code também o dispara (ver Sprint 0).

### 4.2 Mapa "tarefa → ferramenta"

| Tarefa | Use |
|---|---|
| Entender e provar um bug (ex.: F1) | skill `diagnosing-bugs` + teste antes (`tdd`) |
| Desenhar o novo fluxo antes de codar | `/shape` (impeccable) |
| Revisar UX do fluxo atual | `/critique` e `/audit` (impeccable) + `designer-ui` |
| Estado vazio, erro, "não conectou?" | `/onboard`, `/harden`, `/clarify` |
| Acabamento visual | `/layout`, `/typeset`, `/polish` |
| Responsivo | `/adapt` |
| Isolamento de tenant em novas rotas | `security-auditor` |
| Cobertura das regras | `test-auditor` |
| Formalizar RF/RN/caso de uso novo | `/domain-modeling`, `/to-spec` |

### 4.3 Ferramentas externas — decisão D4 (tomada pelo gerente, delegada pelo usuário)

| Ferramenta | Decisão | Como entra |
|---|---|---|
| **Playwright MCP** (Microsoft) | ✅ **Instalar** | `claude mcp add playwright npx @playwright/mcp@latest`. Claude Code abre o app, tira screenshot e confere o visual de verdade. Hoje os auditores só leem código (`auditoria_sistema.md` §5 admite "não houve captura de tela"). Precisa do dev server e do Postgres de pé |
| Skill `frontend-design` (Anthropic) | 🔀 **Mesclar, não instalar** | Duplica o papel do `impeccable` e traz paleta/estética próprias que brigam com o `DESIGN.md` (dark-only, OKLCH, "Operate"). Só as ideias úteis (plano de tokens antes de codar, anti-layout genérico) entram na skill local abaixo |
| Skill `react-best-practices` (Vercel) | 🔀 **Mesclar, depois de ler** | Regras de React/Next úteis (waterfall, `useEffect` desnecessário, Server vs Client). Entram **só as que o projeto ainda não pratica** e que não contradizem `CONTEXT.md`/ADRs |

**Skill local resultante: `inventario-ui`** (`.agents/skills/inventario-ui/SKILL.md` + atalho em
`.claude/commands/inventario-ui.md`, mesmo padrão dos atalhos existentes). Ordem de precedência, escrita
no topo da skill:

```
1. DESIGN.md                      (vence sempre; é o que está no código)
2. CONTEXT.md / docs/adr/         (vocabulário e decisões)
3. impeccable                     (processo: shape/critique/audit/polish)
4. Regras mescladas de terceiros  (só complementam; nunca derrogam 1-3)
```

Conteúdo: (a) as regras duras do `DESIGN.md` §10 como checklist executável; (b) comandos do `impeccable`
recomendados por tipo de tela; (c) o subconjunto aprovado de regras de React/Next; (d) "anti-padrões
genéricos de IA" que **não** conflitam com a paleta do projeto.

> [!IMPORTANT]
> Skill é instrução que o agente obedece — tratar como código de terceiros. A S0 **lê** o conteúdo
> real das duas skills externas antes de mesclar, lista o que foi aproveitado e o que foi descartado, e
> **não** instala nenhuma delas por inteiro. Fontes vieram de pesquisa web resumida: o repositório e o
> caminho exatos precisam ser confirmados pelo Claude Code, e se não forem encontrados, a skill local
> sai só com (a), (b) e (d).

### 4.4 Agente novo sugerido (a criar na Sprint 0, se aprovado)

`visual-qa` — somente leitura, usa Playwright MCP: loga com os 4 papéis, captura 3 larguras
(1440 / 1024 / 390) de cada rota do escopo, e reporta: overflow, texto cortado, foco ausente, cor fora de
token, `h1` faltando. É a versão automatizada do que `designer-ui` hoje descreve como "verifique
visualmente".

---

## 5. Checklist do gerente (como eu reviso cada entrega)

1. **Escopo**: o diff toca só os arquivos que o plano aprovado listou? Algum arquivo extra?
2. **Portões**: relatório traz saída real de `npx tsc --noEmit`, `npm run lint`, `npm run build`,
   `npm run test` (baseline: **596 testes em 62 arquivos**, medido em 2026-10-13 — nenhum pode regredir; esperado **crescer**)?
3. **DoD**: os 10 itens de `docs/DEFINITION_OF_DONE.md`, cada um ✅ / N/A com justificativa?
4. **Varredura proibida** (`DESIGN.md` §10) nos arquivos tocados:
   - cor literal (`#hex`, `rgb(`, `oklch(`, `emerald-`, `zinc-`…) fora de `globals.css`
   - `rounded-lg` em casca de card; `border` sem `border-surface-line`
   - `dark:` novo; `animate-ping` em linha; `hover:scale`; texto em gradiente; emoji no lugar de ícone
   - `backdrop-blur` fora de superfície flutuante
5. **Segurança**: toda rota/ação nova tem guard (`canManageTenant`/`requireTenantContext`), Zod,
   escopo por `clientId`/`organizationId`, auditoria (`recordAuditLog`) quando muda credencial.
6. **Prova visual**: screenshots antes/depois nas 3 larguras (com Playwright, se aprovado).
7. **Teste de papel real**: login nos 4 papéis quando tocar permissão (`node scripts/seed-rbac.ts`).
8. **Honestidade do relatório**: afirmações de sucesso têm evidência; o que ficou pendente está dito.

---

## 6. Sprints

Numeração provisória: **S0 / A0–A3** (frente Agente, executada primeiro, por sua decisão) e
**V17–V22** (frente Visual, já planejada). Os números oficiais saem quando o `sprint-planner` registrar
em `docs/SPRINTS.md`.

| Sprint | Nome | Entrega | Depende de | Status |
|---|---|---|---|---|
| **S0** | Ferramental | Playwright MCP + agente `visual-qa` + skill local `inventario-ui` (mescla) + verificação dos hooks do `impeccable` | D1, D4 | ✅ Concluída em 2026-10-14 |
| **A0** | Auditoria do fluxo Gerar agente | 5 auditores + `designer-ui` + `visual-qa`; 14 achados confirmados/ampliados; D3 respondida | S0 | ✅ Concluída em 2026-10-14 |
| **A1a** | Hotfix Segurança Bootstrap | Validação Zod estrita (regex slug/key), sanitização e escaping contra injeção de PowerShell em `lib/provisioning.ts` e `/api/agent/bootstrap` | A0 | 📋 Próxima |
| **A1** | Corretude e confiança do fluxo | F1 (rotacionar com pacote novo + confirmação), F2 (remover form morto), F3 (copy + docs D3=A), F6 (timeout 3min passo 3), E8 (acentos) + E4 (admin quebra <1024px) | A1a | 📋 Proposta |
| **A2** | Visual do fluxo | E1–E7: tokens, `Panel`/`KpiCard`, `TABLE_*`, `StatusPill`, `h1`, stepper acessível, acabamento | A1 | 📋 Proposta |
| **A3** | Agentes por cliente | F5 (+F4): listar, ver versão/última coleta, revogar; instalador Linux na UI | A2, D5 | 📋 Candidata |
| V17–V22 | Padronização visual do tenant | Prompts já prontos em `PROJETO-PADRONIZACAO-VISUAL.md` §10 | A2 (reusa componentes) | 📋 Planejadas |

### 6.1 Decisões

| # | Decisão | Padrão adotado até você dizer o contrário |
|---|---|---|
| D1 | Liberar `/admin/clients/**` para a frente Agente | ✅ **Liberado só para o fluxo de geração** (sua resposta). `app/users/page.tsx` continua fora |
| D2 | Ordem | ✅ Agente primeiro, depois V17–V22 (sua resposta) |
| D3 | A chave de instalação pode ser reexibida? | ✅ **Confirmado na A0: Opção A (reexibível).** A regra implementada no código é a vigente: cifrada com AES-256-GCM, acessível apenas por `canManageTenant`, e cada visualização grava `credentials.view` no AuditLog. A invariante do `docs/PRODUTO.md` ("apenas uma vez") foi escrita meses depois e está desatualizada; será corrigida na A1. |
| D4 | Ferramentas externas | ✅ Playwright MCP instalado. `frontend-design` e `react-best-practices` **mescladas** numa skill local (`inventario-ui`), com `DESIGN.md` vencendo sempre. Ver §4.3 |
| D5 | A3 entra nesta rodada ou fica como backlog? | Backlog até A2 fechar |
| D6 | Numeração oficial | ✅ **Padrão aceito** ("pode ser"): **S0** e **A\*** são rótulos provisórios; o `sprint-planner` numera na ordem de execução ao registrar em `docs/SPRINTS.md`, com **nota de equivalência** em cada entrada. |
| D10 | Inserção da Sprint A1a (Segurança) | ✅ **Aprovada.** Rota pública `/api/agent/bootstrap` gera script que roda como Administrador; sanitizar contra injeção PowerShell com Zod estrito e validação antes da A1. |
| D11 | Subir E4 (<1024px quebra no admin) para A1 | ✅ **Aprovado.** Resolver a casca de layout no admin durante a A1 evita telas quebradas no teste funcional e visual responsivo. |
| D12 | Cliente de teste `teste-a0-rotacao` | ✅ **Manter durante as sprints A1a e A1.** Serve de fixture segura para testes sem tocar no cliente real `core-ti-expert`. Apagar no encerramento da frente A. |

**Concluído na Sprint A0 (2026-10-14)**:
- 16 achados avaliados: 14 confirmados/ampliados, E8 ampliado.
- D3 confirmada com evidência real de código e banco.
- Descoberta da vulnerabilidade de injeção no bootstrap (motivo da criação da A1a).
- Nenhum arquivo de produto alterado; portões e baseline (596 testes) intactos.

**Backlog gerado pela S0 (não entra na A0–A2):**
- Orbes desfocados do `/login` — candidato às V17–V22.
- `DESIGN.md` §2.1 cita `components/stat-cards.tsx`, apagado na Sprint 16 — corrigir como entrega da A2
  (item 7), pois o doc diz que o código vence e o exemplo está morto.
- Skill `inventario-ui` seguiu a regra de precedência, mas das 70 regras da Vercel só avaliou as que tinham
  sinal verificável; as ~60 restantes **não foram descartadas, foram não avaliadas**.

---

## 7. Prompts

> Cole **um por vez**. Cada um assume o anterior concluído. Todos terminam com o mesmo bloco de
> governança. Os prompts abaixo estão em português; os termos de código ficam como no repositório.

### Bloco de governança (anexar a todo prompt)

```
GOVERNANCA
- Fluxo: auditores relevantes -> sprint-planner (registra em docs/SPRINTS.md) -> PARE e me devolva o
  plano. Nao implemente nada antes de eu aprovar o plano nesta conversa.
- Depois da aprovacao: implementation-agent. Nao amplie o escopo. Achado fora do escopo vira item
  para o sprint-planner, nao correcao de passagem.
- Verificacao: rode e cole a saida real de `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `npm run test` (baseline 596 testes; nenhum pode regredir).
- Confira docs/DEFINITION_OF_DONE.md item a item (OK / N/A com justificativa).
- Nao faca commit nem push. Nao marque a sprint como Concluida.
- Respeite DESIGN.md: zero cor literal em componente, border-surface-line, rounded-xl, sem dark:,
  sem animate-ping em linha, sem backdrop-blur fora de superficie flutuante.
- Entregue o relatorio final no formato: Resumo · Arquivos tocados · Portoes · DoD · Pendencias.
```

---

### Governança da S0 (substitui o bloco acima **só nesta sprint**)

A S0 não altera código de produto, então não há o que auditar nem o que o `sprint-planner` registrar.
Colar este bloco no lugar do bloco geral:

```
GOVERNANCA (SPRINT 0)
- Esta sprint NAO usa auditores nem sprint-planner e NAO registra nada em docs/SPRINTS.md.
- Antes de criar qualquer arquivo, me mostre em 10 linhas o que vai criar e onde. Espere meu OK.
- Escreva somente em: .claude/ , .agents/skills/inventario-ui/ , .mcp.json (se o claude mcp add criar)
  e .claude/scratch/ (leitura das skills externas; apague ao final). Nada mais.
- Nao faca commit nem push. Nao altere skills-lock.json, DESIGN.md, docs/ nem codigo de produto.
- Entregue: Resumo · Arquivos criados · Saida de `claude mcp list` · Tabela aproveitada/descartada ·
  Relatorio de hooks e doctor · Pendencias.
```

---

### PROMPT — SPRINT 0 · Ferramental

```
SPRINT 0 — FERRAMENTAL PARA A COLABORACAO

Contexto: PLANO_SPRINTS_COLABORACAO.md (raiz), secoes 4 e 5. Esta sprint NAO altera codigo de
produto (app/, lib/, components/, prisma/, agent-go/).

OBJETIVO
Dar ao Claude Code olhos no navegador e um auditor visual automatizado, e confirmar que os hooks de
design do impeccable funcionam no Claude Code.

ENTREGAS
1. Instalar o Playwright MCP no escopo do projeto:
   `claude mcp add playwright npx @playwright/mcp@latest`
   Confirme com `claude mcp list` e me mostre a saida. Se o comando exato divergir da versao
   instalada do Claude Code, pare e me diga em vez de improvisar.
   Use escopo de projeto (--scope project) para gerar .mcp.json. As ferramentas do MCP podem so
   aparecer apos reiniciar a sessao do Claude Code: se for o caso, diga e pare nessa etapa em vez de
   simular o resultado. A captura de teste em /login exige `docker compose up -d db` e `npm run dev`.
2. Criar .claude/agents/visual-qa.md, no mesmo formato dos auditores existentes
   (frontmatter name/description/disallowedTools: Write, Edit, NotebookEdit), somente leitura.
   Deve: subir ou reutilizar `npm run dev`, logar com os 4 papeis (docs/PRODUTO.md secao 9),
   capturar cada rota do escopo em 1440, 1024 e 390 px de largura, e reportar overflow, texto
   cortado, foco ausente, h1 ausente, cor fora de token. Formato de relatorio igual ao do
   designer-ui (Achado N / Onde / Problema / Evidencia / Correcao proposta).
3. Criar a skill local `inventario-ui` (decisao D4 do plano, secao 4.3):
   a. Antes de escrever, LEIA o conteudo real de `anthropics/skills` -> frontend-design e da skill
      `react-best-practices` da Vercel (somente leitura; baixe para .claude/scratch/, nao instale).
      Se nao achar o repositorio exato, diga e siga so com (a), (b) e (d) abaixo. Nao invente conteudo.
   b. Crie `.agents/skills/inventario-ui/SKILL.md` (frontmatter name/description, no formato das
      outras skills) e o atalho `.claude/commands/inventario-ui.md` no mesmo padrao dos atalhos
      existentes (ex.: .claude/commands/tdd.md).
   c. Conteudo, nesta ordem de PRECEDENCIA escrita no topo: DESIGN.md > CONTEXT.md/ADRs > impeccable >
      regras de terceiros. Secoes: (a) regras duras do DESIGN.md secao 10 como checklist;
      (b) comandos do impeccable por tipo de tela; (c) subconjunto de regras de React/Next que o projeto
      AINDA NAO pratica e que nao contradizem o codigo; (d) anti-padroes genericos de IA que nao
      conflitam com a paleta do projeto.
   d. Devolva uma tabela: regra de terceiros -> aproveitada / descartada (e por que, em uma linha).
      Descarte qualquer regra que mande trocar paleta, fonte, tema ou usar cor literal.
4. Verificar se .codex/hooks.json (impeccable hook.mjs) tambem dispara no Claude Code. Se nao
   disparar, NAO crie hook novo: apenas relate o que falta e proponha.
5. Rodar `$impeccable doctor` (somente relatorio) e colar o resultado. Nao repare nada por conta
   propria — reporte. Em especial: confirmar se o impeccable acha PRODUCT.md (existe docs/PRODUCT.md,
   mas nao ha PRODUCT.md na raiz).

FORA DE ESCOPO
- Qualquer arquivo de app/, lib/, components/, prisma/, agent-go/.
- Instalar skills externas por inteiro (frontend-design, react-best-practices): decisao D4 e MESCLAR,
  nao instalar. Nao adicione nada a skills-lock.json.

CRITERIOS DE ACEITE
- `claude mcp list` mostra playwright conectado.
- visual-qa.md existe, e somente leitura, e roda uma captura de teste em /login (anexe o screenshot).
- inventario-ui existe, com a precedencia no topo e a tabela aproveitada/descartada anexada;
  nenhuma regra dela contradiz DESIGN.md (cole a verificacao).
- Relatorio dos hooks e do doctor colado, sem alteracoes automaticas.
- git diff mostra apenas arquivos em .claude/, .agents/skills/inventario-ui/ (e eventualmente
  .mcp.json). skills-lock.json intocado.
```

### PROMPT — SPRINT A0 · Auditoria do fluxo "Gerar agente"

```
SPRINT A0 — AUDITORIA DO FLUXO GERAR AGENTE (SOMENTE LEITURA)

Contexto: PLANO_SPRINTS_COLABORACAO.md, secao 3 (achados F1-F8 e E1-E8). Depende da Sprint 0.
/admin/clients/** esta LIBERADO para esta frente por decisao do usuario (nada alem do fluxo de
geracao de agente; app/users/page.tsx continua fora).

OBJETIVO
Validar, refutar ou ampliar cada achado do plano com evidencia, e entregar uma lista priorizada.
NENHUM codigo e alterado nesta sprint.

TAREFAS (rodar em paralelo quando possivel)
1. requirements-auditor: RF/RN que cobrem provisionamento, rotacao e revogacao de credenciais.
   Em especial a invariante "segredos so existem em plaintext uma vez" (PRODUTO.md 4.2) versus
   persistActiveProvisioningKey (chave cifrada e reexibivel). Qual e a regra vigente?
2. security-auditor: GET /api/clients/[id]/credentials, rotateEnrollmentKeyAction, bootstrap,
   download-exe (chave em query string), rate limit em memoria. Reexibir a chave muda o risco?
3. backend-auditor: rastrear RF -> rota -> action -> Prisma de: criar cliente, rotacionar,
   ver credenciais, polling /api/clients/[id]/status.
4. test-auditor: onde esta o teste de cada uma dessas regras? Existe teste do fluxo de rotacao?
5. designer-ui + visual-qa (Playwright): /admin/clients, /admin/clients/novo (3 passos), dialogo
   "Credenciais ativas", nas 3 larguras. Estas rotas estao NOMEADAS aqui de proposito (o visual-qa
   as exclui por padrao). Screenshots ficam FORA do repositorio, como manda o visual-qa; informe o
   caminho absoluto de cada um no relatorio para eu abrir.
6. Skill diagnosing-bugs sobre F1: reproduza no navegador (clicar em "Emitir novo pacote") e
   registre exatamente o que o usuario ve e o que muda no banco.
   CUIDADO: o tenant core-ti-expert tem agentes reais reportando (docs/PRODUTO.md secao 9). NAO
   rotacione a chave dele. Crie um cliente de teste so para isto, nao apague nada ao final (apenas
   informe o nome/slug dele no relatorio para eu decidir o que fazer).
7. Skill impeccable /critique no fluxo completo (criar cliente -> instalar -> primeira maquina).

ENTREGA
Relatorio unico (cole na conversa, nao grave em docs/SPRINTS.md ainda) com: para cada achado F*/E*,
veredito [confirmado / refutado / ampliado] + evidencia (arquivo:linha ou screenshot) + severidade.
Ao fim, proponha a ordem das sprints A1-A3 e liste achados NOVOS que o plano nao previa.

NAO FACA
- Nao edite nenhum arquivo de codigo. Nao corrija F1 ainda, mesmo sendo obvio.
- Nao rode o sprint-planner nesta sprint: o planejamento da A1 comeca depois que eu revisar este
  relatorio.

CRITERIOS DE ACEITE
- Todos os 16 achados com veredito e evidencia; zero afirmacao sem arquivo:linha ou screenshot.
- Resposta explicita para a pergunta de D3 (qual regra de exibicao da chave esta vigente).
- git diff vazio (nenhum arquivo do repositorio criado ou alterado).
```

### PROMPT — SPRINT A1a · Hotfix de Segurança: Injeção PowerShell e Bootstrap

```
SPRINT A1a — HOTFIX DE SEGURANCA: INJECAO POWERSHELL NO BOOTSTRAP

Contexto: PLANO_SPRINTS_COLABORACAO.md, secao 6.1 (Decisao D10). Achado critico da Sprint A0.
A rota `/api/agent/bootstrap` e publica e gera um script PowerShell executado como Administrador
(`irm ... | iex`). Os parametros `client` e `key` hoje nao possuem validacao estrita de regex e a interpolacao
em `lib/provisioning.ts` e na query string pode permitir quebras de linha ou caracteres de injecao.

OBJETIVO
Tornar impossivel qualquer injecao de codigo ou caracteres maliciosos no script gerado pelo bootstrap,
garantindo validacao estrita Zod e testes de seguranca automatizados.

ENTREGAS
1. Validacao Estrita com Zod em `app/api/agent/bootstrap/route.ts`:
   - `client`: `z.string().trim().regex(/^[a-z0-9-]+$/, 'Slug de cliente invalido').min(2).max(64)`
   - `key`: `z.string().trim().regex(/^[a-zA-Z0-9_-]{16,128}$/, 'Chave de instalacao invalida')`
2. Sanitizacao e Escaping em `lib/provisioning.ts`:
   - `escapePowerShellSingleQuoted`: rejeitar ou sanitizar terminantemente quebras de linha (`\r`, `\n`),
     backticks e caracteres de controle.
   - Garantir que `buildBootstrapScript` gere exclusivamente strings seguras entre aspas simples validas.
   - Em `installCommand` (usado em cmd.exe), garantir que `clientSlug` e `enrollmentKey` passem por sanitizacao
     sem permitir interpolacao ou quebra de comando de shell.
3. Testes TDD:
   - Criar suite de testes em `__tests__/provisioning-security.test.ts` cobrindo tentativas de injecao
     (ex.: payloads com `'; calc.exe; '`, newlines `\nWrite-Host pwned`, aspas simples, espacos, etc.).
   - Garantir que a rota rejeite (400) payloads invalidos e que `buildBootstrapScript` lance erro ou gere
     script seguro e inofensivo.

CRITERIOS DE ACEITE
- Zod schema rejeita qualquer caractere fora da allowlist estrita.
- Testes cobrem tentativas reais de bypass e injecao.
- `security-auditor` aprova o diff.
- 4 portoes limpos (`tsc`, `lint`, `build`, `test`), contagem de testes >= 596.

GOVERNANCA
- Fluxo: auditores relevantes -> sprint-planner (registra em docs/SPRINTS.md) -> PARE e me devolva o
  plano. Nao implemente nada antes de eu aprovar o plano nesta conversa.
- Depois da aprovacao: implementation-agent. Nao amplie o escopo. Achado fora do escopo vira item
  para o sprint-planner, nao correcao de passagem.
- Verificacao: rode e cole a saida real de `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `npm run test` (baseline 596 testes; nenhum pode regredir).
- Confira docs/DEFINITION_OF_DONE.md item a item (OK / N/A com justificativa).
- Nao faca commit nem push. Nao marque a sprint como Concluida.
- Entregue o relatorio final no formato: Resumo · Arquivos tocados · Portoes · DoD · Pendencias.
```

### PROMPT — SPRINT A1 · Corretude e confiança do fluxo

> **Rascunho.** Será ajustado depois do relatório da A0. D3 já está decidida (opção A). Não enviar antes.

```
SPRINT A1 — CORRETUDE E CONFIANCA DO FLUXO GERAR AGENTE

Contexto: relatorio da A0 (cole aqui) e PLANO_SPRINTS_COLABORACAO.md secao 3.1.
Decisao D3 (exibicao da chave): A — a chave PERMANECE reexibivel (cifrada em repouso, AES-256-GCM).
Nao ha migration nesta sprint.

OBJETIVO
O administrador sabe, em cada passo, o que aconteceu com a chave e com a primeira maquina — e nada
acontece em silencio.

ENTREGAS
1. F1 — Rotacao com feedback e confirmacao.
   - Capturar o resultado de rotateEnrollmentKeyAction (hoje descartado) e mostrar o pacote novo e o
     aviso "instaladores antigos deixam de funcionar".
   - Confirmar antes de rotar (AlertDialog do shadcn, ja no projeto), dizendo QUANTAS maquinas ja
     instaladas continuam funcionando (a apiKey de cada agente nao muda; so a chave de enrollment).
     Verifique esse fato no codigo antes de escrever o texto.
   - TDD: escreva primeiro o teste que falha.
2. F2 — Remover o formulario inline morto de clients-panel.tsx (showCreateForm e o Card do
   formulario). Se o campo slug fizer falta, proponha no plano mover para o assistente — nao decida.
3. F3 — Alinhar copy e docs a D3=A.
   - AgentInstallPackage: a copy de keyIsFresh=true deixa de dizer "nao sera exibida novamente" e
     passa a dizer a verdade (a chave fica guardada cifrada e pode ser consultada em "Ver credenciais"
     por quem administra o cliente). Mantenha o aviso de que ela e uma credencial sensivel.
   - docs/PRODUTO.md: corrigir a invariante 3 de 4.2 e o passo 1 de 7 ("exibida uma unica vez") para a
     regra real. Edicao so desses trechos, texto apenas; liste no plano as linhas exatas ANTES de editar.
   - Se a A0 mostrar que `GET /api/clients/[id]/credentials` nao grava AuditLog de visualizacao, inclua
     no plano como item proposto (acao `credentials.view`) e ESPERE minha aprovacao — reexibir segredo
     sem trilha e o ponto fraco desta decisao.
4. F6 — Passo 3: estado de erro/tempo esgotado. Apos 3 min sem check-in, mostrar checklist
   (executar como Administrador, firewall, URL do servidor acessivel pela maquina, relogio).
   Sem polling infinito silencioso; falha de rede visivel com role="status".
5. E8 — Padronizar acentuacao das mensagens de actions.ts (somente strings de interface).

FORA DE ESCOPO
Visual (A2), lista/revogacao de agentes (A3), qualquer coisa em app/users, portal ou tenant.

CRITERIOS DE ACEITE
- Teste novo cobre: rotacao devolve pacote; UI exibe pacote e aviso; confirmacao exigida.
- security-auditor revisou o diff: nenhuma regressao de guard (canManageTenant) nem de auditoria
  (credentials.rotate continua gravando AuditLog).
- Nenhuma rota nova sem Zod, guard e escopo de tenant.
- 4 portoes limpos; contagem de testes maior que 596.
```

### PROMPT — SPRINT A2 · Visual do fluxo

> **Rascunho.** Depende da A1 concluída e commitada (e da Sprint 16 já na base: `KpiCard`, `Panel`).

```
SPRINT A2 — VISUAL DO FLUXO GERAR AGENTE

Contexto: relatorio da A0, PLANO_SPRINTS_COLABORACAO.md secao 3.2, DESIGN.md (inteiro),
docs/PROJETO-PADRONIZACAO-VISUAL.md secoes 3-4 (familia de cards).

Modo (impeccable): Operate. Refinamento — preserva a identidade da Fase 1, muda disposicao e
cascas. Pre-requisito: decisao D7 (PRODUCT.md na raiz). Se D7 foi resolvida, rode /shape primeiro e
me devolva o brief ANTES de editar; se nao, use /critique + DESIGN.md e diga que /shape ficou de fora.

ENTREGAS
1. E1 — Trocar emerald-* por tokens (--success), sem cor literal.
2. E2 — Cascas pela familia fechada: Panel no lugar de Card/div; tabela com TABLE_SHELL_CLASS,
   TABLE_HEAD_ROW_CLASS, TABLE_HEAD_CLASS, TABLE_CELL_CLASS; status com StatusPill; border-surface-line.
3. E3/E4 — h1 em /admin/clients e /admin/clients/novo no padrao de cabecalho de pagina
   (flex flex-wrap items-start justify-between gap-4, h1 text-2xl font-bold). Se existir um layout
   compartilhado, use-o; se nao, proponha no plano — nao crie layout novo sem aprovacao.
4. E5 — Stepper com <ol> semantico, aria-current="step", rotulo visivel (ou sr-only) em 390 px;
   mensagens com role="status"/"alert".
5. E6/E7 — Hierarquia de acoes por linha (1 primaria, o resto em menu ou secundario); avaliar trocar o
   dialogo "Credenciais ativas" por painel inline expansivel (DESIGN.md secao 10: modal nao e o
   primeiro pensamento). Apresente a opcao escolhida no plano.
6. Verificacao visual obrigatoria: visual-qa nas 3 larguras, antes e depois. Screenshots fora do
   repositorio (regra do visual-qa); caminhos absolutos no relatorio.
7. DESIGN.md secao 2.1: o exemplo de codigo aponta para components/stat-cards.tsx, apagado na
   Sprint 16. Verifique o arquivo atual e corrija so esse exemplo (unica edicao permitida no DESIGN.md).
8. Hook (decisao D8): se aprovado, criar .claude/settings.json com o PostToolUse (Edit|Write) do
   impeccable. Sem o Stop. Confirme o formato na documentacao do Claude Code, nao copie
   commandWindows do Codex.

FORA DE ESCOPO
Comportamento (A1), agentes por cliente (A3), app/users, portal, tenant.

CRITERIOS DE ACEITE
- Zero cor literal e zero rounded-lg/border sem token nos arquivos tocados (cole o grep).
- Contraste >= 4.5:1 no que for novo (medir, nao estimar).
- Screenshots antes/depois nas 3 larguras, sem overflow horizontal a 390 px.
- prefers-reduced-motion respeitado; nenhum animate-ping novo.
- 4 portoes limpos; testes existentes intactos.
- impeccable /polish rodado uma vez ao final (passada unica, nao em loop).
```

### Sprints Concluídas
- **Sprint A1a** (`c28deff`): Hotfix de segurança de injeção em bootstrap e download de agente.
- **Sprint A1** (`804d9a6`): Confiança e corretude no fluxo Gerar Agente (rotação com diálogo e contagem de máquinas).
- **Sprint A2** (`e261dd1`): Padronização visual e acessibilidade com `Panel`, `TABLE_*` e inline credentials.
- **Sprint A3** (`d4b42e1`): Gestão e revogação de agentes por cliente (`/admin/clients/[id]/agents`).

### Sprints Futuras & Novas Candidatas
- **Sprint A4 (Backlog 19)**: Instalador Linux na UI + hash do executável (F4 + N6).
- **Sprint A5 (Backlog 21 — Nova)**: Desinstalação remota de agente pelo painel (comando `AGENT_UNINSTALL` na fila assíncrona, rotina nativa de auto-remoção do serviço no Windows/Linux, estilo Bitdefender).
- **Sprint A6 (Backlog 22 — Nova)**: Agente de Rede / Sonda Local (descoberta passiva/ativa de ativos de rede não gerenciados via SNMP/ARP/mDNS, relay de proxy para redes isoladas, cache local de downloads).
- **Roadmap de Recursos Avançados (Backlog 23)**: CVE Vulnerability Scanner, telemetria SMART de SSDs, compliance do Windows Update, terminal remoto seguro e auto-remediação.

### Sprints V17–V22 (Visual do Tenant)
Usar os prompts já escritos em
[PROJETO-PADRONIZACAO-VISUAL.md §10](file:///e:/Inventario/docs/PROJETO-PADRONIZACAO-VISUAL.md) para repaginação das telas do tenant (`/app/[slug]/*`).


---

## 8. Riscos do próprio plano

| Risco | Mitigação |
|---|---|
| Os achados F/E vieram de leitura de código, não de execução | A0 existe para confirmar com Playwright antes de planejar |
| A1 mexe em credencial (rotação e copy sobre reexibição) | `security-auditor` obrigatório no diff; teste com 4 papéis reais; sem migration (D3=A) |
| D3=A deixa um segredo reexibível: quem vê a tela vê a chave | Já restrito a `canManageTenant`; A0 verifica se a visualização é auditada e A1 propõe `credentials.view` se faltar |
| A2 colide com V17 (mesmos conceitos: `h1`, cabeçalho, grid) | A2 só toca arquivos do fluxo de agente; V17 herda o padrão que A2 estabelecer |
| Mesclar skills de terceiros traz regra que briga com o `DESIGN.md` | Precedência escrita na skill `inventario-ui`; tabela aproveitada/descartada revisada por mim na S0 |
| Contexto do Claude Code estoura em sprints longas | Um prompt por sessão; relatório curto; histórico fica no `git log` e em `docs/SPRINTS.md` |

---

## 9. Próximo passo

1. ✅ Decisões D1–D6 fechadas (seção 6.1). D5 (A3) segue como backlog até a A2 fechar.
2. Você cola no Claude Code, **nesta ordem**: (a) a **Governança da S0** e (b) o **PROMPT — SPRINT 0**,
   ambos na seção 7. Não use o bloco geral de governança na S0.
3. O Claude Code mostra em 10 linhas o que vai criar e espera seu OK. Você me traz essa mensagem se
   quiser que eu confira antes de liberar.
4. Ao voltar o relatório da S0, eu reviso com a seção 5 — em especial a tabela aproveitada/descartada
   da skill `inventario-ui` e se `claude mcp list` mostra o Playwright conectado — e liberamos a **A0**.
5. Depois da A0, eu fecho o prompt da **A1** com o relatório real em mãos (hoje é rascunho).
