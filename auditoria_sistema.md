# Auditoria Técnica — Inventário Enterprise

**Data:** 16 de setembro de 2026
**Commit:** `02aae3b` · **Branch:** `feat/fundacao-multitenant`
**Regra aplicada:** nenhuma afirmação abaixo vem de comentário de código ou de documentação.
Cada linha é sustentada por output de terminal ou inspeção direta de arquivo, com
`arquivo:linha` citado. Onde um comentário do código afirma um comportamento, o
comportamento foi verificado no código de execução, não no comentário.

> O relatório anterior deste arquivo (gerado por outro modelo) foi preservado em
> `docs/auditoria_sistema.gemini.md` antes da sobrescrita. A comparação entre os dois está
> em `docs/AUDITORIA-COMPARADA.md`.

---

## 1. Os quatro portões técnicos

Executados em sequência, do zero, nesta auditoria.

| Portão | Comando | Exit code | Resultado medido |
|---|---|---|---|
| Testes | `npm test` | **0** | **60 arquivos, 575 testes, 575 passando**, 20,40s |
| Tipos | `npm run typecheck` | **0** | sem saída de erro |
| Lint | `npm run lint` | **0** | sem saída de erro |
| Build | `npm run build:verify` | **0** | **46 rotas**, **0 ocorrências de "warn"** na saída |

Output literal dos testes:
```
 RUN  v4.1.11 E:/Inventario
 Test Files  60 passed (60)
      Tests  575 passed (575)
   Duration  20.40s
```

### 1.1 Bundler: Webpack, não Turbopack

Duas fontes independentes, ambas literais:

`package.json`:
```json
"build": "next build --webpack"
```

`scripts/verification/run-build.mjs:7`:
```js
const BUILD_ARGS = [NEXT_BIN, 'build', '--webpack']
```

E a primeira linha do output do build confirma a invocação real:
```
[phase1b:build] Starting ...\next\dist\bin\next build --webpack
```

**O build usa Webpack explicitamente.** Next.js 16.1.6 (de `package.json`).

### 1.2 Versão declarada

`package.json` → `"version": "0.1.0"`.

---

## 2. Segurança

### 2.1 Guards multi-tenant — cobertura total verificada

Varredura de **todas** as páginas sob `app/app/[clientSlug]/`, contando ocorrências de
`requireTenantContext` em cada arquivo:

| Páginas do tenant | Com `requireTenantContext` |
|---|---|
| 12 | **12** |

Nenhuma exceção. Estendido às rotas de API, que o roteiro não pediu:

| Grupo | Rotas | Com guarda de contexto |
|---|---|---|
| `app/api/tenant/**` | 4 | 4 |
| `app/api/portal/**` | 2 | 2 |

### 2.2 Rotas `/api/agent/*` — 9 rotas, 6 com credencial de agente

Enumeração completa, verificando a presença de validação de credencial no handler:

| Rota | Guarda no handler |
|---|---|
| `checkin/route.ts` | `agentAuth` |
| `metrics/route.ts` | `agentAuth` |
| `discovery/route.ts` | `agentAuth` |
| `register/route.ts` | `agentAuth` |
| `commands/pending/route.ts` | `agentAuth` |
| `commands/[id]/result/route.ts` | `agentAuth` |
| `bootstrap/route.ts` | **nenhuma** — só `rateLimit` |
| `download/route.ts` | **nenhuma** — só `rateLimit` |
| `download-exe/route.ts` | **nenhuma** — só `rateLimit` |

As três rotas sem credencial foram inspecionadas integralmente. O que elas fazem, de fato:

**`bootstrap/route.ts` (40 linhas, lido por completo):** recebe `client` e `key` na query
string, valida **apenas o formato** via Zod (`client` mín. 2 caracteres, `key` mín. 16),
e devolve um script PowerShell de instalação. **Não consulta o banco em momento algum** —
não há import de `prisma` no arquivo. Limite de 20 requisições por IP a cada 5 minutos
(`route.ts:17`).

Consequência verificada: como a rota devolve `200` para qualquer chave bem-formada e
`400` só para chave malformada, **ela não distingue chave válida de inválida** e portanto
não serve como oráculo de enumeração. O script devolvido embute a chave que o próprio
chamador enviou, não um segredo do servidor.

**`download-exe/route.ts`:** mesmo padrão — `client` + `key` na query, sem consulta ao
banco (verificado: zero ocorrências de `prisma`, `findUnique`, `findFirst` ou `agentAuth`
no arquivo). Embute os parâmetros no executável servido.

**`download/route.ts`:** serve o binário sem parâmetro algum. Público com rate limit.

**A validação real da chave ocorre em `register/route.ts`**, que importa `prisma`
(`route.ts:3`) e devolve `404` para cliente inexistente (`:41`), `403` para cliente
desativado (`:46`) e `401` para chave inválida (`:53`, `:59`), antes de criar o
`agentAuth` (`:64`).

**Observação factual, não classificada como vulnerabilidade:** essa diferença de status em
`register` (`404` para cliente inexistente contra `401` para chave errada) permite, a quem
já conhece o slug do cliente, distinguir os dois casos. É um comportamento de oráculo
restrito ao fluxo de enrollment.

### 2.3 Rate limit — em memória, processo único

`lib/rate-limit.ts:17`:
```ts
const buckets = new Map<string, Bucket>()
```

Não há Redis nem store externo. **O limite é por processo.** Numa implantação com mais de
uma instância ou em ambiente serverless, o teto efetivo é multiplicado pelo número de
processos. Isso vale para as três rotas públicas da seção 2.2, que dependem só dele.

### 2.4 Guard SSRF — faixas exatas e re-resolução comprovada

`lib/webhook-url-guard.ts`, lido integralmente (119 linhas).

**IPv4 bloqueado** (`:31-38`), com máscara aplicada em `:45-51`:

| CIDR | Cobre |
|---|---|
| `127.0.0.0/8` | loopback |
| `10.0.0.0/8` | RFC1918 |
| `172.16.0.0/12` | RFC1918 |
| `192.168.0.0/16` | RFC1918 |
| `169.254.0.0/16` | link-local, **inclui `169.254.169.254`** (metadata de nuvem) |
| `0.0.0.0/32` | "esta rede" |

**IPv6 bloqueado** (`:58-72`): `::1`, `::`, `fc00::/7` (`:68`), `fe80::/10` (`:69`), e
endereços IPv4-mapeados `::ffff:a.b.c.d` (`:62-63`), que reaplicam a checagem IPv4.

**Dois controles adicionais** não cobertos pelo roteiro:
- **Somente `https:`** (`:88-90`). `http://` é rejeitado.
- **String `localhost` bloqueada** antes de qualquer resolução (`:95-97`).

**Falha de DNS resulta em bloqueio** (`:106-112`): tanto exceção no `lookup` quanto lista
de endereços vazia devolvem `{ ok: false }`. Fail-closed confirmado no código.

**Re-resolução a cada disparo — verificada no código de execução, não no comentário.**
Enumerei todos os call sites de `checkWebhookUrlSafety`:

| Arquivo:linha | Momento |
|---|---|
| `app/app/[clientSlug]/settings/actions.ts:63` | criação do endpoint |
| `app/app/[clientSlug]/settings/actions.ts:157` | edição do endpoint |
| `lib/webhook-endpoints.ts:105` | **cada disparo** |

O terceiro está dentro de `endpoints.map(async (endpoint) => {...})` (`:104`), e o `return`
em `:110` aborta aquele endpoint antes do `fetch` quando a checagem falha. A proteção
contra DNS rebinding existe de fato no caminho de execução.

### 2.5 Criptografia de segredos

`lib/encrypted-secret.ts`, lido integralmente (81 linhas).

| Item | Valor real | Linha |
|---|---|---|
| Algoritmo | `aes-256-gcm` | `:14` |
| Chave | 32 bytes, `scryptSync` | `:15`, `:40` |
| IV | 12 bytes, `randomBytes`, **por operação** | `:16`, `:44` |
| Tag de autenticação | `cipher.getAuthTag()` | `:49` |
| Versionamento | `v: 1`, rejeita versão diferente | `:17`, `:68-70` |

**Segredo mestre** (`:26-37`), em cadeia de fallback:
```ts
process.env.INVENTARIO_PROVISIONING_SECRET ?? process.env.AUTH_SECRET ?? process.env.ADMIN_SECRET
```
Lança erro se nenhum estiver definido.

**Salts — são exatamente dois, ambos constantes literais no código-fonte**, não variáveis
de ambiente:

| Constante | Valor | Arquivo:linha |
|---|---|---|
| `KEY_SALT` | `'inventario-active-provisioning'` | `lib/provisioning-credentials.ts:9` |
| `WEBHOOK_SECRET_KEY_SALT` | `'inventario-webhook-endpoint-secret'` | `lib/webhook-endpoints.ts:48` |

Consequência factual: existem **duas chaves derivadas no sistema inteiro**, uma por domínio
de segredo. **Não há chave por webhook, por endpoint ou por tenant** — todos os
`WebhookEndpoint.secret` do sistema são cifrados com a mesma chave derivada. A separação
por salt evita reúso de chave *entre domínios*, não *entre registros*.

Não existe nenhuma variável de ambiente chamada `WEBHOOK_SECRET_KEY`. Verificado por
varredura em todo o repositório: a única ocorrência dessa string está no relatório anterior,
em `docs/auditoria_sistema.gemini.md:34`.

### 2.6 AuditLog — o 200 é `LIMIT` de exibição, não deleção

`lib/audit-log.ts:135`, dentro da query:
```sql
LIMIT ${filters.limit ?? 100}
```

`app/app/[clientSlug]/audit/page.tsx:70` passa `limit: 200`.

**Não existe rotina de deleção de `AuditLog`.** Varredura por
`auditLog.delete`, `auditLog.deleteMany`, `purge`, `expurgo`, `retention` e `retencao` em
`app/`, `lib/` e `prisma/` não retornou nenhuma operação de escrita destrutiva sobre essa
tabela.

A única política de retenção real do sistema é de **`MetricSample`**, não de auditoria:
`app/api/agent/metrics/route.ts:76` calcula um `cutoff` a partir de
`metricsRetentionDays` (padrão 90, `:7`) e expurga na própria ingestão (`:72`).

Portanto: registros de auditoria antigos **permanecem no banco**. A tela apenas não os
busca.

---

## 3. Consistência de interface

### 3.1 Dois componentes de KPI com anatomia oposta

Ambos em uso simultâneo no mesmo produto.

**`components/stat-cards.tsx:86-97`** — rótulo primeiro, ícone depois, sob
`justify-between`, portanto **ícone à direita**:
```tsx
<div className="flex items-start justify-between gap-3">
  <p className="section-label">{title}</p>
  {icon && (
    <div className={cn('flex shrink-0 items-center justify-center rounded-lg',
      featured ? 'h-12 w-12' : 'h-10 w-10', iconStyles[variant])}>
```

**`components/ui/summary-card.tsx:121-124`** — ícone primeiro, **à esquerda**:
```tsx
<div className="mb-2 flex items-center gap-3">
  <div className={cn('rounded-lg p-2', tones.icon)}>{icon}</div>
  <p className="section-label">{label}</p>
</div>
```

| Propriedade | `StatCard` | `SummaryCard` |
|---|---|---|
| Posição do ícone | direita | esquerda |
| Chip do ícone | `h-10 w-10` / `h-12 w-12` (40 / 48px) | `p-2` — tamanho segue o ícone recebido |
| Nome do tom de falha | **`danger`** (`:21`) | **`destructive`** |
| Demais tons | `default`, `primary`, `success`, `warning`, `info` | `primary`, `success`, `warning`, `info` |

`stat-cards.tsx:21`, literal:
```ts
variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
```

**O mesmo conceito de severidade tem dois nomes no mesmo sistema**, e a leitura da fileira
de KPI inverte conforme a tela.

### 3.2 `<h1>`: 11 das 12 páginas do tenant

Contagem de `<h1` por arquivo:

| Página | `<h1>` |
|---|---|
| `alerts`, `assets`, `assets/[id]`, `audit`, `computers`, `network`, `processors`, `reports`, `servers`, `settings`, `storage` | 1 cada |
| **`page.tsx` (Visão Geral)** | **0** |

O cabeçalho do shell (`components/sidebar.tsx:546-560`) foi inspecionado: renderiza
`<ShellBreadcrumbs>`, o gatilho da paleta, o seletor de cliente e o menu de perfil.
**Nenhum elemento de título de página.** A justificativa que o código dá para a ausência
do `<h1>` não corresponde ao que o cabeçalho renderiza.

### 3.3 Raio de borda: 45 contra 42

`DESIGN.md:225`, literal:
> Raio: cards e cascas em `rounded-xl` (12px).

Contagem em `app/` e `components/`, de superfícies que combinam raio com `border` ou
`bg-card`:

| Classe | Ocorrências |
|---|---|
| `rounded-lg` (8px) | **45** |
| `rounded-xl` (12px) | **42** |

A divergência não é residual: a classe que **viola** a regra declarada é a mais frequente.
Concentrações em `app/app/[clientSlug]/reports/page.tsx` (4 blocos: `:83`, `:107`, `:144`,
`:169`), `alerts/page.tsx` (`:57`, `:88`), `settings/`, e nos `loading.tsx` de `alerts`,
`network`, `processors`, `reports`, `servers` e `settings`.

### 3.4 Classes de hover documentadas: comentadas, não ativas

Classificação por posição no arquivo (linha iniciada por `*` = comentário):

| Classe | Estado | Onde |
|---|---|---|
| `hover:scale-[1.02]` | **comentado** | `components/ui/summary-card.tsx:67` |
| `hover:bg-accent/30` | **comentado** | `components/ui/summary-card.tsx:66` |
| `bg-card/70` | **zero ocorrências** | — |

Nenhuma das três está ativa em nenhum componente. As duas primeiras aparecem apenas dentro
de blocos de comentário que registram sua remoção.

`backdrop-blur` **existe**, mas em 4 locais, todos de chrome do shell, nenhum em card de
conteúdo: `components/sidebar.tsx:346` (overlay móvel), `:365` (sidebar), `:547`
(cabeçalho) e `app/login/page.tsx:34`. Há ainda `app/portal/layout.tsx:16`.

### 3.5 Card que reage ao hover sem ser clicável

`components/stat-cards.tsx:81` aplica `surface-interactive` **incondicionalmente**:
```tsx
'surface-interactive flex h-full w-full select-none flex-col justify-between gap-3 rounded-xl border bg-card p-4',
```
enquanto `:83` condiciona apenas o cursor e o foco:
```tsx
href && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
```

`app/app/[clientSlug]/reports/page.tsx:57-61` instancia um `StatCard` **sem `href`**:
```tsx
<StatCard
  title="Taxa de disponibilidade"
  value={`${summary.availabilityPercent}%`}
  valueClassName="text-success"
/>
```

Resultado: o card recebe a elevação e o halo do hover, mas não é clicável nem focalizável,
ao lado de três cards que são.

### 3.6 Espaço morto em `/servers`

`app/app/[clientSlug]/servers/page.tsx:86-88`, dentro de um contêiner `space-y-6`:
```tsx
<div className="flex items-center gap-2">
  {/* Action buttons... */}
</div>
```
Elemento sem conteúdo renderizado. `space-y-6` aplica margem tanto a ele quanto ao irmão
seguinte, somando 48px entre o cabeçalho e a tabela, contra 24px nas páginas irmãs.

---

## 4. Resumo dos achados

| # | Achado | Severidade | Evidência |
|---|---|---|---|
| 1 | Rate limit em memória, por processo — único controle das 3 rotas públicas do agente | Média | `lib/rate-limit.ts:17` |
| 2 | Uma única chave derivada cifra todos os segredos de webhook do sistema | Baixa (desenho defensável, mas não é isolamento por registro) | `lib/webhook-endpoints.ts:48` |
| 3 | `register` distingue cliente inexistente (404) de chave inválida (401) | Baixa | `app/api/agent/register/route.ts:41,53,59` |
| 4 | Dois componentes de KPI com anatomia oposta e `danger` vs `destructive` | Alta (UI) | `stat-cards.tsx:21,86-97` · `summary-card.tsx:121-124` |
| 5 | Visão Geral é a única de 12 páginas sem `<h1>` | Alta (UI/a11y) | `app/app/[clientSlug]/page.tsx` · `sidebar.tsx:546-560` |
| 6 | 45 superfícies em `rounded-lg` violando a regra de `DESIGN.md:225` | Alta (UI) | contagem em `app/`, `components/` |
| 7 | Card com hover interativo sem destino | Média (UI) | `stat-cards.tsx:81` · `reports/page.tsx:57-61` |
| 8 | 48px de espaço morto em `/servers` | Baixa (UI) | `servers/page.tsx:86-88` |

Nenhum achado compromete isolamento multi-tenant, autenticação ou confidencialidade de
dados em repouso.

---

## 5. Limites desta auditoria

Declarados para que o relatório não seja lido além do que ele mediu:

- **Não houve execução de teste dinâmico de segurança.** Nenhuma requisição foi disparada
  contra as rotas para confirmar empiricamente os códigos de status. A seção 2 é análise
  estática de código mais execução dos portões.
- **Os achados de UI são geometria implicada por classes Tailwind**, não observação visual.
  Não foram tiradas capturas de tela nem medidos pixels renderizados.
- **O agente Go não foi compilado nem executado** nesta auditoria. A leitura de
  `agent-go/**` foi estática.
- **Cobertura de teste não foi medida.** "575 testes passando" é contagem de casos, não
  percentual de linhas ou ramos cobertos. Nenhuma afirmação de cobertura é feita aqui.
- `app/admin/clients/**` e `app/users/page.tsx` entraram apenas nas contagens agregadas de
  classe CSS; não foram auditados individualmente, por restrição permanente do projeto.
