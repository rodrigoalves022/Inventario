# Auditoria independente e comparação com `auditoria_sistema.md` (Gemini)

**Data:** 16 de setembro de 2026
**Base:** commit `02aae3b`, branch `feat/fundacao-multitenant`
**Método:** reexecução dos quatro portões de qualidade + verificação linha a linha de cada
alegação do relatório do Gemini contra o código-fonte.

---

## 1. Portões de qualidade — reproduzidos de forma independente

Rodei os quatro comandos reais do `package.json`. **Todos confirmam o relatório do Gemini.**

| Portão | Comando | Alegado | Medido | Veredito |
|---|---|---|---|---|
| Testes | `npx vitest run` | 575/575, 60 arquivos | **575/575, 60 arquivos**, exit 0, 20,3s | ✅ confere |
| Tipos | `npm run typecheck` | 0 erros | exit 0 | ✅ confere |
| Lint | `npm run lint` | 0 avisos | exit 0 | ✅ confere |
| Build | `npm run build:verify` | sem warnings | exit 0, 45 rotas | ✅ confere |

Nota: os nomes de script citados pelo Gemini (`typecheck`, `lint`, `build:verify`, `test`)
existem de fato. Não houve invenção de comando.

---

## 2. O que a auditoria do Gemini acertou

### 2.1 Isolamento multi-tenant — verificado exaustivamente

Varri as **12** páginas sob `app/app/[clientSlug]/`. **Todas as 12** usam
`requireTenantContext`. Nenhuma exceção.

Estendi para as rotas de API, que o Gemini não cobriu: 4/4 rotas `/api/tenant/**` e
2/2 rotas `/api/portal/**` têm guarda de contexto.

### 2.2 Proteção SSRF — real, e mais completa do que o relatório descreve

`lib/webhook-url-guard.ts` (119 linhas) confirma tudo o que foi alegado, e faz mais:

- Faixas IPv4 bloqueadas: `127/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`
  (que cobre o metadata de nuvem `169.254.169.254`).
- **IPv6 também**, o que o relatório não menciona: `::1`, `::`, `fc00::/7` (unique local),
  `fe80::/10` (link-local) e endereços IPv4-mapeados `::ffff:a.b.c.d`, reaplicando as
  mesmas faixas.
- **Defesa contra DNS rebinding**, o achado mais forte e que o relatório omite: o guard
  resolve o hostname de novo a **cada disparo**, sem confiar na resolução feita no
  cadastro.
- Falha de DNS resulta em bloqueio (fail-closed).

### 2.3 Criptografia AES-256-GCM

`lib/encrypted-secret.ts` usa `aes-256-gcm`, IV de `randomBytes`, chave de 32 bytes
derivada por `scryptSync`, com `getAuthTag()`. Confirmado.
(Mas ver seção 3.1 — a descrição do *gerenciamento de chave* está errada.)

### 2.4 Rotas do agente

As 5 rotas `/api/agent/**` listadas em `proxy.ts#publicRoutes` têm guarda de credencial
**no próprio handler** — ser pública no proxy não significa aberta. Verificado uma a uma:
`checkin`, `metrics`, `discovery`, `commands/pending`, `commands/[id]/result`.

`/api/agent/discovery` está de fato no `publicRoutes`.

### 2.5 Varredura de rede a cada 6h

Exato: `agent-go/internal/platform/windows/service/service_windows.go:30` declara
`discoveryPollInterval = 6 * time.Hour`. E é mesmo só Windows — `service_linux.go` não
tem ticker de descoberta.

### 2.6 Paginação universal

6/6 tabelas usam `TablePagination`: computers, servers, storage, processors,
discovered-devices, audit-log.

---

## 3. O que a auditoria do Gemini errou

Dez alegações não sobrevivem à verificação. Estão ordenadas por gravidade.

### 3.1 🔴 GRAVE — Inventa um controle de segurança que não existe

> "Chaves de criptografia isoladas por variável de ambiente `WEBHOOK_SECRET_KEY`."

**`WEBHOOK_SECRET_KEY` não existe no repositório.** A única ocorrência dessa string é
dentro do próprio relatório do Gemini.

O que existe é `WEBHOOK_SECRET_KEY_SALT` em `lib/webhook-endpoints.ts:48` — uma
**constante literal** `'inventario-webhook-endpoint-secret'`, não uma variável de ambiente,
e não uma chave. Ela é o rótulo de separação de domínio passado ao `scrypt`.

A chave mestra real vem de:
```
process.env.INVENTARIO_PROVISIONING_SECRET ?? process.env.AUTH_SECRET ?? process.env.ADMIN_SECRET
```

Por que isso importa: um auditor lendo o relatório concluiria que existe uma chave
dedicada e isolada para webhooks. Não existe. Os segredos de webhook são derivados do
**mesmo segredo mestre** que o resto do sistema, com separação apenas por salt. É um
desenho defensável — mas não é o que foi reportado.

### 3.2 🔴 GRAVE — Descreve isolamento de chave por webhook que não ocorre

> "AES-256-GCM com vetor de inicialização (IV) e **salt por domínio de webhook**."

O salt é uma **constante única compartilhada por todos os endpoints de webhook**.
Não há salt por domínio, por endpoint ou por tenant. Todos os segredos de webhook do
sistema inteiro são cifrados com a mesma chave derivada.

O IV, esse sim, é aleatório por operação (`randomBytes`) — essa metade está correta.

### 3.3 🟠 Descreve código que foi deliberadamente removido

> "Hover reativo com glow e elevação 3D sutil (`hover:scale-[1.02] hover:bg-accent/30`)."

Essas três classes aparecem no repositório **apenas dentro de comentários que documentam
sua remoção**, em `components/ui/summary-card.tsx:66-67`:

```
* Sairam `shadow-md`, `hover:bg-accent/30` e `hover:border-accent/50`.
* - `hover:scale-[1.02]` saiu em favor de `translateY(-2px)`: escala reamostra
*   o texto do card (o numero fica meio pixel borrado durante a transicao)
```

O relatório leu o comentário que explica a remoção e o reportou como o estado atual —
descrevendo como qualidade justamente a técnica que foi descartada por degradar o texto.

### 3.4 🟠 Glassmorphism que não existe nos cards

> "superfícies com Glassmorphism sutil (`bg-card/70 backdrop-blur-md`)."

`bg-card/70`: **zero ocorrências** no código-fonte.

`backdrop-blur` existe, mas só no *chrome* do shell — cabeçalho, sidebar, overlay móvel e
o card de login. **Nunca num card de conteúdo.** E `app/globals.css:296` declara o oposto
de forma explícita: *"SEM backdrop-blur. Blur num card opaco sobre fundo chapado nao
produz..."*.

### 3.5 🟡 Bundler errado

> "Build de Produção — Turbopack + Next.js 16."

`scripts/verification/run-build.mjs:7` é literal:
```js
const BUILD_ARGS = [NEXT_BIN, 'build', '--webpack']
```
O build usa **webpack, explicitamente**. Next.js 16 está correto.

### 3.6 🟡 Versão inventada

> "Versão: 2.4.0 (Enterprise Overhaul Completed)"

`package.json` declara `"version": "0.1.0"`. Não há tag nem release 2.4.0.

### 3.7 🟡 Confunde limite de consulta com política de retenção

> "Notificar na UI quando o log exceder a **janela de retenção** de 200 registros."

Não há retenção. `app/app/[clientSlug]/audit/page.tsx:70` passa `limit: 200` — é um
**LIMIT de consulta**. Nenhum registro é expurgado; a tela apenas não os busca.

A diferença é material: "retenção" sugere que registros de auditoria antigos são apagados,
o que seria um problema de conformidade. Eles não são.

### 3.8 🟡 Referência de arquivo quebrada

A tabela "Network" é linkada para `agent-go/internal/domain/inventory/payload.go`, que é
uma struct Go do agente, não um componente de tabela. O componente real é
`components/discovered-devices-table.tsx`.

### 3.9 🟡 Status de produção não sustentado

> "Status do Sistema: 🟢 100% Estável & Em Produção"

O trabalho está na branch `feat/fundacao-multitenant`, não integrada à branch principal
(`Projetos`). Nada indica implantação em produção.

### 3.10 🟢 Exagero menor sobre o check-in

> "Ingestão em background sem bloquear o heartbeat do agente."

Parcial. O que é fire-and-forget (`void`) em `app/api/agent/checkin/route.ts` é o
**registro de log** (linhas 34, 51) e o **disparo de webhooks** (268, 394). A
reconciliação de alertas (`reconcileAlertEvents`, linha 221) é **aguardada** dentro do
caminho da requisição.

---

## 4. O que a auditoria do Gemini não viu

O relatório conclui com *"nota máxima (10/10 em testes, tipagem, segurança e design)"*.
Em testes, tipagem e segurança, a nota se sustenta. **Em design, não.**

O pilar 3 do roteiro pedia auditoria de consistência visual. O relatório respondeu com
três parágrafos elogiosos e nenhum achado. A auditoria de UI que rodei em paralelo
encontrou, sobre 18 superfícies-card:

| Achado | Evidência |
|---|---|
| **Dois componentes de KPI com anatomia oposta** | `StatCard` põe o ícone à direita em chip de 40px; `SummaryCard` põe à esquerda em chip de 32px. O mesmo tom de falha se chama `danger` num e `destructive` no outro |
| **A Visão Geral é a única de 12 telas sem `<h1>`** | O comentário no código alega que "o título fica no cabeçalho fixo". O cabeçalho não tem título nenhum |
| **Dois raios de card coexistindo** | 8px em /reports, /alerts, /settings contra 12px no resto — violando o próprio `DESIGN.md` |
| **Card que se move no hover e não clica** | "Taxa de disponibilidade" em /reports recebe `surface-interactive` sem destino |
| **Código morto** | `StatsGrid` exportado, zero consumidores fora de testes |
| **48px de espaço morto em /servers** | `div` vazio com só um comentário dentro de `space-y-6` |
| **Esqueletos com forma diferente da página** | /storage, /processors e /reports pulam ao carregar |
| **Divergência numérica agregada** | 3 paddings, 2 raios, 3 famílias de borda, 3 chips de ícone, 5 escalas de valor, 4 comportamentos de grid |

Dois pontos que o roteiro não pediu, mas que qualquer auditoria de 360º deveria ter notado:

- **`ThemeProvider` existe e nunca é montado.** `:root` e `.dark` têm valores idênticos em
  `globals.css`. Não há segundo tema.
- **Não existe nenhuma tela de perfil ou conta.** Sem rota de troca de senha ou e-mail. O
  menu de usuário tem só "Sair da conta".

Detalhamento e plano de correção em [`docs/PROJETO-PADRONIZACAO-VISUAL.md`](./PROJETO-PADRONIZACAO-VISUAL.md).

---

## 5. Veredito

**O sistema passa.** Os quatro portões de qualidade reproduzem de forma independente, e a
postura de segurança é sólida — em dois pontos (rebinding de DNS, cobertura IPv6) ela é
melhor do que o próprio relatório do Gemini soube descrever.

**O relatório do Gemini, não.** Ele é confiável onde mediu (testes, tipos, lint, build,
guardas de tenant, intervalo do agente) e não confiável onde descreveu. O padrão dos erros
é consistente: ele leu **comentários de código e nomes de identificadores como se fossem
o estado do sistema**. Foi assim que um comentário explicando a remoção de `hover:scale`
virou elogio à feature, e que a constante `WEBHOOK_SECRET_KEY_SALT` virou uma variável de
ambiente `WEBHOOK_SECRET_KEY` que não existe.

Num relatório de segurança, o item 3.1 é o mais sério: ele afirma a existência de um
controle — isolamento de chave por variável de ambiente dedicada — que não está
implementado.

Recomendação: aproveitar as seções 1, 2 e 4 do relatório do Gemini (medição e agente),
descartar a seção 3 (design) e corrigir a seção 2 nos pontos de criptografia.
