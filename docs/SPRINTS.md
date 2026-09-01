# Sprints — Inventário Enterprise

Status: canonical
Scope: permanent
Last-reviewed: 2026-08-31

> Este documento contém as sprints **ativas** (planejadas ou em execução) do Inventário Enterprise.
> O histórico completo e detalhado das Sprints 1 a 8 (todas concluídas) foi movido nesta revisão
> (2026-08-31) para [`docs/SPRINTS_ARCHIVE.md`](./SPRINTS_ARCHIVE.md), sem resumo nem corte de
> conteúdo, para manter este arquivo enxuto — ver a Tabela Resumo abaixo, com link direto para a
> seção de cada sprint concluída no arquivo histórico. Itens novos só entram neste documento depois
> de passar pelos agentes auditores relevantes (`requirements-auditor`, `security-auditor`,
> `database-auditor`, `backend-auditor`, `test-auditor`) e serem aprovados explicitamente pelo
> usuário — ver [`DEFINITION_OF_DONE.md`](./DEFINITION_OF_DONE.md). Sprints concluídas (no arquivo
> histórico) descrevem o que **já aconteceu**, com evidência de commit (`git log`) ou verificação
> independente registrada na própria seção — não são planejadas retroativamente, só documentadas
> para dar ao [`sprint-planner`](../.claude/agents/sprint-planner.md) um formato de referência e
> uma noção real de velocidade do time. Sprints abaixo com status "📋 Planejada" ou "🟢 Em
> Execução" ainda não têm nenhum critério de aceite confirmado — a implementação e a marcação como
> Concluída são responsabilidade do `implementation-agent` executando e do usuário aprovando, nunca
> deste planner sozinho.

---

## Tabela Resumo — Sprints Concluídas (1–8)

Detalhamento integral (escopo entregue, critérios de aceite, execução confirmada, achados
colaterais, notas de processo) em [`docs/SPRINTS_ARCHIVE.md`](./SPRINTS_ARCHIVE.md).

| # | Título | Status | Conclusão | Entrega em uma frase |
|---|---|---|---|---|
| 1 | [Fundação Multi-tenant](./SPRINTS_ARCHIVE.md#sprint-1-fundação-multi-tenant) | ✅ Concluída | 2026-08-11 | Hierarquia `Organization→Client→AgentAuth→Device`, PostgreSQL único, RBAC de 4 papéis. |
| 2 | [Coleta Ampliada e Valor Operacional](./SPRINTS_ARCHIVE.md#sprint-2-coleta-ampliada-e-valor-operacional) | ✅ Concluída | 2026-08-12 a 2026-08-17 | Postura de segurança, métricas, periféricos, patrimônio, relatórios, alertas, comandos remotos. |
| 3 | [Distribuição, Confiabilidade e Correções de Agregação](./SPRINTS_ARCHIVE.md#sprint-3-distribuição-confiabilidade-e-correções-de-agregação) | ✅ Concluída | 2026-08-17 a 2026-08-18 | Distribuição unificada do agente (Windows+Linux), correção de bug de agregação recorrente, rate limiting. |
| 4 | [Performance & UX](./SPRINTS_ARCHIVE.md#sprint-4-performance-ux) | 🟢 Concluída | 2026-08-20 | Vulnerabilidade crítica de isolamento multi-tenant corrigida, bug de contagem offline em relatórios, UX/performance. |
| 5 | [Consolidação de Rotas](./SPRINTS_ARCHIVE.md#sprint-5-consolidação-de-rotas) | 🟢 Concluída | 2026-08-31 | Rename `/tenant→/app` e `/clients→/admin/clients` com redirect 308, lint real ativado. |
| 6 | [Débito Técnico Residual](./SPRINTS_ARCHIVE.md#sprint-6-débito-técnico-residual) | 🟢 Concluída | 2026-08-24 | Decisão de não consolidar as 4 telas de listagem, hydration mismatch corrigido, teste de RN013, revogação centralizada de `AgentAuth`. |
| 7 | [Paridade de Status em `/servers`](./SPRINTS_ARCHIVE.md#sprint-7-paridade-de-status-em-servers) | 🟢 Concluída | 2026-08-24 | `/servers` corrigida para usar status efetivo em vez de `device.status` bruto. |
| 8 | [Cobertura de Teste dos Guards Fundamentais + Paridade da Allowlist](./SPRINTS_ARCHIVE.md#sprint-8-cobertura-de-teste-dos-guards-fundamentais-paridade-da-allowlist-de-comandos) | 🟢 Concluída | sem data explícita registrada no texto original (antes de 2026-08-31, ver nota de reativação da Sprint 5) | Teste unitário dos guards de RBAC/isolamento multi-tenant, paridade da allowlist de comandos servidor↔agente Go, correção de documentação. |

**Nota sobre os anchors acima**: calculados pelo algoritmo padrão de slug (minúsculas, remoção de
pontuação/crase/`—`/`&`/`+`/`/`, espaços colapsados em hífen). Não confirmados contra um renderer
específico (GitHub vs. VSCode podem diferir em casos de acento/hífen duplo) — se algum link não
saltar para a seção correta, o texto do heading em `docs/SPRINTS_ARCHIVE.md` é a fonte de verdade;
seria só uma questão de o navegador/editor mostrar o `#anchor` diferente, o conteúdo em si não sai
do lugar.

---

## Sprint 9 — Webhook de Disponibilidade/Disco e Métricas em Tempo Real

**Status**: 🟢 Concluída (2026-09-01). Executada pelo `implementation-agent` (interrompido uma vez
por limite de sessão da API já próximo do fim — retomado e finalizado pela sessão principal, que
também corrigiu 3 pequenos erros de verificação encontrados na retomada, listados abaixo) e
verificada de forma independente: `npx tsc --noEmit` limpo, `npm run lint` limpo (regra real,
2 erros `react-hooks/purity` — `Date.now()` chamado direto no corpo de `app/app/[clientSlug]/
assets/[id]/page.tsx` e `app/portal/devices/[id]/page.tsx` — corrigidos extraindo para função de
módulo `computeCheckinLatencyMinutes`, mesmo padrão já usado na Sprint 5), `npm run build` com a
rota nova `/api/tenant/[clientSlug]/devices/[deviceId]/metrics` presente, `npm run test` com
**156/156** passando (24 arquivos). Um erro de `tsc` em `tests/checkin-availability-reconciliation.
test.ts:303` (cast de tupla sem passar por `unknown`) também foi corrigido na retomada.

**A.1 — Webhook piggyback** (`lib/availability-alerts.ts`, novo): `reconcileAvailabilityEvents`
varre todos os dispositivos do `clientId` a cada check-in de qualquer um deles, abrindo/resolvendo
`AlertEvent` sintético (`ruleId: null`, `metric: 'device_offline'`/`'low_disk'`) e disparando webhook
via `lib/alert-webhook.ts` (extraído do caminho reativo original, que ficou intocado — confirmado
por leitura direta: `previousDevice.status !== nextStatus` continua a única condição do disparo
reativo). O dispositivo que acabou de fazer check-in é pulado na checagem de disco (evita duplicar o
caminho reativo), mas continua avaliado para `device_offline` (resolve evento aberto se voltou a
coletar). Chamado dentro de `app/api/agent/checkin/route.ts` com `.catch()` próprio — uma falha na
reconciliação nunca derruba o check-in do agente.

**A.3 — Métricas de saúde com polling**: `components/device-detail-tabs.tsx` ganhou polling
client-side de 60s (`METRICS_POLL_INTERVAL_MS`, justificado no código: o ciclo real de coleta é
~10min, 60s só evita precisar dar F5) contra a nova rota `GET /api/tenant/[clientSlug]/devices/
[deviceId]/metrics`. **Decisão registrada, não uma migration silenciosa**: "versão do agente" foi
omitida do card de saúde — não existe campo no schema que persista esse valor por dispositivo hoje
(o `agentVersion` do payload de check-in só é usado para decidir `updateAvailable`, depois
descartado); adicionar exigiria migration nova, que a sprint pediu explicitamente para não decidir
sozinho. Fica como decisão pendente do usuário, não implementada nesta sprint.

HEAD do repositório no momento deste planejamento: `9fdfe2f` (Sprint 5 concluída —
rename `/tenant`→`/app`, `/clients`→`/admin/clients`, lint real ativo, 132/132 testes), mais
commits de UX posteriores já citados no `git log` (`5acf610` mais recente, 111/111 testes citados
no commit — divergência de número de testes entre `9fdfe2f` e `5acf610` não investigada por este
planner, é anterior ao escopo desta sprint).

**Objetivo**: fechar o pedido literal do usuário de notificação automática por webhook ao exceder o
limiar de horas offline ou de espaço em disco crítico (A.1), mais uma visão de métricas do agente que
se atualiza sozinha na tela de detalhe do dispositivo (A.3).

**Origem**: pedido literal do usuário nesta sessão (2026-08-31), citando RF015/RN014 (automação de
ações por alerta) e RNF008 (métricas de saúde do agente em tempo real) — ver discrepância de IDs
registrada abaixo.

**Discrepância registrada antes de qualquer coisa, não corrigida por este planner**: os RF/RN citados
pelo usuário não batem com `docs/PRODUCT.md` §1–2, conferido linha a linha nesta rodada:
- **RF015**, hoje, é "Ciclo de vida de alertas" — `AlertEvent` abre na transição condição-ok →
  condição-problema e resolve na transição inversa. Não é sobre webhook. O requisito que de fato
  cobre notificação por webhook é **RF016** ("Webhooks... disparado fire-and-forget... quando o
  status do dispositivo transiciona de/para alerta"), e o limiar em si é **RF014** ("Alertas
  configuráveis... limiares fixos por `Client` (disco, RAM, horas offline) que alimentam... o
  webhook").
- **RN014**, hoje, é sobre o guard de edição de `AssetRecord` (`canManageAssetRecord` delega a
  `canOperateTenant`) — sem nenhuma relação com alertas.
- **RNF008**, hoje, é "Portal (`CLIENT_VIEWER`) tem shell e componentes próprios, sem compartilhar
  layout administrativo com `/app/*`" — sem nenhuma relação com métricas ou tempo real. **Nenhuma**
  RNF numerada em `docs/PRODUCT.md` cobre hoje "métricas em tempo real" — é requisito novo, sem ID
  (ver A.3 abaixo).

Este plano usa os RF/RN corretos onde existem (RF014/RF016 para A.1) e registra a ausência de ID para
A.3. Quem aprovar decide se os IDs citados pelo usuário eram um lapso, ou se `docs/PRODUCT.md`
deveria ganhar RF/RN novos para os itens sem cobertura — atualizar `docs/PRODUCT.md` fica fora da
permissão de escrita deste planner.

**Decisões do usuário sobre o escopo desta sprint (2026-08-31), fechando os pontos em aberto da
revisão anterior**:
1. **Separação de blocos**: aprovada. Esta sprint (9) passa a conter só o que era o Bloco A reduzido
   (A.1 + A.3). O que era o Bloco B (16 itens de cobertura de teste) virou a
   **Sprint 10 — Cobertura de Teste dos Gaps Estruturais**, seção própria logo abaixo desta, com o
   mesmo conteúdo técnico, só renumerado (1–16 em vez de B.1–B.16) e reformatado no padrão de seção
   de sprint deste documento.
2. **Mecanismo de A.1**: decidido **piggyback no checkin** (a opção que este planner já havia
   recomendado como MVP na revisão anterior). A alternativa de cron externo foi descartada para esta
   sprint — deixa de ser uma bifurcação em aberto, é a arquitetura confirmada. Ver A.1 abaixo, sem
   mais linguagem condicional.
3. **Canal de e-mail (A.2)**: adiado. A Sprint 9 entrega só webhook (A.1) e métricas em tempo real
   (A.3). A.2 deixa de ser item executável desta sprint e vira uma nota curta de item futuro, sem
   número de sprint — ver nota logo após A.3, antes dos critérios de aceite gerais.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| A.1 — Webhook: fechar o gap de "offline além de `alertOfflineHours`" e unificar disco crítico em `AlertEvent` | RF014, RF016 (usuário citou RF015/RN014 — ver discrepância acima) | 3.6(a) | `Client`, `Device`, `AlertEvent` | pedido literal do usuário |
| A.3 — Métricas de saúde do agente com auto-atualização na tela de detalhe | sem RF/RN — gap novo (usuário citou RNF008, que hoje cobre outra coisa) | 3.3 (tangencial) | `MetricSample` | pedido literal do usuário |

### A.1 — Webhook: fechar o gap de "offline além de `alertOfflineHours`" e unificar disco crítico em `AlertEvent`

**Objetivo**: garantir que um dispositivo que ultrapassa o limiar de horas offline do tenant, ou cujo
disco cai abaixo do limiar crítico, gere uma notificação por webhook e um registro de histórico
(`AlertEvent`) — hoje só a segunda metade (disco, de forma indireta) funciona parcialmente, e a
primeira (offline) não funciona na prática para um dispositivo que realmente parou de reportar.

**Achado (confirmado nesta rodada, lendo o código, não assumido)**: o mecanismo de webhook já existe
— `Client.alertWebhookEnabled`/`alertWebhookUrl` (schema já tem esses campos, nenhuma migration
necessária para isso), configurável via `saveTenantAlertSettingsAction`
(`components/tenant-alert-settings-form.tsx`, ação em `app/app/[clientSlug]/computers/actions.ts`), e
disparado fire-and-forget (timeout 4s) em `app/api/agent/checkin/route.ts:294-325`. **Mas** esse
disparo só roda como efeito colateral de UM checkin do PRÓPRIO dispositivo: compara
`previousDevice.status` (antes desta requisição) com `nextStatus` (calculado nesta requisição, via
`deriveInventoryIssues`/`alertOfflineHours` em `lib/inventory-alerts.ts`) e só dispara se algum dos
dois for `'warning'`. Um dispositivo que **para de fazer checkin** (o cenário literal de "excedeu
`alertOfflineHours`") nunca gera uma nova requisição — nada re-executa esse código depois que o
último checkin aconteceu. A própria UI já documenta esse limite: "Os webhooks são disparados apenas
em transições de status crítico durante o check-in" (`tenant-alert-settings-form.tsx:128`). Para
disco crítico (`alertDiskThresholdGb`), o mecanismo já funciona de forma reativa — dispara quando o
PRÓPRIO dispositivo, ao fazer checkin, reporta disco baixo — mas nunca cria um `AlertEvent`, ficando
sem rastro no histórico da tela `/app/[clientSlug]/alerts`, diferente do catálogo de 4 métricas de
segurança (`AlertRule`/`reconcileAlertEvents`, `lib/alert-rules.ts`), que tem histórico completo mas
**nunca** dispara webhook. `docs/PRODUCT.md` §3.6 já documenta essa bifurcação como design
intencional ("Dois fluxos distintos, com guards diferentes") — este item não a desfaz, só estende o
fluxo (a) para cobrir o caso que falta (offline de um dispositivo silencioso) e alinha seu rastro de
histórico ao padrão já usado pelo fluxo (b).

**Requisitos Afetados**:
- RF014 (limiares fixos por `Client` que alimentam o webhook), RF016 (webhook fire-and-forget na
  transição de status).
- Caso de uso 3.6(a) (`docs/PRODUCT.md`) — o fluxo já documentado, que este item estende sem mudar o
  guard (`canManageTenantAlerts`) nem os campos de configuração existentes.
- Entidade(s) de banco: `Client` (`alertWebhookEnabled`, `alertWebhookUrl`, `alertOfflineHours`,
  `alertDiskThresholdGb` — todos já existentes, nenhuma migration nova), `Device` (`updatedAt`/coleta
  mais recente), `AlertEvent` (reaproveitado com `ruleId: null` para os eventos sintéticos de
  disponibilidade/disco — o campo já é opcional no schema, nenhuma migration nova).

**Arquitetura confirmada (2026-08-31): piggyback no checkin, sem cron externo**. Não existe hoje
nenhuma infraestrutura de job agendado/cron neste projeto — `RNF007` já documenta isso explicitamente
("o expurgo de `MetricSample` roda inline... o projeto ainda não tem onde rodar um cron"), e esta
investigação confirmou: nenhum `vercel.json` com bloco `crons`, nenhuma dependência tipo `node-cron`,
nenhum worker separado. O usuário confirmou a abordagem de piggyback (já recomendada por este planner
como MVP na revisão anterior) — a alternativa de cron externo (nova rota protegida por secret de
header, agendada pela plataforma de hospedagem) foi descartada para esta sprint, não é mais uma
decisão em aberto.

Implementação: dentro de `POST /api/agent/checkin`, depois de persistir o dispositivo que checou,
rodar uma reconciliação (`reconcileAvailabilityEvents(clientId)`, novo módulo sugerido
`lib/availability-alerts.ts`, mesmo padrão de `reconcileAlertEvents`) para **todos** os dispositivos do
mesmo `clientId` — não só o que fez checkin agora —, calculando `ageHours` de cada um (mesma lógica de
`getDevicePresence`) e abrindo/resolvendo um `AlertEvent` sintético (`metric: 'device_offline'`,
`ruleId: null`) quando um dispositivo cruza `alertOfflineHours`; e outro (`metric: 'low_disk'`) usando
o `alertDiskThresholdGb` do mesmo jeito, mas para os dispositivos que **não** são o que acabou de
checar (o que checou já é coberto pelo caminho reativo existente — este item só estende para os
*demais* dispositivos do cliente, evitando duplicar lógica). O webhook fire-and-forget existente é
extraído para uma função comum e chamado sempre que um desses eventos abre ou resolve.

**Limite conhecido e aceito desta abordagem, não um bug escondido**: só varre o cliente quando ALGUM
dispositivo daquele cliente faz checkin. Um cliente com um único dispositivo, ou uma frota inteira que
fica muda ao mesmo tempo, nunca dispara a varredura — o alerta de "ficou offline" nunca chega nesse
caso específico, porque nenhuma requisição nova re-executa o código depois do último checkin. Precisa
ficar documentado na própria UI de configuração (texto de ajuda) e no `docs/PRODUCT.md` (fora da
permissão de escrita deste planner, citado como consequência). A alternativa de cron externo resolveria
esse limite, mas foi descartada para esta sprint (ver decisão do usuário acima); pode voltar a ser
avaliada no futuro se o limite se mostrar um problema real em produção — não é item desta sprint.

**Critérios de aceite**:
- [ ] Um dispositivo sem coleta há mais que `alertOfflineHours` do seu `Client` gera um `AlertEvent`
      sintético (`metric: 'device_offline'`) na próxima vez que **qualquer** dispositivo do mesmo
      `Client` fizer checkin — confirmado por teste automatizado com dispositivos sintéticos.
- [ ] O mesmo `AlertEvent` é resolvido (`resolvedAt` preenchido) quando o dispositivo volta a coletar
      dentro do limiar, sem duplicar linha enquanto a condição persiste — mesmo padrão de
      `reconcileAlertEvents`.
- [ ] Um dispositivo cujo disco cai abaixo de `alertDiskThresholdGb` gera um `AlertEvent`
      (`metric: 'low_disk'`) mesmo quando **não** é o dispositivo que fez o checkin que disparou a
      varredura — cobrindo o caso hoje não coberto (o caminho reativo do próprio dispositivo já
      funcionava e continua funcionando, sem alteração).
- [ ] O webhook fire-and-forget dispara sempre que um desses dois `AlertEvent`s sintéticos abre ou
      resolve, reaproveitando `Client.alertWebhookEnabled`/`alertWebhookUrl`, sem duplicar o disparo já
      existente para o dispositivo que fez o checkin original.
- [ ] `/app/[clientSlug]/alerts` (`prisma.alertEvent.findMany`, já existente) passa a exibir também os
      eventos sintéticos de disponibilidade/disco no histórico, sem nenhuma alteração de query além do
      que já existe (o componente já itera `AlertEvent` genericamente).
- [ ] O limite conhecido da abordagem piggyback (cliente com um único dispositivo, ou frota inteira
      muda) está documentado como texto de ajuda visível na UI de configuração de alertas.
- [ ] Nenhuma mudança de comportamento no caminho reativo já existente (webhook do próprio dispositivo
      que faz checkin) — protegido por teste de regressão comparando o payload/condições de disparo
      antes e depois deste item.

**Testes Necessários**:
- Teste unitário de `reconcileAvailabilityEvents` (sem Prisma real — entrada sintética, mesmo padrão
  de `tests/device-report.test.ts`/`tests/permissions.test.ts`): dispositivo que cruza
  `alertOfflineHours` abre evento; dispositivo que volta a coletar resolve; dispositivo já com evento
  aberto não duplica linha num segundo ciclo.
- Teste equivalente para disco crítico, incluindo o caso de um dispositivo diferente do que fez o
  checkin sendo pego pela varredura.
- Teste de integração da rota de checkin confirmando que a varredura roda para o `clientId` inteiro
  (mock de múltiplos `Device`s do mesmo cliente), com o webhook mockado (sem chamada de rede real).
- Teste de regressão: o caminho reativo original (webhook do próprio dispositivo que checou) continua
  dependendo apenas de `previousDevice.status !== nextStatus`, sem nova duplicata de disparo quando a
  varredura também identifica o mesmo dispositivo.

---

### A.3 — Métricas de saúde do agente com auto-atualização na tela de detalhe

**Objetivo**: fazer a aba de métricas de `DeviceDetailTabs` (gráfico Recharts de CPU/RAM/disco/uptime,
`components/device-detail-tabs.tsx`) se atualizar sozinha em intervalos curtos, sem exigir reload
manual da página — hoje os dados são um retrato estático do momento em que a página carregou (Server
Component, `app/app/[clientSlug]/assets/[id]/page.tsx:78-88`, consulta `prisma.metricSample.findMany`
uma vez, `take: 500`).

**Achado**: `MetricSample` já é ingerida pelo agente a cada ~10 minutos (RF011, ciclo independente do
checkin de 1h), mas não existe hoje nenhuma rota de API autenticada por sessão que devolva amostras
recentes de um dispositivo para consumo do lado do cliente — a única rota de métricas existente
(`app/api/agent/metrics/route.ts`) é autenticada por `X-Api-Key` do agente (protocolo de ingestão, não
de leitura por usuário). Não existe nenhuma infraestrutura de WebSocket/Server-Sent Events/polling no
projeto hoje (busca confirmada nesta rodada: nenhum `setInterval`/`EventSource`/`WebSocket` em
`components/`).

**Decisão de escopo a confirmar (RISCO menor que A.1/A.2, mas ainda uma decisão)**: "tempo real"
tomado literalmente (sub-segundo, push) não é sustentável neste stack sem introduzir infraestrutura
nova (WebSocket exigiria um servidor com estado teria problemas com múltiplas réplicas — o mesmo
tipo de limite que `RNF010` já documenta para `lib/rate-limit.ts`) e, mais importante, **não faria
diferença real**: o agente só produz uma amostra nova a cada ~10 minutos, então nenhum mecanismo de
transporte mais rápido que isso mostraria dado novo com mais frequência. Este planner recomenda que
"tempo real" seja entregue como **auto-atualização por polling client-side** (ex.: a cada 60s,
reaproveitando a mesma consulta do carregamento inicial via uma nova rota leve de API, sem WebSocket),
o que cobre o objetivo prático (não precisar recarregar a página manualmente) sem introduzir
infraestrutura nova. Quem aprovar a sprint confirma esse enquadramento ou pede algo diferente.

**Requisitos Afetados**:
- Sem RF/RN numerado hoje — gap novo, a registrar em `docs/PRODUCT.md` se aprovado (fora da permissão
  de escrita deste planner).
- Caso de uso 3.3 (Check-in do agente) tangencia o ciclo de métricas, mas não cobre a experiência de
  visualização — gap de caso de uso a registrar, mesma classe de gap já citada nas Sprints 4-7 para
  RF019/RF020.
- Entidade(s) de banco: `MetricSample` (só leitura, nenhuma migration).

**Proposta de escopo técnico**:
- Nova rota `GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics`, sessão + `requireTenantContext`
  + `canAccessTenant` (mesmo padrão de guard das outras rotas tenant-scoped), devolvendo as amostras
  mais recentes (mesmo `take`/`orderBy` já usado na página).
- Componente client (`'use client'`) envolvendo o gráfico existente, com `setInterval`/`fetch` a cada
  60s (intervalo configurável, mas não exposto como configuração de usuário nesta sprint — fixo no
  código), atualizando o estado local sem recarregar a página; parar o polling quando a aba não está
  visível (`document.visibilityState`) para não gerar tráfego desnecessário.
- Nenhuma mudança na ingestão (`POST /api/agent/metrics`) nem no ciclo do agente.

**Critérios de aceite**:
- [ ] Nova rota `GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics` responde só para sessões com
      `canAccessTenant` sobre o tenant do dispositivo — confirmado por teste (um `ORG_ADMIN` de outra
      organização recebe `404`, mesmo padrão de `requireTenantContext`, nunca `403`).
- [ ] A aba de métricas em `DeviceDetailTabs` atualiza os dados exibidos sem reload manual da página,
      em um intervalo definido (recomendado 60s) — confirmado por teste de componente
      (`vi.useFakeTimers`, avançando o relógio e confirmando nova chamada de `fetch`).
- [ ] O polling para quando a aba/página não está visível (`document.visibilityState !== 'visible'`) e
      retoma quando volta a ficar visível.
- [ ] Nenhuma mudança no formato de `DeviceMetricSample` nem no gráfico Recharts existente — só a fonte
      dos dados passa a se atualizar.

**Testes Necessários**:
- Teste de integração da nova rota: dispositivo do tenant correto retorna amostras; dispositivo de
  outro tenant retorna `404`.
- Teste de componente do wrapper de polling com temporizador falso, confirmando refetch periódico e
  pausa quando a aba fica invisível.

---

### A.2 — Canal de e-mail (item futuro, fora do escopo desta sprint)

Adiado pelo usuário nesta rodada (2026-08-31) — não faz parte do escopo executável da Sprint 9. Não
existe hoje **nenhuma** dependência de envio de e-mail instalada (`package.json` conferido nesta
rodada — sem `nodemailer`, `resend`, `@aws-sdk/client-ses`, ou qualquer equivalente), nenhuma
variável de ambiente de SMTP/API key documentada, e nenhum campo em `Client` para habilitar e-mail ou
guardar destinatário(s) — precisaria de migration nova (`alertEmailEnabled Boolean`, `alertEmailTo
String?`) e de um provedor confirmado (SMTP genérico via `nodemailer`? Resend? SES? algo já
contratado pela organização fora deste repositório?), decisão de produto/infraestrutura que este
planner não toma sozinho. **Candidato futuro, aguardando decisão de provedor de e-mail** — não
numerado em nenhuma sprint ainda; entra no planejamento quando o provedor for decidido.

---

### Critérios de aceite gerais da sprint

- [ ] A.1 concluído com a arquitetura piggyback (sem cron externo) implementada e coberta por teste.
- [ ] A.3 concluído com o enquadramento de "tempo real" (polling client-side, ~60s) confirmado pelo
      usuário, e coberto por teste.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npm run test` sem erro novo, cobrindo os
      testes de A.1 e A.3 descritos em cada item.
- [ ] `docs/PRODUCT.md` — decisão registrada sobre se ganha RF/RN novos para A.1 (extensão do webhook)
      e A.3 (métricas em tempo real), e sobre a discrepância de IDs citada no início desta seção —
      atualização do documento em si fica fora da permissão de escrita deste planner.
- [ ] Critérios de aceite específicos de A.1 e A.3 aprovados pelo usuário antes de qualquer sprint
      subsequente reaproveitar o mesmo achado.

### Fora de escopo desta sprint

A rota de cron externa para A.1 — descartada nesta rodada (decisão travada: piggyback), não é mais
uma opção em aberto para esta sprint (pode voltar a ser avaliada no futuro se o limite conhecido da
abordagem piggyback se mostrar um problema real em produção). O canal de e-mail (A.2) inteiro —
adiado, não é "rejeitado", é item futuro sem data (ver nota acima); qualquer UI de configuração de
e-mail fica sem sentido enquanto A.2 não for retomado. Também fora de escopo: expandir o polling de
métricas (A.3) para qualquer tela além da aba de detalhe de um único dispositivo (ex.: dashboard
agregado com auto-atualização) — escopo literal foi a tela de detalhe. Também fora de escopo:
qualquer mudança de comportamento do fluxo (b) de alertas (catálogo `AlertRule` de segurança) — o
catálogo de 4 métricas continua fechado, sem adicionar quinta métrica; cobertura de teste desse fluxo
é o item 8 da Sprint 10. Também fora de escopo: consolidar os dois fluxos de alerta (limiares fixos
vs. `AlertRule`) num único mecanismo — `docs/PRODUCT.md` §3.6 já documenta a bifurcação como design
intencional, e este plano só estende o fluxo (a), não o funde com o (b).

---

## Sprint 10 — Cobertura de Teste dos Gaps Estruturais

**Status**: 🟢 Concluída (2026-09-01). Os 16 itens foram divididos em 4 grupos independentes de
`implementation-agent`, executados em paralelo (mesmo padrão da Sprint 6), e verificados de forma
independente pela sessão principal depois: `npx tsc --noEmit` limpo, `npm run lint` limpo, `npm run
build` limpo, `npm run test` com **296/296 passando** (41 arquivos, 18 novos), confirmado estável em
duas rodadas seguidas. Confirmado por `grep` que nenhum teste mocka `lib/permissions.ts`,
`lib/tenant-context.ts` ou `lib/portal-context.ts` — os guards centrais são sempre exercitados de
verdade, conforme exigido explicitamente pelo usuário.

**Achados registrados durante a execução (não são regressão, são gaps/decisões para avaliação
futura)**:
- `createClientAction` (`app/admin/clients/actions.ts`) **não grava `AuditLog`** na criação de um
  cliente — diferente de `rotateEnrollmentKeyAction`/`revokeAgentAuthAction` no mesmo arquivo, que
  gravam. Documentado por teste que prova o comportamento atual (não um critério de aceite exigindo
  o log). Candidato a item de sprint futura.
- Item 13 (RNF002) já estava implementado corretamente no código (`AgentCheckLog` grava motivos
  distintos para JSON malformado vs. schema inválido) — não era gap real, só faltava o teste.
- Item 6 (dedupe de `UsbDevice`): não vive no schema Zod nem na rota de checkin — vive no agente Go
  (`agent-go/internal/collectors/windows/peripherals.go`). Sem teste Go escrito nesta sprint (fora do
  escopo Vitest desta execução); candidato a item de cobertura Go separado.
- `lib/auth-credentials.ts` (novo) — `authorizeCredentials` extraída de `auth.ts` para viabilizar
  teste direto do fluxo de login (item 3); `next-auth` não expõe o `authorize` passado para
  `CredentialsProvider` de um jeito testável sem contornar problemas de resolução ESM do próprio
  pacote. Comportamento idêntico, `tsc`/`build` confirmam que o login não quebrou.

Seção desmembrada numa revisão anterior (2026-08-31) do que era o "Bloco B" dentro da antiga
Sprint 9 — mesmo conteúdo técnico, reestruturado no padrão de seção de sprint deste documento e
renumerado (1–16 em vez de B.1–B.16), por decisão explícita do usuário de separar as duas frentes de
trabalho.

**Objetivo**: fechar 17 gaps de cobertura de teste sobre RF/RN já implementados no código, mapeados
numa Auditoria Geral de Conformidade do `requirements-auditor` nesta mesma sessão (2026-08-31), antes
da Sprint 5.

**Origem**: 17 achados do `requirements-auditor`, rodado sozinho (sem `security-auditor`/
`database-auditor`/`backend-auditor`/`test-auditor` sobre este escopo específico nesta rodada) numa
Auditoria Geral de Conformidade — rastreabilidade explícita: se algum dos outros 4 auditores rodar
sobre esses mesmos 17 pontos antes da execução, a priorização abaixo pode mudar.

**Nota de honestidade sobre a investigação deste planner**: este planner confirmou nesta rodada os
caminhos de arquivo pós-rename da Sprint 5 citados em cada item abaixo (`lib/schemas/
agent-checkin.ts`, `agent-metrics.ts`, `asset-record.ts`; `app/app/[clientSlug]/assets/[id]/
actions.ts`; `app/users/page.tsx`; `lib/portal-context.ts`; `lib/rate-limit.ts`; `auth.ts`) lendo o
código real, não copiando cego o texto do pedido. Não releu, porém, o conteúdo interno linha a linha
de cada um dos 17 pontos nesta passada (ex.: não conferiu o valor exato do limite de 2.000 itens em
`agent-checkin.ts`, nem o texto exato dos motivos gravados em `AgentCheckLog`) — os achados abaixo são
os que o `requirements-auditor` já registrou nesta sessão; se algo tiver mudado desde então, cabe a
uma nova auditoria pontual antes da execução, não a este planner.

Os 16 itens abaixo (mais a nota de RN001) vêm dos 17 gaps mapeados pelo `requirements-auditor` nesta
sessão — RF/RN implementados no código, sem nenhum teste automatizado. Ordenados aqui por risco de
segurança/isolamento primeiro (itens 1, 2), depois os demais na ordem em que o achado foi apresentado.
Nenhum destes itens corrige um bug conhecido de produção — são gaps de cobertura sobre código que, até
onde as auditorias desta sessão apuraram, já funciona corretamente; se a escrita do teste revelar um
bug real, isso vira um achado novo a registrar, não presumido aqui.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1 — RF021: `getPortalContext`/`requirePortalDevice`, incluindo vazamento entre clientes | RF021, RNF004 | 3.9 | `Client`, `Device` | `requirements-auditor` |
| 2 — RF023: `/users` (escopo por role, sentinela `ORG_ADMIN` sem `organizationId`) | RF023, RN004 | 3.7 | `User` | `requirements-auditor` |
| 3 — RF001: fluxo de login (`CredentialsProvider.authorize`, `bcrypt.compare`) | RF001 | 3.10 | `User` | `requirements-auditor` |
| 4 — RF002: `createClientAction` (`app/admin/clients/actions.ts`) | RF002 | 3.1 | `Client`, `Organization` | `requirements-auditor` |
| 5 — RF003/RF004/RF011: rotas `register`/`checkin`/`metrics` do agente | RF003, RF004, RF011 | 3.2, 3.3 | `AgentAuth`, `Device`, `MetricSample` | `requirements-auditor` |
| 6 — RF005–RF010, RF012: schemas Zod de coleta (limite 2.000 itens, dedupe `UsbDevice`) | RF005–RF010, RF012 | 3.3 | `Software`, `UsbDevice`, e demais 1:N do check-in | `requirements-auditor` |
| 7 — RF013: `saveAssetRecordAction` (guard, schema, reconfirmação de tenant) | RF013 | 3.8 | `AssetRecord` | `requirements-auditor` |
| 8 — RF015/RF016: ciclo de vida de `AlertEvent` + disparo de webhook (overlap com Sprint 9 A.1) | RF015, RF016 | 3.6 | `AlertRule`, `AlertEvent`, `Client` | `requirements-auditor` |
| 9 — RF017: `enqueueDeviceCommandAction`, claim atômico, `commands/pending`, `commands/[id]/result` | RF017 | 3.5 | `AgentCommand` | `requirements-auditor` |
| 10 — RF020: as 4 rotas HTTP de relatório (CSV/PDF × tenant/portal) | RF020 | — (gap de caso de uso já registrado nas Sprints 4–7) | `Device` e agregados | `requirements-auditor` |
| 11 — RF022: cobertura de `AuditLog` (comandos, `AssetRecord`, exclusão de `Device`, login/logout) | RF022, RNF009 | transversal | `AuditLog` | `requirements-auditor` |
| 12 — RF024: verificação SHA-256 do auto-update (lado servidor) | RF024 | 3.3 | — | `requirements-auditor` |
| 13 — RNF002: `AgentCheckLog` com motivo distinto (JSON malformado vs. schema inválido) | RNF002 | 3.3 | `AgentCheckLog` | `requirements-auditor` |
| 14 — RNF006: idempotência do upsert por `agentAuthId` (reenvio de check-in) | RNF006 | 3.3 | `Device`, `Hardware` | `requirements-auditor` |
| 15 — RNF007: expurgo inline de `MetricSample` por `metricsRetentionDays` | RNF007 | — | `MetricSample` | `requirements-auditor` |
| 16 — RNF010: `lib/rate-limit.ts` (Map em memória) | RNF010 | 3.2, 3.3 | — | `requirements-auditor` |
| Nota — RN001: constraints de banco (`@unique`, `Cascade` `AgentAuth→Device`) | RN001 | — | `AgentAuth`, `Device` | `requirements-auditor` (não verificável por Vitest — domínio do `database-auditor`) |

#### 1 — RF021: `getPortalContext`/`requirePortalDevice`, incluindo vazamento entre clientes

**Objetivo**: provar, com teste direto (sem depender de nenhuma página específica do portal), que o
contexto do portal do cliente final nunca resolve um dispositivo de um `Client` diferente do da
sessão — o caso mais crítico de toda a Sprint 10, por ser o único ponto de acesso do papel
`CLIENT_VIEWER`.

**Requisitos Afetados**: RF021 (portal do cliente, contexto derivado exclusivamente da sessão), RNF004
(chokepoint de isolamento — mesmo princípio de `requireTenantContext`, aplicado ao portal). Caso de
uso 3.9. Entidade(s): `Client`, `Device`, `User`.

**Critérios de aceite**:
- [ ] Teste isolado (mock de sessão/Prisma, sem banco real, mesmo padrão de
      `tests/tenant-context.test.ts`) prova que `requirePortalDevice(deviceId, clientId)` rejeita um
      `deviceId` pertencente a um `Client` diferente do `clientId` da sessão.
- [ ] Teste cobre `getPortalContext` resolvendo corretamente a partir da sessão (`CLIENT_VIEWER`),
      nunca de parâmetro de URL — confirmando que não existe nenhum caminho de bypass via slug/id na
      querystring.
- [ ] Teste de regressão explícito para o "caso crítico de vazamento entre clientes": um `deviceId`
      válido de outro `Client` não deve nunca aparecer em nenhuma resposta do portal.

**Testes Necessários**: novo arquivo `tests/portal-context.test.ts` (ou equivalente), mockando `auth()`
e `prisma`, mesmo padrão de `tests/tenant-context.test.ts`.

#### 2 — RF023: `/users` (escopo por role, sentinela `ORG_ADMIN` sem `organizationId`)

**Requisitos Afetados**: RF023 (gestão de usuários — tela somente leitura), RN004 (RBAC de 4 papéis).
Caso de uso 3.7. Entidade(s): `User`.

**Critérios de aceite**:
- [ ] Teste confirma que `/users` (`app/users/page.tsx`) responde `notFound()` para `ORG_OPERATOR`/
      `CLIENT_VIEWER`, nunca `403` — mesmo padrão dos outros chokepoints.
- [ ] Teste cobre o caso sentinela: um `ORG_ADMIN` sem `organizationId` preenchido (estado
      inconsistente, mas possível de existir na coluna `String` livre) não vê usuários de nenhuma
      organização — filtro fail-closed, não fail-open.

**Testes Necessários**: teste de integração/componente da página, mockando sessão nos 4 papéis mais o
caso sentinela.

#### 3 — RF001: fluxo de login (`CredentialsProvider.authorize`, `bcrypt.compare`)

**Requisitos Afetados**: RF001. Caso de uso 3.10. Entidade(s): `User`.

**Critérios de aceite**:
- [ ] Teste cobre `authorize()` (`auth.ts`) com credenciais válidas retornando o usuário; credenciais
      inválidas (senha errada, e-mail inexistente) retornando `null`, nunca lançando exceção que
      vaze detalhe de qual dos dois campos errou (evitar oráculo de existência de e-mail).
- [ ] Teste confirma que `bcrypt.compare` é de fato chamado (não comparação de string direta) —
      verificação manual durante a implementação: trocar temporariamente por comparação direta e
      confirmar que o teste não pega a regressão seria o oposto do desejado; o teste deve **falhar**
      se a comparação deixar de usar hash.

**Testes Necessários**: novo arquivo `tests/auth-login.test.ts`, mockando `prisma.user.findUnique` e
`bcrypt.compare`.

#### 4 — RF002: `createClientAction` (`app/admin/clients/actions.ts`)

**Requisitos Afetados**: RF002, RN015 (guard `hasClientsAdminAccess`). Caso de uso 3.1. Entidade(s):
`Client`, `Organization`.

**Critérios de aceite**:
- [ ] Teste cobre criação bem-sucedida por `PLATFORM_ADMIN`/`ORG_ADMIN` (`hasClientsAdminAccess`).
- [ ] Teste confirma rejeição para `ORG_OPERATOR`/`CLIENT_VIEWER`.
- [ ] Teste confirma que `enrollmentKeyHash` é gravado como hash (nunca a chave em claro no banco),
      mesmo padrão de verificação já usado para `AgentAuth.apiKeyHash`.

**Testes Necessários**: novo arquivo `tests/create-client.test.ts`, mesmo padrão de mock de
`tests/rotate-enrollment-key.test.ts`.

#### 5 — RF003/RF004/RF011: rotas `register`/`checkin`/`metrics` do agente

**Requisitos Afetados**: RF003 (enrollment), RF004 (check-in), RF011 (métricas). Caso de uso 3.2, 3.3.
Entidade(s): `AgentAuth`, `Device`, `MetricSample`.

**Critérios de aceite**:
- [ ] Teste de rota de `POST /api/agent/register`: chave de provisionamento válida cria `AgentAuth`;
      chave inválida/expirada rejeita.
- [ ] Teste de rota de `POST /api/agent/checkin`: `X-Api-Key` válida persiste `Device`; inválida
      retorna `401`/`403`; payload malformado não persiste nada (ver também item 13).
- [ ] Teste de rota de `POST /api/agent/metrics`: amostra válida persiste `MetricSample`; chave
      inválida rejeita.
- [ ] Todos os três cobertos por rate limiting (RNF010/RNF001) — ver overlap com item 16, não duplicar
      asserção de rate limit aqui, só confirmar que a rota chama o guard.

**Testes Necessários**: 3 arquivos (ou um arquivo por rota) de teste de integração de rota, com Prisma
mockado, mesmo padrão dos testes de Server Action já existentes.

#### 6 — RF005–RF010, RF012: schemas Zod de coleta

**Requisitos Afetados**: RF005–RF010 (hardware, rede, disco, software, segurança, contas locais),
RF012 (periféricos). Caso de uso 3.3. Entidade(s): `Software`, `UsbDevice`, e demais 1:N do check-in.

**Critérios de aceite**:
- [ ] Teste confirma que `agentCheckinSchema` rejeita mais de 2.000 itens de software (limite citado
      pelo achado original — valor exato a confirmar contra `lib/schemas/agent-checkin.ts` no início
      da implementação, não presumido por este planner).
- [ ] Teste confirma o dedupe de `UsbDevice` por VID+PID+serial (hubs filtrados), mesmo comportamento
      já documentado em RF012.
- [ ] Teste cobre pelo menos um caso de payload válido mínimo e um caso de payload claramente inválido
      por seção (hardware, rede, disco, software, segurança, contas locais, periféricos).

**Testes Necessários**: novo arquivo `tests/agent-checkin-schema.test.ts` (ou equivalente),
sem Prisma — validação pura de schema Zod com entrada sintética.

#### 7 — RF013: `saveAssetRecordAction` (guard, schema, reconfirmação de tenant)

**Requisitos Afetados**: RF013, RN009 (`AssetRecord.deviceId` único), RN014 (guard
`canManageAssetRecord`/`canOperateTenant`). Caso de uso 3.8. Entidade(s): `AssetRecord`.

**Critérios de aceite**:
- [ ] Teste confirma que `ORG_OPERATOR` consegue salvar `AssetRecord` (RN014 documenta esse papel como
      permitido, mais permissivo que `canManageTenant`).
- [ ] Teste confirma que um ator de outra organização é bloqueado, sem escrita no banco.
- [ ] Teste confirma que `assetRecordSchema` rejeita payload inválido antes de qualquer escrita.
- [ ] Teste confirma reconfirmação de tenant (o `deviceId` pertence ao `clientSlug` da URL) — mesmo
      princípio de isolamento já testado em outras actions.

**Testes Necessários**: novo arquivo `tests/save-asset-record.test.ts`.

#### 8 — RF015/RF016: ciclo de vida de `AlertEvent` + disparo de webhook

**Nota de sobreposição com a Sprint 9 (A.1), registrada explicitamente**: este item **não** deve ser
implementado como tarefa duplicada se A.1 for aprovada e executada — os testes que A.1 já exige
(`reconcileAvailabilityEvents`, disparo de webhook) cobrem a maior parte deste gap. O que sobra aqui,
independente de A.1, é a cobertura do fluxo (b) já existente (`reconcileAlertEvents`,
`lib/alert-rules.ts`, catálogo de 4 métricas de segurança) — que hoje **também** não tem nenhum teste
automatizado, e não depende de nenhuma decisão de arquitetura em aberto.

**Requisitos Afetados**: RF015 (ciclo de vida de `AlertEvent`), RF016 (webhook). Caso de uso 3.6.
Entidade(s): `AlertRule`, `AlertEvent`, `Client`.

**Critérios de aceite**:
- [ ] Teste de `reconcileAlertEvents` (`lib/alert-rules.ts`): condição ok→problema abre `AlertEvent`;
      problema→ok resolve; condição persistente entre dois check-ins não duplica linha.
- [ ] Teste cobre os 4 metrics do catálogo (`antivirus_inactive`, `firewall_inactive`, `uac_inactive`,
      `bitlocker_missing`) retornando `null` (não apurado) sem disparar nem resolver nada.
- [ ] Se A.1 for executada antes deste item: os testes de webhook para offline/disco já ficam cobertos
      lá — este item não os repete, só referencia.

**Testes Necessários**: novo arquivo `tests/alert-rules.test.ts`, sem Prisma — entrada sintética.

#### 9 — RF017: `enqueueDeviceCommandAction`, claim atômico, `commands/pending`, `commands/[id]/result`

**Requisitos Afetados**: RF017. Caso de uso 3.5. Entidade(s): `AgentCommand`.

**Nota**: `tests/agent-command-allowlist-parity.test.ts` (Sprint 8) já cobre a paridade estática da
allowlist — este item cobre o **fluxo real** (enfileirar, reivindicar, reportar resultado), que ainda
não tem teste.

**Critérios de aceite**:
- [ ] Teste confirma que `enqueueDeviceCommandAction` grava `AgentCommand` com status `pending` e
      `expiresAt` = +15min, guardada por `canOperateTenant`, com `AuditLog` (`command.enqueue`).
- [ ] Teste confirma o claim atômico em `GET /api/agent/commands/pending`: duas requisições
      concorrentes pelo mesmo comando nunca reivindicam a mesma linha duas vezes (`UPDATE ... WHERE
      status = 'pending'`, perder a corrida devolve `null`).
- [ ] Teste confirma expiração automática de comando vencido não reivindicado a tempo.
- [ ] Teste confirma `POST /api/agent/commands/[id]/result` grava o resultado e `AuditLog`
      (`command.result`).

**Testes Necessários**: novo arquivo `tests/agent-commands-flow.test.ts`.

#### 10 — RF020: as 4 rotas HTTP de relatório (CSV/PDF × tenant/portal)

**Requisitos Afetados**: RF020. Entidade(s): `Device` e agregados (`lib/reports/device-report.ts`).

**Critérios de aceite**:
- [ ] Teste de rota para cada uma das 4 rotas (`/api/tenant/[clientSlug]/reports/{csv,pdf}`,
      `/api/portal/reports/{csv,pdf}`) confirmando guard correto (sessão + `canAccessTenant` para
      tenant; `getPortalContext` para portal) e formato de resposta (`content-type` correto).
- [ ] Teste confirma que as 4 rotas reaproveitam a mesma função de agregação
      (`lib/reports/device-report.ts`), sem duplicar cálculo — já coberto indiretamente pelos testes
      de `device-report.test.ts`/`device-report-rn013.test.ts`, este item cobre a camada HTTP em si.

**Testes Necessários**: novo arquivo `tests/report-routes.test.ts`.

#### 11 — RF022: cobertura de `AuditLog` (comandos, `AssetRecord`, exclusão de `Device`, login/logout)

**Nota de sobreposição, registrada explicitamente**: as asserções de `AuditLog` para comandos (item 9)
e `AssetRecord` (item 7) devem ser adicionadas **dentro** dos testes desses itens, não duplicadas aqui.
Este item cobre o que sobra: exclusão de `Device` e login/logout, que não têm item próprio acima.

**Requisitos Afetados**: RF022, RNF009 (auditabilidade — cobertura depende de cada ação chamar
`recordAuditLog()` explicitamente, sem garantia estrutural). Entidade(s): `AuditLog`, `Device`, `User`.

**Critérios de aceite**:
- [ ] Teste confirma que excluir um `Device` (`app/app/[clientSlug]/assets/[id]/actions.ts`) grava
      `AuditLog` (`device.delete`) com `targetId`/`clientId` corretos.
- [ ] Teste confirma que login bem-sucedido e logout geram `AuditLog`, se essa gravação já existir no
      código — se não existir, este item registra o gap como achado novo (ausência de auditoria de
      login/logout), não presume que o código já faz isso.

**Testes Necessários**: extensão de teste existente de exclusão de `Device` (se houver) ou novo
arquivo; teste de login/logout condicionado à confirmação de que a gravação existe no código.

#### 12 — RF024: verificação SHA-256 do auto-update (lado servidor)

**Requisitos Afetados**: RF024. Caso de uso 3.3. Entidade(s): nenhuma (binário servido por rota).

**Critérios de aceite**:
- [ ] Teste confirma que `getAgentBinarySha256()` (usado em `app/api/agent/checkin/route.ts`) calcula
      o hash correto do binário servido, e que o campo `updateMetadata` só é preenchido quando
      `isOutdated` é verdadeiro.

**Testes Necessários**: novo teste unitário/integração cobrindo o cálculo do hash com um arquivo de
teste sintético (não o binário real de produção).

#### 13 — RNF002: `AgentCheckLog` com motivo distinto (JSON malformado vs. schema inválido)

**Requisitos Afetados**: RNF002. Caso de uso 3.3. Entidade(s): `AgentCheckLog`.

**Critérios de aceite**:
- [ ] Teste confirma que um corpo de requisição que não é JSON válido grava `AgentCheckLog` com um
      motivo (ex.: `invalid_json`) distinguível do motivo gravado para JSON válido mas que falha a
      validação Zod (ex.: `schema_validation_failed`) — os dois nunca devem gravar o mesmo texto de
      motivo.

**Testes Necessários**: teste de rota de `POST /api/agent/checkin` com os dois tipos de payload
inválido, inspecionando a linha gravada em `AgentCheckLog`.

#### 14 — RNF006: idempotência do upsert por `agentAuthId` (reenvio de check-in)

**Requisitos Afetados**: RNF006. Caso de uso 3.3. Entidade(s): `Device`, `Hardware`.

**Critérios de aceite**:
- [ ] Teste confirma que reenviar o mesmo payload de check-in duas vezes não cria um segundo `Device`
      (upsert por `agentAuthId`), e que `CollectionLog.create()` gera uma segunda linha de log (insert
      puro, não upsert) — os dois comportamentos diferentes, no mesmo teste.

**Testes Necessários**: extensão do teste de rota de checkin (item 5) ou arquivo próprio.

#### 15 — RNF007: expurgo inline de `MetricSample` por `metricsRetentionDays`

**Requisitos Afetados**: RNF007. Entidade(s): `MetricSample`.

**Critérios de aceite**:
- [ ] Teste confirma que uma amostra mais antiga que `metricsRetentionDays` do `Client` é removida na
      ingestão seguinte de `POST /api/agent/metrics` (expurgo inline, não job separado — mesmo texto
      já documentado em RNF007).
- [ ] Teste confirma que amostras dentro do período de retenção não são tocadas.

**Testes Necessários**: teste de rota de `POST /api/agent/metrics` com amostras sintéticas de idades
diferentes.

#### 16 — RNF010: `lib/rate-limit.ts` (Map em memória)

**Requisitos Afetados**: RNF010, RNF001. Caso de uso 3.2, 3.3. Entidade(s): nenhuma.

**Critérios de aceite**:
- [ ] Teste unitário confirma que o limitador bloqueia após N requisições na janela configurada, e
      libera depois que a janela expira (com `vi.useFakeTimers`, sem depender de tempo real de
      execução do teste).
- [ ] Teste confirma isolamento por chave (`agentAuthId` pós-auth ou IP pré-auth) — duas chaves
      diferentes não compartilham o mesmo contador.
- [ ] Teste documenta (não corrige — já é limite conhecido e aceito) que o `Map` é por processo, não
      compartilhado entre réplicas — nenhuma asserção sobre múltiplas réplicas, só uma nota no teste.

**Testes Necessários**: novo arquivo `tests/rate-limit.test.ts`.

### Nota — RN001: constraints de banco (fora de escopo de Vitest)

RN001 (`@unique`, `Cascade` de `AgentAuth→Device`, e demais constraints do schema) não é verificável
por teste automatizado em JavaScript/Vitest — é comportamento do PostgreSQL em si, checável por
inspeção do `schema.prisma`/migrations reais ou por teste de integração com banco real (fora do
padrão hoje usado pela suíte, que mocka Prisma). Este é o domínio do `database-auditor`, não desta
Sprint 10 — registrado aqui só para não ser esquecido, não como item de sprint a implementar via
Vitest.

---

### Critérios de aceite gerais da sprint

- [ ] Os 16 itens (1–16) cobertos por teste automatizado, sem sobreposição duplicada com a Sprint 9
      (A.1) nos itens 8/9/11 (overlap resolvido conforme nota em cada item).
- [ ] Nenhum item desta sprint corrigiu um bug de produção sem antes registrá-lo como achado novo — a
      premissa é que o código já funciona, só falta teste; se isso se provar falso durante a
      implementação, o achado entra no relatório de execução, não é corrigido silenciosamente sem
      registro.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npm run test` sem erro novo, com o total
      de testes crescendo em pelo menos 16 arquivos novos (um por item desta sprint, aproximadamente).
- [ ] Critérios de aceite específicos de cada item aprovados pelo usuário antes de qualquer sprint
      subsequente reaproveitar o mesmo achado.

### Fora de escopo desta sprint

Qualquer mudança de comportamento do fluxo (b) de alertas (catálogo `AlertRule` de segurança) além de
cobri-lo por teste (item 8) — o catálogo de 4 métricas continua fechado, sem adicionar quinta métrica.
Também fora de escopo: consolidar os dois fluxos de alerta (limiares fixos vs. `AlertRule`) num único
mecanismo — `docs/PRODUCT.md` §3.6 já documenta a bifurcação como design intencional; a Sprint 9 (A.1)
só estende o fluxo (a), não o funde com o (b). Também fora de escopo: rodar uma auditoria completa dos
5 agentes sobre os 17 gaps desta sprint antes de aprová-la — as auditorias foram as que já rodaram
nesta sessão (`requirements-auditor` sozinho); se o usuário quiser uma rodada adicional de
`security-auditor`/`test-auditor` especificamente sobre o item 1 (o de maior risco, dado que é sobre
isolamento entre clientes do portal) antes de aprovar, isso é uma decisão a tomar separadamente, não
incluída por este planner.

---

## Sprint 11 — Painel de Webhooks, `agentVersion` e AuditLog em `createClientAction`

**Status**: 🟢 Concluída (2026-09-01). Execução direta aprovada pelo usuário nesta conversa, sem fase
de planejamento separada (`sprint-planner` não rodou antes da implementação, só depois, para este
registro e para o Backlog). Commit: `6f20150`.

**Atualização (2026-09-01, mesma conversa)**: os 3 achados de segurança abertos na auditoria abaixo
(SSRF ALTO, limite de endpoints MÉDIO, secret em texto plano BAIXO) foram **corrigidos** mediante
aprovação explícita do usuário — ver detalhe em cada achado na seção "Auditoria de segurança" e nos
itens 5/6/7 do Backlog.

### Escopo entregue

| Item | Entrega | RF/RN | Testes |
|---|---|---|---|
| A — Painel de Webhooks | `WebhookEndpoint` (múltiplos endpoints por tenant, filtro por evento, assinatura HMAC-SHA256, header `X-Webhook-Signature`), página `/app/[clientSlug]/settings`, guardada por `canManageTenantAlerts` | RF026, RN016 (novos) | `tests/webhook-endpoints.test.ts` (9 testes) |
| B — `agentVersion` | `Device.agentVersion` (schema aplicado via `prisma db push`, backup prévio `prisma/backups/pre-sprint11-20260901085402.sql`), persistido no check-in a partir de `body.agentVersion`, exibido no card de saúde | RF027 (novo) | `tests/device-detail-tabs-metrics-polling.test.tsx`, `tests/tenant-device-metrics-route.test.ts` (atualizados) |
| C — AuditLog em `createClientAction` | `recordAuditLog('client.create', ...)` dentro da mesma transação, mesmo padrão de `rotateEnrollmentKeyAction`/`revokeAgentAuthAction` — fecha o gap 1 do Backlog (ver seção abaixo, item removido do Backlog) | RF002 (existente, comportamento corrigido) | `tests/create-client-action.test.ts` (2 testes novos) |

**Correções técnicas aplicadas antes/durante a execução** (documentadas para rastreabilidade, não são
desvio silencioso):
- `secret` armazenado em texto plano (`WebhookEndpoint.secret`), não `secretHash` como o pedido
  original citava — HMAC exige o segredo de volta a cada disparo para recalcular a assinatura; um
  hash é unidirecional e não serve para assinar nada. Gerado sempre no servidor
  (`crypto.randomBytes(32)`), nunca aceito de formulário.
- Itens A e B executados por um único `implementation-agent` (não 3 agentes totalmente paralelos como
  o pedido sugeria) porque os dois alteram `prisma/schema.prisma` e exigem migration — rodar em
  paralelo real arriscaria dois processos editando o schema/gerando migration ao mesmo tempo. Item C
  rodou isolado em paralelo, sem tocar nesses arquivos.
- Schema aplicado via `npx prisma db push` (não `prisma migrate dev`, que o pedido original citava) —
  o projeto nunca teve `prisma/migrations/` rastreado; `migrate dev` pela primeira vez forçaria uma
  decisão de baseline arriscada contra o banco de desenvolvimento real. Seguido o padrão já
  estabelecido no projeto (backup `pg_dump` antes de `db push`, mesmo padrão de 4 backups anteriores
  já existentes em `prisma/backups/`).
- IDs de requisito corrigidos: o pedido original citava "RF024/RN016" e "RF025" para as duas novas
  entregas, mas RF024 (auto-update do agente) e RF025 (coleta multiplataforma) já existiam em
  `docs/PRODUCT.md` para outra coisa. Registrado como **RF026/RN016** (webhooks) e **RF027**
  (`agentVersion`) — RN016 não colidia, só os dois RF citados.

### Verificação (independente, sessão principal, não só autorrelato dos agentes)
1. `npx tsc --noEmit` — limpo.
2. `npm run lint` — limpo (regra real).
3. `npm run build` — sucesso, `/app/[clientSlug]/settings` presente na listagem de rotas.
4. `npm run test` — **306/306 passando** (42 arquivos), confirmado estável em duas rodadas seguidas.
5. Confirmado diretamente no banco (`npx prisma db pull --print`) que `Device.agentVersion` e o model
   `WebhookEndpoint` foram de fato aplicados, não só declarados no schema local.
6. Lógica de assinatura HMAC (`lib/webhook-endpoints.ts`) e guard da página/actions
   (`canManageTenantAlerts`, reaproveitado corretamente) revisados linha a linha pela sessão principal
   antes do commit.

### Auditoria de segurança (`security-auditor`, rodada após o commit `6f20150`)

**✅ Validado sem ressalva**: isolamento por tenant em `WebhookEndpoint` (todas as operações —
create/update/toggle/dispatch/leitura — escopadas por `clientId` derivado do contexto de sessão,
nunca de input do formulário; padrão anti-oráculo consistente); geração e proteção do `secret`
(256 bits, servidor-only, nunca logado em `AuditLog`, nunca reexibido em texto pleno depois da
criação); assinatura HMAC-SHA256 (secret por endpoint, corpo assinado idêntico ao corpo enviado,
sem transformação entre os dois); adequação do guard `canManageTenantAlerts` (já é a faixa mais
restritiva disponível abaixo de `PLATFORM_ADMIN`, correta para uma superfície que envolve enviar
dados de dispositivo a um destino externo escolhido pelo usuário); persistência de `agentVersion`
(sem superfície de injeção nova, string exibida como texto JSX puro, sem `dangerouslySetInnerHTML`).

**✅ Achado 1 — ALTO — SSRF — CORRIGIDO (2026-09-01)**: `app/app/[clientSlug]/settings/actions.ts`
(schemas `createSchema`/`updateSchema`, campo `url: z.string().url()`) não validava protocolo nem
destino da URL do webhook — nenhum bloqueio de `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`,
`192.168.0.0/16`, `169.254.0.0/16` (metadata de cloud), `::1`, `fc00::/7`. O servidor
(`lib/webhook-endpoints.ts`, `dispatchClientWebhookEndpoints`) chama `fetch(endpoint.url, ...)`
automaticamente e de forma recorrente (a cada evento de dispositivo cadastrado), não como ação
pontual supervisionada. Um `ORG_ADMIN` (nível já correto pelo guard, mas ainda assim capaz disso)
podia cadastrar um endpoint apontando para a rede interna ou para metadata de cloud e receber
requisições POST indefinidamente. **Correção**: guard centralizado
`lib/webhook-url-guard.ts#checkWebhookUrlSafety` — só aceita `https:`, resolve o hostname
(`dns.promises.lookup(..., { all: true })`) e rejeita se qualquer IP resolvido cair nas faixas
privadas/loopback/link-local/metadata listadas acima (IPv4 e IPv6), além de `localhost` e IP literal
bloqueado direto (sem round-trip de DNS). Aplicado em DOIS pontos: (a) `createSchema`/`updateSchema`
via `superRefine` assíncrono, feedback imediato no formulário; (b) **de novo, a cada disparo**, em
`dispatchClientWebhookEndpoints`, imediatamente antes de cada `fetch` — a proteção real contra DNS
rebinding, já que (a) sozinho não pega um hostname que resolvia para IP público no cadastro e foi
trocado para IP interno depois. Falha em (b) não dispara, loga (`console.error`) e não derruba o
restante do fan-out nem o check-in. Prova: `tests/webhook-url-guard.test.ts` (guard isolado, 12
casos incl. hostname que resolve via DNS mockado para IP privado) e
`tests/webhook-endpoints.test.ts` (integração com a action e com o dispatch, incl. DNS rebinding
simulado entre cadastro e disparo).

**✅ Achado 2 — MÉDIO — sem limite de endpoints por tenant — CORRIGIDO (2026-09-01)**:
`createWebhookEndpointAction` não impunha teto de quantidade nem rate limit. Combinado com o Achado
1, permitia cadastrar dezenas de endpoints apontando para portas diferentes de um mesmo host interno,
funcionando como primitivo de port-scan/DoS via fan-out de `fetch` simultâneo a cada evento.
**Correção**: limite de 20 `WebhookEndpoint` por `clientId`, contando TODOS (ativos ou não — contar
só os ativos permitiria contornar o limite desativando e recriando), checado dentro da mesma
transação da criação (`tx.webhookEndpoint.count`) para não haver corrida entre a contagem e o
`create`. Acima do limite, retorna erro sem escrever no banco. Prova:
`tests/webhook-endpoints.test.ts` ("limite de endpoints por tenant" — cria até 20 com sucesso, o 21º
é rejeitado sem alterar `endpoints.size`; e um segundo caso confirmando que desativar todos não
libera o limite).

**✅ Nota — BAIXO — secret em texto plano em repouso — CORRIGIDO (2026-09-01)**: necessário para HMAC
(raciocínio já documentado no código está correto — um hash não serviria), mitigado antes só por
mascaramento na UI, não por criptografia em repouso. **Correção**: núcleo AES-256-GCM de
`lib/provisioning-credentials.ts` extraído/generalizado para `lib/encrypted-secret.ts`
(`encryptJsonSecret`/`decryptJsonSecret`, aceita qualquer payload serializável + um `keySalt` por
domínio de segredo); `lib/webhook-endpoints.ts` ganhou `encryptWebhookSecret`/`decryptWebhookSecret`
reaproveitando esse núcleo com `keySalt` próprio. `WebhookEndpoint.secret` continua `String` no
schema (sem migration) — só o conteúdo passou a ser o payload cifrado serializado; decifrado
somente no momento do disparo (`dispatchClientWebhookEndpoints`) e na leitura mascarada da página de
configurações (`app/app/[clientSlug]/settings/page.tsx`, decifra antes de `maskWebhookSecret`).
**Dado existente**: tabela `webhook_endpoints` conferida vazia no banco de dev nesta sessão (`0`
linhas) — sem dado em texto plano pra migrar/limpar. Prova: `tests/webhook-endpoints.test.ts` (secret
persistido é cifrado — `created.secret !== result.secret` —, decifra de volta para o mesmo valor, e o
disparo decifra corretamente antes de assinar, com paridade de HMAC contra o secret original).

---

## Backlog — Achados Pendentes

Itens abaixo **não** são sprints numeradas e **não** têm status "Planejada"/"Em execução" — são
achados já confirmados contra o código atual (verificados nesta rodada, 2026-09-01), registrados
para avaliação/decisão futura. Nenhum é bug bloqueante de produção; cada um depende de uma decisão
de escopo (adicionar uma gravação, escrever um teste numa linguagem fora do padrão da suíte, ou
decidir se vale uma migration nova) que este planner não toma sozinho. Entram numa sprint numerada
quando alguém aprovar explicitamente o escopo.

### 1. `createClientAction` não grava `AuditLog` na criação de cliente — ✅ RESOLVIDO (Sprint 11, 2026-09-01)

**Origem**: achado durante a execução da Sprint 10 (cobertura de teste dos gaps estruturais,
concluída no commit `77610fd`), reportado pelo `implementation-agent` do grupo responsável pelo
item 4 (RF002).

**Achado**: em `app/admin/clients/actions.ts`, `rotateEnrollmentKeyAction` e `revokeAgentAuthAction`
gravam `AuditLog` via `recordAuditLog` (confirmado nesta rodada, linhas 237 e 325). `createClientAction`
(linhas 110–184) não grava — a transação cria `Client` e persiste a chave de provisionamento, mas
nenhuma chamada a `recordAuditLog` acontece no caminho de sucesso. Isso é uma violação de RNF009 (toda
mutação sensível deve gravar `AuditLog`). `tests/create-client-action.test.ts` já existe e documenta o
comportamento atual (sem asserção exigindo o log — só prova o estado real, não é um teste que falha por
causa disso).

**Por que fica pendente**: não é um bug de fluxo (a criação de cliente funciona) — é uma lacuna de
auditabilidade, pequena e isolada, que o `implementation-agent` que a encontrou deliberadamente não
corrigiu por estar fora do escopo daquela sessão (que era escrever teste, não mudar comportamento).
Candidato: adicionar `recordAuditLog` dentro da mesma transação de `createClientAction`, seguindo o
padrão já estabelecido nas outras duas actions do mesmo arquivo, e atualizar o teste existente para
exigir o log.

### 2. Dedupe de `UsbDevice` vive só no agente Go, sem cobertura de teste no lado TS/Vitest

**Origem**: achado durante a execução da Sprint 10, reportado pelo `implementation-agent` do grupo
responsável pelo item 6 (RF005–RF010, RF012 — schemas Zod de coleta).

**Achado**: a lógica real de dedupe de periféricos USB por VID+PID+serial está em
`agent-go/internal/collectors/windows/peripherals.go`, função `collectUsbDevices` (confirmado nesta
rodada: `seen := make(map[string]bool, ...)` na linha 217, chave `vendorId + productId + serial` na
linha 229, filtro de hubs via `usbHubServices` na linha 181). O schema Zod
(`lib/schemas/agent-checkin.ts`) só valida a forma do array recebido, sem aplicar nem verificar dedupe;
a rota de checkin persiste o array como veio do agente. Não foi escrito teste Go para
`collectUsbDevices` durante a Sprint 10 porque a função está fortemente acoplada a uma consulta WMI
real (`Win32_PnPEntity`), não mockável sem refatoração — decisão de escopo registrada no momento,
não um esquecimento.

**Por que fica pendente**: é uma decisão de escopo de teste (introduzir Go test + possível
refatoração para isolar a função de parse/dedupe da consulta WMI, ou aceitar formalmente que a
cobertura fica só documentada e não testada), não um bug — o comportamento em produção não foi
questionado por nenhum auditor. Candidato: ou um teste Go dedicado
(`agent-go/internal/collectors/windows/peripherals_test.go`, isolando `parseUsbDeviceID`/a lógica de
dedupe da consulta WMI em si), ou uma decisão explícita registrada de que a cobertura fica só no lado
Go por inspeção manual, fechando o item por documentação em vez de teste.

### 3. `authorizeCredentials` sem teste unitário isolado da função em si

**Origem**: achado durante a execução da Sprint 10, reportado pelo `implementation-agent` do grupo
responsável pelo item 3 (RF001 — fluxo de login).

**Achado**: `authorizeCredentials` (`lib/auth-credentials.ts`, extraída de `auth.ts` durante a Sprint
10 porque `next-auth` não expõe o `authorize` do `CredentialsProvider` de um jeito testável sem
contornar problemas de resolução ESM do próprio pacote) hoje só é exercitada indiretamente, via
`tests/auth-login.test.ts` (fluxo de login ponta a ponta) e `tests/auth-login-logout-audit-log.test.ts`
(AuditLog de login/logout — confirmado nesta rodada que ambos os arquivos existem e que nenhum teste
importa `authorizeCredentials` diretamente). Nenhum teste hoje isola a função em si (assinatura, tipos
de retorno, casos de borda que os testes de fluxo podem não cobrir por completo).

**Por que fica pendente**: os testes de fluxo existentes já cobrem o caminho principal (credenciais
válidas/inválidas, hash via `bcrypt.compare`) — não há evidência hoje de uma lacuna real de
comportamento, só ausência de teste unitário isolado da função. Candidato: teste unitário dedicado, a
escrever se uma auditoria futura (`test-auditor` ou `requirements-auditor`) confirmar que os testes de
fluxo existentes têm lacunas reais nos casos de borda dessa função especificamente.

### 4. Campo `agentVersion` no schema `Device` — requer migration Prisma — ✅ RESOLVIDO (Sprint 11, 2026-09-01)

**Origem**: achado da Sprint 9 (webhook piggyback + métricas de saúde do agente, item A.3, concluída
no commit `6c768bf`), registrado neste Backlog por pedido direto do usuário nesta conversa
(2026-09-01).

**Achado**: durante a Sprint 9 (A.3, métricas de saúde do agente com polling), descobriu-se que o
payload de check-in já carrega `agentVersion`, mas nenhum campo do schema Prisma persiste esse valor
por dispositivo — hoje ele só é usado transitoriamente para calcular `updateAvailable` na resposta do
check-in, depois descartado. `components/device-detail-tabs.tsx` (`DeviceHealth`) omite "versão do
agente" do card de saúde por causa disso, com a decisão documentada em comentário no próprio código
(confirmado nesta rodada, linhas 90–99: "'Versao do agente' foi deliberadamente OMITIDA aqui... —
adicionar isso exigiria migration nova, que a sprint pediu para nao decidir sozinho").

**Por que fica pendente**: é uma decisão de produto/schema (vale o custo de uma migration nova só para
exibir a versão do agente no card de saúde?), não um bug — o sistema funciona sem esse campo, e a
Sprint 9 já registrou explicitamente que não decidiria isso sozinha. Candidato: avaliar numa sprint
futura se `Device.agentVersion` (migration nova, campo opcional) vale o custo, e então popular o card
de saúde a partir do check-in seguinte à migration.

### 5. SSRF no cadastro de URL de `WebhookEndpoint` — ALTO — ✅ RESOLVIDO (2026-09-01)

**Origem**: `security-auditor`, auditoria da Sprint 11 rodada após o commit `6f20150` (2026-09-01).

**Achado**: `app/app/[clientSlug]/settings/actions.ts` (`createSchema`/`updateSchema`, campo
`url: z.string().url()`) aceitava qualquer URL sintaticamente válida, sem restringir protocolo nem
bloquear destinos internos (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
`169.254.0.0/16` — inclui metadata de cloud —, `::1`, `fc00::/7`). O servidor
(`lib/webhook-endpoints.ts`, `dispatchClientWebhookEndpoints`) chama `fetch(endpoint.url, ...)`
automaticamente a cada evento de dispositivo cadastrado — não é uma ação pontual do usuário, é um
gatilho recorrente e não supervisionado. Um `ORG_ADMIN` (o guard já é o correto — o achado não é de
autorização, é de validação de destino) podia cadastrar um endpoint apontando pra rede interna e
receber requisições POST indefinidamente.

**Resolução (aprovada explicitamente pelo usuário nesta conversa)**: `lib/webhook-url-guard.ts`
(`checkWebhookUrlSafety`) — só `https:`, resolve o hostname a cada chamada
(`dns.promises.lookup(..., { all: true })`) e bloqueia qualquer IP resolvido nas faixas acima (IPv4 e
IPv6), `localhost` e IP literal bloqueado sem round-trip de DNS. Aplicado em dois pontos: no Zod de
create/update (feedback imediato) e — a proteção real contra DNS rebinding — de novo em
`dispatchClientWebhookEndpoints`, imediatamente antes de cada `fetch`. Detalhe completo na seção
"Auditoria de segurança" da Sprint 11 acima. Prova: `tests/webhook-url-guard.test.ts` (12 casos) +
`tests/webhook-endpoints.test.ts` (integração, incl. DNS rebinding simulado).

### 6. Sem limite de `WebhookEndpoint` por tenant — MÉDIO — ✅ RESOLVIDO (2026-09-01)

**Origem**: `security-auditor`, mesma auditoria do item 5.

**Achado**: `createWebhookEndpointAction` não impunha teto de quantidade nem rate limit por
`clientId`. Combinado com o item 5, permitia cadastrar dezenas de endpoints apontando para portas
diferentes de um mesmo host interno, funcionando como primitivo de port-scan/DoS via fan-out de
`fetch` simultâneo a cada evento de dispositivo.

**Resolução**: limite de 20 `WebhookEndpoint` por `clientId`, contando TODOS (ativos ou não, pra não
permitir contornar desativando e recriando), checado dentro da mesma transação da criação. Acima do
limite, erro sem escrever no banco. Prova: `tests/webhook-endpoints.test.ts`, describe "limite de
endpoints por tenant".

### 7. `WebhookEndpoint.secret` em texto plano em repouso — BAIXO — ✅ RESOLVIDO (2026-09-01)

**Origem**: `security-auditor`, mesma auditoria dos itens 5 e 6.

**Achado**: necessário para HMAC (um hash não serviria — o servidor precisa do segredo de volta a
cada disparo para recalcular a assinatura). Mitigado antes só por mascaramento na UI
(`maskWebhookSecret`), não por criptografia em repouso.

**Resolução**: núcleo AES-256-GCM de `lib/provisioning-credentials.ts` generalizado para
`lib/encrypted-secret.ts` (aceita qualquer payload serializável + `keySalt` por domínio de segredo);
`lib/webhook-endpoints.ts` ganhou `encryptWebhookSecret`/`decryptWebhookSecret` reaproveitando esse
núcleo. `WebhookEndpoint.secret` continua `String` (sem migration) — só o conteúdo passou a ser o
payload cifrado; decifrado somente no disparo e na leitura mascarada da página de configurações.
Tabela `webhook_endpoints` conferida vazia no banco de dev nesta sessão — sem dado em texto plano pra
migrar. Prova: `tests/webhook-endpoints.test.ts` (secret persistido cifrado, decifra corretamente,
paridade de HMAC contra o secret original).
