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

## Sprint 12 — Blacklist de Software com Alerta/Webhook e Comandos Remotos em Lote

**Status**: 🟢 Concluída (2026-09-01). Execução direta aprovada pelo usuário nesta conversa (o próprio
usuário escreveu o escopo), sem fase de planejamento separada (`sprint-planner` não rodou antes da
implementação) — mesmo padrão da Sprint 11. Verificação independente do orquestrador (não só o
autorrelato do `implementation-agent`): `git status` conferido, `npx tsc --noEmit` limpo, `npm run lint`
limpo, `npm run build` limpo (14 rotas de tenant geradas, incluindo `/app/[clientSlug]/alerts`),
`npx vitest run` 361/361 estável em 2 execuções consecutivas, `npx prisma db pull --print` confirmando
`AlertRule.pattern`/`AlertEvent.metadataJson` aplicados no banco real (não só no `schema.prisma` local),
e revisão manual linha a linha de `bulkEnqueueDeviceCommandAction`, `lib/alert-rules.ts` e
`app/app/[clientSlug]/alerts/actions.ts` (escopo de tenant, guards de permissão, AuditLog).

### Escopo entregue

| Item | Entrega | RF/RN | Testes |
|---|---|---|---|
| 1 — Blacklist de software | Métrica `software_blacklisted` no catálogo de alertas (`lib/alert-rules.ts`), `AlertRule.pattern` (texto livre, ex: "uTorrent"/"AnyDesk"), comparação case-insensitive por `.includes()` contra `Software.nome` coletado no check-in, `AlertEvent.metadataJson` com `{ softwareNome, softwareVersao }`, webhook `device.warning` (`WebhookEndpoint`) disparado SÓ na abertura (transição ok→problema), painel `/app/[clientSlug]/alerts` estendido para cadastrar/remover regras desse tipo | RF014 (existente, catálogo de alertas de 4→5 métricas — `docs/PRODUCT.md` atualizado) | `tests/alert-rules.test.ts` (+16 casos), `tests/checkin-software-blacklist-webhook.test.ts` (3, integração da rota real), `tests/create-alert-rule-action.test.ts` (4) |
| 2 — Comandos remotos em lote | `bulkEnqueueDeviceCommandAction` (`app/app/[clientSlug]/computers/actions.ts`) — mesmo catálogo fechado de `lib/agent-commands.ts`, escopo estrito por tenant (ids fora do escopo ignorados silenciosamente), N `AgentCommand` + 1 `AuditLog` agregado (`command.bulk_enqueue`) numa única transação; checkboxes + barra flutuante (`components/bulk-command-bar.tsx`) em `components/tenant-computers-table.tsx` (`/computers`, `/assets`) e `components/tenant-servers-table.tsx` (`/servers`) | RF017 (existente, disparo em lote além do disparo unitário já coberto) | `tests/bulk-enqueue-command-action.test.ts` (9), `tests/tenant-computers-table.test.tsx` / `tests/tenant-servers-table.test.tsx` (+5 casos de seleção) |

### Modelos de banco alterados (2, ambos aditivos/nullable — `prisma db push`, sem `migrate dev`)

- `AlertRule.pattern String?` — texto livre da regra `software_blacklisted`; `null` para as outras 4
  métricas.
- `AlertEvent.metadataJson String?` — JSON serializado (mesmo padrão de `AuditLog.metadataJson`/
  `AgentCheckLog.detailsJson`, string, não coluna JSON nativa) com `{ softwareNome, softwareVersao }`;
  `null` para as demais métricas.

Backup prévio: `prisma/backups/pre-sprint12-20260901154753.sql` (`docker exec inventario-db pg_dump`,
458KB). Aplicado com `npx prisma db push --accept-data-loss` (nenhuma perda real — só colunas novas
nullable). Confirmado com `npx prisma db pull --print`: as duas colunas (`pattern` em `alert_rules`,
`metadataJson` em `alert_events`) apareceram no schema introspectado do banco real, não só no
`schema.prisma` local.

### Decisões técnicas (desvios documentados em relação ao pedido original do usuário)

1. **`canOperateTenant` reaproveitado, não recriado** — já existia em `lib/permissions.ts` com
   exatamente a semântica pedida (`canManageTenant` OR `isOrgOperator` do mesmo `organizationId`).
2. **Bulk action em `app/app/[clientSlug]/computers/actions.ts`** (arquivo existente), não em
   `app/app/[clientSlug]/devices/actions.ts` (não existe) — segue o padrão já estabelecido de
   `saveTenantAlertSettingsAction` no mesmo arquivo.
3. **Seleção múltipla implementada em DOIS componentes, não um só**: a suposição inicial era que
   `/servers` reusava `components/tenant-computers-table.tsx` (como `/computers` e `/assets` fazem via
   `showTypeColumn`) — verificado durante a implementação que `/servers` na verdade usa um componente
   separado e mais simples, `components/tenant-servers-table.tsx` (sem filtros/summary cards). Como o
   pedido original cobria explicitamente "tabela de computadores/servidores", a seleção múltipla foi
   adicionada aos DOIS componentes, compartilhando a mesma barra flutuante
   (`components/bulk-command-bar.tsx`) para não duplicar a lógica de disparo — só a lógica de seleção
   (checkbox por linha) precisou ser replicada, por viverem em componentes distintos.
4. **Resolução de device por `agentAuthId`, nunca por `deviceId` direto** — `AgentCommand` é indexado
   por `agentAuthId` (`Device.agentAuthId` é `@unique`). O bulk action resolve
   `prisma.device.findMany({ where: { id: { in: deviceIds }, ...getTenantDeviceWhere(tenantSlug) }, select: { id, hostname, agentAuthId, agentAuth: { clientId } } })`
   — mesmo padrão de `app/api/tenant/[clientSlug]/devices/[deviceId]/commands/route.ts` (rota de
   disparo unitário), usado aqui como referência direta.
5. **`deviceIds` fora do tenant: ignorados silenciosamente, não rejeita o lote inteiro** — decisão
   explícita (a alternativa documentada no pedido original). Um id de outro tenant misturado numa
   seleção legítima não derruba o disparo para os ids válidos; `AuditLog.metadata` registra
   `requestedCount`/`appliedCount`/`ignoredCount` para rastreabilidade. Erro só quando **nenhum**
   deviceId resolve dentro do tenant.
6. **Catálogo de comandos 100% reaproveitado** de `lib/agent-commands.ts`
   (`agentCommandInputSchema`/`toParamsJson`/`AGENT_COMMAND_TTL_MS`) — nenhum tipo de comando novo.
7. **Schema**: as duas colunas novas descritas acima, `db push` (não `migrate dev` — projeto nunca
   teve `prisma/migrations/` rastreado, mesmo padrão das Sprints 9/10/11), backup `pg_dump` antes via
   `docker exec inventario-db` (Postgres roda em container Docker neste ambiente, `pg_dump` não está
   no PATH do host).
8. **`lib/alert-rules.ts` estendido, não reescrito**: `evaluateAlertMetric` ganhou um 4º parâmetro
   opcional `context: { software, pattern }` (só lido pelo case `software_blacklisted`, os outros 4
   ignoram); `reconcileAlertEvents` ganhou `software?: SoftwareSnapshot[]` nos params e passou a
   **devolver a lista de `AlertEvent` recém-abertos nesta chamada** — necessário porque a função não
   tem `clientName`/`clientSlug` disponíveis para montar o payload do webhook sozinha, e não fazia
   sentido adicionar esses dois campos só para isso quando o caller (`checkin/route.ts`) já os tem.
   Regra com `pattern` nulo/vazio (malformada) é tratada como "não apurado" (`evaluateAlertMetric`
   devolve `null`, não dispara); lista de software vazia no check-in é um resultado válido "nada
   encontrado" (`firing: false`), nunca `null` — distinção coberta explicitamente em
   `tests/alert-rules.test.ts`.
9. **`app/api/agent/checkin/route.ts`**: o disparo do webhook por `software_blacklisted` é um caminho
   **independente** do bloco `statusTransitioned` pré-existente (que só cobre `warningIssues` de
   disco/RAM/coleta atrasada, nunca `AlertRule`) — uma máquina pode continuar com `status: 'online'` e
   ainda assim abrir um alerta de software proibido. Payload segue o mesmo formato de
   `statusTransitioned` (`event`, `tenant`, `device`, `collectedAt`), com um bloco `alert` no lugar de
   `issues` para carregar `metric`/`severity`/`message`/`metadata` do `AlertEvent`. Fire-and-forget
   (`void dispatchClientWebhookEndpoints(...)`), mesmo padrão já usado ali.
10. **`AuditLog` em `createAlertRuleAction`**: a ação de criar `AlertRule` não tinha auditoria antes
    desta sprint (só `deleteAlertRuleAction` tinha). Adicionada **restrita a `metric ===
    'software_blacklisted'`**, seguindo literalmente o escopo pedido — as outras 4 métricas continuam
    sem `AuditLog` na criação (mudar isso para elas também não fazia parte do pedido, ficaria como
    item de backlog se o usuário quiser).
11. **Confirmação de guard com login real nos 4 papéis — NÃO EXECUTADA end-to-end via browser**: o
    ambiente desta sessão não expõe uma ferramenta de automação de browser/E2E. Em vez disso, os
    guards reais (`canOperateTenant`/`canManageTenantAlerts`, sem mock) foram exercitados por testes de
    integração com sessão sintética para os 4 papéis (`tests/bulk-enqueue-command-action.test.ts`:
    ORG_OPERATOR e ORG_ADMIN autorizados, CLIENT_VIEWER e ator de outra organização bloqueados, sem
    nenhuma escrita no bloqueio). Login real via browser nos 4 usuários seed fica como verificação
    manual pendente antes do commit, se o usuário/orquestrador quiser confirmar visualmente.

### Verificação

1. `npx tsc --noEmit` — limpo.
2. `npm run lint` — limpo (regra real, `scripts/verification/run-lint.mjs`).
3. `npm run build` — sucesso; `/app/[clientSlug]/alerts`, `/app/[clientSlug]/computers`,
   `/app/[clientSlug]/servers`, `/app/[clientSlug]/assets` presentes na listagem de rotas.
4. `npm run test` — **361/361 passando** (46 arquivos), confirmado estável em duas rodadas seguidas.
5. Confirmado no banco real (`npx prisma db pull --print`) que `AlertRule.pattern` e
   `AlertEvent.metadataJson` foram de fato aplicados, não só declarados no schema local.
6. `go vet`/build cruzado do agente: **N/A** — esta sprint não tocou `agent-go/`.

---

## Sprint 13 — Relatórios Executivos em PDF, Metadados de Alerta e Cobertura dos 4 Papéis

**Status**: 🟢 Concluída (2026-09-02). Execução direta aprovada pelo usuário nesta conversa (o próprio
usuário escreveu o escopo, com 6 correções técnicas do orquestrador aplicadas antes da implementação —
ver seção própria abaixo), sem fase de planejamento separada, mesmo padrão das Sprints 11/12.

**Nota sobre o bloqueio de `npm run test` relatado pelo `implementation-agent`**: o agente reportou
`Error: Vitest failed to find the current suite` afetando toda a suíte (inclusive arquivos não tocados
por esta sprint) e, após investigação própria (`git stash`, variações de `--pool`, busca por issues
externas do Vitest), concluiu se tratar de um bug real de ambiente (Node `v24.13.0` + `vitest@4.1.11`)
sem correção disponível. **Verificação independente do orquestrador não reproduziu esse erro**:
`npx vitest run` executado 2x consecutivas nesta mesma máquina/ambiente passou limpo em ambas —
**402/402 testes, 48 arquivos**. Isso combina com um padrão de flakiness já visto repetidas vezes
nesta sessão (cache stale de `node_modules/.vite`/`.vitest` ou estado de processo de uma execução
anterior confundindo a auto-descoberta do Vitest), não uma incompatibilidade real de versão — o
diagnóstico do agente, embora bem investigado, não se sustentou na reverificação. `npx tsc --noEmit`,
`npm run lint` e `npm run build` também limpos.

### Escopo entregue

| Item | Entrega | Testes |
|---|---|---|
| 1 — Relatórios Executivos em PDF | `lib/reports/device-report.ts` estendido (não duplicado): `DeviceReportRow` ganhou `deviceType`, `antivirusAtualizado`, `bitlockerAtivo`, `criticalDisks`; `DeviceReportSummary` ganhou `computadores`/`servidores`, `securityCompliance` (BitLocker/antivírus/firewall, % sobre apurados) e `criticalDisks` achatado; `getBlacklistedSoftwareHistory` (novo, por tenant); `renderDeviceReportPdf` ganhou marca d'água vetorial "CONFIDENCIAL", 3 seções novas (Conformidade de Segurança, Discos Críticos, Softwares Não Autorizados) e `Resumo de Ativos` com contagem por tipo — as duas rotas (`/api/tenant/[clientSlug]/reports/pdf`, `/api/portal/reports/pdf`) chamam a mesma função-fonte, ganham a melhoria automaticamente | `tests/device-report-sprint13.test.ts` (novo, 16 casos), `tests/device-report.test.ts`/`tests/device-report-rn013.test.ts` (fixtures atualizadas), `tests/report-routes.test.ts` (mock de `alertEvent` adicionado; os 2 testes de PDF já existentes cobrem o critério de aceite "Content-Type: application/pdf + 200") |
| 2 — Metadados de alerta (`software_blacklisted`) | `lib/alert-rules.ts`: `SoftwareSnapshot.editor` (opcional), `evaluateAlertMetric` grava `softwareEditor` no metadata, `parseSoftwareBlacklistMetadata` (novo, parse defensivo); `app/api/agent/checkin/route.ts` repassa `software.editor`; `app/app/[clientSlug]/alerts/page.tsx` seleciona `metric`/`metadataJson` e renderiza bloco destacado (nome/versão/editor) para `software_blacklisted` | `tests/alert-rules.test.ts` (+7 casos, incl. `parseSoftwareBlacklistMetadata`), `tests/checkin-software-blacklist-webhook.test.ts` (+1 caso, editor ponta a ponta) |
| 3 — Testes dos 4 papéis | `tests/auth-roles-e2e.test.ts` (novo) — integração Vitest com sessão sintética exercitando `lib/permissions.ts`/`lib/tenant-context.ts`/`lib/portal-context.ts` reais (nunca mockados), um `describe` por papel, cada asserção citando a linha/condição exata de `proxy.ts` que ela reproduz | `tests/auth-roles-e2e.test.ts` (novo, 16 casos) |

### As 6 correções do orquestrador — decisões técnicas aplicadas (documentadas, não desvio silencioso)

1. **"E2E" = integração Vitest, não browser real.** Projeto não tem Playwright/Cypress.
   `tests/auth-roles-e2e.test.ts` mocka só `@/auth`/`@/lib/prisma` e chama as funções reais de
   `lib/permissions.ts`/`lib/tenant-context.ts`/`lib/portal-context.ts`, mesmo padrão de
   `tests/portal-context.test.ts`/`tests/users-page-scope.test.ts`/`tests/auth-login.test.ts`. Para o
   redirect `/dashboard` (CLIENT_VIEWER em `/app/*`/`/admin/*`), cada teste chama a MESMA função de
   `lib/permissions.ts` que `proxy.ts` chama para decidir (`canPossiblyAccessTenantSlug`,
   `canAccessGlobalAdmin`/`isOrgAdmin`), com comentário citando a condição exata do proxy — sem
   servidor HTTP real. Um caso adicional (`requirePortalContext` sem contexto válido) usa o
   `redirect()` REAL de `next/navigation` (não mockado), capturando o digest `NEXT_REDIRECT;...` —
   mesmo princípio de `notFound()` real já usado em `tests/tenant-context.test.ts`.
2. **Sem logotipo — marca d'água vetorial, não imagem.** `Client` não tem campo de branding.
   `renderDeviceReportPdf` desenha "CONFIDENCIAL" com `pdfkit` (texto rotacionado -45°, opacidade
   0.07, redesenhado em toda página via evento `pageAdded`) mais uma faixa vermelha de aviso abaixo
   do cabeçalho de texto já existente (título/subtítulo/data). Nenhum upload de imagem foi criado.
3. **`lib/reports/device-report.ts` estendido, nunca duplicado.** `getDeviceReportRows`,
   `buildDeviceReportSummary`, `renderDeviceReportPdf` e o tipo `DeviceReportRow`/
   `DeviceReportSummary` ganharam campos aditivos (novos campos opcionais na saída, novos parâmetros
   com default no fim da assinatura) — as duas rotas de PDF (`/api/tenant/[clientSlug]/reports/pdf`,
   `/api/portal/reports/pdf`) e as duas de CSV (que passaram a repassar `alertDiskThresholdGb` real
   também, por consistência, embora o CSV em si não tenha mudado de formato) chamam a mesma função.
   `renderDeviceReportCsv` não foi tocada — confirmado que só usa campos que já existiam antes desta
   sprint.
4. **Dados novos carregados em `getDeviceReportRows`**: tipo do dispositivo via
   `isServerOperatingSystem` (mesmo helper de `tenant-computers-table.tsx`); BitLocker por device via
   `computeRowBitlockerStatus` (novo, exportado, testado isoladamente) — **regra de agregação
   documentada no código**: "pior caso", a máquina só conta como "BitLocker ativo" se TODOS os discos
   com dado conhecido (`'on'`/`'off'`) estiverem `'on'`; discos com dado desconhecido não contaminam
   o resultado; sem nenhum disco conhecido, o resultado é `null` ("não apurado"), nunca `false` — a
   mesma lógica de pior-caso já usada por `evaluateAlertMetric('bitlocker_missing')`, só invertida
   (lá, dispara se ALGUM disco conhecido está `'off'`; aqui, "ativo" exige que NENHUM esteja);
   `antivirusAtualizado` passou a ser selecionado (campo já existia em `SecurityPosture`); discos
   críticos usam `alertDiskThresholdGb` real do tenant (as duas rotas passaram a extrair esse campo
   de `getTenantAlertSettingsBySlug`/`getTenantAlertSettingsByClientId`, que já o retornava — só não
   estava sendo lido); softwares não autorizados via `getBlacklistedSoftwareHistory` (nova consulta,
   escopada por `clientId`, `AlertEvent` com `metric: 'software_blacklisted'`) — **decisão de escopo
   registrada**: sem seletor de período (o usuário não pediu controle de data) — lista os 50 mais
   recentes por `firedAt desc`, mesmo padrão (`take: 50`) já usado em
   `app/app/[clientSlug]/alerts/page.tsx`.
5. **`AlertEvent.metadataJson` estendido com `softwareEditor`**: `lib/alert-rules.ts`
   (`SoftwareSnapshot.editor?`, `evaluateAlertMetric` inclui `softwareEditor: match.editor ?? null` no
   metadata) e `app/api/agent/checkin/route.ts` (repassa `editor: software.editor ?? null` no `.map`
   que monta `software` para `reconcileAlertEvents`). Sem migration nova (`metadataJson` já é
   `String?` livre). `editor` opcional no tipo `SoftwareSnapshot` (não obrigatório) para não quebrar
   fixtures de teste pré-existentes que só passavam `nome`/`versao`.
6. **`app/app/[clientSlug]/alerts/page.tsx` agora seleciona `metric`/`metadataJson`** e renderiza um
   bloco destacado (nome/versão/editor) quando `event.metric === 'software_blacklisted'`, usando
   `parseSoftwareBlacklistMetadata` (novo, em `lib/alert-rules.ts`) — parse defensivo com
   `try/catch`, nunca confia cegamente no conteúdo armazenado, mesmo princípio de `parseMetadata` em
   `lib/audit-log.ts`.

### Verificação

1. `npx tsc --noEmit` — **limpo**.
2. `npm run lint` — **limpo** (regra real, `scripts/verification/run-lint.mjs`).
3. `npm run build` — **sucesso**; todas as rotas tocadas presentes na listagem (`/api/tenant/
   [clientSlug]/reports/pdf`, `/api/tenant/[clientSlug]/reports/csv`, `/api/portal/reports/pdf`,
   `/api/portal/reports/csv`, `/app/[clientSlug]/alerts`, `/api/agent/checkin`).
4. `npm run test` — **BLOQUEADO** por um bug de runtime pré-existente do ambiente (Node `v24.13.0` +
   `vitest@4.1.11`), não relacionado a esta sprint — ver detalhe e evidência de isolamento na seção de
   Status acima. Novos testes desta sprint revisados manualmente linha a linha contra a implementação
   real, mas sem confirmação de execução.
5. `go vet`/build cruzado do agente: **N/A** — esta sprint não tocou `agent-go/`.

### Fora de escopo desta sprint

Corrigir o bug de ambiente Vitest/Node que bloqueou o item 4 da verificação — é uma decisão de
infraestrutura (versão do Node/Vitest instalada), fora da permissão de escrita/execução de um
`implementation-agent` restrito ao código da aplicação. Upload de logotipo de cliente — explicitamente
descartado pelo orquestrador (sem campo no schema, fora de escopo). Seletor de período para o
histórico de softwares não autorizados no PDF — o usuário não pediu, decisão registrada no item 4 das
correções acima.

---

## Sprint 14 — Descoberta de Dispositivos na Rede (opt-in, com gate server-side)

**Status**: 🟢 Concluída (2026-09-03). Execução direta aprovada pelo usuário nesta conversa (o próprio
usuário escreveu o escopo, com 9 correções técnicas do orquestrador aplicadas antes da implementação
— ver seção própria abaixo), sem fase de planejamento separada, mesmo padrão das Sprints 11/12/13.

**Verificação independente do orquestrador** (não só o autorrelato do `implementation-agent`):
`npx tsc --noEmit`, `npm run lint` e `npm run build` limpos (com `/api/agent/discovery` presente na
listagem de rotas); `npx vitest run` **438/438 em 51 arquivos, estável em 2 execuções consecutivas**;
no `agent-go/`, `go build ./...`, `go vet ./...` e `go test ./...` limpos (pacote `discovery` com
testes passando). Revisão manual linha a linha de `proxy.ts` (a correção de `publicRoutes` — o
casamento é `pathname === route || startsWith(route + '/')`, então a entrada nova cobre exatamente a
rota pretendida, sem abrir prefixo indevido), `app/api/agent/discovery/route.ts` (os dois gates
fail-closed antes de qualquer escrita; `clientId` sempre derivado de `agentAuth`, nunca do payload),
`lib/schemas/agent-discovery.ts` (IPv4 validado com faixa por octeto, enum estrito, `.max()` em todo
array e string) e `agent-go/internal/collectors/discovery/scan.go` (`recover()` no `Scan` **e** por
worker — um panic em goroutine não é capturado pelo defer de quem a lançou, detalhe correto e sutil).

**Limpeza pós-sprint feita pelo orquestrador**: os dois servidores `next start` de teste (PIDs nas
portas 3100/3101) que o `implementation-agent` não conseguiu encerrar foram identificados por linha
de comando e finalizados (o `next dev` do usuário na porta 3000 foi deliberadamente preservado); os
16 arquivos `query_engine-windows.dll.node.tmp*` órfãos em `node_modules/.prisma/client/` (294 MB,
acumulados por falhas de `EPERM` de `prisma generate` com o dev server segurando a DLL) foram
removidos, e o carregamento do `PrismaClient` foi reconfirmado depois da limpeza.

**Objetivo**: dar visibilidade sobre o que existe na rede do cliente **além das máquinas com agente
instalado** — impressoras, switches, roteadores, NAS e access points. O inventário até aqui só
enxergava o que tinha agente; um parque real tem dezenas de equipamentos que nunca vão ter um. A
varredura é do próprio agente (não há appliance de rede no produto), o que traz junto uma questão de
privacidade que o escopo original não tratava e que virou a decisão estruturante da sprint: a
varredura é **opt-in por tenant e desligada por padrão** (ver correção 8).

### Escopo entregue

| Item | Entrega | Testes |
|---|---|---|
| 1 — Schema | `DiscoveredDevice` (novo model, `@@map("discovered_devices")`): `clientId` **NOT NULL** com FK `Cascade` para `Client`, `ip`, `mac?`, `hostname?`, `vendor?`, `deviceType` (default `"UNKNOWN"`), `snmpSysDescr?`, `openPorts?`, `firstSeenAt`, `lastSeenAt`; `@@unique([clientId, ip])`, `@@index([clientId, lastSeenAt])`, `@@index([clientId, deviceType])`. `Client.discoveryEnabled Boolean @default(false)` (aditivo). Backup `pg_dump` → `prisma db push` → `prisma db pull --print` confirmando as duas mudanças no banco real | Constraints de banco não são cobertas por Vitest (mesma nota da Sprint 10); a semântica do `upsert` por `(clientId, ip)` é coberta em `tests/agent-discovery-route.test.ts` |
| 2 — Varredura no agente Go | Pacote novo `agent-go/internal/collectors/discovery/` (plataforma-neutro): `subnet.go` (interface primária, `/24`, hosts varreveis), `classify.go` (catálogo fechado de 6 tipos, precedência de sinais, `FormatOpenPorts`), `vendor.go` (sysDescr + tabela OUI mínima de 21 prefixos), `snmp.go` (GET SNMPv2c real via `github.com/gosnmp/gosnmp` v1.44.0), `scan.go` (worker pool de 20, `recover()` geral **e** por worker), `arp.go` (parser neutro) + `arp_windows.go`/`arp_stub.go` (build tags, padrão já usado em `factory_windows.go`/`factory_stub.go`) | `agent-go/internal/collectors/discovery/discovery_test.go` (novo, 13 funções de teste / 40+ casos) |
| 3 — Ciclo e agendamento do agente | `checkin.SendDiscoveryOnce(cfg)` (espelha `SendMetricsOnce`), `httpapi.Client.SendDiscovery` (espelha `SendMetrics`, **sem retry**), `httpapi.SetDiscoveryEnabled`/`DiscoveryEnabled` (estado em memória, default `false`), `discoveryTicker` de **6h** em `service_windows.go` com `defer recoverAndLog("runNetworkDiscovery")`, subcomando `discovery` em `main.go` + `printUsage()` | Cobertura Go das funções puras (item 2); o ciclo de I/O em si não é testado por design (exigiria dispositivo de rede real) |
| 4 — Rota de ingestão | `POST /api/agent/discovery` modelada linha a linha sobre `app/api/agent/metrics/route.ts`: `validateAgentApiKey` → `rateLimit('discovery:<agentAuthId>', 5/hora)` → parse JSON → Zod → gate `clientId` nulo → gate `discoveryEnabled` → `upsert` por `(clientId, ip)`. `lib/schemas/agent-discovery.ts` (novo) com `.max()` em todo array e string, IPv4 validado por regex **e** faixa de octeto, `deviceType` em enum estrito | `tests/agent-discovery-route.test.ts` (novo, 16 casos) |
| 5 — Toggle e auditoria | `Client.discoveryEnabled` exposto em `lib/tenant-alert-settings.ts` (leitura raw + `updateTenantAlertSettings`), checkbox com aviso de privacidade em `components/tenant-alert-settings-form.tsx`, campo em `saveTenantAlertSettingsAction` (guard `canManageTenantAlerts`, inalterado) e `AuditLog` `tenant.discovery_enabled`/`tenant.discovery_disabled` **só na transição** | `tests/tenant-discovery-toggle-action.test.ts` (novo, 6 casos — guards reais, nunca mockados) |
| 6 — Resposta do check-in | `POST /api/agent/checkin` passa a devolver `discoveryEnabled: boolean` (de `getTenantAlertSettingsByClientId`, `?? false`) | Suíte de check-in existente segue verde; o campo é aditivo |
| 7 — UI | `components/discovered-devices-table.tsx` (novo Client Component: 4 abas de tipo + busca por IP/hostname/MAC, badges por família de equipamento, tokens de `lib/table-styles.ts`) e seção **nova** "Dispositivos Descobertos na Rede" em `app/app/[clientSlug]/network/page.tsx` — a seção de segmentos existente foi **mantida**, não substituída | `tests/discovered-devices-table.test.tsx` (novo, 14 casos) |
| 8 — `proxy.ts` | `/api/agent/discovery` adicionado a `publicRoutes` (ver "Bug encontrado no teste com servidor real", abaixo) | Nenhum teste automatizado cobre a lista do proxy — lacuna registrada no Backlog |

### Modelos de banco alterados (2, ambos aditivos — `prisma db push`, sem `migrate dev`)

1. `DiscoveredDevice` — tabela nova, `discovered_devices`.
2. `Client.discoveryEnabled Boolean @default(false)` — coluna nova com default, segura para linhas existentes.

Backup: `prisma/backups/pre-sprint14-20260903082907.sql` (`docker exec inventario-db pg_dump`), tirado
**antes** do push. Verificação pós-push com `npx prisma db pull --print`: `model DiscoveredDevice`
presente com o `@@unique`/`@@index` esperados, e `discoveryEnabled Boolean @default(false)` presente
em `Client`.

### As 9 correções do orquestrador — decisões técnicas aplicadas (documentadas, não desvio silencioso)

1. **`npm run check:all` não existe.** Verificação real: `npx tsc --noEmit`, `npm run lint`,
   `npm run build`, `npx vitest run`; no Go, `go build ./...`, `go vet ./...`, `go test ./...`.
2. **SNMP é UDP, não TCP — o escopo original tornaria a detecção não-funcional.** O pedido mandava
   "TCP Probe" na porta 161; `net.Dial("udp", ...)` "conecta" sempre localmente, sem emitir pacote,
   então nunca serve de sinal. Implementado: probe TCP só em portas realmente TCP
   (**22, 80, 443, 445, 515, 631, 9100** — 515/LPD e 631/IPP incluídos por serem, com 9100, o sinal
   forte de impressora) e, separadamente, um **GET SNMPv2c real em UDP/161** (community `public`,
   somente leitura). `161` só entra em `openPorts` quando uma resposta SNMP válida chegou dentro do
   timeout.
3. **Sem ICMP/ping.** Go stdlib não tem ICMP e `golang.org/x/net/icmp` exige raw socket. "Host vivo"
   = respondeu a algum probe TCP ou ao GET SNMP. **Limitação aceita e documentada** (no código, em
   `PRODUCT.md` RF028 e no glossário): dispositivo com todas as portas sondadas fechadas e sem SNMP
   fica invisível — é o preço de não exigir privilégio de raw socket.
4. **MAC lido da tabela ARP.** `arp -a` no Windows (`arp_windows.go`, com `HideWindow` — o agente
   roda como serviço), stub que devolve mapa vazio e **erro nil** nas demais plataformas (MAC ausente
   não invalida a descoberta). O parser (`ParseARPOutput`) vive em arquivo **neutro** de plataforma
   justamente para ser testável fora do Windows, e é agnóstico a idioma do SO: casa qualquer linha
   cujo 1º campo seja IPv4 e o 2º um MAC de 6 octetos, descartando broadcast/multicast. MAC ausente →
   `null`, nunca inventado.
5. **Sem base OUI da IEEE embutida.** `vendor` vem prioritariamente do `sysDescr`/`sysName` do SNMP;
   como fallback, uma tabela de **21 prefixos** OUI dos fabricantes mais comuns. Sem SNMP e sem match
   → `null`.
6. **`github.com/gosnmp/gosnmp` v1.44.0, sem parser ASN.1 artesanal.** A resposta vem de um
   dispositivo não confiável da rede. Mesmo com a lib, a varredura roda sob `recover()` — e não só um:
   um `recover()` geral em `Scan` **mais um por worker**, porque um pânico dentro de goroutine não é
   capturado pelo `defer` de quem a lançou (sem isso, derrubaria o processo do serviço). `go mod tidy`
   rodado; `go mod verify` → "all modules verified".
7. **Localização e agendamento conforme especificado.** Pacote próprio `internal/collectors/discovery`
   (não dentro de `collectors/windows`), split por build tag só na leitura de ARP;
   `SendDiscoveryOnce`/`SendDiscovery` espelhando os equivalentes de métricas, sem retry;
   `discoveryTicker` de 6h no loop de tickers existente, com `defer recoverAndLog(...)`; subcomando
   `discovery` no `main.go` e em `printUsage()`.
8. **Varredura opt-in, default desligado (decisão de segurança/privacidade do orquestrador, ausente
   do escopo original).** Um agente que varre portas de qualquer LAN em que a máquina se conecte
   (Wi-Fi de hotel, casa do funcionário, coworking) cataloga dispositivos de terceiros, e port scan
   não solicitado é comportamento que EDR/IDS classificam como malicioso. Entregue: coluna
   `Client.discoveryEnabled @default(false)`; **gate server-side fail-closed** na rota (202
   `discovery_disabled`, sem gravar); `discoveryEnabled` na resposta do check-in **só como
   otimização**; toggle na UI sob `canManageTenantAlerts` com texto explicando o risco; `AuditLog` na
   transição do flag (RNF009).
9. **Isolamento multi-tenant fail-closed.** `auth.agentAuth.clientId` é nulável (agentes legados):
   a rota rejeita com 202 `agent_without_client` **sem gravar**, e `DiscoveredDevice.clientId` é
   `NOT NULL` para que linha órfã seja impossível por construção. Na leitura, escopo sempre por
   `tenant.id` de `requireTenantContext`, com `select` explícito.

### Decisões técnicas adicionais (não especificadas no escopo nem nas correções)

- **Como o flag chega ao agente**: em **memória de processo** (`internal/transport/httpapi/discovery_flag.go`,
  `sync.RWMutex`), não no config em disco. Persistir criaria uma segunda fonte de verdade capaz de
  ficar defasada (tenant desliga, agente fica offline uma semana, volta varrendo pelo valor antigo).
  Em memória, o pior caso é o lado seguro: **default `false` a todo início de processo** (reinício de
  serviço, reboot, auto-update → não varre até um check-in autorizar), e todo check-in (1h) reafirma
  o valor. Além disso, um 202 `discovery_disabled`/`agent_without_client` na resposta da própria rota
  de descoberta **também** zera o flag local, para o agente parar de gastar o ciclo caro.
- **Precedência de classificação, para sinais conflitantes** (o caso `9100` **e** `445` abertos):
  (1) `sysDescr`/`sysName` do SNMP vence tudo — é a autodescrição do dispositivo; (2) porta de
  impressão (9100/515/631) — portas altamente específicas, então **9100+445 ⇒ `PRINTER`**; (3) porta
  445 sozinha ⇒ `NAS`, o sinal mais fraco, com **falso positivo conhecido e aceito** (estação/servidor
  Windows com compartilhamento também escuta em 445; mantido porque era o pedido explícito do escopo,
  e a máquina com agente já aparece no inventário de verdade); (4) qualquer outro caso ⇒ `UNKNOWN` —
  em especial, **SNMP que responde mas cujo `sysDescr` não casa palavra-chave nenhuma NÃO vira
  `SWITCH`**: no-break, câmera IP e controladora de ar-condicionado também falam SNMP, e "não
  identificado" é melhor que categoria inventada (mesmo princípio do "não apurado ≠ desativado").
- **`deviceType` em enum Zod estrito, não `.catch('UNKNOWN')`**: agente de versão futura que invente
  um tipo tem o payload rejeitado com 400 (falha visível) em vez de ter o valor silenciosamente
  reescrito. Custo aceito: acopla versão de agente e servidor, exatamente como o catálogo de comandos
  já faz (RNF003).
- **`discoveryEnabled` fora de `InventoryAlertSettings`**: apesar de compartilhar formulário e Server
  Action com `alertsEnabled`/`alertWebhookEnabled`, o flag vive em `TenantAlertSettingsRecord`
  (lib/tenant-alert-settings.ts), não no tipo de `lib/inventory-alerts.ts` — este último alimenta
  `deriveInventoryIssues`/`reconcileAvailabilityEvents`/`getDevicePresence`, que são lógica de
  **alerta**. Varredura de rede não é alerta; incluí-lo ali arrastaria um campo irrelevante para todo
  o caminho de decisão de alerta e para toda fixture de teste desse tipo.
- **`AuditLog` só na transição do flag**, não a cada submit do formulário: ajustar um threshold de
  disco não é mutação sensível; ligar a varredura de rede é. Gravar em todo save encheria a tabela de
  linhas sem transição e esconderia justamente o evento que importa.
- **A rota consulta `prisma.client.findUnique({ select: { discoveryEnabled: true } })`** em vez de
  `getTenantAlertSettingsBySlug` (que usa `$queryRaw`): é o mesmo padrão que
  `app/api/agent/metrics/route.ts` já usa para ler `metricsRetentionDays`, e mantém a rota testável
  com o mock de Prisma tipado.
- **Upserts sequenciais, sem transação única**: no máximo ~254 linhas a cada 6h por agente; uma
  transação de centenas de statements custaria mais (lock) do que resolve, e o `upsert` por
  `(clientId, ip)` já é idempotente.
- **Hostname do dispositivo descoberto** vem de PTR reverso best-effort (`net.LookupAddr`); sem PTR,
  fica `null` — nunca o próprio IP fazendo as vezes de nome.
- **Teto de 500 linhas** na leitura da página de rede (uma /24 rende ~254 por sub-rede).

### Bug encontrado no teste com servidor real (que nenhum teste automatizado pegaria)

`proxy.ts` mantém uma lista `publicRoutes` — "público" no sentido de "não exige **sessão de
usuário**"; as rotas do agente continuam autenticadas por `X-Api-Key` dentro do próprio handler.
`/api/agent/discovery` não estava nessa lista, então o proxy respondia **307 → `/login`** antes de a
requisição chegar ao handler: a rota estava **completamente inacessível ao agente**, apesar de
`tsc`, `lint`, `build` e os 16 testes da rota passarem.

Nenhum teste automatizado pegaria isso, e vale registrar por quê: os testes de rota importam e
chamam `POST()` diretamente (`await import('@/app/api/agent/discovery/route')`), o que **nunca
passa pelo proxy**. O bug só apareceu no primeiro `curl` real contra o servidor. Correção: a rota
entrou em `publicRoutes`, com um comentário no próprio `proxy.ts` avisando que toda rota nova sob
`/api/agent` precisa entrar ali.

### Verificação

1. `npx tsc --noEmit` — **limpo**.
2. `npm run lint` — **limpo** (regra real, `scripts/verification/run-lint.mjs`).
3. `npm run build` — **sucesso**, com `/api/agent/discovery` presente na listagem de rotas.
4. `npx vitest run` — **438/438 testes, 51 arquivos**, verde em **duas execuções consecutivas**
   (402 anteriores intactos + 36 novos: 16 em `tests/agent-discovery-route.test.ts`, 14 em
   `tests/discovered-devices-table.test.tsx`, 6 em `tests/tenant-discovery-toggle-action.test.ts`).
   A flakiness conhecida do Vitest neste ambiente ("failed to find the current suite") **não
   apareceu** em nenhuma das execuções.
5. Agente Go: `go build ./...`, `go vet ./...` e `go test ./...` **limpos**; build cruzado
   `GOOS=windows` e `GOOS=linux` (amd64) **ambos com sucesso**, e `go vet` também limpo sob
   `GOOS=linux` (cobre o caminho de `arp_stub.go`). `go mod verify` → "all modules verified".
6. **Teste com servidor real e login real nos 4 papéis** (`node scripts/seed-rbac.ts` + login via
   `POST /api/auth/callback/credentials` com CSRF, cookies preservados). Servidor `next start`
   subido numa porta separada porque o `next dev` de longa duração da máquina segurava um Prisma
   Client anterior ao `prisma generate` desta sprint e devolvia 500 nas consultas às colunas novas —
   artefato de ambiente, não do código (o mesmo cenário passa limpo no processo novo).
   - `/app/[clientSlug]/network`: `200` para `PLATFORM_ADMIN`, `ORG_ADMIN` e `ORG_OPERATOR`; `307 →
     /dashboard` para `CLIENT_VIEWER`; `307 → /login` sem sessão; `404` (nunca `403`) em slug
     inexistente.
   - Bloco "Configurações de Alerta" (que hospeda o toggle de descoberta) presente no HTML para
     `PLATFORM_ADMIN`/`ORG_ADMIN` e **ausente** para `ORG_OPERATOR` — `canManageTenantAlerts`
     funcionando na tela, não só no teste.
   - `POST /api/agent/discovery` contra Postgres real, com `AgentAuth` temporário: 12 asserções,
     todas PASS — `401` sem chave e com chave inválida; `202 agent_without_client` para agente sem
     tenant; `202 discovery_disabled` com o flag desligado **e zero linhas gravadas**; `200
     upserted=2` com o flag ligado; segunda varredura do mesmo IP **não duplicou** a linha,
     **preservou `firstSeenAt`** e avançou `lastSeenAt`; campos atualizados corretamente.
   - Seção "Dispositivos Descobertos na Rede" renderizada com os dados reais (hostname, IP, vendor),
     **junto** da tabela de segmentos preexistente, que continua na página.
   - Dados de teste removidos ao final: 2 `DiscoveredDevice`, 2 `AgentAuth` temporários,
     `discoveryEnabled` restaurado para `false` (confirmado por contagem pós-limpeza).

### Fora de escopo desta sprint

Leitura de tabela ARP em Linux (`arp -n`/`ip neigh` têm formato diferente — o stub devolve mapa vazio
sem erro, e o dispositivo continua sendo catalogado sem MAC). Varredura de máscara diferente de /24
(simplificação deliberada: cobre a maioria das LANs de escritório e mantém o custo do ciclo
previsível). Detecção de host por ICMP. Community SNMP configurável por tenant. Promover um
`DiscoveredDevice` a `Device` (as duas tabelas não se relacionam por design). Base OUI completa da
IEEE.

---

## Sprint 15 — Grid de KPI em /processors e /storage (cards como o próprio filtro)

**Status**: 🟢 Concluída (2026-09-03). Execução direta aprovada pelo usuário nesta conversa (o próprio
usuário escreveu o escopo, com 8 correções técnicas do orquestrador aplicadas antes da implementação
— ver seção própria abaixo), sem fase de planejamento separada, mesmo padrão das Sprints 11–14.

**Verificação independente do orquestrador** (não só o autorrelato do `implementation-agent`):
`npx tsc --noEmit`, `npm run lint` e `npm run build` limpos (`/app/[clientSlug]/processors` e
`/storage` presentes na listagem de rotas); `npx vitest run` **451/451 em 51 arquivos, estável em 2
execuções consecutivas**. Revisão manual de `lib/processor-vendor.ts` (colapso do rótulo fantasma
`'Intel Xeon'`, com `getVendorGroup` garantindo que qualquer rótulo fora dos 3 caia em "Não
identificado" em vez de sumir da contagem — é o que torna `Total = Intel + AMD + Outros` verdadeiro
por construção, não por confiança no chamador), de `components/ui/summary-card.tsx` (tons `success` e
`info` sobre os tokens `--success`/`--info` que já existem em `app/globals.css`, definidos nos blocos
claro **e** escuro) e dos dois `useMemo` de contagem. Confirmada também a cobertura das duas
invariantes exigidas: soma da coluna "Dispositivos" das linhas visíveis após clicar em Intel ==
número do card Intel, e `total === ok + warning + critical` no storage.

**Auditoria de segurança: N/A confirmado pelo orquestrador.** A sprint é UI client-side derivada em
memória de dados que as páginas já buscavam via `getTenantDeviceWhere` — nenhuma rota, guard, query,
segredo ou superfície de RBAC foi tocada, e por isso também não se aplica o teste de login real com
os 4 papéis.

**Objetivo**: padronizar `/app/[clientSlug]/processors` e `/app/[clientSlug]/storage` com o mesmo
grid de cards de KPI que Computadores e Servidores já têm — e, ao fazer isso, eliminar a duplicação
de controles que o grid criaria. Não é só cosmética: o card passa a ser o próprio botão de filtro
("o número que o usuário já olha é o botão que ele aperta"), o que obriga cada número exibido a
corresponder exatamente à lista que ele filtra. Duas incoerências antigas caíram nesse teste e foram
corrigidas: a mistura de unidades em Processadores (modelos vs. dispositivos) e o fabricante fantasma
`'Intel Xeon'`. Refinamento de UI de **RF019** (listagens filtráveis) sob a disciplina de **RN013**
(conta máquina por faixa, nunca soma) — nenhum RF/RN novo foi criado.

### Escopo entregue

| Item | Entrega | Testes |
|---|---|---|
| 1 — Tons novos no componente base | `components/ui/summary-card.tsx`: `SUMMARY_TONE` ganhou `success` e `info`, no mesmo formato das entradas existentes (`{ icon, value, ring }`) e sobre os tokens de tema que o app já tem (`--color-success`, `--color-info` em `app/globals.css`). Também ganhou `testId?: string` (aplicado no card e, como `${testId}-value`, no `<p>` do número) — os cards agora são controles clicáveis e os testes precisam alcançá-los. Nenhum estilo inline, nenhum card paralelo | Exercitado indiretamente pelos 24 testes dos dois grids |
| 2 — Vocabulário único de fabricante | `lib/processor-vendor.ts` (novo): `inferVendor` (movido de `processors/page.tsx`, colapsado para 3 valores) + `getVendorGroup` + `PROCESSOR_VENDORS`. Ficou em `lib/` porque agora é usado pelo Server Component (rotular cada modelo, normalizar `?fabricante=`) **e** pelo Client Component (contar cards, filtrar linhas) — card, filtro e badge da linha precisam falar a mesma língua | `tests/tenant-processors-table.test.tsx`, describe "inferVendor — colapso do fabricante fantasma" (3 casos) |
| 3 — Cards KPI em Processadores | `components/tenant-processors-table.tsx`: grid `md:grid-cols-2 xl:grid-cols-4` com **Total de Máquinas** (`primary`, limpa o filtro), **Intel** (`info`), **AMD** (`destructive`), **Outros / Não Identificados** (`warning`). Os 3 de fabricante aplicam `?fabricante=` via o `applyVendorFilter` que já existia. A fileira de badges de fabricante (incluindo "Todos os fabricantes") **saiu** — o card Total assumiu o papel de limpar, exatamente como `TenantComputersTable` | Mesmo arquivo, describes "cards de KPI por fabricante" (4 casos) e "filtro por fabricante refletido na URL" (5 casos) |
| 4 — Cards KPI em Armazenamento | `components/tenant-storage-table.tsx`: grid de 4 com **Total de Dispositivos** (`primary`, limpa a faixa), **Normal** (`success`), **Em Alerta** (`warning`), **Crítico** (`destructive`). Rótulos montados a partir do `USAGE_RANGE_LABEL` já existente (`Normal (Até 60% usado)`, …) para não duplicar limiar. Chamam o `applyUsageFilter`/`syncUrl` que já existiam — nenhuma lógica de faixa nova. A fileira de badges de **faixa** saiu; as de **tipo de disco** (`?tipo=`) ficaram | `tests/tenant-storage-table.test.tsx`, describes "cards de KPI por faixa de uso" (5 casos) e "badge de presenca e filtros" (7 casos) |
| 5 — Normalização de URL legada | `app/app/[clientSlug]/processors/page.tsx`: `?fabricante=` passa por `getVendorGroup` antes de virar `initialVendor`, então um bookmark antigo com `?fabricante=Intel%20Xeon` cai no grupo Intel em vez de renderizar lista vazia | Coberto pelo describe de `getVendorGroup` |

Nenhuma mudança de schema, de rota de API, de permissão ou de `agent-go/` nesta sprint.

### As 8 correções do orquestrador — decisões técnicas aplicadas

1. **`npm run check:all` não existe.** Verificação real: `npx tsc --noEmit`, `npm run lint`,
   `npm run build`, `npx vitest run` (2x).
2. **`SUMMARY_TONE` estendido no componente base**, não contornado. O escopo pedia `info` (Intel) e
   `success` (storage "Normal"), tons que o `SummaryCard` não tinha. Adicionados lá, uma vez só —
   foi exatamente por isso que o componente foi extraído para `components/ui/` na sprint anterior.
3. **O filtro de faixa do storage já existia e foi reusado, não reescrito.** `usageFilter`,
   `applyUsageFilter`, `syncUrl(?faixa=)`, `worstUsagePercent` (pior disco) e `USAGE_RANGE_LABEL`
   permaneceram intactos; os cards só passaram a ser mais um gatilho dos mesmos handlers.
4. **Controles duplicados removidos junto com a entrada dos cards.** Sem isso ficariam duas UIs para
   o mesmo filtro, o oposto do que o `SummaryCard` documenta. Saíram: a fileira de badges de faixa em
   `/storage` e a fileira inteira de badges de fabricante em `/processors` (inclusive "Todos os
   fabricantes"). Ficaram: as badges de **tipo de disco**, que são outra dimensão e não têm card.
5. **Unidade de contagem coerente em Processadores: os 4 cards contam DISPOSITIVOS.** O escopo
   original misturava "Total de **Modelos**" com três cards de **dispositivos** — num grid de 4
   números lado a lado, isso convida a uma soma que não fecha. O card 1 virou **"Total de Máquinas"**
   e é exatamente `Intel + AMD + Outros`. A contagem de modelos não se perdeu: continua no subtítulo
   da página, logo acima do grid (`N modelos encontrados…`), onde não se confunde com as outras.
   Invariante provada por teste: a soma da coluna "Dispositivos" das linhas exibidas após clicar em
   "Intel" é exatamente o número do card Intel.
6. **`inferVendor` colapsado para 3 valores — o fabricante fantasma `'Intel Xeon'` acabou.** A ordem
   dos `if` checava `'intel'` **antes** de `'xeon'`, então `"Intel Xeon E5-2680"` caía em `'Intel'` e
   só uma string com "xeon" **sem** "intel" (`"Xeon E5-2680"`, formato que algumas máquinas reportam
   via WMI) produzia `'Intel Xeon'`: o mesmo silício ganhava dois rótulos conforme a formatação da
   string, e o card "Intel" mentiria. Agora `'Intel'` (qualquer "intel" **ou** "xeon"), `'AMD'`,
   `'Nao identificado'`. A chave `'Intel Xeon'` saiu de `VENDOR_BADGE_CLASS`; a badge de fabricante
   **na linha** continua existindo (só a fileira de badges-filtro do topo saiu).
7. **Invariante de soma do storage provada por teste.** `getDiskUsageTier` classifica cada device em
   exatamente um tier (`ok` ≤60, `warning` >60 e ≤80, `critical` >80), pelo **pior disco** — critério
   não alterado. `tests/tenant-storage-table.test.tsx` afirma `total === ok + warning + critical`.
8. **Contagens no client, com `useMemo` sobre os dados que a table já recebe por prop.** Nenhuma
   query nova nos Server Components: o escopo de tenant continua garantido pela consulta existente
   (`getTenantDeviceWhere`), e não há segunda ida ao banco. As páginas seguem Server Components; os
   cards vivem dentro das tables, que já eram `'use client'`.

### Decisões técnicas adicionais (não especificadas no escopo nem nas correções)

- **Onde `inferVendor` foi morar.** A função saiu de `processors/page.tsx` para
  `lib/processor-vendor.ts` em vez de ser exportada da própria página. Motivo: o Client Component
  precisa da mesma regra para agrupar os cards, e um `export` extra de um `page.tsx` é exatamente o
  tipo de acoplamento que o App Router não deveria ter. O arquivo novo é a única adição de superfície
  da sprint, e existe para que **uma** definição de fabricante sirva página, tabela e teste.
- **Como ficou o agrupamento depois do colapso do `'Intel Xeon'`.** O filtro da tabela deixou de
  comparar a string crua (`processor.vendor === vendorFilter`) e passou a comparar **grupo**
  (`getVendorGroup(processor.vendor) === vendorFilter`). Consequência deliberada: qualquer rótulo
  fora dos três — legado (`'Intel Xeon'`), ou vindo de dado montado fora do Server Component — cai em
  "Outros / Não Identificados" e **nunca some da contagem**, o que é o que mantém
  `Total = Intel + AMD + Outros` verdadeiro por construção, e não por confiança no chamador.
  Complementarmente, a badge da linha passou a exibir `getVendorGroup(processor.vendor)`, não a
  string crua: seria confuso uma linha rotulada "Intel Xeon" aparecer dentro do filtro "Intel". Para
  dado real produzido hoje os dois valores são idênticos — a diferença só existe para dado legado.
- **Os cards de faixa do storage recontam dentro do filtro de tipo ativo** (a base do `useMemo` é
  `rows` já restrito por `typeFilter`), diferente do `summary` de `TenantComputersTable`, que é
  global. A razão é a invariante que o próprio escopo exige: com `?tipo=SSD` ligado, um card
  "Crítico" com contagem global prometeria linhas que a lista não mostraria ao ser clicado. Assim as
  duas propriedades valem juntas: os 3 tiers somam o total, **e** cada número é exatamente a
  população que aparece ao clicar. Em `/processors` a questão não existe (dimensão única).
- **Ícone `Cpu` nos quatro cards de processadores e `HardDrive` nos quatro de storage.** O escopo
  especificava o ícone dos três primeiros de cada grid e omitia o quarto; manter o mesmo ícone em
  toda a fileira deixa claro que os quatro números são a mesma unidade (é o rótulo que os distingue),
  ao contrário de `TenantComputersTable`, onde cada card mede uma coisa diferente.
- **Testes reapontados, não apagados.** Em `tenant-storage-table.test.tsx`, os dois testes que
  clicavam em `usage-filter-critical`/`usage-filter-ok` continuam cobrindo o mesmo comportamento
  (filtrar por faixa, classificação pelo pior disco, reflexo na URL) — só mudou o alvo do clique para
  `usage-card-critical`/`usage-card-ok`. Em `tenant-processors-table.test.tsx`, o teste de
  "Todos os fabricantes" virou o teste do card `vendor-card-all` e o de `vendor-filter-AMD` virou
  `vendor-card-AMD`. Foram acrescentados, nos dois arquivos, testes de que as fileiras de badges
  removidas **não existem mais** — a regressão que se quer impedir aqui é o reaparecimento da UI
  duplicada. Fixtures ganharam casos que antes não existiam: um processador com rótulo legado
  `'Intel Xeon'`, um com fabricante desconhecido, e um device de storage na faixa `warning` (que a
  fixture antiga não cobria).

### Resultado da verificação

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo, sem saída |
| `npm run lint` | limpo |
| `npm run build` | sucesso; `/app/[clientSlug]/processors` e `/app/[clientSlug]/storage` presentes na listagem de rotas |
| `npx vitest run` (1ª) | **451/451 em 51 arquivos** |
| `npx vitest run` (2ª) | **451/451 em 51 arquivos** — estável, sem flakiness nesta rodada |

Baseline anterior: 438 testes. Os 13 a mais são o saldo líquido de +12 testes novos nos dois arquivos
de grid contra os 4+7 reescritos (12 no de processadores, 12 no de storage, contra 4 e 7 antes).
`agent-go/` não foi tocado — `go vet`/build cruzado não se aplicam a esta sprint.

### Definition of Done — conferência item a item

| Item | Situação |
|---|---|
| Requisito atende `PRODUTO.md`/`PRODUCT.md` | ✅ Refinamento de UI de RF019 sob RN013; nenhum documento precisou mudar |
| RF e RN mapeados | ✅ RF019 (listagens filtráveis) e RN013 (conta por faixa, nunca soma) — IDs já existentes, nenhum novo criado (últimos em uso seguem RF028/RN017) |
| Caso de uso documentado | **N/A** — nenhum fluxo novo; o filtro por fabricante e por faixa já existia, mudou o controle que o dispara |
| Código implementado | ✅ 5 arquivos alterados + 1 novo (`lib/processor-vendor.ts`) |
| Validação Zod e isolamento de tenant | ✅ **por não mudar nada disso**: nenhuma entrada externa nova (os cards só alteram estado de client component e a query string), e as contagens são derivadas em memória dos dados que as páginas já buscam com `getTenantDeviceWhere` — nenhuma query nova, nenhuma chance de vazar escopo |
| Banco e migrations | **N/A** — nenhuma mudança de schema |
| Testes implementados e passando | ✅ 24 testes nos dois arquivos de grid (12 + 12), suíte total 451/451 verde em 2 execuções |
| Auditoria de segurança | **N/A/parcial** — sprint puramente de UI client-side, sem rota, guard, segredo ou query nova; não foi acionado o `security-auditor`. Fica a critério do orquestrador na verificação independente |
| Nenhuma regressão no build | ✅ `tsc`, `lint` e `build` limpos; `agent-go/` intocado |
| Critérios de aceite aprovados pelo usuário | ⏳ **Pendente** — é exatamente o que falta para virar 🟢 Concluída |

### Fora de escopo desta sprint

Cards de KPI em `/network` e `/alerts` (mesmo padrão, mas não pedido). Tornar as badges de tipo de
disco também cards (não têm KPI natural — a quantidade de tipos é variável por tenant). Persistir o
filtro de tipo/fabricante em preferência de usuário. Backfill de `Hardware.processador` para
normalizar strings de WMI no banco (o colapso do fabricante é feito na leitura, não no dado gravado).

---

## Ajuste pós-Sprint 15 — Padronização visual de tabelas e cards de KPI

**Status**: 🟢 Concluído (2026-09-04). Execução direta aprovada pelo usuário nesta conversa (o próprio
usuário escreveu o escopo, a partir de 5 screenshots das telas inconsistentes), com 9 correções
técnicas do orquestrador aplicadas antes da implementação — ver seção própria abaixo. **Não é uma
sprint numerada**: não cria RF/RN, não toca rota, guard, query, schema nem `agent-go/`; é um ajuste
de apresentação sobre o que a Sprint 15 entregou.

**Verificação independente do orquestrador**: `npx tsc --noEmit`, `npm run lint` e `npm run build`
limpos; `npx vitest run` **451/451 em 51 arquivos, estável em 2 execuções consecutivas** (nenhum
teste precisou ser alterado — a suíte assere comportamento, nunca string de classe, o que é
exatamente o que tornou esta padronização segura). Conferido por `grep` que **as 10 tabelas importam
os tokens** e que **não sobrou nenhum `<th className="px-…"` hardcoded** fora da exceção documentada;
`git diff --stat components/device-detail-tabs.tsx` vazio, confirmando que a exceção foi respeitada
de fato, não só documentada. Revisão manual de `components/ui/status-pill.tsx` (a distinção RN010
entre presença e status efetivo está preservada, com o tom `neutral` existindo só para
presença-offline e o `destructive` reservado a falha ativa) e de `lib/table-styles.ts`.

Uma alteração fora da lista das 10 tabelas foi verificada e aprovada: `app/app/[clientSlug]/reports/page.tsx`
teve `sm:grid-cols-2` → `md:grid-cols-2`, que é a unificação de grid pedida no escopo (o arquivo
não estava no inventário de `<th>` porque o que ele tem é grid de `StatCard`, não tabela).

**Objetivo**: fazer as tabelas de listagem e os cards de KPI parecerem o mesmo sistema. Antes deste
ajuste conviviam **6 variantes diferentes de `<th>`** (`px-4`/`px-5`, `py-3`/`py-4`,
`font-medium`/`font-semibold`, com e sem `uppercase`, `bg-muted/50` vs `bg-secondary/50` vs
`bg-secondary/40` vs `bg-secondary/30`) em 10 tabelas, e a diferença aparecia lado a lado ao navegar
entre `/servers`, `/computers` e `/network`. Refinamento de UI de **RF019** — nenhum RF/RN novo.

### Escopo entregue

| Item | Entrega |
|---|---|
| 1 — Tokens centralizados | `lib/table-styles.ts` (arquivo que já existia com `CLICKABLE_ROW_CLASS`/`STATIC_ROW_HOVER_CLASS`, criado justamente para isto) ganhou `TABLE_HEAD_ROW_CLASS`, `TABLE_HEAD_CLASS` e `TABLE_CELL_CLASS`. As 10 tabelas **importam** os tokens — a string não foi colada ~60 vezes, e a próxima correção tem um lugar só |
| 2 — 10 tabelas padronizadas | `tenant-servers-table.tsx`, `tenant-computers-table.tsx`, `tenant-processors-table.tsx`, `tenant-storage-table.tsx`, `tenant-recent-devices-table.tsx`, `discovered-devices-table.tsx`, `audit-log-table.tsx`, `app/app/[clientSlug]/network/page.tsx`, `app/users/page.tsx`, `app/admin/clients/clients-panel.tsx` |
| 3 — Pílula de status compartilhada | `components/ui/status-pill.tsx` (novo): componente puramente apresentacional (tom + ícone + rótulo). `PresenceBadge` (storage, dashboard) e `DeviceStatusPill` (computers, servers) passaram a usá-lo **sem colapsar os dois vocabulários** — ver correção 8 abaixo |
| 4 — Cards de KPI alinhados | `components/ui/summary-card.tsx` e `components/stat-cards.tsx`: `flex h-full w-full select-none flex-col justify-between`, `rounded-xl`, `p-4`, `transition-all duration-150`. Grids unificados em `grid gap-4 md:grid-cols-2 lg:grid-cols-4` (+`xl:grid-cols-5` no grid de 5 cards de `/computers` e do dashboard) |

**Antes → depois do token de cabeçalho**, por arquivo (estado do `<th>`):

| Arquivo | Antes | Depois |
|---|---|---|
| `tenant-servers-table.tsx` | `px-4 py-3 text-left font-medium` (**sem uppercase** — é a 1ª screenshot do usuário, cabeçalho em caixa mista) | `TABLE_HEAD_CLASS` |
| `tenant-computers-table.tsx` | `px-5 py-4 text-left font-semibold uppercase tracking-wider` (**sem `text-xs`**, herdava `text-sm` da `<table>`) | `TABLE_HEAD_CLASS` |
| `tenant-processors-table.tsx` | `px-5 py-3 … uppercase tracking-wider` | `TABLE_HEAD_CLASS` |
| `tenant-storage-table.tsx` | `px-5 py-3 … uppercase tracking-wider` | `TABLE_HEAD_CLASS` |
| `tenant-recent-devices-table.tsx` | `px-4 py-3 text-xs … uppercase tracking-wider` | `TABLE_HEAD_CLASS` |
| `discovered-devices-table.tsx` | `px-4 py-3 text-left font-semibold`, sem uppercase; `<tr>` em `bg-secondary/50` | `TABLE_HEAD_CLASS` + `TABLE_HEAD_ROW_CLASS` |
| `audit-log-table.tsx` | `px-4 py-3 text-left font-medium`, sem uppercase; fundo no `<thead>` (`bg-secondary/30`) | `TABLE_HEAD_CLASS` + `TABLE_HEAD_ROW_CLASS` |
| `app/app/[clientSlug]/network/page.tsx` | `px-4 py-3 text-left font-semibold`, sem uppercase; `<tr>` em `bg-secondary/50` (5ª screenshot) | `TABLE_HEAD_CLASS` + `TABLE_HEAD_ROW_CLASS` |
| `app/users/page.tsx` | `px-4 py-3 font-medium`, **sem `text-left`**; `<tr>` em `bg-secondary/40` | `TABLE_HEAD_CLASS` + `TABLE_HEAD_ROW_CLASS` |
| `app/admin/clients/clients-panel.tsx` | `px-4 py-3 text-left font-medium`; borda no `<thead>` | `TABLE_HEAD_CLASS` + `TABLE_HEAD_ROW_CLASS` |

Valores finais dos tokens:

```
TABLE_HEAD_ROW_CLASS = 'border-b bg-muted/50 text-muted-foreground'   // no <tr> do <thead>
TABLE_HEAD_CLASS     = 'px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider'
TABLE_CELL_CLASS     = 'px-5 py-4 align-top'
```

### As 9 correções do orquestrador — decisões técnicas aplicadas

1. **`npm run check:all` não existe** neste `package.json`. Verificação real: `npx tsc --noEmit`,
   `npm run lint`, `npm run build`, `npx vitest run` (2x).
2. **O diagnóstico de "zona morta de clique" do escopo original estava errado; a mudança foi feita
   por outro motivo.** Um `<button>` filho direto de um grid já recebe `align-self: stretch` e já
   preenchia a célula — não havia bounding box não-clicável. O problema **real e visível nas
   screenshots** é outro: os rótulos têm comprimentos muito diferentes ("Total de Dispositivos" vs
   "Crítico (Acima de 80% usado)"), quebram em número diferente de linhas, e os **números ficavam em
   alturas diferentes ao longo da fileira**. `h-full flex flex-col justify-between` corrige isso —
   e é esse o motivo registrado no comentário do código, não "zona morta". `select-none` entrou como
   melhoria legítima (evita seleção de texto ao clicar repetido num card que é botão).
3. **Padronizadas as 10 tabelas, não as 4 citadas no escopo.** O objetivo declarado era "100% de
   consistência"; corrigir só 4 das 10 fora de padrão deixaria o sistema *mais* inconsistente.
4. **EXCEÇÃO DELIBERADA — `components/device-detail-tabs.tsx` não foi tocado.** As `<th>` de lá
   (`px-4 py-2 font-medium`) são de **sub-tabelas densas aninhadas dentro das abas de detalhe** do
   dispositivo (softwares instalados, discos, interfaces), não tabelas de listagem principal. Subir
   para `py-4` incharia uma aba que mostra dezenas de linhas num painel. A exceção está documentada
   no comentário do token em `lib/table-styles.ts` para não ser "corrigida" por engano depois.
5. **Tokens centralizados em `lib/table-styles.ts`**, o arquivo que já existia exatamente para isso,
   e importados nas 10 tabelas — em vez de a string literal ser colada ~60 vezes.
6. **`bg-muted/50` e `border-b` ficam no `<tr>` do `<thead>`, não em cada `<th>`.** O escopo original
   os colocava na classe do `<th>`; repetir background por célula é redundante e pode deixar emenda
   visível entre células adjacentes. `TABLE_HEAD_CLASS` contém só o que é por célula.
7. **`text-xs` explícito DIMINUIU o cabeçalho de `/computers`, `/processors` e `/storage`** (as três
   herdavam `text-sm` da `<table className="w-full text-sm">`). É exatamente o que o usuário pediu e
   alinha com `tenant-recent-devices-table.tsx`, que já usava `text-xs`, mas é **mudança visível** —
   fica registrada aqui. Os cabeçalhos continuam legíveis: `text-xs` + `font-semibold` +
   `uppercase tracking-wider` é o mesmo tratamento já em produção no dashboard desde a Sprint 15.
8. **Unificado o COMPONENTE de badge, não o vocabulário semântico.** `PresenceBadge` e
   `DeviceStatusPill` medem coisas diferentes e não intercambiáveis: **presença**
   (`online | ausente | offline`, derivada da última coleta por `getDevicePresence` — nunca o
   `Device.status` bruto, **RN010**) e **status efetivo** (`online | warning | offline`, de
   `getEffectiveDeviceStatus`, que combina presença com alertas de disco/RAM). O novo
   `components/ui/status-pill.tsx` recebe apenas `tone` + `icon` + `label`; cada chamador continua
   traduzindo **o seu** enum e lendo **a sua** fonte de dado. "ausente" **não** virou "warning".
   Consequência deliberada: o tom `neutral` existe só para o "offline" de *presença* (ausência de
   sinal, `bg-muted`), enquanto o "offline" de *status efetivo* continua `destructive` (falha ativa)
   — a mesma palavra com dois pesos, porque são duas medidas. `tests/tenant-storage-table.test.tsx`
   ("usa getDevicePresence (nunca device.status bruto) para o badge de status") continua passando
   **sem afrouxar a asserção**: os rótulos literais `ausente` e `offline` seguem renderizados.
9. **Achado lateral registrado, não corrigido**: `components/ui/table.tsx` é código morto — ver
   Backlog, item 9.

### Verificação executada

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ limpo, sem saída |
| `npm run lint` | ✅ limpo (`eslint app components lib … --max-warnings=0`) |
| `npm run build` | ✅ sem erro; as 10 rotas afetadas presentes na listagem (`/app/[clientSlug]`, `/computers`, `/servers`, `/processors`, `/storage`, `/network`, `/audit`, `/reports`, `/users`, `/admin/clients` via `/dashboard`) |
| `npx vitest run` (1ª) | ✅ **451/451 em 51 arquivos** |
| `npx vitest run` (2ª) | ✅ **451/451 em 51 arquivos** — estável, sem a flakiness "Vitest failed to find the current suite" |
| `agent-go/` | **N/A** — nenhum arquivo Go tocado |

**Nenhum teste precisou ser ajustado.** Os 451 continuam passando sem edição: os testes de tabela
asseveram comportamento (navegação da linha, `role`/`tabIndex`, `href` do hostname, contagem de
linhas, texto renderizado), não strings de classe CSS — que é a razão de a padronização ter sido
segura. A única mudança estrutural com risco real de quebrar teste era o `StatusPill` compartilhado,
e ela preservou os rótulos literais (`online`, `ausente`, `offline`, `Desconectado`).

### Definition of Done

| Item | Situação |
|---|---|
| Requisito atende `PRODUTO.md`/`PRODUCT.md` | ✅ Refinamento de apresentação de RF019; nenhum documento precisou mudar |
| RF e RN mapeados | ✅ RF019 (listagens); **RN010** preservada explicitamente na correção 8 (presença ≠ status efetivo). Nenhum ID novo criado |
| Caso de uso documentado | **N/A** — nenhum fluxo novo nem alterado; só a apresentação dos mesmos dados |
| Código implementado | ✅ 13 arquivos alterados + 1 novo (`components/ui/status-pill.tsx`) |
| Validação Zod e isolamento de tenant | ✅ **por não mudar nada disso** — nenhuma entrada externa, query, `where` ou guard foi tocado; a mudança é 100% de classe CSS e composição de componente de apresentação |
| Banco e migrations | **N/A** — nenhuma mudança de schema |
| Testes implementados e passando | ✅ 451/451 em 2 execuções. **Nenhum teste novo escrito**: a mudança é de classe CSS/apresentação, e a suíte deste projeto (corretamente) não asserta strings de classe — travar `px-5 py-4` num teste tornaria a próxima mudança de design uma quebra falsa. O comportamento que **importa** e que a mudança poderia ter quebrado (RN010 nos badges, navegação de linha, links) já é coberto pelos testes existentes, que passaram sem edição |
| Auditoria de segurança | **N/A** — nenhuma rota, guard, segredo, query ou superfície de RBAC tocada; por isso também não se aplica o teste de login real com os 4 papéis |
| Nenhuma regressão no build | ✅ `tsc`, `lint` e `build` limpos; `agent-go/` intocado |
| Critérios de aceite aprovados pelo usuário | ⏳ **Pendente** — é exatamente o que falta para virar 🟢. Não marcado como concluído nem commitado pelo `implementation-agent`, por instrução explícita |

### Fora de escopo deste ajuste

`components/device-detail-tabs.tsx` (exceção deliberada, correção 4). A badge "Ativo/Inativo" de
`app/users/page.tsx` e a "ativo/inativo" de `app/admin/clients/clients-panel.tsx`: são estado de
**conta**, não de dispositivo, e o escopo aprovado nomeou apenas `PresenceBadge` e `StatusPill` —
migrá-las para `components/ui/status-pill.tsx` é candidato natural, mas escopo novo. A duplicação
remanescente do mapa presença → (tom, ícone, rótulo) entre `tenant-storage-table.tsx` e
`tenant-recent-devices-table.tsx` (já existia antes; o escopo aprovado pedia que cada chamador
mantivesse o seu wrapper local). Remoção de `components/ui/table.tsx` (Backlog, item 9).

---

## Overhaul visual — Fase 1 de 4 (fundação e superfícies)

**Status**: 🟢 Concluída (2026-09-04). Execução direta pedida pelo usuário ("quero repaginação, mudar
a visualização; tudo do visual"), com autorização explícita para o orquestrador remover partes do
pedido com que não concordasse. É a primeira de **4 fases**: (1) fundação e superfícies — esta;
(2) app shell (sidebar, header, breadcrumbs, cabeçalho de página, CMD+K); (3) paginação nas tabelas
com sincronia de URL; (4) dashboard (hero, grid de KPI, painéis duplos). A ordem é deliberada: como
paleta e componentes compartilhados são centralizados, a Fase 1 sozinha repinta as 15 telas.

**Documento de design**: criado `DESIGN.md` na raiz (444 linhas) — não existia. Cobre paleta com o
papel de cada token, escala tipográfica, superfície/elevação, estados de interação, movimento
(incluindo `prefers-reduced-motion`), componentes de dado, acessibilidade e uma seção explícita de
proibições. É a referência das Fases 2–4.

**Decisões do orquestrador que alteraram o pedido original** (o usuário autorizou):

1. **Paleta como token OKLCH, nunca hex em componente.** O pedido trazia hex literais
   (`#090D16`, `#0EA5E9`…). Espalhar hex pelos componentes destruiria a centralização consolidada no
   ajuste pós-Sprint 15. Os hex foram convertidos para OKLCH e aplicados sobre os tokens que já
   existiam em `app/globals.css`.
2. **`animate-ping` não vai em linha de tabela.** Uma listagem de 142 máquinas renderizaria 142
   animações simultâneas. O ponto de status em linha é estático; o ping fica reservado a indicadores
   únicos por tela (o de agentes online chega na Fase 2).
3. **`backdrop-blur` só em superfície que se sobrepõe a conteúdo** (header fixo, modal, popover,
   drawer). Em card opaco sobre fundo chapado o blur não produz efeito visível e só custa GPU.
4. **Fonte Outfit não adicionada.** `Inter` e `JetBrains Mono` já estavam configuradas via
   `next/font/google`; trocar a fonte de interface inteira arriscaria layout shift em todas as telas
   sem contrapartida. O que faltava e foi feito: aplicar `font-mono tracking-tight` de forma
   consistente em todo dado técnico (IP, hostname, MAC, CPU, serial, portas), que era irregular.
5. **Gaveta de detalhes ao clicar na linha ficou fora** — hoje a linha navega para a página de
   detalhe; trocar por drawer é mudança de fluxo, não de visual.
6. **`app/admin/clients/**` e `app/users/page.tsx` intocados**, conforme o usuário determinou ao
   reverter o commit `65c5d96` nesses arquivos (ver `2425bd9`).

**Verificação independente do orquestrador.** O `implementation-agent` foi interrompido por limite de
sessão da API já com todo o código pronto, faltando só esta entrada de documentação — que foi escrita
pelo orquestrador. O código foi verificado integralmente: `npx tsc --noEmit`, `npm run lint` e
`npm run build` limpos; `npx vitest run` **451/451 em 51 arquivos**, sem nenhum teste alterado.

Além disso, duas afirmações do agente foram **conferidas por cálculo**, não aceitas de palavra:

- *Fidelidade da conversão hex → OKLCH*: reconvertendo cada token de volta para sRGB, todos caem a
  1–4 unidades do alvo (`--primary` `oklch(0.685 0.148 237)` → `#0aa5e9` para alvo `#0EA5E9`;
  `--background` → `#090d16` exato; `--card` → `#0d111d` exato; `--warning` → `#f59e0a` para
  `#F59E0B`; `--destructive` → `#ef4445` para `#EF4444`).
- *Contraste*: `--muted-foreground` (`#A2AAB5`) dá **8.03:1** sobre o card e **8.28:1** sobre o
  fundo — exatamente os números que o agente reportou. Todos os tons de estado passam AA sobre o
  card: primary 6.80, success 7.42, warning 8.77, destructive 5.00 (o mais apertado, ainda acima do
  piso de 4.5).

**Observação de percepção, registrada para não virar surpresa**: o fundo novo **não** é mais escuro
que o anterior. O `--background` antigo era `oklch(0.12 0.01 260)` ≈ `#040609`, quase preto puro; o
alvo pedido (`#090D16`) é ligeiramente mais claro, porém com cast azul frio. A mudança percebida é de
*temperatura e profundidade de camada*, não de escuridão bruta.

**Decisões de craft do agente que superaram o pedido** (avaliadas e mantidas):

- **A barra de disco virou gradiente de ESCALA, não de estado.** O pedido era gradiente
  Emerald→Amber→Crimson com marcações em 60% e 80%. O agente trocou o antigo
  `DISK_USAGE_TIER_BAR_CLASS` (mapa tier → cor chapada) por `disk-usage-scale`: a faixa inteira
  0–100% é pintada com as trocas de cor exatamente sobre os limiares, e a barra é um recorte dessa
  escala. Consequência boa: a cor passa a depender da **posição**, não do tier, então significa a
  mesma coisa entre discos e entre linhas. O tier continua governando o número ao lado e o filtro
  por faixa dos cards de KPI.
- **`DISK_USAGE_THRESHOLDS` como fonte de verdade única** (`lib/disk-usage.ts`), consumida tanto por
  `getDiskUsageTier` quanto pelas marcações visuais — sem isso, marca e cor poderiam divergir do tier
  sem nada acusar. A semântica exclusiva foi preservada: 60% ainda é "ok", 80% ainda é "warning".
- **`--accent` deixou de ser cor de marca** e virou a superfície de hover do sistema. O agente
  percebeu o efeito colateral: o halo decorativo de `app/login/page.tsx` usava `bg-accent/10` e teria
  ficado quase invisível; migrou para `--info` (o Neon Teal), que é a cor que ele pintava antes.
- **`prefers-reduced-motion` global** em `app/globals.css`, desligando animação e transição — mas
  preservando a cor de estado, com a nota correta de que "quem pediu menos movimento não pediu menos
  informação".

**Arquivos**: `app/globals.css` (paleta, utilitários e keyframes), `DESIGN.md` (novo),
`lib/table-styles.ts`, `lib/disk-usage.ts`, `components/ui/{summary-card,status-pill,badge,button,card,input}.tsx`,
`components/stat-cards.tsx`, as 6 tabelas de listagem de tenant, `app/app/[clientSlug]/network/page.tsx`
e `app/login/page.tsx`.

---

## Overhaul visual — Fases 2, 3 e 4 (shell, paginação e dashboard)

**Status**: 🟢 Concluídas (2026-09-08). As três rodaram **em paralelo**, cada uma com fronteira de
arquivos fechada e nenhuma escrevendo neste arquivo (a documentação foi escrita pelo orquestrador,
justamente para as três não colidirem aqui). Com isso o overhaul de 4 fases está completo.

### Fase 2 — App shell (sidebar, header, breadcrumbs, paleta de comando)

- **Fonte única de rota→nome**: `lib/shell-navigation.ts` (novo). Antes existiam **dois mapas
  divergíveis** dentro de `components/sidebar.tsx`: os `NavigationItem[]` do menu e a tabela
  `titles` de `getHeaderTitle`. Agora há uma tabela só (`TENANT_ROUTES`) alimentando menu, trilha e
  paleta; o que difere entre eles é o *filtro*, nunca o rótulo. Há teste que falha se alguém
  reintroduzir a divergência.
- **Breadcrumbs com RBAC**: o nível "Clientes" só vira link quando `canAccessClientList(user)`
  (`isPlatformAdmin || isOrgAdmin`); ORG_OPERATOR, CLIENT_VIEWER e papel `null` recebem texto, nunca
  âncora. Default sem a opção é texto (fail-closed). Isso é RBAC vazando por navegação, não detalhe
  estético — 10 testes cobrem, incluindo a prova de que um nível sem href não vira `<a>` na tela.
- **`Ctrl/⌘+K` real, não enfeite** (`components/command-palette.tsx`): abre, filtra as rotas do
  tenant já filtradas pelo papel, navega por setas, fecha no `Esc`. Usa `cmdk` e
  `components/ui/command.tsx`, **ambos já presentes** — nenhuma dependência nova. O listener global
  ignora `input`/`textarea`/`select`/`contenteditable` (senão sequestraria o Ctrl+K de quem digita
  num filtro). Foco preso, `role="dialog"`, retorno de foco. **Não** busca dispositivos no banco —
  isso exigiria rota de API com escopo de tenant, paginação e rate limit próprios; virou candidato
  a sprint futura.
- **Zero query nova no layout**, por decisão do agente: a pílula de frota deriva do
  `lastCollectionAt` que o layout já buscava, usando a **mesma** constante
  `ONLINE_PRESENCE_MINUTES` de `getDevicePresence` — para a pílula não dizer "frota ativa" enquanto
  a tabela ao lado mostra tudo como "ausente".
- Desvio deliberado do pedido verbatim: a sidebar usa `bg-sidebar/80`, **não** `bg-card/80`. O
  `DESIGN.md` §2.2 define a sidebar como camada um degrau *abaixo* do conteúdo; `bg-card`
  inverteria a hierarquia (menu mais claro que a tela que ele serve). O indicador ativo é um
  `<span>` posicionado e não `border-l-2`, senão o item ativo ganharia 2px de caixa e o texto andaria
  ao navegar.

### Fase 3 — Paginação unificada

- `lib/table-pagination.ts` (puro, sem React) + `components/ui/table-pagination.tsx`, consumidos
  pelas 6 tabelas. O rodapé recebe **o mesmo objeto `slice`** que produziu as linhas, justamente
  para não poder dizer um número enquanto a tabela mostra outro.
- **Decisão arquitetural: paginação client-side.** Server-side (`skip`/`take`) quebraria os cards de
  KPI da Sprint 15, que contam sobre o conjunto inteiro e têm invariantes de soma testadas — eles
  passariam a exigir queries de contagem próprias — e mexeria em query escopada por tenant, risco
  de RBAC injustificável numa fase de apresentação. **É paginação de apresentação, não ganho de
  escala**: o servidor continua carregando tudo. Está escrito com essas palavras no cabeçalho dos
  dois arquivos. Server-side virou item de Backlog.
- Ordem correta e testada: **filtrar → contar → paginar**. O rodapé conta o conjunto *filtrado*, e
  trocar filtro ou busca reseta para a página 1.
- **Substantivo parametrizado** (`itemNoun`): `/processors` lista **modelos**, `/audit` lista
  **registros** — um rodapé dizendo "dispositivos" numa tabela de modelos seria mentira.
- `parsePageSize`/`parsePageNumber` usam `/^-?\d+$/` em vez de `Number()` cru, porque
  `Number('1e2') === 100` e `Number('0x19') === 25` passariam pelo catálogo como valores legítimos
  vindos da URL. `?page=99` numa lista de 6 páginas cai na 6, nunca numa tela vazia.
- **`components/ui/pagination.tsx` (item 9 do Backlog, código morto) foi reescrito, não deletado.**
  As primitivas antigas não serviam: todo controle era `<a>` **sem `href`** — fora da ordem de
  tabulação, sem Enter/Espaço, sem estado desabilitado, de modo que "Anterior" desativado no extremo
  era inexprimível. Viraram `<button>`, com rótulos em português.
- **Mudança de comportamento registrada**: a checkbox "selecionar todos" de `/computers` e
  `/servers` passou a operar sobre a **página atual**, não sobre o conjunto filtrado inteiro —
  selecionar 142 máquinas fora da tela seria a checkbox mentindo sobre o próprio alcance.
- **Zero teste existente alterado** (as fixtures têm 1–6 linhas, abaixo do default de 25); 59 testes
  novos.

### Fase 4 — Dashboard de frota

- Hero de conformidade (`components/fleet-security-hero.tsx`), grid de 5 KPI navegáveis e painel
  duplo (`critical-devices-panel` | `recent-activity-panel`); `loading.tsx` refeito para a forma
  real, senão a página pula ao hidratar.
- **Ambiguidade real encontrada no brief**: o pedido dizia "Antivírus **Ativo** %", e esse agregado
  não existia — `securityCompliance` expõe `antivirusUpdatedPercent`, que é **outra medida**
  (assinatura atualizada), não o mesmo número com outra conta. Entregou "ativo" como pedido **e**
  "atualizado" como nota do mesmo bloco: antivírus ligado com assinatura velha não é conformidade, e
  mostrar só um dos dois esconderia isso.
- **Percentual sempre com base de cálculo à vista** ("3 de 5 máquinas com dado apurado") e
  `knownCount === 0` → **"Sem dado"**, nunca `0%` nem `NaN`. Há teste assertando inclusive por
  *ausência* de `0%` na tela.
- **Dois links que estavam prestes a mentir, corrigidos**: (a) os cards de status apontam para
  `/assets`, não `/computers` — o `summary` conta computadores **e** servidores, e `/computers`
  exclui servidor por definição, abrindo menos linhas do que o card promete; (b) o card de disco
  crítico usa o critério de **pior disco** (o mesmo de `/storage`, via `lib/disk-usage.ts`), não os
  buckets que somam a capacidade de todos os discos antes de calcular a %.
- **Micro-tendência não entregue, de propósito**: não existe série temporal *agregada de frota*
  nesta base (`MetricSample` é por dispositivo). Qualquer sparkline seria dado sintético num painel
  de operação. Card sólido com contexto real > gráfico mentiroso.
- **Descoberta desligada ≠ nada encontrado**: `discoveryEnabled` é fail-closed e o painel diz que a
  varredura está desligada, nunca "0 dispositivos descobertos" (RN017). O bloco de auditoria **some
  inteiro** sem permissão — lista vazia sugeriria "não houve atividade".
- Mudança visível: o `StatsGrid` (cards Windows 10 / Windows 11 / Servidores) saiu do dashboard. A
  informação não se perdeu — o recorte por SO segue no gráfico de distribuição logo abaixo, que já
  linka para a listagem filtrada.
- Passou a repassar `alertDiskThresholdGb` do tenant para `getDeviceReportRows`; antes a página
  omitia e caía no default de 10 GB, o que divergiria da configuração do cliente agora que
  `criticalDisks` alimenta o painel.

### Verificação independente do orquestrador

`npx tsc --noEmit`, `npm run lint` e `npm run build` limpos — **build sem nenhum warning** (o
`layout.tsx` chegou a emitir um sobre import nomeado de `version`, resolvido pela Fase 2 com import
default). `npx vitest run` **575/575 em 60 arquivos, estável em 2 execuções consecutivas**, e mais
2 execuções após as correções abaixo.

**Correção de contagem**: o alvo "451 testes" citado nos despachos já estava defasado — a baseline
real quando as fases começaram era **500**. O total final é 575 (39 da Fase 2, 59 da Fase 3, 26 da
Fase 4, menos sobreposição de arquivo).

**Três pontas soltas que os agentes relataram e o orquestrador corrigiu** (nenhuma estava dentro da
fronteira de quem a encontrou):

1. **`/assets` escrevia `?page=`/`?limit=` mas não lia de volta.** A rota compartilha
   `TenantComputersTable` com `/computers`, então herdou o rodapé — e recarregar caía na página 1
   com um `?page=3` obsoleto na barra de endereço. Corrigido lendo os dois via `parsePageNumber`/
   `parsePageSize`, igual `/computers`.
2. **Bug de precedência em `getInitials`** (`components/sidebar.tsx`, pré-existente):
   `(parts[0]?.[0] ?? '' + (parts[1]?.[0] ?? ''))` agrupa como `a ?? ('' + b)` porque `??` tem
   precedência **menor** que `+` — "Rodrigo Silva" produzia `R`, nunca `RS`. Corrigido com
   parênteses por termo.
3. **`DESIGN.md` desatualizado**: §11 ainda listava as Fases 2–4 como pendentes (agora descreve a
   cobertura de cada fase concluída) e §10 proibia "borda colorida de mais de 1px num lado só", que
   é exatamente o indicador de rota ativa — registrada a exceção, com a razão (navegação responde
   "onde estou", não categoriza) e a nota de que é `<span>` posicionado, não borda real.

---

## Sprint A1a — Hotfix de segurança no bootstrap do agente

**Status**: Concluída (aceita pelo gerente em 2026-10-14). Plano registrado pelo `sprint-planner` a
partir do relatório da Sprint A0. Portões: typecheck, lint e build:verify limpos; `npm test` com
806 testes / 63 arquivos (210 novos em `tests/provisioning-security.test.ts`). Dois achados fora de
escopo foram para o Backlog (itens 14 e 15).

**Objetivo**: fechar a injeção de PowerShell sem autenticação no `GET /api/agent/bootstrap` (achado
N1, severidade Alta) e a mesma superfície em `GET /api/agent/download-exe`. Ao final, nenhum valor de
`client`, `key` ou `serverUrl` fora de uma allowlist estrita chega a ser interpolado no script
`.ps1`, no comando `cmd.exe` de instalação ou no payload do `.exe`: a entrada inválida é
**rejeitada** (400, sem script no corpo), nunca "consertada".

### Origem do achado (rastreabilidade)

Relatório da **Sprint A0** (auditoria de segurança, `security-auditor`, verificação independente do
orquestrador, aprovado pelo gerente), **achado N1 — Alta — injeção de PowerShell sem autenticação**:

- `GET /api/agent/bootstrap` é público (`app/api/agent/bootstrap/route.ts`). O Zod atual é só
  `client: z.string().trim().min(2)`, `key: z.string().trim().min(16)` (`route.ts:9-12`).
- O script é montado por `buildBootstrapScript` (`lib/provisioning.ts:37-74`), que interpola
  `client`/`key`/`server` entre aspas simples. `escapePowerShellSingleQuoted`
  (`lib/provisioning.ts:7-9`) só dobra a aspa ASCII `'`, mas o PowerShell também trata **U+2018,
  U+2019, U+201A e U+201B** como aspa simples.
- Prova por parse (sem execução): um payload com U+2019 na `key` vira comando executável na linha 12
  do script, **depois** do check de Administrador. O comando oficial de instalação é
  `irm '<url>' | iex` (`lib/provisioning.ts:32`) e a rota responde `text/plain; charset=utf-8` — ou
  seja, quem cola o comando de instalação executa o que vier.
- Mesma superfície, mesmo Zod frouxo: `GET /api/agent/download-exe`
  (`app/api/agent/download-exe/route.ts:10-13`) embute `client`/`key` no payload do `.exe`. O
  relatório A0 aprovado propôs a allowlist "em bootstrap e download-exe".
- Entrada não confiável adicional: o `$server` do script vem de `getCurrentServerUrl()`
  (`lib/server-url.ts`), que sem env (`INVENTARIO_SERVER_URL`/`APP_URL`/`NEXT_PUBLIC_APP_URL`) usa os
  cabeçalhos `x-forwarded-host`/`host` e `x-forwarded-proto` (`lib/server-url.ts:40-47`).
- `installCommand` (`lib/provisioning.ts:33`) interpola `client`/`key` entre aspas duplas de
  `cmd.exe` — mesma classe de problema, outro interpretador.

Fatos verificados que fundamentam as regras (orquestrador, Sprint A0):

- A chave de instalação é sempre 32 bytes em hex minúsculo = 64 caracteres (`lib/auth.ts:12-23`,
  `generateSecret`). A regex `^[a-zA-Z0-9_-]{16,128}$` aceita todas as chaves legítimas.
- Todos os slugs existentes no banco casam com `^[a-z0-9-]+$` e têm de 2 a 64 caracteres (consulta
  SQL: zero violações). A allowlist de `client` não invalida nenhum tenant real.

### RFs relacionados

- **RF002** — Cadastro de tenant (`createClientAction` gera a `enrollmentKey` que alimenta o
  bootstrap; o fluxo não pode quebrar).
- **RF003** — Enrollment de agente (o script de bootstrap e o `.exe` com config embutida são o
  caminho de instalação que leva ao `POST /api/agent/register`).

### RNs / RNFs relacionados

- **RN005** — só o hash das credenciais é persistido; esta sprint **não** muda o formato da chave nem
  o modelo de exibição (D3 já ratificado).
- **RNF002** — validação por schema Zod antes de qualquer efeito colateral; aqui estendida ao
  conteúdo que vira código executável na máquina do cliente.
- **RNF003** — princípio de allowlist / defesa em profundidade (validação na rota **e** na função de
  montagem do script).

### Casos de uso

- `docs/PRODUCT.md` §3.1 (cadastro de tenant → passo de instalação) e §3.2 (enrollment do agente:
  download via `/api/agent/download-exe` com `client`/`key` na query string, ou script bootstrap).
- `docs/SPEC.md` §2 (`GET /api/agent/bootstrap`) e §3.6 (schema inline do bootstrap).

### Entidades de banco

Nenhuma alteração de schema. Entidade **lida indiretamente** como referência de formato: `Client`
(`slug`, `enrollmentKeyHash`). Nenhuma migration, nenhum `db push`, nenhum backup necessário.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1 — Schema Zod estrito e **compartilhado** para `client`/`key`, num único módulo importado pelas duas rotas: `client` `/^[a-z0-9-]+$/` (min 2, max 64); `key` `/^[a-zA-Z0-9_-]{16,128}$/`. Aplicado em `app/api/agent/bootstrap/route.ts` **e** `app/api/agent/download-exe/route.ts`. Parâmetro inválido → `400` sem script/binário no corpo | RF003, RNF002 | PRODUCT §3.2; SPEC §2, §3.6 | Client (formato de `slug`) | security-auditor (A0, N1) |
| 2 — Validação por allowlist em `lib/provisioning.ts` que **lança erro** (rejeita, não sanitiza): `buildBootstrapScript` e `installCommand` recusam `client`/`key` fora da allowlist (cobre `\r`, `\n`, backtick, `$`, aspas de qualquer tipo, caracteres de controle) | RF002, RF003, RNF003 | PRODUCT §3.1, §3.2 | — | security-auditor (A0, N1) |
| 3 — Validação do `serverUrl` dentro de `buildBootstrapScript`: URL parseável, protocolo `http`/`https`, sem aspas de nenhum tipo (ASCII e U+2018–U+201B), sem backtick, sem `$`, sem quebra de linha ou caractere de controle; inválido → lança erro e a rota responde `400`/`500` sem script | RF003, RNF003 | PRODUCT §3.2 | — | security-auditor (A0, N1 — `lib/server-url.ts:40-47`) |
| 4 — Segunda camada: `escapePowerShellSingleQuoted` passa a dobrar também U+2018, U+2019, U+201A e U+201B | RNF003 | — | — | security-auditor (A0, N1) |
| 5 — Testes TDD em `tests/provisioning-security.test.ts` (vermelho primeiro), cobrindo função e rotas | RNF002 | — | — | security-auditor (A0, N1); gerente |

### Desvio registrado em relação ao texto do gerente

O gerente especificou o arquivo de teste como `__tests__/provisioning-security.test.ts`. O
`vitest.config.ts` só inclui `tests/**/*.test.{ts,tsx}` — nesse caminho o arquivo **nunca rodaria** e
a suíte ficaria verde sem testar nada. O arquivo deve ser criado em
**`tests/provisioning-security.test.ts`**. Mudança só de localização; o conteúdo exigido é o mesmo.

### Restrições de compatibilidade

Consumidores de `lib/provisioning.ts` que não podem quebrar: `app/admin/clients/actions.ts`,
`app/api/agent/bootstrap/route.ts`, `app/api/clients/[id]/credentials/route.ts`. Como as funções
passam a lançar em entrada inválida, o implementador deve confirmar que os três chamadores só
recebem slugs/chaves legítimos (gerados pelo próprio sistema) ou tratam o erro sem vazar stack trace.

### Critérios de aceite

- [x] Existe **um único** schema Zod para `client`/`key`, importado por
      `app/api/agent/bootstrap/route.ts` e por `app/api/agent/download-exe/route.ts` (nenhuma das
      duas rotas define a regex inline): `client` `/^[a-z0-9-]+$/` com min 2 e max 64; `key`
      `/^[a-zA-Z0-9_-]{16,128}$/`.
- [x] `GET /api/agent/bootstrap` responde `400` **sem script no corpo** para cada payload malicioso
      em `client` e em `key`: `\n`, `\r\n`, aspa ASCII `'`, U+2018, U+2019, U+201A, U+201B, backtick,
      `$(...)`, `;`, `|`, `&`, NUL e outros caracteres de controle, e `calc.exe` injetado — um caso de
      teste por payload.
- [x] `GET /api/agent/download-exe` responde `400` **sem binário no corpo** para o mesmo conjunto de
      payloads, um caso de teste por payload.
- [x] `GET /api/agent/bootstrap` e `GET /api/agent/download-exe` respondem `200` com slug real
      (ex.: `core-ti-expert`) e chave legítima de 64 caracteres hex.
- [x] `buildBootstrapScript` e `installCommand` **lançam erro** (teste com `toThrow`) para cada
      payload malicioso em `client`/`key` — rejeição, não sanitização silenciosa.
- [x] `buildBootstrapScript` **lança erro** para `serverUrl` malicioso: não parseável, protocolo
      diferente de `http`/`https`, contendo aspa ASCII ou U+2018–U+201B, backtick, `$`, `\r`/`\n` ou
      caractere de controle.
- [x] Teste de rota com `serverUrl` malicioso vindo dos cabeçalhos `host`/`x-forwarded-host` (sem env
      de URL configurada) responde `400`/`500` **sem script no corpo**.
- [x] `escapePowerShellSingleQuoted` dobra `'`, U+2018, U+2019, U+201A e U+201B (teste unitário por
      caractere).
- [x] Teste de não-regressão de formato: uma chave gerada por `generateEnrollmentKey()` passa no
      schema compartilhado (garante que a allowlist não rejeita chave legítima se o gerador mudar).
- [x] Testes escritos em `tests/provisioning-security.test.ts` (não em `__tests__/`), e o relatório
      do implementador mostra a execução **vermelha** antes da correção.
- [x] Fluxos de `app/admin/clients/actions.ts` e `app/api/clients/[id]/credentials/route.ts`
      continuam verdes nas suítes existentes.
- [x] Portão 1: `npm run typecheck` limpo.
- [x] Portão 2: `npm run lint` limpo.
- [x] Portão 3: `npm run build:verify` limpo — **não** rodar com o `next dev` em background de pé; o
      implementador avisa o orquestrador antes do build.
- [x] Portão 4: `npm test` verde com **mais de 596 testes** (baseline atual: 596 testes / 62
      arquivos; o total deve subir).
- [x] Sem commit e sem push.

### Fora de escopo desta sprint

- **N6** — hash do `.exe` verificado no bootstrap (achado separado; sprint própria).
- **N10** — rate limit por `X-Forwarded-For` (achado separado).
- **F1–F8 e E\*** do relatório A0 — não tratados aqui.
- Qualquer UI, `/admin/clients/**` (além de não quebrar `actions.ts`) e `app/users/page.tsx`.
- Mudança do formato da chave de instalação ou do modelo de exibição da chave (**D3 já
  ratificado**).
- Conferência de `client`/`key` contra o banco nas rotas `bootstrap`/`download-exe` — o desenho
  "validar só no `register`" continua como está (PRODUCT.md §4, "achado de simetria"); esta sprint
  só restringe o **formato**.

### Documentação que ficará desatualizada (não editada por este plano)

- `docs/SPEC.md` §3.6 descreve o schema do bootstrap como `client: string.min(2)` — passa a estar
  errado após esta sprint e deve ser atualizado junto da implementação, incluindo o `400` no contrato
  de `GET /api/agent/bootstrap` (§2).
- `docs/PRODUCT.md` §4 (contrato de `download-exe`) não menciona `400` por parâmetro fora da
  allowlist.

---

## Sprint A1 — Corretude e confiança do fluxo "Gerar agente"

**Status**: Concluída (aceita pelo gerente em 2026-10-15; 851 testes / 68 arquivos; visual-qa e security-auditor sem regressão; os achados 1 e 2 de acessibilidade do visual-qa foram corrigidos na própria sprint, os 3 e 4 foram para o Backlog, itens 16 e 17). O `sprint-planner` registrou o plano a partir do relatório da
Sprint A0 e do escopo aprovado pelo gerente (`PLANO_SPRINTS_COLABORACAO.md` §3.1, §3.2 E4/E8 e
§6.1 D1, D3, D11, D12). Depende da A1a (concluída, commit `c28deff`). Este plano não altera nenhuma
linha de código. As linhas citadas abaixo foram conferidas contra o código em 2026-10-14, depois de
`c28deff`.

**Objetivo**: em cada passo do fluxo "Gerar agente", o administrador sabe o que aconteceu com a chave
de instalação e com a primeira máquina, e nada acontece em silêncio. A rotação pede confirmação e
mostra o pacote novo ou o erro. O passo 3 do assistente tem saída de erro e tempo esgotado. A copy e
a documentação dizem a verdade sobre a chave reexibível (D3 = A). As duas telas do admin deixam de
quebrar abaixo de 1024 px.

### Origem do achado (rastreabilidade)

Os achados vêm do relatório da **Sprint A0**. Participaram `backend-auditor`, `security-auditor`,
`requirements-auditor`, `test-auditor`, `designer-ui` e `visual-qa`, com verificação independente
do orquestrador e aprovação do gerente. Estão consolidados em `PLANO_SPRINTS_COLABORACAO.md` §3.1 e
§3.2.

- **F1 — rotação sem feedback e sem confirmação** (`backend-auditor`, `designer-ui`; reproduzido no
  navegador pelo `visual-qa` na A0). Em `app/admin/clients/clients-panel.tsx:166`,
  `const [, rotateAction] = useActionState(rotateEnrollmentKeyAction, initialProvisioningState)`
  descarta o resultado. O form fica em `:385-389`. O hash muda, a tela não muda nada, não há
  confirmação e os erros da rotação também somem.
- **F2 — formulário inline morto** (`backend-auditor`, `designer-ui`). `showCreateForm` (`:161`)
  nunca vira `true`. O bloco morto ocupa `:275-327`, com `Card`, campo `slug` e o botão "Criar e
  emitir pacote". `PackagePanel` (`:64-85`) só é renderizado em `:255`, alimentado por `createState`,
  que vem do formulário morto.
- **F3 — copy e docs contra D3 = A** (`requirements-auditor`, `security-auditor`). Os trechos estão
  listados no item 6 do Escopo.
- **F6 — passo 3 sem saída de erro** (`backend-auditor`, `designer-ui`).
  `app/admin/clients/novo/new-client-wizard.tsx` tem `if (!response.ok) return` (`:82`), que engole
  401/404/500, e um `catch` vazio (`:85-87`). O polling roda a cada 5 s (`:91`) e "Aguardando a
  primeira máquina…" (`:211`) fica na tela para sempre.
- **E8 — acentuação e idioma das mensagens** (`designer-ui`, ampliado na A0).
  `app/admin/clients/actions.ts` é a fonte. As strings estão listadas no item 9 do Escopo.
- **E4 — admin quebra abaixo de 1024 px** (`visual-qa`, medido na A0; subiu da A2 por **D11**).
  `pl-64` sem `lg:` aparece em `app/admin/clients/page.tsx:80` e em
  `app/admin/clients/novo/page.tsx:29`, e `<main className="p-6">` em `:82` e `:31`. Em 390 px o
  `main` começa em 256 px e a página rola na horizontal de 198 a 686 px. Em 1024 px a tabela
  transborda 52 px.

Fatos verificados no código que fundamentam as regras desta sprint:

- `rotateEnrollmentKeyAction` (`actions.ts:199-280`) **já devolve o pacote completo** via
  `buildState` (`:265-271`): `clientId`, `clientName`, `clientSlug`, `enrollmentKey`,
  `bootstrapUrl`, `bootstrapCommand` e `installCommand`, mais `message`. O F1 não muda o contrato da
  action, só passa a consumir o retorno.
- A rotação só atualiza `Client.enrollmentKeyHash` e `activeProvisioningKeyEnc`
  (`actions.ts:243-261`) e **não toca `AgentAuth`**. As máquinas já registradas continuam o
  check-in com a própria `apiKey`. Isso confirma o fato da A0.
- A coluna "Agentes" de `/admin/clients` (`page.tsx:34-38`, `:48`) conta `_count.agents` **sem
  filtro**, ou seja, inclui `AgentAuth` revogados (`revokeAgentAuthAction` grava `isActive: false` e
  `revokedAt`, `actions.ts:333-336`). Esse número **não serve** para o diálogo de confirmação. A
  contagem do F1 deve usar `isActive: true`, o mesmo critério de
  `app/api/clients/[id]/status/route.ts:30`.
- `GET /api/clients/[id]/credentials` já exige `canManageTenant` (`route.ts:66`) e já grava
  `credentials.view` (`:72`, `:98`). Não é preciso item novo de auditoria. A condição do rascunho do
  PLANO §7 ("se não gravar AuditLog, propor") não se aplica.
- O drawer mobile **já existe** dentro de `Sidebar` (`components/sidebar.tsx:314-367`: botão
  `lg:hidden` e `aside` com `-translate-x-full` até `lg`). A casca do tenant
  (`app/app/[clientSlug]/layout.tsx:60` e `:66`) usa `flex-1 lg:pl-64` e `p-4 lg:p-6`. O que quebra
  no admin é só o `pl-64` fixo e o `p-6` das duas páginas.
- A tabela de clientes **já está** dentro de `overflow-x-auto` (`clients-panel.tsx:336`), e mesmo
  assim a A0 mediu 52 px de transbordo em 1024 px. Hipótese, que o implementador deve confirmar (este
  plano não a decide): a coluna `flex-1` (`page.tsx:80`) sem `min-w-0` deixa o min-content da tabela
  alargar o item flex e anula o `overflow-x-auto`. O critério de aceite é a medição, não a técnica.
- `components/ui/alert-dialog.tsx` já existe no projeto. Nenhum componente novo de terceiros é
  necessário.

### RFs relacionados

- **RF002**: cadastro de tenant. O texto atual ("exibe a chave em claro uma única vez") está errado
  diante de D3 e é corrigido no F3.
- **RF003**: enrollment de agente. "`enrollmentKey` de uso único" é falso, porque a chave é
  reutilizável até ser rotacionada. Corrigido no F3. A rotação do F1 é o ciclo de vida dessa chave.

### RNs / RNFs relacionados

- **RN005**: "apenas o hash é persistido". Para a `enrollmentKey`, o banco também guarda a cópia
  cifrada (`Client.activeProvisioningKeyEnc`, AES-256-GCM). O texto precisa de nuance (F3). A
  `apiKey` segue só com hash.
- **RN015**: rotação e reexibição de credenciais usam `canManageTenant`, não `hasClientsAdminAccess`
  (comentário em `actions.ts:220-223`). Esta sprint **não muda** nenhum guard.
- **RNF002**: validação Zod antes de efeito colateral. As mensagens passam a sair em pt-BR (E8).
- **RNF004**: isolamento multi-tenant. A contagem de máquinas do F1 fica escopada ao cliente já
  filtrado por organização em `getClients` (`page.tsx:26`).
- **RNF009**: auditabilidade. `credentials.rotate` e `credentials.view` continuam gravando
  `AuditLog`. O custo aceito da D3 é registrado em ADR (F3).

### Casos de uso

- `docs/PRODUCT.md` §3.1 (cadastro de tenant: passo 4 e pós-condição) e §3.2 (enrollment).
- `docs/PRODUTO.md` §7 ("Como o cliente fica vinculado", passo 1).
- **Lacuna de DoD (item 3)**: não existe caso de uso de **rotação da chave de instalação** em
  `docs/PRODUCT.md` §3, e o F1 altera esse fluxo (confirmação, pacote novo, erro). Este plano
  **propõe**, para o gerente aprovar ou cortar, um fluxo alternativo curto "Emitir novo pacote" no UC
  §3.1 (Ator `canManageTenant`, Pré-condição, Fluxo, Exceções). O planner não decide sozinho.

### Entidades de banco

Nenhuma alteração de schema, migration, `db push` ou backup.

Entidades **lidas**:
- `Client`: `enrollmentKeyHash`, `activeProvisioningKeyEnc`, `activeProvisioningSetAt`.
- `AgentAuth`: `clientId`, `isActive`, `revokedAt`, para a contagem do diálogo.
- `Device`: passo 3, via a rota de status já existente.
- `AuditLog`: `credentials.rotate` e `credentials.view` continuam sem mudança.

Fixture de teste manual e visual: o cliente `teste-a0-rotacao` (D12). **Nunca rotacionar
`core-ti-expert`.**

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1 — **F1 (TDD, vermelho primeiro)**: teste de componente em `tests/` (`// @vitest-environment jsdom`) para o painel de clientes. O clique em "Emitir novo pacote" abre um `AlertDialog` e **não** chama a action. "Cancelar" não chama a action. "Confirmar" chama. Sucesso exibe o pacote novo e o aviso. Erro exibe a mensagem. A execução vermelha aparece no relatório antes da correção | RF003, RNF009 | PRODUCT §3.1 | — | backend-auditor, designer-ui, visual-qa (A0, F1) |
| 2 — **F1, confirmação**: `AlertDialog` antes de rotacionar. O texto diz quantas máquinas **continuam funcionando** (contagem de `AgentAuth` com `isActive: true` do cliente, que **não** é o `_count.agents` atual) e que instaladores, comandos e pacotes antigos param de funcionar. Singular/plural e caso zero tratados | RF003, RN015, RNF004 | PRODUCT §3.1 | AgentAuth, Client | backend-auditor (A0, F1); fato verificado na A0 (rotação não revoga AgentAuth) |
| 3 — **F1, resultado**: capturar o estado de `useActionState(rotateEnrollmentKeyAction, …)` (hoje `:166`). Em sucesso, renderizar `PackagePanel` (`:64`) com o pacote novo e o aviso de revisar instaladores antigos. Em erro, exibir `state.error`. O botão "X" de dispensar continua funcionando. Feito **antes** de apagar o código morto (item 4) | RF003 | PRODUCT §3.1 | Client | backend-auditor (A0, F1) |
| 4 — **F2**: remover `showCreateForm` (`:161`), o bloco `:275-327` (`Card`, campo `slug`, botões) e tudo que ficar órfão: `useActionState(createClientAction)`, o espelho `createState → result` (`:173-186`), `setProvisioningServerUrl`, a prop `createClientAction` de `ClientsPanel` e o wrapper em `page.tsx:67-70`/`:101`, mais os imports sem uso. O painel de resultado (`:252-273`) **não** é apagado: passa a servir à rotação (item 3) | RF002 | — | — | backend-auditor, designer-ui (A0, F2) |
| 5 — **F3, copy de UI**: em `components/agent-install-package.tsx:44`, a variante `keyIsFresh` deixa de dizer "Ela não será exibida novamente…" e passa a dizer que a chave fica guardada cifrada e pode ser consultada em "Ver credenciais" por quem administra o cliente, mantendo o aviso de credencial sensível. Coerente com `:45` | RF002, RN005 | PRODUCT §3.1 | — | requirements-auditor, security-auditor (A0, F3; D3) |
| 6 — **F3, API e docs** (só texto). Ver a lista de trechos logo abaixo da tabela | RF002, RF003, RN005 | PRODUCT §3.1, §3.2; PRODUTO §7 | Client, AgentAuth (só documentação) | requirements-auditor (A0, F3; D3) |
| 7 — **F3, ADR 0005**: `docs/adr/0005-enrollment-key-reexibivel.md` (nome sugerido) registra a D3: chave reexibível, cifrada com AES-256-GCM, acesso só por `canManageTenant`, cada visualização grava `credentials.view`. Registra o **custo aceito**: uma sessão de `ORG_ADMIN` sequestrada lê a chave, e a rotação não contém `AgentAuth` já registrados (contenção fica para a A3/N4). Mais uma entrada no índice de `docs/adr/README.md` | RN005, RN015, RNF009 | — | Client, AgentAuth, AuditLog | security-auditor (A0, D3) |
| 8 — **F6 (TDD, vermelho primeiro)**: ver o detalhamento logo abaixo da tabela | RF003 | PRODUCT §3.2 | Device, AgentAuth (leitura via rota existente) | backend-auditor, designer-ui (A0, F6; N2); E5 parcial (só `role="status"`) |
| 9 — **E8**: corrigir acentuação e idioma das strings de interface de `app/admin/clients/actions.ts` e trocar as mensagens padrão do Zod em inglês. Ver a lista logo abaixo da tabela | RNF002 | — | — | designer-ui (A0, E8 ampliado) |
| 10 — **E4**: casca responsiva igual à do tenant nas duas páginas do admin. `pl-64` vira `lg:pl-64` e `p-6` vira `p-4 lg:p-6` (ou um layout compartilhado que reproduza isso). A tabela de clientes não transborda a página em nenhuma largura. O drawer da `Sidebar` (já existente) abre abaixo de `lg` | — | — | — | visual-qa (A0, E4; D11) |

**Item 6, trechos que mudam:**
- `app/api/clients/route.ts:103`: "Guarde a enrollmentKey - ela não será exibida novamente." (só a
  string).
- `docs/PRODUTO.md:136`, §4.2, invariante 3 ("Segredos só existem em plaintext uma vez… o banco
  guarda apenas hash").
- `docs/PRODUTO.md:255`, §7, passo 1 ("exibida **uma única vez**").
- `docs/PRODUCT.md:20`, RF002 ("exibe a chave em claro uma única vez").
- `docs/PRODUCT.md:21`, RF003 ("`enrollmentKey` de uso único").
- `docs/PRODUCT.md:75`, RN005 (falta mencionar a cópia cifrada da `enrollmentKey`).
- `docs/PRODUCT.md:102`, UC 3.1, passo 4 ("grava apenas `enrollmentKeyHash`… exibida uma única
  vez").
- `docs/PRODUCT.md:413`, §6.2, passo 1 ("grava só `enrollmentKeyHash`").
- `docs/PRODUCT.md:673`, glossário ("de uso único por `Client`").
- `docs/SPEC.md:25` ("a chave em claro só existe nesta resposta, uma vez").
- **Não mudar** nada sobre a `apiKey`: `PRODUCT.md:118`, `:416`, `SPEC.md:145` e
  `app/api/agent/register/route.ts:82` estão corretos.

**Item 8, F6 em detalhe** (`new-client-wizard.tsx`):
- Erro de polling visível. HTTP não-ok (401/404/500) e falha de rede deixam de ser engolidos (hoje
  `:82` e `:85-87`).
- Depois de **3 min** sem check-in, mostrar um checklist:
  - executar como Administrador;
  - firewall/porta liberados;
  - servidor alcançável pela rede do cliente. O instalador usa o **endereço do servidor
    configurado**, não o digitado no passo 1 (N2 da A0).
- Distinguir o estado "agente registrado, aguardando primeira coleta" (`agentCount > 0` e
  `device === null`, ambos já devolvidos por `/api/clients/[id]/status`).
- Região `role="status"` (aria-live) para o estado do passo 3.
- Estado derivado, sem `setState` no corpo do efeito (lint `react-hooks/set-state-in-effect`).
- Testes de componente com jsdom e fake timers.

**Item 9, strings de `app/admin/clients/actions.ts`:**
- `:22` "Use apenas letras minusculas, numeros e hifens."
- `:47` "Acesso administrativo nao autorizado."
- `:127`, `:214`, `:296` "Payload invalido."
- `:136` "Nao foi possivel gerar um identificador valido para o cliente."
- `:145` "Ja existe um cliente com esse slug." Reescrever para quem não vê slug, por exemplo "Já existe
  um cliente com esse nome." Ver as divergências abaixo.
- `:182` "Cliente criado e pacote de instalacao emitido."
- `:231` "Cliente nao encontrado."
- `:265` "Enrollment key rotacionada. Revise os instaladores antigos." Passa a falar em "chave de
  instalação".
- `:275` "Erro interno ao rotacionar a enrollment key."
- `:325` "Credencial de agente nao encontrada."
- Mensagens padrão do Zod 3 em inglês, que vazam por `issues[0]?.message`:
  - `serverUrl: z.string().trim().url()` em `:17` e `:27` → "Invalid url";
  - campo ausente (`formData.get` → `null`) → "Expected string, received null";
  - `clientId` `.min(1)` em `:28` → "String must contain at least 1 character(s)".
- Comentários de código ficam fora: só strings de interface.

Ordem de execução recomendada:
1. teste vermelho do F1 (item 1);
2. F1 (itens 2 e 3);
3. F2 (item 4);
4. F3 (itens 5 a 7);
5. E8 (item 9);
6. teste vermelho do F6 e depois o F6 (item 8);
7. E4 (item 10);
8. portões;
9. `visual-qa`;
10. `security-auditor` sobre o diff.

### Divergências registradas em relação ao texto do gerente

1. **"PRODUCT.md §4.2 e §7"**: a invariante "§4.2 invariante 3" e o "passo 1 de §7" estão em
   **`docs/PRODUTO.md`** (`:136` e `:255`), não em `PRODUCT.md`. Em `docs/PRODUCT.md`:
   - **§4.2** trata de relacionamentos e cascades e não tem nada a mudar;
   - **§7** (matriz RBAC) já cobre o caso em `:448` ("Administrar tenant (credenciais, …)" →
     `canManageTenant`), então **não há mudança obrigatória**. Citar `credentials.view` na nota da
     matriz é opcional e fica a critério do gerente.
2. **Trechos de docs além dos citados pelo gerente**, incluídos no item 6 porque contradizem D3:
   `PRODUCT.md:75` (RN005), `:413` (§6.2) e `SPEC.md:25`.
   - **Fora dos caminhos permitidos**: `CONTEXT.md:40` (raiz do repositório) repete "de uso único".
     Não está em `docs/`, então fica desatualizado até o gerente liberar.
   - `docs/PRODUTO.md:298` narra o redesenho antigo ("destacar que a chave só aparece uma vez"). É
     texto histórico. O gerente decide se ganha uma nota ou fica como está.
3. **Tamanho do código morto**: o bloco realmente inacessível é `:275-327` (53 linhas), mais o
   espelho `:173-186` e as declarações e props órfãs, perto de 80 a 90 linhas no total. Os "~120"
   medidos na A0 incluíam o painel de resultado (`:252-273`), que **não** deve ser apagado: ele vira
   o feedback da rotação.
4. **Contagem de máquinas**: a coluna "Agentes" já existente inclui `AgentAuth` revogados
   (`page.tsx:34-38`). O diálogo precisa de contagem própria (`isActive: true`). Se o implementador
   preferir corrigir a própria coluna, isso muda um número visível na tabela e deve ser reportado
   como desvio, não feito em silêncio.
5. **Tabela em 1024 px**: o `overflow-x-auto` pedido já existe (`clients-panel.tsx:336`). A causa
   provável é a falta de `min-w-0` no item flex (hipótese, não decidida).
6. **"Já existe um cliente com esse nome."**: o slug é derivado do nome por `slugifyClientName`, então
   nomes diferentes podem colidir (ex.: "Acme Ltda" e "ACME LTDA."). O texto sugerido pode confundir
   nesse caso. Alternativa: "Já existe um cliente com esse nome ou com um nome equivalente." Escolha
   do gerente. O `createClientSchema` mantém o campo `slug` opcional (a API e os testes existentes o
   usam). Só a UI morta que o enviava sai. Mover o campo `slug` para o assistente **não** está no
   escopo; se fizer falta, vira proposta para a A2.
7. `app/api/clients/route.ts:78` ("Já existe um cliente com esse slug.") **não** muda: nessa API o
   slug é um campo do payload, e o escopo autoriza só a string de `:103`.

### Restrições de compatibilidade

- Os testes existentes `tests/rotate-enrollment-key.test.ts` e `tests/create-client-action.test.ts`
  checam `result.error` só com `toBeTruthy()`/`toBeNull()`. A troca de texto do E8 não deve
  quebrá-los. Se algum teste afirmar o texto literal, o teste é atualizado junto, não removido.
- `AgentInstallPackage` tem três consumidores: o assistente, o diálogo "Credenciais ativas" e o
  estado vazio do dashboard do tenant (comentário em `:9-15`). A copy nova da variante `keyIsFresh`
  aparece no assistente e no `PackagePanel` da rotação.
- Nenhuma mudança de guard, de contrato de action ou rota, nem de formato da chave.

### Critérios de aceite

- [x] **F1, TDD**: existe teste de componente novo em `tests/` (`// @vitest-environment jsdom`), e o
      relatório do implementador mostra a execução **vermelha** antes da correção.
- [x] **F1, confirmação**: clicar em "Emitir novo pacote" abre um `AlertDialog` e **não** chama
      `rotateEnrollmentKeyAction`. "Cancelar" fecha sem chamar a action, e só "Confirmar" a chama
      (afirmado em teste com a action mockada).
- [x] **F1, contagem**: o diálogo mostra o número de `AgentAuth` **não revogados** (`isActive: true`)
      do cliente como máquinas que continuam funcionando, e avisa que instaladores e pacotes antigos
      param de funcionar. Teste com cliente de 2 credenciais ativas e 1 revogada exibe "2". Singular
      ("1 máquina") e zero cobertos.
- [x] **F1, resultado**: depois de rotação bem-sucedida, a tela exibe `PackagePanel` com a
      `enrollmentKey` **nova** e o aviso de revisar os instaladores antigos. Depois de rotação com
      erro, a tela exibe a mensagem de erro. Os dois casos são afirmados em teste.
- [x] **F1, segurança**: `rotateEnrollmentKeyAction` continua exigindo `canManageTenant` e gravando
      `credentials.rotate` (suítes existentes verdes, sem alteração de guard).
- [x] **F2**: `rg "showCreateForm|name=\"slug\"" app/admin/clients` não retorna nada. `ClientsPanel`
      não recebe mais `createClientAction`. Nenhum import ou estado órfão sobra (lint limpo). O
      painel de resultado continua existindo, agora alimentado pela rotação.
- [x] **F3, UI**: `components/agent-install-package.tsx` não contém mais "não será exibida
      novamente". A variante `keyIsFresh` diz que a chave fica guardada cifrada e pode ser
      consultada em "Ver credenciais" por quem administra o cliente, e mantém o aviso de credencial
      sensível (afirmado em teste de componente).
- [x] **F3, API**: a `message` de `POST /api/clients` (`app/api/clients/route.ts:103`) não afirma mais
      que a chave não será exibida novamente. Nenhuma outra linha dessa rota muda.
- [x] **F3, docs**: os trechos listados no item 6 do Escopo passam a descrever a regra D3 = A (chave
      reutilizável até rotacionar, reexibível só por `canManageTenant`, cifrada com AES-256-GCM, cada
      visualização gravando `credentials.view`). Os textos sobre a `apiKey` (`PRODUCT.md:118`, `:416`,
      `SPEC.md:145`, `register/route.ts:82`) continuam **inalterados**. O relatório lista linha por
      linha o que mudou.
- [x] **F3, ADR**: `docs/adr/0005-*.md` existe com contexto, decisão, consequências (incluindo os
      dois custos aceitos e a contenção adiada para a A3) e status. O índice de `docs/adr/README.md`
      ganha a entrada 5.
- [x] **F6, TDD**: existe teste de componente novo em `tests/` (`// @vitest-environment jsdom`, fake
      timers), e o relatório mostra a execução **vermelha** antes da correção.
- [x] **F6, tempo esgotado**: com fake timers, depois de 180 s sem `device`, o passo 3 exibe o
      checklist com os três itens (executar como Administrador; firewall/porta; servidor alcançável
      pela rede do cliente, com a observação de que o instalador usa o endereço do servidor
      configurado e não o digitado). Antes de 180 s o checklist não aparece. Um check-in que chega
      depois do tempo esgotado ainda leva ao estado de sucesso.
- [x] **F6, erro visível**: respostas 401, 404 e 500 da rota de status e uma rejeição de `fetch`
      produzem mensagem visível no passo 3, cada caso afirmado em teste. O `catch` vazio e o
      `if (!response.ok) return` silencioso deixam de existir.
- [x] **F6, registrado sem coleta**: `agentCount > 0` com `device === null` exibe o estado "agente
      registrado, aguardando primeira coleta", distinto de "aguardando a primeira máquina"
      (afirmado em teste).
- [x] **F6, acessibilidade**: o estado do passo 3 (aguardando, registrado, erro, tempo esgotado,
      conectado) fica dentro de uma região `role="status"`.
- [x] **F6, lint**: nenhum `setState` síncrono no corpo de `useEffect`; o tempo esgotado é estado
      derivado. `npm run lint` não acusa `react-hooks/set-state-in-effect`.
- [x] **E8**: nenhuma string de interface de `app/admin/clients/actions.ts` sai sem acento. Não
      resta "Enrollment key" em mensagem ao usuário. Entradas inválidas de `serverUrl` e `clientId`
      (URL inválida, campo ausente, vazio) devolvem mensagens em pt-BR, afirmadas em teste. A
      mensagem de nome duplicado não menciona "slug".
- [x] **E4**: `document.documentElement.scrollWidth <= document.documentElement.clientWidth` em
      **390, 1024 e 1440 px**, nas rotas `/admin/clients` e `/admin/clients/novo`, medido pelo
      `visual-qa` (Playwright MCP) com sessão de administrador. Em 390 px o `main` começa na borda
      esquerda (sem os 256 px) e o drawer da `Sidebar` abre e fecha.
- [x] **Verificação visual**: o `visual-qa` captura `/admin/clients`, `/admin/clients/novo` e o
      **diálogo de rotação** (aberto e depois de confirmar) nas três larguras. A rotação real é
      feita **só** no cliente `teste-a0-rotacao` (D12) e **nunca** em `core-ti-expert`.
- [x] **Segurança**: o `security-auditor` revisou o diff. Nenhuma regressão de guard
      (`canManageTenant`/`hasClientsAdminAccess`) nem de auditoria (`credentials.rotate`,
      `credentials.view`). Nenhuma rota ou action nova sem Zod, guard e escopo de tenant.
- [x] **Escopo de arquivos**: o diff toca só `app/admin/clients/**`,
      `components/agent-install-package.tsx`, `app/api/clients/route.ts` (só a string de `:103`),
      `docs/` e `tests/`. `app/users/page.tsx` intocado.
- [x] Portão 1: `npm run typecheck` limpo.
- [x] Portão 2: `npm run lint` limpo.
- [x] Portão 3: `npm run build:verify` limpo. **Não** rodar com o `next dev` de pé; o implementador
      avisa o orquestrador antes do build.
- [x] Portão 4: `npm test` verde com **mais de 806 testes** (baseline: 806 testes / 63 arquivos,
      depois de `c28deff`).
- [ ] DoD (`docs/DEFINITION_OF_DONE.md`): os 10 itens conferidos um a um, com ✅ ou N/A e
      justificativa. "Banco de dados e migrations" é N/A, porque não há mudança de schema.
- [x] Sem commit e sem push.

### Fora de escopo desta sprint

- **E1, E2, E3/N3, E5** (exceto o `role="status"` do F6), **E6, E7**: ficam para a **A2** (visual
  do fluxo).
- **F4** (instalador Linux na UI), **F5** (listar/revogar agentes), **N4** (revogar `AgentAuth` na
  rotação), **N5**, **N12**: ficam para a **A3**. O ADR 0005 registra que a contenção da rotação
  depende de N4.
- **F7/N2** (URL digitada ignorada pelo instalador): entra **só** como texto do checklist do F6, não
  como correção.
- Backlog: **N6, N7, N9, N10, N11** e os itens **14** e **15** do Backlog deste arquivo.
- Mover o campo `slug` para o assistente (ver a divergência 6).
- Qualquer arquivo fora de `app/admin/clients/**`, `components/agent-install-package.tsx`,
  `app/api/clients/route.ts` (só a string), `docs/` e `tests/`. `app/users/page.tsx` é proibido.

### Documentação que ficará desatualizada (não editada por este plano)

- `CONTEXT.md:40` (raiz do repositório): "`enrollmentKey` é de uso único por `Client`". Contradiz D3,
  mas está fora dos caminhos liberados para esta sprint. Precisa de liberação explícita do gerente.
- `docs/PRODUTO.md:298`: narrativa histórica do redesenho ("a chave só aparece uma vez"). O gerente
  decide se ganha nota.
- `PLANO_SPRINTS_COLABORACAO.md` §6 ainda mostra a A1a como "📋 Próxima" e a A1 como "📋 Proposta".
  Esse documento é do gerente; o planner não o edita.

---

## Sprint A2 — Visual do fluxo "Gerar agente"

**Status**: Concluída (2026-10-15). Implementada e auditada com sucesso; todos os 4 portões limpos (893 testes passando, typecheck, lint e build:verify verdes).
Sprint A0 (`PLANO_SPRINTS_COLABORACAO.md` §3.2 E1–E7, §6 linha da A2, §6.1 D1 e D12, e o bloco
"Backlog gerado pela S0"), do escopo definido pelo gerente e dos itens 16 e 17 deste Backlog
(achados do `visual-qa` na A1). Depende da A1 (concluída, commit `804d9a6`). Este plano não altera
nenhuma linha de código. As linhas citadas abaixo foram conferidas contra o código em 2026-10-15,
depois de `804d9a6`.

**Objetivo**: o fluxo "Gerar agente" (`/admin/clients` e `/admin/clients/novo`) passa a usar a
família fechada de superfícies e os tokens do `DESIGN.md`: sem cor literal, sem card dentro de
painel, tabela com `TABLE_*`, status com `StatusPill`, um `h1` por página, stepper legível por leitor
de tela e ações por linha com hierarquia. A `Sidebar` compartilhada deixa de prender o Tab com o
drawer fechado, fecha com Esc e mostra o nome cortado no `title`.

### Origem do achado (rastreabilidade)

Os achados E\* vêm do relatório da **Sprint A0** (`designer-ui` e `visual-qa`, com verificação do
orquestrador e aprovação do gerente), consolidados em `PLANO_SPRINTS_COLABORACAO.md` §3.2. Os itens
16 e 17 vêm do `visual-qa` da **Sprint A1**. O exemplo morto do `DESIGN.md` vem do Backlog da **S0**.
Estado atual de cada um, conferido no código:

- **E1, cor crua** (`designer-ui`, A0). `app/admin/clients/novo/new-client-wizard.tsx:175`
  (`border-emerald-500/40 bg-emerald-500/5`), `:181` (`bg-emerald-500/15`) e `:182`
  (`text-emerald-600`), no estado "conectou" do passo 3. O PLANO citava `:181,187,188`; as linhas
  andaram na A1.
- **E2, casca sem token** (`designer-ui`, A0).
  - `app/admin/clients/clients-panel.tsx`: `Card` do shadcn em `:80` (`PackagePanel`), `:120` e
    `:127` (dentro do diálogo de credenciais), `:346` (erro da rotação) e `:365` (casca da lista).
  - O estado vazio (`:368`) é uma caixa `rounded-lg border border-dashed` dentro desse `Card`: card
    dentro de card.
  - A tabela (`:373`) não usa `TABLE_SHELL_CLASS`, `TABLE_HEAD_ROW_CLASS`, `TABLE_HEAD_CLASS` nem
    `TABLE_CELL_CLASS` (`lib/table-styles.ts`). Os `<th>` em `:376-381` usam `font-medium` em vez de
    `.section-label`, e os `<td>` usam `px-4 py-3` em vez de `px-5 py-4 align-top`.
  - O assistente tem a mesma casca sem token, fora do texto do gerente: `rounded-xl border bg-card`
    sem `border-surface-line` em `new-client-wizard.tsx:174` (passo 3), `:268` (passo 1) e `:303`
    (passo 2).
- **E3/N3, `h1`** (`designer-ui`, A0; N3 do relatório A0).
  - O único `<h1>` do admin é a marca "Inventário TI" em `components/sidebar.tsx:375`.
    `/admin/clients` não tem `h1` por decisão registrada no comentário de `page.tsx:45-46`.
    `/admin/clients/novo` não tem `h1` nem na página nem no assistente (os passos são `h2`).
  - **Todas as 12 rotas** de `/app/[clientSlug]` têm `h1` de página incondicional, hoje somado ao da
    marca: `page.tsx:197`, `alerts:51`, `assets:69`, `assets/[id]:152`, `audit:82`,
    `computers:74`, `network:135`, `processors:60`, `reports:35`, `servers:80`, `settings:53`,
    `storage:77`. Nenhuma fica com zero `h1` quando a marca deixar de ser `h1`.
  - A `Sidebar` tem mais três consumidores, todos com `h1` próprio:
    `app/admin/clients/audit/page.tsx:87`, `app/users/page.tsx:54` e `app/security/page.tsx:95`.
    Ficam com exatamente um `h1` sem edição.
- **E4**: resolvido na A1. Não entra aqui.
- **E5, stepper** (`designer-ui`, A0; N13 do relatório A0).
  - `Stepper` em `new-client-wizard.tsx:30-57` já é um `<ol>` (`:32`), mas não tem
    `aria-current="step"` nem rótulo acessível.
  - O círculo concluído mostra só o ícone `Check` (`:46`), sem texto.
  - O rótulo some abaixo de `sm` (`hidden sm:inline`, `:48`): em 390 px o leitor de tela não ouve o
    nome do passo.
  - O conector (`:51`) não é `aria-hidden`.
  - Com a máquina conectada, `step` vale `2` (`:252`) e `done = index < current` (`:34`), então o
    passo 3 aparece "atual", nunca "concluído" (N13).
  - O erro do passo 1 (`:290-294`) não tem `role="alert"`. O `role="status"` do passo 3 já existe
    (`:172`, A1).
- **E6, diálogo como primeiro recurso** (`designer-ui`, A0). `CredentialsDialog` em
  `clients-panel.tsx:95-149`, `DialogContent className="sm:max-w-3xl"` (`:104`). Os estados de erro
  (`:120`) e "indisponível" (`:127`) são `Card` dentro do diálogo. `DESIGN.md` §10: "Modal como
  primeiro pensamento. Esgote inline/progressivo antes."
- **E7, hierarquia e status** (`designer-ui`, A0; estava como [hipótese], agora confirmado no
  código).
  - "Abrir painel" (`:401-408`) fica numa coluna própria, "Painel", com `variant="secondary"`.
  - "Ver credenciais" (`:417-420`, ícone `Eye`) e "Emitir novo pacote" (`:421-434`) estão na coluna
    "Instalação", ambos `outline`, com o mesmo peso. A rotação usa o ícone `Terminal` (`:432`), que
    não diz nada sobre emitir uma chave nova.
  - O status é um `Badge` (`:389-399`) com texto minúsculo `ativo`/`inativo`. A cor **já** vem por
    token (`border-success/40 bg-success/10 text-success`); o problema é a forma (não é
    `StatusPill`) e a caixa.
  - Estado vazio (`:367-370`): "Nenhum cliente cadastrado. Clique em **Novo cliente** para começar."
    Não tem ação no próprio estado, e fica dentro de card.
- **`CopyField`** (A0). `components/copy-field.tsx` **não tem cor literal** (ver as divergências).
  Os desvios reais são:
  - o rótulo (`:13`) usa `text-xs uppercase tracking-wide` solto em vez de `.section-label`;
  - a chave e os comandos (`:15`) usam `font-mono` em vez de `.data-mono` (`DESIGN.md` §3.1 lista
    "chave" como dado técnico);
  - a confirmação de cópia é só a troca de ícone (`:29`), sem anúncio para leitor de tela;
  - `navigator.clipboard.writeText` (`:24`) não tem tratamento de falha. Em contexto não seguro
    (HTTP fora de `localhost`), `navigator.clipboard` é `undefined` e o clique falha em silêncio.
- **`DESIGN.md` §2.1** (Backlog da S0). O exemplo em `DESIGN.md:54-57` cita
  `components/stat-cards.tsx`, apagado na Sprint 16. O equivalente vivo é
  `lib/kpi-tone.ts:46-53` (`KPI_TONE_GLOW_CLASS`), onde a linha é
  `success: '[--surface-glow:var(--color-success)]'`, sem o `border-success/25` do exemplo.
- **Backlog 16** (`visual-qa`, A1). O `aside` (`components/sidebar.tsx:363-369`) só sai da tela com
  `-translate-x-full` e continua no Tab. Não há handler de Esc. O botão "Abrir menu" (`:333-342`) é
  desmontado enquanto o drawer está aberto, então devolver o foco a ele exige esperar a remontagem.
- **Backlog 17** (`visual-qa`, A1). `components/sidebar.tsx:447`, `p.truncate` sem `title`, no
  rodapé das telas sem tenant. O rodapé do tenant tem o mesmo padrão em `:418-419` (nome do usuário
  e papel, `truncate`, sem `title`). O item 17 só citava `:447`.

### RFs relacionados

- **RF002**: cadastro de tenant. É a tela do assistente; nenhuma regra muda.
- **RF003**: enrollment de agente. É a tela de credenciais e rotação; nenhuma regra muda.

### RNs / RNFs relacionados

- **RN015**: "Ver credenciais" e "Emitir novo pacote" continuam atrás de `canManageTenant` no
  servidor. Esta sprint não muda guard.
- **RNF004**: nenhuma query muda; o escopo por organização de `getClients` fica como está.
- **RNF009**: cada "Ver credenciais" continua sendo **um** `GET /api/clients/[id]/credentials`
  disparado por clique explícito, e por isso grava **um** `credentials.view`. Se o E6 virar inline,
  o conteúdo não pode ser buscado de antemão, no render nem no hover.
- **Lacuna de DoD (item 2)**: não existe RF/RNF de acessibilidade ou de sistema visual em
  `docs/PRODUCT.md` §1–2. A referência normativa desta sprint é o `DESIGN.md`. O planner registra a
  lacuna e não propõe ID novo sozinho; o gerente decide se vale um RNF.

### Casos de uso

- `docs/PRODUCT.md` §3.1 (cadastro de tenant) e §3.2 (enrollment). Os fluxos não mudam; muda só a
  apresentação. A exceção é o E6: na opção recomendada, as credenciais deixam de abrir em modal, e
  isso é mudança de **apresentação** do mesmo fluxo, não de regra.

### Entidades de banco

Nenhuma alteração de schema, migration, `db push` ou backup. Nenhuma entidade nova é lida: a tela
consome os mesmos dados de `getClients` e das rotas já existentes.

Fixture de verificação visual: o cliente `teste-a0-rotacao`. **Nunca rotacionar `core-ti-expert`.**
Ver a decisão 7: o D12 do PLANO só autorizou a fixture "durante as sprints A1a e A1".

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1 — **E1**: no passo 3 conectado, `emerald-*` vira token `--success`: `:175` → `border-success/40 bg-success/5` (ou o equivalente do item 2), `:181` → `bg-success/15`, `:182` → `text-success`. Zero cor literal em `new-client-wizard.tsx` | RF003 | PRODUCT §3.2 | — | designer-ui (A0, E1) |
| 2 — **E2, assistente**: as três cascas `rounded-xl border bg-card` (`:174`, `:268`, `:303`) viram `Panel` (`components/ui/panel.tsx`); títulos de passo via `PanelHeader` (`h2`) e corpo via `PanelBody`. O tom de sucesso do passo 3 entra pela `className` do `Panel` | RF002, RF003 | PRODUCT §3.1, §3.2 | — | designer-ui (A0, E2 ampliado) |
| 3 — **E2, painel de clientes**: a casca da lista (`:365`) vira `Panel`, com a tabela em `TABLE_SHELL_CLASS` (ou `PanelBody flush`) + `overflow-x-auto`, `TABLE_HEAD_ROW_CLASS` no `<tr>` do `<thead>`, `TABLE_HEAD_CLASS` nos `<th>` e `TABLE_CELL_CLASS` nos `<td>`. `PackagePanel` (`:80`) e o erro da rotação (`:346`) viram `Panel`. Nenhum `Card` sobra em `clients-panel.tsx` | RF003 | PRODUCT §3.1 | — | designer-ui (A0, E2) |
| 4 — **E3/N3**: a marca de `components/sidebar.tsx:375` vira `<p>` ou `<span>` com a mesma aparência. `/admin/clients` ganha `<h1>Clientes</h1>` no padrão de cabeçalho de página (`flex flex-wrap items-start justify-between gap-4`, `h1 text-2xl font-bold text-foreground`), com a descrição e o botão "Novo cliente" já existentes (`page.tsx:47-57`); o comentário `:45-46` sai. `/admin/clients/novo` ganha `<h1>Novo cliente</h1>` no assistente, entre o link "Clientes" e o stepper | — | — | — | designer-ui (A0, E3); N3 (A0) |
| 5 — **E5, stepper (TDD, vermelho primeiro)**: ver o detalhamento abaixo da tabela | RF002, RF003 | PRODUCT §3.1 | — | designer-ui (A0, E5); N13 (A0) |
| 6 — **E5, mensagens**: o erro do passo 1 (`:290-294`) ganha `role="alert"`. O `role="status"` do passo 3 (`:172`) fica como está e continua **único** dentro de `FirstCheckinStatus` | RF002 | PRODUCT §3.1 | — | designer-ui (A0, E5) |
| 7 — **E6, "Credenciais ativas"**: conforme a **decisão 1**. Em qualquer opção: nenhum `Card` dentro, cabeçalho e espaçamento de `Panel`, loading/erro/indisponível/disponível preservados, a busca só acontece no clique e o foco vai para o conteúdo quando ele chega | RF003, RN015, RNF009 | PRODUCT §3.1 | Client, AuditLog (via rota existente, sem mudança) | designer-ui (A0, E6) |
| 8 — **E7, hierarquia e status**: conforme a **decisão 2**. Status vira `StatusPill` (`success` "Ativo" / `neutral` "Inativo"), como `components/tenant-computers-table.tsx:68-74` traduz o próprio enum. "Abrir painel" é a única ação com peso de preenchimento na linha; "Ver credenciais" e "Emitir novo pacote" ficam abaixo dela. O ícone `Terminal` sai da rotação (troca por ícone que signifique "nova chave/rotação" ou nenhum ícone; nada decorativo). O estado vazio explica por que está vazio e oferece a ação no próprio estado (link para `/admin/clients/novo`), sem caixa com borda dentro do painel | RF002, RF003 | PRODUCT §3.1 | — | designer-ui (A0, E7) |
| 9 — **CopyField**: rótulo em `.section-label`, valor em `.data-mono`, borda do campo por token. Confirmação de cópia anunciada a leitor de tela. Falha de cópia conforme a **decisão 5** | RF003 | PRODUCT §3.1 | — | A0 (CopyField); conferido nesta rodada |
| 10 — **`agent-install-package.tsx:63`**: o separador `border-t` das "outras formas de instalar" ganha `border-surface-line`. Nenhuma mudança de copy (a A1 fechou a copy) | RF003 | — | — | designer-ui (A0, E2 ampliado); conferido nesta rodada |
| 11 — **`DESIGN.md` §2.1**: o exemplo `:54-57` passa a citar `lib/kpi-tone.ts` (`KPI_TONE_GLOW_CLASS`) com a linha real `success: '[--surface-glow:var(--color-success)]'`. Única edição permitida no `DESIGN.md` (ver a decisão 4 para `:217`) | — | — | — | S0 (Backlog gerado pela S0) |
| 12 — **Backlog 16 (TDD, vermelho primeiro)**: abaixo de `lg`, com o drawer fechado, o `aside` sai do Tab e da árvore de acessibilidade (`inert`, ou `invisible` + `lg:visible`). A partir de `lg` a sidebar continua focável normalmente. Com o drawer aberto, Esc fecha e o foco volta a "Abrir menu". A técnica fica com o implementador; a animação de saída não pode ser cortada pela ocultação | — | — | — | visual-qa (A1, achado 3; Backlog 16) |
| 13 — **Backlog 17**: `title={user.name ?? user.email}` no nome truncado de `components/sidebar.tsx:447`, como `:415` já faz com `tenant.name`. Extensão conforme a **decisão 6**: o mesmo em `:418-419` | — | — | — | visual-qa (A1, achado 4; Backlog 17) |
| 14 — **Testes** em `tests/` com `// @vitest-environment jsdom`: stepper, `h1` do assistente, credenciais (item 7), `StatusPill`/estado vazio (item 8), `CopyField` (item 9), drawer e `title` (itens 12 e 13), marca sem `h1` (item 4) | — | — | — | gerente (TDD onde houver comportamento) |

**Item 5, stepper em detalhe** (`new-client-wizard.tsx:30-57`):
- `<ol>` com nome acessível (ex.: `aria-label="Etapas"`).
- Exatamente um `<li>` com `aria-current="step"` em cada estado: passo 1 sem pacote, passo 2 com
  pacote, passo 3 com a máquina conectada.
- Cada passo concluído expõe texto acessível ("concluído"). O ícone `Check` e o conector `:51` ficam
  `aria-hidden`.
- O rótulo do passo continua visível a partir de `sm` e vira `sr-only` abaixo de `sm`, em vez de
  `hidden`.
- **N13**: com `checkin.status.device` presente, o passo 3 aparece como **concluído** (círculo com
  `Check` e texto "concluído") e mantém o `aria-current="step"`. Hoje ele fica só "atual" (`:252` e
  `:34`).
- Estado derivado, sem `setState` em efeito.
- Teste renderizando `NewClientWizard` com `createClientAction` mockada e `fetch` mockado para
  `/api/clients/[id]/status`.

**Ordem de execução recomendada:**
1. `/critique` (impeccable) e captura **antes** pelo `visual-qa`;
2. testes vermelhos dos itens 5, 12 e 13 e da marca sem `h1`;
3. item 4 (marca e `h1`) e itens 12 e 13 (sidebar);
4. itens 1, 2, 5 e 6 (assistente);
5. itens 3, 7 e 8 (painel de clientes);
6. itens 9 e 10 (`CopyField`, `AgentInstallPackage`);
7. item 11 (`DESIGN.md`);
8. portões;
9. `visual-qa` e `/critique` **depois**.

### Decisões que ficam para o usuário

1. **E6: diálogo ou inline.** Três opções:
   - **(A)** manter o `Dialog` sem `Card` dentro, com cabeçalho e espaçamento de `Panel`;
   - **(B)** linha expansível na tabela;
   - **(C)** inline: as credenciais abrem como `Panel` no mesmo espaço de resultado que a A1 criou
     para a rotação (`clients-panel.tsx:336-363`), acima da tabela, com o botão "Dispensar" e o foco
     levado ao painel.

   **Recomendação do planner: (C).**
   - O `DESIGN.md` §10 manda esgotar o inline antes do modal, e (C) é um inline viável.
   - (B) põe um bloco largo (botão de download, chave, dois comandos) dentro de um `<tr colSpan>`,
     dentro do `overflow-x-auto` da tabela. Em 390 px esse bloco rolaria na horizontal junto com a
     tabela, que é a medida que a A1 acabou de consertar.
   - (C) reaproveita o padrão já testado na A1 (foco, `aria-live`, dispensar) e dá **um** lugar só
     para "o pacote deste cliente", seja ele rotacionado ou consultado.
   - Custo de (C): em lista longa, o painel aparece longe da linha clicada. O foco programático
     resolve a rolagem.
   - Regra a aprovar junto: o espaço mostra **um** resultado por vez, e a ação mais recente substitui
     a anterior.

   (A) é a opção de menor risco se o usuário preferir não mexer no padrão de interação.
2. **E7: onde fica "Emitir novo pacote".**
   - **(a)** visível na linha, com peso menor (ghost), ao lado de "Ver credenciais";
   - **(b)** dentro de um menu "Mais ações" (`DropdownMenu`) por linha.

   **Recomendação: (a).** O `AlertDialog` da A1 já protege a ação destrutiva. Esconder num menu
   muda o contrato de foco testado na A1 (`tests/clients-panel-rotation.test.tsx:180`, "Cancelar
   devolve o foco ao botão 'Emitir novo pacote'"), e esse teste teria de ser reescrito.

   Em aberto: dar ao "Confirmar" do `AlertDialog` o estilo destrutivo (`--destructive-solid`, só
   cor; o rótulo "Confirmar" fica, porque os testes da A1 o usam).
3. **Callout com borda de tom dentro de `Panel`.** O aviso da chave
   (`agent-install-package.tsx:34`), o erro (`new-client-wizard.tsx:221`) e o checklist de tempo
   esgotado (`:228`) são caixas com borda de 1px no tom. O planner as trata como **alerta**, não como
   card, e portanto permitidas dentro de `Panel`. Se o usuário ler a regra "nenhum card dentro de
   painel" de forma estrita, elas viram blocos sem borda com ícone de tom, e isso entra no escopo.
4. **`DESIGN.md:217`** cita `SummaryCard` e `StatCard`, também extintos na Sprint 16. Mesma classe
   do exemplo de §2.1, mas fora da edição autorizada. O planner recomenda liberar a troca por
   `KpiCard`; sem liberação, a linha fica desatualizada.
5. **`CopyField`, falha de cópia.** Incluir uma mensagem visível quando
   `navigator.clipboard` não existir ou rejeitar? É só do cliente, sem servidor. O planner recomenda
   incluir: é o mesmo "nada acontece em silêncio" da A1.
6. **Item 17 estendido** ao rodapé do tenant (`sidebar.tsx:418-419`). O planner recomenda incluir:
   mesmo componente, mesmo defeito.
7. **D12, fixture**: o PLANO autoriza `teste-a0-rotacao` "durante as sprints A1a e A1". A
   verificação desta sprint rotaciona esse cliente de novo. Precisa de extensão explícita até o fim
   da A2 (ou da frente A).
8. **Itens do rascunho do PLANO §7 que o escopo do gerente não incluiu**: hook do impeccable
   (`.claude/settings.json`, D8), `/shape` (depende da D7, `PRODUCT.md` na raiz) e `/polish` final.
   Este plano os deixa **fora**. Confirmar.

### Divergências registradas

1. **E1**: as linhas do gerente (`:175`, `:181`, `:182`) batem com o código. As do PLANO
   (`:181,187,188`) estão velhas.
2. **E2 maior que o citado**: além de `:80` e `:120`, há `Card` em `:127`, `:346` e `:365`. O
   assistente tem três cascas sem token (`:174`, `:268`, `:303`). Todas entraram nos itens 2 e 3.
3. **E3**: as 12 rotas do tenant têm `h1` (lista na Origem). A troca da marca não deixa nenhuma com
   zero `h1` **depois de carregada**. Porém os 11 `loading.tsx` de `app/app/[clientSlug]/**` não têm
   `h1`: durante o carregamento a página passa de 1 `h1` (a marca) para 0. Isso fica registrado e
   fora de escopo (ver abaixo). Há ainda três consumidores da `Sidebar` que o gerente não citou
   (`/admin/clients/audit`, `/users`, `/security`), todos com `h1` próprio e sem edição necessária.
   `/users` é proibido e não precisa ser tocado.
4. **E5**: a lista já é `<ol>`. O que falta é `aria-current`, o nome acessível e o texto de
   concluído.
5. **E7**: a cor do status **já** é token (`success`). O achado é a forma e a caixa, não cor crua.
   "Abrir painel" está numa coluna separada, não no grupo das outras duas ações.
6. **CopyField**: a A0 apontou "cor fora de token". Não há cor literal no arquivo. Os desvios são o
   tipo do rótulo, a fonte do valor, a falta de anúncio de cópia e a falha silenciosa.
7. **Item 17**: o mesmo defeito existe em `sidebar.tsx:418-419` (decisão 6).
8. **PLANO §6.1**: o bloco "Backlog gerado pela S0" diz "não entra na A0–A2" e, na linha seguinte,
   destina o exemplo do `DESIGN.md` à A2. O plano segue a linha específica (A2), como pediu o
   gerente.

### Restrições de compatibilidade

- **Arquivos permitidos**: `app/admin/clients/**`, `components/agent-install-package.tsx`,
  `components/copy-field.tsx`, `components/sidebar.tsx` (só a marca do item 4 e os itens 12 e 13),
  `DESIGN.md` (só o exemplo de §2.1, mais `:217` se a decisão 4 liberar), `tests/` e
  `docs/SPRINTS.md`.
- **Proibido**: `app/users/page.tsx` e qualquer mudança de comportamento de servidor, de action ou de
  rota. Nenhuma página do tenant precisa de edição para o E3 (todas já têm `h1`).
- `tests/new-client-wizard-first-checkin.test.tsx` usa `screen.getByRole('status')` (`:48-49`), que
  falha se houver mais de uma região `status` em `FirstCheckinStatus`. Um anúncio novo do
  `CopyField` não pode criar outra região `status` nessa árvore. Ele pode usar `aria-live` sem
  `role="status"`, ou viver fora dela.
- `tests/clients-panel-rotation.test.tsx` usa `alertdialog`, "Cancelar", "Confirmar", "Dispensar" e
  `data-testid="rotation-result"`. Esses contratos ficam. Se a decisão 1 for (C) e o espaço de
  resultado mudar de forma, o `data-testid` e o foco continuam valendo para a rotação.
- `AgentInstallPackage` tem três consumidores (assistente, credenciais, estado vazio do dashboard do
  tenant). A mudança do item 10 aparece nos três.
- Zero cor literal, zero `dark:` novo, nenhum `hover:scale`, movimento só para estado (`DESIGN.md`
  §6 e §10).
- Sem "cara de IA" (`inventario-ui` §d): nenhum ícone decorativo novo, orbe, gradiente ou halo, e
  nenhum texto de template no estado vazio.

### Critérios de aceite

- [x] **E1**: `rg "emerald|#[0-9a-fA-F]{3,8}\b|rgb\(|oklch\(" app/admin/clients components/copy-field.tsx components/agent-install-package.tsx`
      não retorna nada. O estado "conectou" usa `--success` (`border-success`, `bg-success`,
      `text-success`).
- [x] **E2, assistente**: `rg "rounded-xl border bg-card" app/admin/clients` não retorna nada. Os três
      passos são `Panel`.
- [x] **E2, painel**: `rg "@/components/ui/card" app/admin/clients` não retorna nada. A tabela de
      clientes usa `TABLE_SHELL_CLASS` (ou `Panel` + `PanelBody flush`), `TABLE_HEAD_ROW_CLASS`,
      `TABLE_HEAD_CLASS` e `TABLE_CELL_CLASS`, e nenhum `<th>` usa `font-medium`. Nenhuma superfície
      com borda própria dentro de `Panel`, exceto os callouts de tom, se a decisão 3 os mantiver.
- [x] **E3, sidebar**: teste jsdom renderiza `Sidebar` (com e sem tenant) e afirma zero `h1`, com o
      texto "Inventário TI" ainda presente.
- [x] **E3, admin**: `/admin/clients` tem exatamente um `h1`, "Clientes". `/admin/clients/novo` tem
      exatamente um `h1`, "Novo cliente" (afirmado em teste jsdom do `NewClientWizard`). O
      comentário "Sem h1 aqui" sai de `page.tsx`.
- [x] **E3, medido**: o `visual-qa` mede `document.querySelectorAll('h1').length === 1`, com a página
      carregada, em `/admin/clients`, `/admin/clients/novo` e em 3 rotas do tenant
      (`/app/teste-a0-rotacao`, `/app/teste-a0-rotacao/computers` e
      `/app/teste-a0-rotacao/assets/<id>` se houver dispositivo, senão `/settings`).
- [x] **E5, TDD**: existe teste novo do stepper em `tests/` (`// @vitest-environment jsdom`), e o
      relatório do implementador mostra a execução **vermelha** antes da correção.
- [x] **E5, `aria-current`**: em cada estado (sem pacote, com pacote, conectado), exatamente um
      `<li>` do stepper tem `aria-current="step"`, e é o passo 1, 2 e 3 respectivamente. O `<ol>`
      tem nome acessível.
- [x] **E5, N13**: com a máquina conectada, os três passos expõem o texto acessível "concluído", e o
      passo 3 mostra o `Check` (afirmado em teste).
- [x] **E5, 390 px**: o nome de cada passo está no nome acessível do `<li>` em qualquer largura
      (`sr-only` abaixo de `sm`, não `hidden`). Ícone e conector têm `aria-hidden`.
- [x] **E5, mensagens**: o erro do passo 1 está em `role="alert"`. Os testes existentes de
      `tests/new-client-wizard-first-checkin.test.tsx` continuam verdes sem alteração.
- [x] **E6**: implementado conforme a opção aprovada na decisão 1. Nenhum `Card` dentro. Teste jsdom
      afirma:
      - o clique em "Ver credenciais" dispara **uma** requisição a
        `/api/clients/<id>/credentials`;
      - nada é buscado antes do clique;
      - loading, erro, indisponível e disponível aparecem;
      - o foco vai para o conteúdo;
      - "Dispensar" (ou fechar) remove o conteúdo.
- [x] **E6, opção (C)**, se aprovada: nenhum `role="dialog"` é aberto por "Ver credenciais", e uma
      rotação feita depois substitui o painel de credenciais no mesmo espaço (afirmado em teste).
- [x] **E7, status**: a coluna Status usa `StatusPill` (`success`/"Ativo", `neutral`/"Inativo"). Não
      resta `Badge` de status em `clients-panel.tsx` (afirmado em teste).
- [x] **E7, hierarquia**: em cada linha, só "Abrir painel" tem variante de preenchimento. "Ver
      credenciais" e "Emitir novo pacote" usam variante de menor peso (ou menu, se a decisão 2 for
      (b)). `rg "Terminal" app/admin/clients/clients-panel.tsx` não retorna nada.
- [x] **E7, estado vazio**: com zero clientes, o painel diz por que está vazio e mostra um link
      focável para `/admin/clients/novo`, sem caixa com borda dentro do painel (afirmado em teste).
- [x] **CopyField**: o rótulo usa `.section-label`, o valor usa `.data-mono`, e não há `font-mono`
      solto. Teste jsdom com `navigator.clipboard` mockado afirma que a cópia bem-sucedida é
      anunciada em texto acessível. Se a decisão 5 for aprovada, outro teste afirma que a falha
      (`clipboard` ausente ou rejeitado) mostra mensagem visível.
- [x] **`AgentInstallPackage`**: o separador de `:63` usa `border-surface-line`.
      `tests/agent-install-package-copy.test.tsx` segue verde sem alteração.
- [x] **`DESIGN.md`**: `rg "stat-cards" DESIGN.md` não retorna nada. O exemplo de §2.1 cita
      `lib/kpi-tone.ts` com a linha real de `KPI_TONE_GLOW_CLASS`. Nenhuma outra linha do `DESIGN.md`
      muda, salvo `:217` se a decisão 4 liberar.
- [x] **Backlog 16, TDD**: existe teste novo da sidebar (`// @vitest-environment jsdom`), e o
      relatório mostra a execução **vermelha** antes da correção.
- [x] **Backlog 16, Tab**: com o drawer fechado abaixo de `lg`, o `aside` está `inert` (ou
      `visibility: hidden`), afirmado em teste. Medido pelo `visual-qa` em 390 px: a partir do topo
      da página, o Tab não para em "Fechar menu", nos itens do menu nem no menu do usuário antes do
      conteúdo. Em 1440 px os itens da sidebar continuam alcançáveis pelo Tab.
- [x] **Backlog 16, Esc**: com o drawer aberto, Esc fecha e o foco fica em "Abrir menu" (afirmado
      em teste e no navegador).
- [x] **Backlog 17**: o nome truncado de `sidebar.tsx:447` tem `title` com o nome completo (afirmado
      em teste). Se a decisão 6 for aprovada, o mesmo vale para `:418-419`.
- [x] **Regras do `DESIGN.md` no diff**: `rg "dark:|hover:scale|animate-ping"` nos arquivos tocados
      não acusa nada **novo** (colar o grep no relatório). Nenhum ícone decorativo, gradiente ou orbe
      novo.
- [x] **Contraste**: o `visual-qa` mede (não estima) ≥ 4.5:1 para todo texto novo ou recolorido, em
      especial o texto de sucesso do passo 3 e os rótulos da `StatusPill`.
- [x] **Verificação visual**: o `visual-qa` captura, **antes e depois**, em **390, 1024 e 1440 px**,
      com screenshots fora do repositório e caminhos absolutos no relatório:
      - `/admin/clients`, com a lista e com o estado vazio, se reproduzível sem apagar dado;
      - `/admin/clients/novo`, nos passos 1, 2 e 3;
      - as credenciais ("Ver credenciais") abertas;
      - o diálogo de rotação, aberto e depois de confirmar;
      - as 3 rotas do tenant do critério E3, com o drawer aberto e fechado em 390 px.

      `scrollWidth <= clientWidth` em todas. A rotação real é feita **só** em `teste-a0-rotacao`,
      **nunca** em `core-ti-expert`.
- [x] **Referência de qualidade**: `/critique` (impeccable) rodado antes e depois em
      `/admin/clients` e `/admin/clients/novo`, com as duas notas no relatório. A A0 registrou
      22/40. A nota é referência, não portão.
- [x] **Segurança**: o `security-auditor` revisa o diff e confirma:
      - nenhuma mudança de guard, action ou rota;
      - "Ver credenciais" continua gerando um `credentials.view` por clique;
      - nenhum segredo é buscado ou renderizado sem ação explícita.
- [x] **Escopo de arquivos**: o diff toca só os arquivos permitidos acima. `app/users/page.tsx`
      fica intocado. Nenhum arquivo em `app/api/**`, em `app/admin/clients/actions.ts`, em
      `queries.ts` ou em `lib/**` muda.
- [x] Portão 1: `npm run typecheck` limpo.
- [x] Portão 2: `npm run lint` limpo, inclusive `react-hooks/set-state-in-effect`.
- [x] Portão 3: `npm run build:verify` limpo. **Não** rodar com o `next dev` de pé; o implementador
      avisa o orquestrador antes do build.
- [x] Portão 4: `npm test` verde com **mais de 851 testes** (baseline: 851 testes / 68 arquivos
      depois de `804d9a6`; o commit cita 848 porque os 3 testes de acessibilidade entraram depois).
- [x] DoD (`docs/DEFINITION_OF_DONE.md`): os 10 itens conferidos um a um, com ✅ ou N/A e
      justificativa. "Banco de dados e migrations" é N/A, porque não há mudança de schema. "Validação
      Zod" é N/A, porque não há entrada nova. "RF/RN" registra a lacuna de RNF de acessibilidade.
- [x] Sem commit e sem push.

### Fora de escopo desta sprint

- **E4 nas outras telas que usam a `Sidebar`**: `app/admin/clients/audit/page.tsx:81-83`,
  `app/security/page.tsx:90-92` e `app/users/page.tsx:49-51` ainda usam `pl-64` e `p-6` fixos e
  quebram abaixo de `lg`. O primeiro está dentro de `app/admin/clients/**`, mas fora do fluxo "Gerar
  agente" e do escopo do gerente. `/users` é proibido. Candidato a Backlog ou à V17, por decisão do
  gerente.
- **`h1` nos `loading.tsx`** do tenant (11 arquivos), que ficam com zero `h1` durante o carregamento
  depois desta sprint. Candidato à V17 (alinhamento e `h1`).
- **Foco preso no drawer aberto** (Tab saindo do drawer para o conteúdo atrás do overlay). O item 16
  pede só Tab com o drawer fechado e Esc.
- `encodeURIComponent` no link de download de `agent-install-package.tsx:28` é mudança de URL e
  comportamento, não visual. Os valores já passam pela allowlist da A1a.
- Mudar o rótulo "Confirmar" do `AlertDialog` da rotação (contrato de teste da A1).
- **A3**: F4, F5, N4, N5, N12. **Backlog**: N6, N7, N9, N10, N11 e os itens 1 a 15.
- Hook do impeccable (D8), `/shape` (D7) e `/polish` final (decisão 8).
- `KpiCard` no admin: a tela não tem KPI hoje, e o escopo do gerente não pede.

### Documentação que ficará desatualizada (não editada por este plano)

- `DESIGN.md` §11 (`:454`) diz que `app/admin/clients/**` "ainda não [foi] redesenhado". Isso passa
  a ser falso depois desta sprint, mas fica fora da edição autorizada (só o §2.1). Precisa de
  liberação do gerente.
- `DESIGN.md:217` (`SummaryCard`, `StatCard`), se a decisão 4 não liberar a edição.
- `PLANO_SPRINTS_COLABORACAO.md` §6 ainda mostra A1a/A1/A2 com os status antigos, e o §6.1 D12 limita
  a fixture à A1. O documento é do gerente; o planner não o edita.

---

## Sprint A3 — Gestão e revogação de agentes por cliente

**Status**: Concluída (2026-10-15). Implementada e auditada com sucesso; todos os 4 portões limpos (969 testes passando em 81 arquivos, typecheck, lint e build:verify verdes com a nova rota /admin/clients/[id]/agents).
Plano montado a partir do relatório do `requirements-auditor` (verificado pelo orquestrador nos pontos
403, `tenant-scope` e `availability-alerts`), dos achados F5, N4, N5 e N12 que a A1 e a A2 adiaram
para a A3 (`PLANO_SPRINTS_COLABORACAO.md` §3, linha F5; ADR 0005) e das decisões do usuário já
aprovadas para esta sprint. Depende da A2 (concluída, commit `e261dd1`, 893 testes / 73 arquivos).
F4 (instalador Linux) e N6 (hash do executável) saíram desta sprint por decisão do usuário e estão
registrados no Backlog, item 19. Este plano não altera nenhuma linha de código. As linhas citadas
abaixo foram conferidas contra o código em 2026-10-15, depois de `e261dd1`.

**Objetivo**: quem administra um cliente (`canManageTenant`) passa a ver, em
`/admin/clients/[id]/agents`, cada instalação de agente do cliente com estado, versão e última
coleta, e pode revogar uma instalação de forma individual e irreversível. A rotação da chave ganha a
opção de revogar também os agentes ativos. A revogação deixa de gerar alerta fantasma e comando
órfão, o registro de agente passa a ser auditado e a contagem "Agentes" passa a contar só os
ativos.

### Origem do achado (rastreabilidade)

- **F5, nenhuma tela lista ou revoga agentes** (`backend-auditor`, A0; `PLANO_SPRINTS_COLABORACAO.md`
  linha F5). `revokeAgentAuthAction` **já existe** em `app/admin/clients/actions.ts:298-380` desde
  a Sprint 6, com guard `canManageTenant` (`:339`), resposta única para "não existe" e "não pode"
  (sem oráculo), transação e `AuditLog` `agent_auth.revoke` (`:348-365`), coberta por
  `tests/revoke-agent-auth.test.ts`. Nenhum componente em `app/` a chama. A A3 cria a tela e
  **estende** a action; não cria uma action nova.
- **N4, contenção da rotação** (`security-auditor`, A0; ADR 0005,
  `docs/adr/0005-enrollment-key-reexibivel.md:34`). `rotateEnrollmentKeyAction`
  (`actions.ts:215-296`) só troca `enrollmentKeyHash` e `activeProvisioningKeyEnc` (`:259-277`). Os
  `AgentAuth` já registrados continuam fazendo check-in.
- **N5, registro sem auditoria** (`requirements-auditor`). `app/api/agent/register/route.ts:63-70`
  cria o `AgentAuth` sem `recordAuditLog`. O caminho por `X-Admin-Secret` existe (`:15`, `:34-36`,
  `:49`) e também não audita.
- **N12, contagem "Agentes" com revogados** (`requirements-auditor`; divergência 4 da A1). A coluna
  usa `agentCount` = `_count.agents` sem filtro (`app/admin/clients/queries.ts:33-37`, `:58`),
  exibido em `clients-panel.tsx:404`. `activeAgentCount` já existe (`queries.ts:42-59`) e alimenta
  só o diálogo de rotação (`clients-panel.tsx:182`). `GET /api/clients` tem o mesmo `_count.agents`
  (`app/api/clients/route.ts:50-54`, contrato em `docs/PRODUCT.md:506`). Ver a divergência 3 sobre o
  rótulo N12.
- **Alerta fantasma** (`requirements-auditor`, verificado pelo orquestrador).
  `lib/availability-alerts.ts:56-65` faz `device.findMany({ where: { clientId } })` sem filtrar
  `agentAuth.isActive`. Uma máquina revogada fica sem coleta, passa do `alertOfflineHours` e abre
  `device_offline` com webhook (`:81-110`) no próximo check-in de qualquer outra máquina do cliente.
- **Comando órfão** (`requirements-auditor`). `AgentCommand` `pending` só vira `expired` quando o
  próprio agente consulta (`app/api/agent/commands/pending/route.ts:15-22`). Um agente revogado
  recebe 403 antes disso (`:7-8`), então os comandos `pending` e `running` dele ficam abertos para
  sempre. `AgentCommand.status` é `String` com os valores `pending, running, done, failed, expired`
  (`prisma/schema.prisma:583`); não há enum de banco. `expired` já é valor em uso.
- **Revogação é imediata e devolve 403** (verificado pelo orquestrador). `lib/auth.ts:81-83` devolve
  `403` "API Key revogada" a cada requisição, sem cache. O agente Go trata 401 e 403 como
  `authError` (`agent-go/internal/transport/httpapi/client.go:171-172`, `:238-239`, `:275-276`,
  `:314-315`), desiste da tentativa (`:63-64`), não se registra de novo e segue no loop do serviço.
  `docs/PRODUCT.md:144` diz "chave inválida/revogada (`401`/`403`)"; revogada é sempre `403`.
- **Telas do tenant já escondem revogados** (verificado pelo orquestrador). `getTenantDeviceWhere`
  (`lib/tenant-scope.ts:3-21`) exige `agentAuth.isActive` e `client.isActive`. O portal não usa
  esse filtro (Backlog, item 18, por decisão do usuário). `/app/[slug]/alerts` também não: lista
  `AlertEvent` por `clientId` (`app/app/[clientSlug]/alerts/page.tsx:31-45`), então eventos de uma
  máquina revogada continuam visíveis no histórico (ver a divergência 5).

### RFs relacionados (numeração proposta: próximos livres RF029, RN018, UC 3.12)

- **RF029 (novo)**: listagem de agentes por cliente em `/admin/clients/[id]/agents`. Identidade da
  linha = `agentAuthId` (`CONTEXT.md:27-31`); `AgentAuth.name` e `Device.hostname` são só exibição.
  Colunas: nome, hostname, versão (`Device.agentVersion`), registrado em (`AgentAuth.createdAt`),
  última coleta, estado (RN018) e revogado em (`AgentAuth.revokedAt`).
- **RF030 (novo)**: revogação individual, irreversível, com confirmação; grava `agent_auth.revoke`.
- **RF031 (novo)**: `POST /api/agent/register` grava `AuditLog` `agent_auth.register`, com ator nulo
  (`AuditLog.actorUserId` é opcional, `prisma/schema.prisma:245`) e
  `metadata: { name, via }`, onde `via` é `enrollment_key` ou `admin_secret`.
- **RF003**: enrollment. O UC 3.2 ganha a gravação do RF031 na pós-condição.
- **RF022**: auditoria. Duas ações novas no catálogo (`agent_auth.register` e o uso em massa de
  `agent_auth.revoke`).

### RNs / RNFs relacionados

- **RN018 (nova)**: estado derivado de cada `AgentAuth`, sem coluna nova:
  - **Revogado**: `isActive = false`. Mostra `revokedAt`.
  - **Bloqueado pelo cliente**: `isActive = true` e `Client.isActive = false` (`lib/auth.ts:85-87`
    recusa com 403 "Cliente desativado").
  - **Registrado, sem coleta**: ativo e sem `Device`. Duas causas possíveis, e o texto do estado diz
    as duas: o agente registrou e ainda não fez o primeiro check-in, ou o `Device` foi excluído
    (`app/app/[clientSlug]/assets/[id]/actions.ts:66`) e o `AgentAuth` segue ativo; nesse caso o
    próximo check-in recria o `Device`.
  - **Ativo**: ativo e com `Device`.
- **RN019 (nova)**: revogação em massa **opcional** na rotação. Checkbox desmarcado por padrão. Se
  marcado, todos os `AgentAuth` ativos do cliente são revogados na **mesma transação** da troca de
  chave.
- **RN020 (nova)**: a contagem "Agentes" mostra só `AgentAuth` ativos. Vale para `/admin/clients` e,
  se a decisão 3 liberar, para `GET /api/clients`.
- **RN015**: passa a citar a revogação (individual e em massa) como operação sobre tenant existente,
  guardada por `canManageTenant`. Texto em `docs/PRODUCT.md:85`.
- **RNF004**: a rota nova carrega o `Client` e aplica `canManageTenant(user, client)`. Cliente de
  outra organização ou inexistente dá o mesmo `notFound()`.
- **RNF009**: um `agent_auth.revoke` por credencial revogada, inclusive na rotação (decisão 4), e
  `agent_auth.register` em todo registro.
- **RNF002**: Zod antes de efeito colateral no campo novo da rotação.

### Casos de uso

- **UC 3.12 (novo) — Gerenciar agentes do cliente**, em `docs/PRODUCT.md` §3. Ator:
  `PLATFORM_ADMIN` ou `ORG_ADMIN` da organização (`canManageTenant`). Pré-condição: `Client`
  existente. Fluxo: abrir a lista a partir de `/admin/clients`, ler o estado, revogar uma instalação
  com confirmação. Exceções: cliente de outra organização (`notFound`), credencial já revogada
  (idempotente), erro interno.
- **UC 3.1**: o fluxo alternativo "Emitir novo pacote" ganha o checkbox do RN019.
- **UC 3.2**: pós-condição ganha o `agent_auth.register`.
- **UC 3.3**: exceções passam a dizer "revogada: `403`".
- **§7, matriz**: linha nova "Listar e revogar `AgentAuth`": ✅ / ✅ (mesma org) / ❌ / ❌,
  `canManageTenant`.

### Entidades de banco

Nenhuma alteração de schema, migration, `db push` ou backup.

- **Lidas**: `Client` (`id`, `name`, `slug`, `organizationId`, `isActive`); `AgentAuth` (`id`,
  `name`, `isActive`, `createdAt`, `revokedAt`); `Device` (`hostname`, `agentVersion`,
  `updatedAt`); `CollectionLog` (`coletadoEm` mais recente, com fallback em `Device.updatedAt`, o
  mesmo padrão de `lib/tenant-device-rows.ts:58`). `AgentCheckLog` **não** serve para última coleta:
  só grava em erro.
- **Escritas**: `AgentAuth` (`isActive`, `revokedAt`), `AgentCommand` (`status = 'expired'`),
  `AlertEvent` (`resolvedAt`), `AuditLog` (`agent_auth.revoke`, `agent_auth.register`).
- `Device` e o histórico **não** são apagados na revogação.

Fixture de verificação: o cliente `teste-a0-rotacao` (ver a decisão 7). **Nunca revogar nem
rotacionar nada de `core-ti-expert`**, que tem agentes reais.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1 — **Rota nova `/admin/clients/[id]/agents` (TDD, vermelho primeiro)**: Server Component que carrega o `Client` por `id` e aplica `canManageTenant(user, client)`; inexistente ou sem permissão → `notFound()`, sem distinção. **Não** reaproveita `requireClientsAdminAccess` de `page.tsx:14-23` (`isPlatformAdmin \|\| isOrgAdmin`, sem checar organização) | RF029, RNF004, RN015 | UC 3.12 | Client | requirements-auditor; decisão do usuário (rota autorizada) |
| 2 — **Query da lista** em `app/admin/clients/queries.ts`: todos os `AgentAuth` do cliente (ativos e revogados), com `Device` (`hostname`, `agentVersion`, `updatedAt`) e o `CollectionLog` mais recente (`take: 1`, `orderBy coletadoEm desc`). Escopo por `clientId` do cliente já autorizado no item 1. Ordem: ativos primeiro, depois por `createdAt desc` | RF029, RNF004 | UC 3.12 | AgentAuth, Device, CollectionLog | requirements-auditor |
| 3 — **Estado derivado (RN018, TDD)**: função pura (revogado, bloqueado pelo cliente, registrado sem coleta, ativo), testada nos quatro casos, sem `setState` em efeito | RN018 | UC 3.12 | AgentAuth, Device, Client | requirements-auditor |
| 4 — **Tela**: casca igual à de `/admin/clients` após A1/A2 (`min-w-0 flex-1 lg:pl-64`, `p-4 lg:p-6`, `page.tsx:41-43`), **um** `h1` com o nome do cliente e link de volta para "Clientes". Tabela em `Panel` com `TABLE_SHELL_CLASS`/`TABLE_HEAD_ROW_CLASS`/`TABLE_HEAD_CLASS`/`TABLE_CELL_CLASS` (`lib/table-styles.ts`) e `overflow-x-auto`. Estado em `StatusPill`. Versão e `agentAuthId` em `.data-mono`; o id aparece curto, com `title` do id completo, para distinguir duas linhas de mesmo nome após reinstalação. Estado vazio explica por quê (nenhum agente registrou com a chave deste cliente) e leva ao pacote de instalação ("Ver credenciais" em `/admin/clients`) | RF029, RN018 | UC 3.12 | — | requirements-auditor; padrões A1/A2 |
| 5 — **Link a partir de `/admin/clients`**: o número da coluna "Agentes" vira link (ou ação "Ver agentes" de menor peso) para a rota nova. "Abrir painel" continua a única ação preenchida da linha (hierarquia da A2) | RF029 | UC 3.12 | — | requirements-auditor |
| 6 — **Contagem "Agentes" (N12/RN020)**: a coluna passa a mostrar `activeAgentCount`. `agentCount` sai do tipo se ficar sem uso. `GET /api/clients` só muda se a decisão 3 liberar o arquivo | RN020 | UC 3.12 | AgentAuth | requirements-auditor (N12) |
| 7 — **Revogar pela UI (TDD)**: botão "Revogar" só em linhas não revogadas; abre `AlertDialog` com "Confirmar" destrutivo (padrão da A2) e "Cancelar"; cancelar não chama a action; o foco volta ao botão de origem; o resultado sai em `role="status"` (padrão da A1). Texto do diálogo no detalhamento abaixo da tabela | RF030, RN015 | UC 3.12 | AgentAuth | requirements-auditor; F5 |
| 8 — **`revokeAgentAuthAction` estendida**, na mesma transação já existente (`actions.ts:348-365`): (a) `AgentCommand` do `agentAuthId` com `status in ('pending','running')` → `expired`; (b) `AlertEvent` abertos (`resolvedAt: null`) do `Device` dessa credencial → `resolvedAt = now`, **sem** webhook (decisão 2); (c) **idempotência**: credencial já revogada não muda `revokedAt` nem grava `AuditLog` de novo (hoje a action sobrescreve `revokedAt` e audita outra vez); (d) `revalidatePath` também de `/admin/clients/[id]/agents`. Guard, mensagem única e `TransactionLike` ampliada só no necessário | RF030, RNF009, RN015 | UC 3.12 | AgentAuth, AgentCommand, AlertEvent, AuditLog | requirements-auditor (riscos 1 e 2); conferido nesta rodada (idempotência) |
| 9 — **Alerta fantasma (condicional à decisão 1)**: em `lib/availability-alerts.ts:56-57`, `where: { clientId, agentAuth: { isActive: true } }`. Teste: um device com `AgentAuth` revogado e sem coleta além do limiar não abre `device_offline` nem chama webhook | RF030 | UC 3.12, UC 3.3 | Device, AlertEvent | requirements-auditor (verificado pelo orquestrador) |
| 10 — **N4/RN019, revogação em massa na rotação (TDD)**: no `AlertDialog` de rotação existente (`clients-panel.tsx:169-196`), checkbox "Revogar também os N agentes ativos", **desmarcado**, com texto de consequência; N vem de `activeAgentCount`; sem checkbox quando N = 0. `rotateKeySchema` (`actions.ts:40-43`) ganha o campo opcional, validado por Zod. Marcado: na mesma transação de `:259-277`, todos os `AgentAuth` ativos do cliente são revogados com os efeitos (a) e (b) do item 8, e um `agent_auth.revoke` por credencial (decisão 4). Desmarcado: comportamento atual, byte a byte | RN019, RNF009 | UC 3.1 | AgentAuth, AgentCommand, AlertEvent, AuditLog, Client | security-auditor (A0, N4; ADR 0005) |
| 11 — **N5/RF031, auditoria do registro (TDD)**: em `app/api/agent/register/route.ts`, `agentAuth.create` e `recordAuditLog({ action: 'agent_auth.register', targetType: 'agent_auth', targetId, clientId, actor: null, metadata: { name, via } })` na mesma `$transaction`. `via` = `admin_secret` quando `hasValidAdminSecret` liberou, senão `enrollment_key`. Nenhum segredo (`enrollmentKey`, `apiKey`, hash) no `metadata`. Contrato da resposta 201 e códigos de erro inalterados | RF031, RNF009 | UC 3.2 | AgentAuth, AuditLog | requirements-auditor (N5); decisão do usuário (arquivo liberado) |
| 12 — **Docs**: `docs/PRODUCT.md`: RF029–RF031, RN018–RN020, UC 3.12, linha nova na §7, RN015 (`:85`) citando a revogação, `:144` "revogada: `403`", UC 3.2 com o RF031 e, se a decisão 3 liberar, `:506`. `docs/SPEC.md` e `docs/PRODUTO.md` só onde citarem revogação ou contagem de agentes | RF029–RF031, RN015, RN018–RN020 | §3, §7 | — | requirements-auditor |
| 13 — **Testes** em `tests/`: ver os critérios de aceite. `tests/revoke-agent-auth.test.ts`, `tests/clients-panel-rotation.test.tsx` e `tests/admin-clients-actions-messages.test.ts` continuam verdes; se algum mock precisar de `agentCommand`/`alertEvent` na transação, a mudança no mock é declarada no relatório | — | — | — | gerente (TDD) |

**Item 7, texto do diálogo de revogação** (copy final fica com o implementador, o conteúdo não):
- a revogação é imediata e **não pode ser desfeita**;
- o serviço do agente continua instalado na máquina e é recusado a cada ciclo; para parar de vez é
  preciso desinstalar na máquina;
- a máquina e o histórico **não** são apagados; ela deixa de aparecer nas listas de máquinas do
  cliente (o histórico de alertas continua em `/alerts`, divergência 5);
- comandos pendentes desse agente são cancelados;
- reinstalar na mesma máquina cria um registro novo, com outro id;
- se for o **último** agente ativo do cliente, aviso explícito de que o cliente fica sem nenhuma
  máquina reportando.

**Ordem de execução recomendada:**
1. testes vermelhos: guard da rota (item 1), estado derivado (item 3), action estendida (item 8),
   N4 (item 10), N5 (item 11), contagem (item 6) e, se aprovado, `availability-alerts` (item 9);
2. itens 8, 10 e 11 (servidor);
3. item 9, se a decisão 1 aprovar;
4. itens 2, 1, 3, 4 (rota e tela);
5. itens 5, 6 e 7 (`/admin/clients` e diálogo);
6. item 12 (docs);
7. portões;
8. `security-auditor` sobre o diff e `visual-qa`.

### Decisões que ficam para o usuário

1. **Liberar `lib/availability-alerts.ts`** para o filtro do item 9. **Recomendação: sim.** Sem o
   filtro, cada revogação vira um `device_offline` com webhook horas depois, ou seja, a tela nova
   produziria alarme falso por construção. A mudança é uma linha no `where`, com teste.
2. **Resolver os `AlertEvent` abertos da máquina na revogação, e com ou sem webhook.**
   **Recomendação: resolver todos os abertos do device (qualquer métrica, inclusive os de
   `AlertRule`), sem webhook.** Um evento aberto de máquina revogada nunca mais seria resolvido,
   porque a resolução depende de check-in. Mandar `device.online` seria falso: a máquina não voltou.
   Fica dentro de `actions.ts`, que já é liberado.
3. **`GET /api/clients` (`route.ts:50-54`) passa a contar só ativos?** **Recomendação: não mudar
   nesta sprint.** A rota é só `PLATFORM_ADMIN` (`:40`), é contrato de API documentado
   (`PRODUCT.md:506`) e não alimenta a tela (`/admin/clients` usa `getClients`). Trocar o significado
   de `_count.agents` em silêncio quebra quem consome. Se o usuário quiser coerência, a opção segura é
   acrescentar um campo `activeAgentCount` e manter `_count.agents`. Sem liberação, `PRODUCT.md:506`
   ganha uma nota de que o número inclui revogados.
4. **Auditoria da revogação em massa (N4).** (a) um `agent_auth.revoke` por credencial, com
   `metadata.via = 'rotation'`, além do `credentials.rotate` existente; ou (b) só `credentials.rotate`
   com `metadata.revokedCount`. **Recomendação: (a)**, mais `revokedCount` no `credentials.rotate`.
   A trilha fica por máquina (RNF009) e a busca por `agent_auth.revoke` encontra todas as revogações,
   venham de onde vierem.
5. **Rótulo de `agent_auth.register` na atividade recente.** `components/recent-activity-panel.tsx:64-81`
   não está na lista de arquivos liberados; sem rótulo, a ação aparece como o identificador cru
   `agent_auth.register` (fallback de `:83-85`). **Recomendação: liberar só essa linha do mapa**
   ("Registro de agente"). Sem liberação, vira Backlog.
6. **Ordem e filtro da lista.** Revogados aparecem na mesma tabela, depois dos ativos, ou atrás de um
   filtro "Mostrar revogados"? **Recomendação: mesma tabela, ativos primeiro.** O volume por cliente
   é pequeno e a reinstalação (duas linhas de mesmo nome) só se explica vendo as duas.
7. **D12, fixture.** O PLANO autorizou `teste-a0-rotacao` "durante as sprints A1a e A1"; a A2 pediu
   extensão. A A3 também precisa. Além disso, o cliente de teste **não tem agente**, então a revogação
   real no navegador não é possível. Opções: (a) a revogação real fica coberta só por testes, e o
   `visual-qa` captura o diálogo aberto e o cancela; (b) criar um `AgentAuth` de teste em
   `teste-a0-rotacao` via `POST /api/agent/register` com a chave dele (sem agente instalado, o estado
   fica "Registrado, sem coleta") e revogá-lo de verdade. **Recomendação: (b)**, com o D12 estendido
   explicitamente até o fim da A3. Isso também exercita o N5 de ponta a ponta. O `AgentAuth` de teste
   entra no apagamento da fixture ao fim da frente A.

### Divergências registradas

1. **A revogação não é nova.** O briefing a trata como funcionalidade a criar; `revokeAgentAuthAction`
   existe desde a Sprint 6 (`actions.ts:298-380`), com guard, mensagem sem oráculo, transação e
   auditoria, e teste próprio. O que falta é a tela e os efeitos colaterais. O plano estende a action.
2. **A action atual não é idempotente.** Revogar de novo uma credencial já revogada sobrescreve
   `revokedAt` (`:351`) e grava outro `agent_auth.revoke`. Entrou no item 8 (c).
3. **"N12" não está definido em nenhum arquivo do repositório.** Só aparece em listas
   (`docs/SPRINTS.md`, A1 "Fora de escopo" e A2 "Fora de escopo"). Este plano o lê como a contagem
   "Agentes" com revogados (divergência 4 da A1, RN020). Se N12 for outra coisa, o item 6 muda de
   rótulo e o N12 real fica sem plano.
4. **O guard da rota nova é a segunda camada.** `proxy.ts:91-104` já barra `ORG_OPERATOR` e
   `CLIENT_VIEWER` em `/admin/clients/*`. Não protege contra `ORG_ADMIN` de outra organização; esse
   caso é responsabilidade da página (item 1). Os testes do guard chamam a página diretamente.
5. **"Somem das telas do tenant" não vale para `/alerts`.** As listas de máquinas usam
   `getTenantDeviceWhere`, mas `app/app/[clientSlug]/alerts/page.tsx:31-45` lista eventos por
   `clientId` e mostra o hostname da máquina revogada. É histórico, e a página está proibida nesta
   sprint; o texto do diálogo não pode prometer que tudo some.
6. **`GET /api/clients` é só `PLATFORM_ADMIN`** (`route.ts:40`), não a fonte da coluna da tela. Ver a
   decisão 3.
7. **`AgentCommand.status` não é enum.** É `String` com comentário de valores (`schema.prisma:583`).
   `expired` já é usado por `commands/pending/route.ts:21`, então não há valor novo.

### Restrições de compatibilidade

- **Arquivos permitidos**: `app/admin/clients/**` (rota nova, `actions.ts`, `queries.ts`,
  `clients-panel.tsx`, `page.tsx`), `components/agent-install-package.tsx` só se necessário,
  `app/api/agent/register/route.ts`, `docs/PRODUCT.md`, `docs/PRODUTO.md` e `docs/SPEC.md` (se
  pertinentes), `docs/SPRINTS.md` e `tests/`. **Condicionados**: `lib/availability-alerts.ts`
  (decisão 1), `app/api/clients/route.ts` (decisão 3), `components/recent-activity-panel.tsx`
  (decisão 5).
- **Proibido**: `app/users/page.tsx`, `prisma/schema.prisma` e qualquer migration, `app/portal/**`,
  `lib/portal-context.ts`, `app/app/**` (telas do tenant), `agent-go/**`.
- Contrato de `POST /api/agent/register` intacto: corpo e status da resposta 201 e dos erros
  400/401/403/404/429/500 não mudam. O agente Go não é tocado.
- Contratos de teste da rotação (`alertdialog`, "Cancelar", "Confirmar", "Dispensar",
  `data-testid="rotation-result"`, foco de volta em "Emitir novo pacote") ficam.
- `tests/new-client-wizard-first-checkin.test.tsx` usa `getByRole('status')`; a região `status` nova
  fica na página de agentes, não no assistente.
- Zero cor literal, zero `dark:` novo, nenhum `hover:scale`, nenhum ícone decorativo (`DESIGN.md`
  §6 e §10).

### Critérios de aceite

- [x] **Guard (TDD)**: teste da página `/admin/clients/[id]/agents`, com execução **vermelha** no
      relatório antes da implementação: `PLATFORM_ADMIN` renderiza; `ORG_ADMIN` da mesma organização
      renderiza; `ORG_ADMIN` de outra organização → `notFound()`; cliente inexistente → `notFound()`
      (mesma resposta); `ORG_OPERATOR` → `notFound()`; `CLIENT_VIEWER` → `notFound()`.
- [x] **Guard, código**: a página chama `canManageTenant(user, client)` e não importa nem copia
      `requireClientsAdminAccess`.
- [x] **Escopo da query**: teste afirma que a consulta de agentes filtra por `clientId` do cliente
      autorizado, e que nenhum `AgentAuth` de outro cliente aparece.
- [x] **RN018 (TDD)**: a função de estado devolve "Revogado", "Bloqueado pelo cliente", "Registrado,
      sem coleta" e "Ativo" nos quatro casos, e a tela mostra cada um com `StatusPill`.
- [x] **Última coleta**: teste com `CollectionLog` mostra o `coletadoEm` mais recente; sem
      `CollectionLog` e com `Device`, mostra `Device.updatedAt`; sem `Device`, mostra "—".
      `AgentCheckLog` não é lido.
- [x] **Tela**: exatamente um `h1`, com o nome do cliente. Tabela com `TABLE_*`; `rg "font-medium"`
      nos `<th>` novos não acha nada. `agentAuthId` curto em `.data-mono` com `title` do id completo.
      Estado vazio com explicação e link focável para o pacote de instalação (afirmado em teste).
- [x] **Link**: em `/admin/clients`, cada linha leva a `/admin/clients/<id>/agents`, e "Abrir painel"
      continua a única ação com variante preenchida (afirmado em teste).
- [x] **RN020/N12**: a coluna "Agentes" mostra `activeAgentCount`; teste com um cliente de 3
      `AgentAuth` (2 ativos, 1 revogado) mostra `2`.
- [x] **Revogar, diálogo (TDD)**: o botão "Revogar" só existe em linhas não revogadas; o clique abre
      `alertdialog` e **não** chama a action; "Cancelar" não chama a action e devolve o foco ao botão
      "Revogar" da linha; "Confirmar" (variante destrutiva) chama a action com o `agentAuthId` da
      linha; o resultado é anunciado em `role="status"`.
- [x] **Revogar, texto**: o diálogo diz que é irreversível, que o serviço segue instalado e é
      recusado a cada ciclo, que a máquina e o histórico ficam, que comandos pendentes são cancelados
      e que reinstalar cria registro novo. Com um único agente ativo, mostra o aviso de último agente
      (afirmado em teste nos dois casos).
- [x] **Revogar, servidor**: teste da action afirma, na mesma transação: `isActive=false` e
      `revokedAt`; `AgentCommand` `pending` e `running` do `agentAuthId` → `expired` (e os `done`,
      `failed` intocados); `AlertEvent` abertos do device → `resolvedAt` preenchido, sem chamada a
      webhook; um `agent_auth.revoke`.
- [x] **Revogar, idempotência**: revogar credencial já revogada não altera `revokedAt` nem grava
      `AuditLog` (afirmado em teste).
- [x] **Revogar, isolamento**: os testes existentes de `tests/revoke-agent-auth.test.ts` continuam
      verdes; a mensagem para "não existe" e "outra organização" continua idêntica.
- [x] **Revogar, efeito real**: o teste de regressão existente (`validateAgentApiKey` devolve 403
      depois da revogação) continua verde.
- [x] **Alerta fantasma** (se a decisão 1 aprovar): teste de `reconcileAvailabilityEvents` com um
      device de `AgentAuth` revogado e sem coleta além do limiar: nenhum `AlertEvent` criado e nenhum
      webhook disparado; o device ativo do mesmo cliente continua sendo avaliado.
- [x] **N4 (TDD)**: com o checkbox **desmarcado**, a rotação não toca `AgentAuth`, `AgentCommand` nem
      `AlertEvent` e grava só o `credentials.rotate` de hoje (teste). Com o checkbox **marcado**, todos
      os ativos do cliente ficam revogados, com comandos expirados, eventos resolvidos e auditoria
      conforme a decisão 4, tudo dentro da mesma `$transaction` da troca de chave (teste afirma que
      uma falha na transação não deixa a chave trocada sem as revogações, nem o contrário). Agentes
      de **outro** cliente não são tocados.
- [x] **N4, UI**: o checkbox aparece desmarcado, diz quantos agentes serão revogados, some quando o
      cliente tem zero ativos, e é enviado no `FormData` só quando marcado (teste). O campo é
      validado por Zod.
- [x] **N5 (TDD)**: registro por `enrollmentKey` grava um `agent_auth.register` com `actorUserId`
      nulo, `targetId` = id do `AgentAuth`, `clientId` do cliente e `metadata { name, via:
      'enrollment_key' }`; registro por `X-Admin-Secret` grava `via: 'admin_secret'`; nenhum
      `metadata` contém `apiKey`, `enrollmentKey` ou hash; erros (400, 401, 403, 404) não gravam
      `AuditLog`; corpo da resposta 201 inalterado.
- [x] **Docs**: `docs/PRODUCT.md` tem RF029, RF030, RF031, RN018, RN019, RN020, UC 3.12 e a linha
      nova na §7; RN015 cita a revogação; `:144` diz que revogada é `403`. `rg "401/403"
      docs/PRODUCT.md` não acha a frase antiga do UC 3.3.
- [x] **Regras do `DESIGN.md` no diff**: `rg "dark:|hover:scale|animate-ping"` e
      `rg "#[0-9a-fA-F]{3,8}\b|rgb\(|oklch\("` nos arquivos tocados não acusam nada novo (grep no
      relatório).
- [x] **Segurança**: o `security-auditor` revisa o diff e confirma: guard da rota nova com
      `canManageTenant` e sem oráculo de existência; revogação e revogação em massa transacionais;
      um `AuditLog` por credencial revogada; `agent_auth.register` sem segredo; nenhum `clientId` ou
      `agentAuthId` vindo do cliente sem checagem de posse.
- [x] **Verificação visual**: o `visual-qa` captura `/admin/clients/<id de teste-a0-rotacao>/agents`
      em **390, 1024 e 1440 px**, com a lista (ou o estado vazio) e com o diálogo de revogação aberto;
      `scrollWidth <= clientWidth` em todas; contraste medido ≥ 4.5:1 nos rótulos da `StatusPill`;
      `document.querySelectorAll('h1').length === 1`. Revogação real só conforme a decisão 7, e
      **nada** é revogado ou rotacionado em `core-ti-expert`.
- [x] **Escopo de arquivos**: o diff toca só os arquivos permitidos e os condicionados que o usuário
      liberar. `app/users/page.tsx`, `prisma/`, `app/portal/**`, `app/app/**` e `agent-go/**` intactos.
- [x] Portão 1: `npm run typecheck` limpo.
- [x] Portão 2: `npm run lint` limpo, inclusive `react-hooks/set-state-in-effect`.
- [x] Portão 3: `npm run build:verify` limpo, com a rota `/admin/clients/[id]/agents` na listagem.
      **Não** rodar com o `next dev` de pé; o implementador avisa o orquestrador antes do build.
- [x] Portão 4: `npm test` verde com **mais de 893 testes** (baseline: 893 testes / 73 arquivos
      depois de `e261dd1`).
- [x] DoD (`docs/DEFINITION_OF_DONE.md`): os 10 itens conferidos um a um, com ✅ ou N/A e
      justificativa. "Banco de dados e migrations" é N/A (sem mudança de schema). "Validação Zod"
      cobre o campo novo da rotação. "RF/RN" cita RF029–RF031 e RN018–RN020.
- [x] Sem commit e sem push.

### Fora de escopo desta sprint

- **F4 e N6** (instalador Linux na UI e hash do executável): Sprint A4, registrada no Backlog,
  item 19, por decisão do usuário.
- **Dispositivos de `AgentAuth` revogado no portal**: Backlog, item 18, por decisão do usuário.
- **Histórico de alertas de máquina revogada em `/app/[slug]/alerts`** (divergência 5): tela do
  tenant, proibida nesta sprint. Se o usuário quiser escondê-los, vira item de Backlog.
- **Reativar** um `AgentAuth` revogado: RF030 define a revogação como irreversível; reinstalar cria
  credencial nova.
- **Revogação em massa fora da rotação** (seleção múltipla na lista): não pedida.
- **Agentes órfãos** (`AgentAuth.clientId` nulo, `schema.prisma:75-76`): não pertencem a cliente e não
  aparecem na rota nova.
- Renomear `AgentAuth.name` pela UI.
- Backlog 14 e 15 (`slug` sem `.max(64)` e `%VAR%` no `installCommand`), mesmo estando em
  `app/admin/clients/**` e `lib/provisioning.ts`: não pedidos.

### Documentação que ficará desatualizada (não editada por este plano)

- `PLANO_SPRINTS_COLABORACAO.md` §6 descreve a A3 como "F5 (+F4) … instalador Linux na UI"; com a
  decisão do usuário, o F4 foi para a A4. O §6.1 D12 ainda limita a fixture à A1. O documento é do
  gerente; o planner não o edita.
- `docs/adr/0005-enrollment-key-reexibivel.md:34` diz que a contenção (N4) "fica para a Sprint A3".
  Depois da A3 isso passa a ser verdade parcial (contenção opcional, desmarcada por padrão); o ADR
  não está na lista de arquivos liberados.
- `CONTEXT.md` (glossário) não define os estados de RN018 nem "revogado"; fora da lista liberada.

---

## Sprint A4 — Instalador Linux no Painel + Hash SHA-256 (N6 + F4)

**Status**: ✅ Concluída (2026-10-19) — 1.250 testes passando em 86 arquivos, 4 portões limpos.
Plano montado pelo `sprint-planner` a partir do registro do Backlog, item 19 (F4 e N6, retirados da
A3 por decisão do usuário), do relatório da Sprint A0 (`security-auditor`, N6; F4 confirmado em
`PLANO_SPRINTS_COLABORACAO.md:75`), dos fatos verificados pelo orquestrador e do escopo aprovado pelo
usuário com 8 ressalvas. Depende da A3 (concluída, commit `d4b42e1`; HEAD atual `2a4d138`; baseline
970 testes / 81 arquivos). Este plano não altera nenhuma linha de código. As linhas citadas abaixo
foram conferidas contra o código em 2026-10-19, depois de `2a4d138`.

**Objetivo**: quem administra um cliente passa a instalar o agente em Linux (amd64) direto do painel,
com o mesmo pacote que já existe para Windows: download do binário, script de uma linha e comando
manual. Os dois scripts de bootstrap (PowerShell e bash) passam a conferir o SHA-256 do binário
baixado antes de executá-lo e abortam se o hash divergir. Sem binário publicado, nenhum script é
servido.

### Origem do achado (rastreabilidade)

- **F4, só Windows na UI** (A0; `PLANO_SPRINTS_COLABORACAO.md:75`, "[confirmado]"; Backlog item 19).
  `components/agent-install-package.tsx:27-32` só oferece o `.exe`; `:68-69` só mostram PowerShell e
  cmd.exe. `scripts/build-agent.mjs:44-48` compila `linux/amd64` só para `agent-go/dist/`, com
  comentário obsoleto ("coletores Linux ainda nao existem"): `agent-go/internal/collectors/factory_linux.go`
  existe e `service_linux.go` instala unidade systemd `Type=simple` (`:97-110`, `ExecStart=%s run` a
  partir de `os.Executable()`, `:117-126`).
- **N6, bootstrap sem conferência de hash** (`security-auditor`, A0; adiado na A1a, "Fora de escopo",
  e na A3). `lib/provisioning.ts:163` faz `Invoke-WebRequest` de `/inventario-agent.exe` e `:168`
  executa o arquivo sem conferir hash. O SHA-256 só existe no auto-update (RF024,
  `lib/agent-binary.ts:22-36`, consumido em `app/api/agent/checkin/route.ts:401`).
- **Injeção em shell** (classe do N1 da A1a, `security-auditor`). Um comando bash montado com
  `serverUrl`, `slug` e chave é a mesma superfície fechada na A1a para PowerShell e cmd.exe. A
  allowlist de `lib/provisioning.ts:14-95` (lança erro, não sanitiza) é a primeira camada; falta o
  escape de bash.
- **Fatos do orquestrador conferidos nesta rodada**: `lib/agent-binary.ts:10` fixa o caminho no
  `.exe`; o agente lê `<<INV_CONFIG>>` do fim do próprio binário em qualquer plataforma
  (`agent-go/cmd/inventario-agent/main.go:53`) e, sem argumentos e com config, faz autoinstall
  (`:111-119`); no Linux sem root, `elevation_stub.go:16-19` avisa e sai com código 1;
  `download-exe/route.ts:38-47` monta o bloco; `.gitignore:44` só ignora `public/*.exe`.

### RFs relacionados (numeração proposta: próximo livre RF032)

- **RF032 (novo)**: instalação Linux (amd64) pelo painel e conferência de hash nos dois bootstraps.
  O pacote de instalação oferece Windows e Linux. `GET /api/agent/bootstrap-linux` serve um script
  bash e `GET /api/agent/download-linux` serve o binário com a configuração embutida. Os dois
  scripts de bootstrap (`.ps1` e `.sh`) carregam o SHA-256 do binário publicado e abortam, com
  código diferente de zero, se o arquivo baixado divergir. Sem binário publicado da plataforma, a
  rota responde `503` sem script. O texto registra o limite do N6 (ressalva 5): com `http` na rede
  local, script e binário vêm do mesmo canal; o hash protege contra download corrompido ou truncado
  e contra binário trocado no servidor depois de o script ser gerado, **não** contra interceptação
  ativa. A defesa contra MITM é HTTPS.
- **RF003**: enrollment. O UC 3.2 ganha o caminho Linux.
- **RF024**: auto-update. Inalterado nesta sprint (ver o Backlog, item 24).
- **RF025**: coleta multiplataforma. Passa a ter instalação pelo painel.

### RNs / RNFs relacionados

- **RNF002**: Zod (`provisioningParamsSchema`) antes de qualquer efeito nas duas rotas novas, com a
  mesma resposta `400` da A1a (`PROVISIONING_PARAMS_ERROR`).
- **RNF003**: allowlist que lança erro (primeira camada) e `escapeBashSingleQuoted` (segunda camada).
  O hash esperado também é validado (`/^[a-f0-9]{64}$/`) antes de entrar em qualquer script.
- **RNF010**: rate limit por IP nas duas rotas novas, 20 por 5 min, chaves próprias
  (`bootstrap-linux:`, `download-linux:`), no padrão de `bootstrap/route.ts:11`.
- **RN005**: a chave continua só no pacote já exibível (ADR 0005); nenhuma rota nova persiste nada.

### Casos de uso

- **UC 3.2** (`docs/PRODUCT.md:120-133`): passo 1 ganha o caminho Linux (botão, `curl … | sudo
  bash` e comando manual) e a conferência de hash nos dois bootstraps; exceções ganham "binário não
  publicado (`503`)" e "hash divergente (script aborta, nada é instalado)".
- **UC 3.1**: o pacote mostrado ao criar cliente e ao emitir novo pacote passa a ter as duas
  plataformas.

### Entidades de banco

Nenhuma alteração de schema, migration, `db push` ou backup. Nenhuma entidade nova é lida: as rotas
novas não consultam o banco (mesmo desenho de `bootstrap` e `download-exe`, `docs/PRODUCT.md:558`).
`Client` e `AuditLog` continuam sendo lidos e escritos só pelos caminhos já existentes de
`actions.ts` e `credentials/route.ts`, que ganham apenas os campos de hash no pacote.

Fixture de verificação: `teste-a0-rotacao`. **Nada** é rotacionado, revogado ou instalado em
`core-ti-expert`.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1 — **Build e publicação**: `buildLinux()` vira `publishLinux()`: compila `linux/amd64` e copia para `public/inventario-agent-linux`; o alvo `all` publica os dois; o comentário obsoleto de `:45-46` é trocado por um correto. O implementador roda `node scripts/build-agent.mjs all` e registra no relatório os dois SHA-256 publicados | RF032, RF025 | UC 3.2 | — | F4 (A0); fatos do orquestrador |
| 2 — **`.gitignore`**: uma linha, `public/inventario-agent-linux` (ressalva 4) | RF032 | — | — | orquestrador (ressalva 4) |
| 3 — **`lib/agent-binary.ts` por plataforma (TDD)**: `getAgentBinaryPath(platform = 'windows')` e `getAgentBinarySha256(platform = 'windows')`, `platform: 'windows' \| 'linux'`; cache por mtime separado por plataforma; chamada sem argumento (checkin) devolve exatamente o de hoje | RF032, RF024 | UC 3.2 | — | security-auditor (A0, N6) |
| 4 — **`escapeBashSingleQuoted` (TDD)**: `'` → `'\''`. Segunda camada; a primeira continua sendo `assertProvisioningInput` (`lib/provisioning.ts:91-95`) para client, key e serverUrl (ressalva 7). Como `linuxInstallCommand` usa aspas duplas de bash, a recusa de `$` e backtick pela allowlist é obrigatória e testada | RNF003 | UC 3.2 | — | security-auditor (A1a, N1, mesma classe) |
| 5 — **`buildLinuxBootstrapScript(serverUrl, clientSlug, enrollmentKey, expectedSha256)` (TDD)**: `expectedSha256` obrigatório, validado por `/^[a-f0-9]{64}$/`; ausente ou inválido → lança (ressalva 3). Script: `#!/usr/bin/env bash`; `set -euo pipefail`; `id -u` diferente de 0 → mensagem e saída ≠ 0; `mktemp -d` com `trap` que apaga o diretório; download de `${server}/inventario-agent-linux` por `curl -fsSL` (fallback `wget -qO`; nenhum dos dois → aborta); hash por `sha256sum` ou `shasum -a 256` (nenhum → aborta); divergência → mensagem com esperado e obtido, apaga o arquivo e sai ≠ 0; `chmod 755`; se `/etc/systemd/system/inventario-agent.service` existir, desinstala a versão anterior (o `Install()` do agente recusa unidade existente, `service_linux.go:113-115`); move para `/usr/local/bin/inventario-agent` e executa de lá `install -server … -client … -key … -name "$(hostname)"`. Valores interpolados entre aspas simples com o escape do item 4. Nenhum binário é executado a partir do diretório temporário (ver decisão 3) | RF032, RNF003 | UC 3.2 | — | F4; security-auditor (A0, N6); ressalvas 3 e 7 |
| 6 — **N6 Windows (TDD, ressalva 2)**: `buildBootstrapScript` ganha `expectedSha256` obrigatório e validado como no item 5. Depois do `Invoke-WebRequest` (`:163`) e antes de qualquer execução do arquivo baixado (`:165`, `:168`), compara `(Get-FileHash -Algorithm SHA256 -Path $downloadPath).Hash` com o esperado sem diferenciar maiúsculas; divergência → `Remove-Item` do arquivo e `throw` com esperado e obtido | RF032, RNF003 | UC 3.2 | — | security-auditor (A0, N6) |
| 7 — **`/api/agent/bootstrap` (TDD)**: passa `getAgentBinarySha256()` ao builder; `null` → `503` sem script, depois do `400` de parâmetro e antes de montar o script. O `500` de `serverUrl` rejeitado (`route.ts:30-35`) continua | RF032 | UC 3.2 | — | security-auditor (A0, N6); ressalva 2 |
| 8 — **`buildProvisioningArtifacts`**: acrescenta `linuxBootstrapUrl` (`/api/agent/bootstrap-linux?client=&key=`), `linuxBootstrapCommand` (`curl -fsSL '<url escapada>' \| sudo bash`) e `linuxInstallCommand` (forma final pela decisão 2). Tipos atualizados em `lib/provisioning.ts:3-7` e `app/admin/clients/types.ts:1-9`. Campos atuais intactos | RF032 | UC 3.1, UC 3.2 | — | F4 |
| 9 — **Rota nova `app/api/agent/bootstrap-linux/route.ts` (TDD)**: pública, rate limit (RNF010), `provisioningParamsSchema`, `400` igual ao da A1a; hash por `getAgentBinarySha256('linux')`, `null` → `503` sem script; `200` com `text/plain; charset=utf-8`, `Content-Disposition: attachment; filename="install-${client}.sh"`, `Cache-Control: no-store` | RF032, RNF002, RNF010 | UC 3.2 | — | F4; ressalva 3 |
| 10 — **Rota nova `app/api/agent/download-linux/route.ts` (TDD)**: pública, rate limit, mesmo schema e `400`; lê `getAgentBinaryPath('linux')`; ausente → `503` sem binário; anexa o bloco `<<INV_CONFIG>>` com paridade byte a byte com `download-exe` (helper compartilhado se reduzir duplicação; nesse caso `download-exe/route.ts` só troca a montagem pelo helper); `200` com `application/octet-stream`, `Content-Disposition: attachment; filename="inventario-agent-${client}"`, `Cache-Control: no-store`, `Content-Length` | RF032, RNF002, RNF010 | UC 3.2 | — | F4 |
| 11 — **`proxy.ts` (condicional à decisão 1)**: `/api/agent/bootstrap-linux`, `/api/agent/download-linux` e `/inventario-agent-linux` em `publicRoutes`. Sem isso as três respondem `307 → /login` a quem não tem sessão (divergência 1) | RF032 | UC 3.2 | — | conferido nesta rodada; Backlog item 8 (mesma classe) |
| 12 — **Hash até a tela (ressalva 8)**: `app/admin/clients/actions.ts` (`buildState`, `:142-169`, que serve criação e rotação) e `app/api/clients/[id]/credentials/route.ts` (`:96-119`) acrescentam `windowsSha256` e `linuxSha256` (`string \| null`) ao pacote, lidos no servidor por `getAgentBinarySha256`. Nenhuma outra linha desses arquivos muda; o `AuditLog` existente não muda | RF032 | UC 3.1 | Client (leitura já existente) | orquestrador (ressalva 8) |
| 13 — **UI `components/agent-install-package.tsx` (TDD)**: seletor Windows \| Linux com semântica de `tablist`/`tab`/`tabpanel` (`aria-selected`, setas e Home/End, um só `tabIndex=0`) ou `radiogroup` (`aria-checked`); tokens `bg-secondary`, `border-surface-line`, `cursor-pointer`; zero cor literal. **Windows**: "Baixar instalador para Windows (.exe)", PowerShell de uma linha, cmd.exe manual. **Linux**: "Baixar binário para Linux (amd64)", `curl … \| sudo bash`, comando manual com nota de `chmod +x` e `sudo`. **Badge do hash (ressalva 1)**: rótulo "SHA-256 do binário publicado (sem configuração)", nota curta de que o arquivo do botão inclui a configuração e por isso tem outro hash, e de que a conferência automática é feita pelo script de uma linha; `.data-mono`, truncado, com `title` do hash inteiro. Hash `null` → "binário não publicado" naquela plataforma, **sem** botão de download e sem comando de uma linha para ela. Caixa da chave (F3) idêntica | RF032 | UC 3.1, UC 3.2 | — | F4; ressalvas 1 e 8 |
| 14 — **Docs**: `docs/PRODUCT.md`: RF032, UC 3.2, linhas novas da §8.1 (`:522-523` têm as rotas do Windows), contratos e `503` na §8.4, limite do N6 (ressalva 5). `docs/SPEC.md`: contratos de `bootstrap-linux` e `download-linux` na §2, `503` no `bootstrap` (`:202`), schema compartilhado na §3.6, rate limit na §4.4. `docs/PRODUTO.md` só onde citar a instalação | RF032 | UC 3.2 | — | requisito novo (F4); ressalva 5 |
| 15 — **Testes** em `tests/`: ver os critérios de aceite. `tests/provisioning-security.test.ts`, `tests/agent-binary-sha256.test.ts` e `tests/agent-install-package-copy.test.tsx` continuam verdes; mudança de rótulo exigida pelo escopo ("(.exe)") é declarada no relatório | — | — | — | orquestrador (TDD) |

**Ordem de execução recomendada:**
1. testes vermelhos: itens 3, 4, 5, 6, 7, 9, 10 e 13;
2. itens 3 e 4, depois 5 e 6 (`lib/`);
3. itens 7, 9 e 10 (rotas) e, se aprovado, 11 (`proxy.ts`);
4. itens 8 e 12 (pacote e tipos);
5. item 13 (UI);
6. itens 1 e 2 (build e publicação; avisar o orquestrador antes);
7. item 14 (docs);
8. portões;
9. `security-auditor` sobre o diff e `visual-qa`.

### Decisões que ficam para o usuário

1. **Liberar `proxy.ts` (item 11).** **Recomendação: sim, só as três entradas em `publicRoutes`.** O
   casamento é exato ou por prefixo com `/` (`proxy.ts:52-54`): `/api/agent/bootstrap-linux` não casa
   com `/api/agent/bootstrap`, e `/inventario-agent-linux` não tem extensão, então o `matcher`
   (`proxy.ts:123`, que só exclui `.exe` e imagens) passa por ele. Sem a liberação, `curl -fsSL`
   segue o `307` até `/login`, recebe HTML com `200` e o script aborta por hash divergente: a
   funcionalidade nasce quebrada, e nenhum teste Vitest pega isso (Backlog, item 8). A alternativa
   de excluir o arquivo no `matcher` também exige `proxy.ts`.
2. **Forma do comando manual Linux.** O serviço systemd aponta para onde o binário estiver no
   momento do `install` (`service_linux.go:117-126`). O `./inventario-agent install …` do escopo
   deixa o serviço preso à pasta de download, e o arquivo baixado pelo botão se chama
   `inventario-agent-<slug>`, não `inventario-agent`. **Recomendação**: `sudo install -m 755
   ./inventario-agent-<slug> /usr/local/bin/inventario-agent && sudo /usr/local/bin/inventario-agent
   install -server "…" -client "…" -key "…" -name "$(hostname)"`, mesmo destino do bootstrap. A nota
   de `chmod +x` fica para quem rodar o autoinstall (`chmod +x` e `sudo ./inventario-agent-<slug>`),
   com o aviso de mover o arquivo antes, porque o autoinstall registra o caminho atual.
3. **Execução a partir do diretório temporário.** `/tmp` com `noexec` é comum em servidores
   endurecidos. **Recomendação**: o script não executa nada do `mktemp -d`; para desinstalar a versão
   anterior, move o binário novo para `/usr/local/bin` primeiro e roda `uninstall` de lá (o
   `Uninstall()` só mexe no systemd, `service_linux.go:142-153`), depois `install`.
4. **`visual-qa` também no estado vazio do tenant.** `components/tenant-empty-state.tsx:94` usa o
   mesmo componente; o seletor aparece em `/app/teste-a0-rotacao` sem nenhum arquivo extra tocado.
   **Recomendação: incluir** essa tela nas 3 larguras.
5. **`download-exe` sem binário responde `500`** (`download-exe/route.ts:33-35`), não `503` como as
   rotas novas e `download/route.ts:30-35`. **Recomendação: não mudar nesta sprint** (contrato
   existente; o arquivo só é liberado para extrair o helper). Se o usuário quiser paridade, a troca é
   uma linha com teste.

### Divergências registradas

1. **Rotas públicas novas exigem `proxy.ts`**, que não está na lista de arquivos permitidos (decisão
   1). Vale para as duas rotas e para o arquivo estático `/inventario-agent-linux` que o script baixa.
2. **`getAgentBinaryPath` não tem consumidor.** O briefing diz que o único consumidor de
   `lib/agent-binary.ts` é o checkin: é verdade para `getAgentBinarySha256`. `download/route.ts:19`
   e `download-exe/route.ts:28` repetem o caminho literal. As rotas novas devem usar
   `getAgentBinaryPath('linux')`; as duas antigas ficam como estão (fora da lista).
3. **`§8.4` não basta**: as rotas do Windows aparecem também na tabela resumo `docs/PRODUCT.md`
   §8.1 (`:522-523`) e no UC 3.2 (`:125`). O item 14 inclui os três pontos.
4. **`Install()` Linux recusa unidade existente** (`service_linux.go:113-115`, "Use 'uninstall'
   primeiro"). "Desinstala versão anterior se existir" não é opcional: sem isso a reinstalação falha.
5. **Rótulo do botão Windows muda** ("Baixar instalador para Windows" → "… (.exe)").
   `tests/agent-install-package-copy.test.tsx` pode afirmar o texto atual.
6. **Mensagem do autoinstall é de Windows**: `main.go:98` manda religar "pelo services.msc", também
   no Linux. `agent-go/**` é proibido; fica registrado, não corrigido.

### Restrições de compatibilidade

- **Arquivos permitidos**: `scripts/build-agent.mjs`, `.gitignore` (uma linha), `lib/agent-binary.ts`,
  `lib/provisioning.ts`, `app/api/agent/bootstrap/route.ts`, `app/api/agent/bootstrap-linux/**`,
  `app/api/agent/download-linux/**`, `app/api/agent/download-exe/route.ts` (só para extrair o helper
  do bloco), `app/admin/clients/types.ts`, `app/admin/clients/actions.ts` e
  `app/api/clients/[id]/credentials/route.ts` (só o hash), `components/agent-install-package.tsx`,
  `docs/`, `tests/`. **Condicionado**: `proxy.ts` (decisão 1).
- **Proibido**: `agent-go/**`, `app/api/agent/checkin/route.ts`, `app/users/page.tsx`,
  `prisma/schema.prisma` e qualquer migration.
- `getAgentBinarySha256()` sem argumento devolve o mesmo valor de hoje: o auto-update (RF024) não
  muda.
- Contratos A1a intactos: `400` com `PROVISIONING_PARAMS_ERROR` e sem corpo de script/binário;
  `provisioningParamsSchema` sem mudança.
- `bootstrapUrl`, `bootstrapCommand` e `installCommand` com o mesmo texto de hoje para entradas
  válidas.
- Zero cor literal, zero `dark:` novo, nenhum `hover:scale`, nenhum ícone decorativo (`DESIGN.md`
  §6 e §10).

### Critérios de aceite

- [x] **Build**: `node scripts/build-agent.mjs all` gera `public/inventario-agent.exe` e
      `public/inventario-agent-linux`; `node scripts/build-agent.mjs linux` publica só o Linux; o
      comentário de `buildLinux`/`publishLinux` não diz mais que os coletores Linux não existem. O
      relatório traz os dois SHA-256.
- [x] **`.gitignore`**: `git status --porcelain public/` não lista `inventario-agent-linux` depois do
      build; o diff do `.gitignore` é uma linha.
- [x] **agent-binary (TDD)**: teste afirma `getAgentBinaryPath()` = `public/inventario-agent.exe`,
      `getAgentBinaryPath('linux')` = `public/inventario-agent-linux`; o hash de cada plataforma é o
      do arquivo dela; o cache de uma plataforma não serve a outra; mudar o mtime recalcula; arquivo
      ausente → `null`. `tests/agent-binary-sha256.test.ts` continua verde.
- [x] **Escape bash (TDD)**: `escapeBashSingleQuoted` troca cada `'` por `'\''` (teste unitário).
      Com bash disponível, `bash -c "printf %s '<escapado>'"` devolve o literal original para
      valores com `'`, `$(id)`, backtick, `;`, `|`, `&` e `\n` (prova de que o escape não vira
      comando).
- [x] **Allowlist primeiro (TDD)**: `buildLinuxBootstrapScript` e `buildProvisioningArtifacts`
      **lançam** para cada payload de `tests/provisioning-security.test.ts` em `client`, `key` e
      `serverUrl` (inclusive `$` e backtick, exigidos pelas aspas duplas do `linuxInstallCommand`).
- [x] **Hash obrigatório (TDD)**: `buildLinuxBootstrapScript` e `buildBootstrapScript` lançam com
      `expectedSha256` ausente, vazio, com maiúsculas fora do padrão escolhido, com 63 ou 65
      caracteres, ou com caractere fora de `[a-f0-9]`.
- [x] **Script Linux (TDD)**: o texto gerado começa com `#!/usr/bin/env bash`, tem `set -euo
      pipefail`, checagem de `id -u`, `mktemp -d` com `trap` de limpeza, `curl -fsSL` com fallback
      `wget`, `sha256sum` com fallback `shasum -a 256`, comparação com o hash recebido, saída ≠ 0 na
      divergência, `chmod 755`, desinstalação condicionada à unidade existente, destino
      `/usr/local/bin/inventario-agent` e `install -server … -client … -key … -name "$(hostname)"`.
      Conforme a decisão 3, nenhuma linha executa binário dentro do diretório temporário.
- [x] **Parse**: com bash disponível (Git Bash está), `bash -n` no script gerado sai com 0. O
      relatório mostra que o teste **rodou**, não foi pulado.
- [x] **Hash divergente na prática**: com bash disponível, um teste roda o trecho de conferência do
      script contra um arquivo cujo hash não bate e afirma saída ≠ 0, sem chegar ao `install`
      (download e `install` substituídos por stub; nada instalado no ambiente).
- [x] **N6 Windows (TDD)**: o `.ps1` tem `Get-FileHash -Algorithm SHA256` sobre `$downloadPath`
      **depois** do `Invoke-WebRequest` e **antes** da primeira execução de `$downloadPath`, com
      `Remove-Item` e `throw` na divergência (teste afirma a ordem das linhas). Os testes de escape
      PowerShell da A1a continuam verdes.
- [x] **`/api/agent/bootstrap` (TDD)**: com binário, `200` e o hash do `.exe` publicado no script;
      sem binário, `503` sem script no corpo; parâmetro inválido continua `400` igual à A1a.
- [x] **`/api/agent/bootstrap-linux` (TDD)**: um caso de teste por payload da A1a em `client` e em
      `key` → `400` com `PROVISIONING_PARAMS_ERROR` e sem script; sem binário Linux → `503` sem
      script; com slug e chave legítimos → `200`, `Content-Type: text/plain; charset=utf-8`,
      `Content-Disposition: attachment; filename="install-<slug>.sh"`, `Cache-Control: no-store`,
      e o hash do binário Linux no script; excesso de requisições → `429`.
- [x] **`/api/agent/download-linux` (TDD)**: mesmos `400` por payload, sem bytes de binário no
      corpo; sem binário → `503`; `200` com `application/octet-stream`,
      `filename="inventario-agent-<slug>"`, `Cache-Control: no-store`, `Content-Length`, e o corpo é
      o binário seguido do bloco `<<INV_CONFIG>>` idêntico ao de `download-exe` para os mesmos
      parâmetros (teste de paridade). `download-exe` continua verde.
- [x] **Proxy** (se a decisão 1 aprovar): `curl -sS -o /dev/null -w "%{http_code}"` sem sessão,
      contra `next start` depois do `build:verify`, devolve `200` (ou `503`/`400` conforme o caso),
      nunca `307`, em `/api/agent/bootstrap-linux`, `/api/agent/download-linux` e
      `/inventario-agent-linux`. Resultado no relatório.
- [x] **Pacote**: `buildProvisioningArtifacts` devolve `linuxBootstrapUrl`, `linuxBootstrapCommand`
      (`curl -fsSL '<url>' | sudo bash`, URL escapada) e `linuxInstallCommand` (forma da decisão 2);
      `bootstrapUrl`, `bootstrapCommand` e `installCommand` com o texto de hoje (teste de
      não-regressão).
- [x] **Hash na tela (ressalva 8)**: teste da action (criação e rotação) e da rota de credenciais
      afirma `windowsSha256`/`linuxSha256` no pacote, `null` quando o binário falta; nenhum outro
      campo da resposta nem do `AuditLog` muda.
- [x] **UI (TDD)**: o seletor alterna Windows e Linux por clique e por teclado (setas, Home/End;
      ou setas no `radiogroup`), com `aria-selected`/`aria-checked` corretos; cada aba mostra só os
      seus comandos; o badge tem o rótulo "SHA-256 do binário publicado (sem configuração)", a nota
      sobre o arquivo do botão e o `title` com o hash inteiro; hash `null` → "binário não publicado",
      sem botão de download e sem comando de uma linha daquela plataforma; a caixa da chave é a
      mesma da A2 (teste existente verde).
- [x] **Regras do `DESIGN.md` no diff**: `rg "dark:|hover:scale|animate-ping"` e
      `rg "#[0-9a-fA-F]{3,8}\b|rgb\(|oklch\("` nos arquivos tocados não acusam nada novo (grep no
      relatório).
- [x] **Docs**: `docs/PRODUCT.md` tem RF032, UC 3.2 atualizado, as rotas novas na §8.1 e na §8.4,
      o `503` e o parágrafo do limite do N6 (HTTP no mesmo canal; MITM só com HTTPS).
      `docs/SPEC.md` tem os dois contratos novos, o `503` do `bootstrap` e as linhas novas de rate
      limit.
- [x] **Segurança**: o `security-auditor` revisa o diff e confirma: rotas públicas novas com
      allowlist antes de qualquer efeito e rate limit; nenhuma interpolação sem allowlist e escape;
      script executado como root falha fechado (sem root, sem ferramenta de download, sem
      ferramenta de hash, hash divergente → sai ≠ 0 sem instalar); hash obrigatório nos dois
      builders; `503` sem script quando falta binário; nenhum segredo em log.
- [x] **Verificação visual**: o `visual-qa` captura o pacote de `teste-a0-rotacao` (diálogo "Ver
      credenciais" e, se a decisão 4 aprovar, o estado vazio em `/app/teste-a0-rotacao`) em **390,
      1024 e 1440 px**, nas duas abas; `scrollWidth <= clientWidth`; foco visível no seletor;
      contraste ≥ 4.5:1 no rótulo do badge. **Nada** em `core-ti-expert`.
- [x] **Escopo de arquivos**: o diff toca só os arquivos permitidos e o condicionado aprovado;
      `agent-go/**`, `app/api/agent/checkin/route.ts`, `app/users/page.tsx` e `prisma/` intactos.
- [x] Portão 1: `npm run typecheck` limpo.
- [x] Portão 2: `npm run lint` limpo.
- [x] Portão 3: `npm run build:verify` limpo, com `/api/agent/bootstrap-linux` e
      `/api/agent/download-linux` na listagem. **Não** rodar com o `next dev` de pé; o implementador
      avisa o orquestrador antes do build.
- [x] Portão 4: `npm test` verde com **mais de 970 testes** (baseline: 970 testes / 81 arquivos
      depois de `2a4d138` — alcançado 1.250 testes em 86 arquivos).
- [x] DoD (`docs/DEFINITION_OF_DONE.md`): os 10 itens conferidos um a um, com ✅ ou N/A e
      justificativa. "Banco de dados e migrations" é N/A. "Validação Zod" cobre as duas rotas novas.
      "RF/RN" cita RF032.
- [x] Sem commit e sem push.

### Fora de escopo desta sprint

- **Auto-update Linux** (o checkin sempre anuncia o `.exe`): Backlog, item 24. Exige mudança no
  agente Go, proibida aqui.
- **Mensagem "services.msc" do autoinstall no Linux** (divergência 6): `agent-go/**`.
- **`linux/arm64`** e outras arquiteturas: não pedidas; o rótulo diz "amd64".
- **Defesa contra MITM** além do hash (assinatura do binário, pinagem): o limite fica documentado
  (ressalva 5); a defesa é HTTPS.
- **`download-exe` e `download` com `503`** (decisão 5) e com `getAgentBinaryPath`: contratos
  existentes, fora da lista.
- **Script antigo `scripts/agent/install-linux-agent.sh`** (modelo timer + oneshot): não é usado
  pelo painel; remoção não pedida.
- Backlog 14 e 15 (`slug` sem `.max(64)` e `%VAR%` no `installCommand`), mesmo estando em
  `lib/provisioning.ts`: não pedidos.

### Documentação que ficará desatualizada (não editada por este plano)

- `PLANO_SPRINTS_COLABORACAO.md` §6 ainda põe o F4 na A3 (`:203`); `:538` já cita a A4. O documento
  é do gerente; o planner não o edita.
- `scripts/agent/install-linux-agent.sh` continua descrevendo o modelo antigo, sem aviso de que o
  painel usa outro caminho; fora da lista liberada.
- `CONTEXT.md` (glossário) não define "binário publicado" nem "bootstrap"; fora da lista liberada.

---

## Sprint V17 — Padronização visual do tenant (alinhamento, grid, cabeçalhos, esqueletos e medidor de disco)

**Status**: 🟡 Implementada, **com 1 decisão pendente do usuário** (entrega 2, fileiras de 5 KPI) —
executada em 2026-10-21 sobre `887bf0e`. Contexto: `docs/PROJETO-PADRONIZACAO-VISUAL.md` §§3–4 e o
prompt da Sprint 17 (§10). Testes rodados localmente só nos arquivos tocados (104 testes, 4 arquivos,
todos verdes); `tsc --noEmit` e `eslint` nos arquivos alterados limpos. Suíte completa e `build` ficam
com o orquestrador. Nenhum arquivo proibido tocado (`app/admin/clients/**`, `app/users/page.tsx`,
`prisma/schema.prisma`).

### Plano (TDD)

1. Red: `tests/tenant-visual-standard.test.ts` (novo, estrutural sobre o fonte — jsdom não calcula
   layout, então grid/recuo/cabeçalho só são verificáveis pela classe), mais casos novos em
   `tests/tenant-storage-table.test.tsx` (medidor) e `tests/disk-usage.test.ts`
   (`DISK_USAGE_TIER_BAR_CLASS`). 30 falhas na primeira rodada.
2. Green: entregas 1–7 abaixo. 104/104.

### Entregas

| # | Entrega | Resultado |
|---|---|---|
| 1 | Recuo de 20px | Hero da Visão Geral já estava em `px-5` desde a Sprint 16; o esqueleto dele ainda usava `px-6`/`pt-6` — corrigido. `/alerts` e `/settings` (página e esqueleto): `p-6` → `p-5`. Teste cobra que nenhuma página/esqueleto do tenant tenha superfície-card com `p-6`/`px-6` (botão excluído). |
| 2 | Grid de KPI 3 ou 4 | `/storage`, `/processors`, `/reports` (4) e `/audit` (3) já obedeciam; os esqueletos de `/reports` usavam `sm:grid-cols-2` e passam a `md:`. **Visão Geral, `/computers` e `/assets` têm 5 cards — não alterados, aguardando decisão** (ver abaixo). |
| 3 | `h1` na Visão Geral | O `h1` já existia nos dois caminhos (com e sem máquinas, Sprint A2). O comentário foi reescrito (sem "única tela sem h1") e o `h1` passou para o cabeçalho padrão. |
| 4 | Cabeçalho único | As 12 telas usam `flex flex-wrap items-start justify-between gap-4` + `h1 text-2xl font-bold text-foreground` + subtítulo `text-muted-foreground`. Ajustadas: `/audit` (`items-center` sem `flex-wrap`, subtítulo `text-sm`), `/alerts`, `/network`, `/processors`, `/servers`, `/settings`, `/storage` e Visão Geral (estavam num `<div>` simples). |
| 5 | Esqueletos com forma real | Novo `components/ui/skeleton-shapes.tsx` (`KpiCardSkeleton`, `PanelSkeleton`, `TableSkeleton`, `PageHeaderSkeleton`) importando as mesmas constantes das superfícies reais (`KPI_ICON_CHIP_CLASS`, `TABLE_SHELL_CLASS`, `TABLE_HEAD_ROW_CLASS`). `/storage` e `/processors` deixam de ser pilha de cartões `p-6` e viram fileira de 4 KPI + tabela; `/reports` ganha a grid `md:` e painéis `px-5`; Visão Geral: gráficos reservam 180px (era `h-56` = 224px), KPI com a anatomia do `KpiCard`, tabela final sem borda dupla. |
| 6 | Espaçamento fantasma em `/servers` | Removido o `div` com só `{/* Action buttons... */}` (48px → 24px). |
| 7 | Medidor de disco em `/storage` | Saiu o recorte `clip-path: inset(...)` sobre a escala em gradiente (`.disk-usage-scale`) e as marcas de limiar (`.disk-usage-mark`), ambos apagados de `globals.css`. Causa do artefato: aresta reta sem antialias sobre trilho `rounded-full`, caindo no meio da transição verde→âmbar entre 60–80% (o "amarelado" a 66%). Agora: preenchimento por `width` (limitado a 0–100%), `rounded-full` próprio, cor chapada do tier por `DISK_USAGE_TIER_BAR_CLASS` (`bg-success` ≤60%, `bg-warning` 60–80%, `bg-destructive` >80% — mesmos limiares exclusivos de `getDiskUsageTier`) e transição `motion-safe:transition-[width]`. |

### Decisão pendente — fileiras de 5 KPI (entrega 2)

O prompt da Sprint 17 proíbe remover card sem aprovação explícita. As três fileiras estão listadas em
`KPI_ROWS_PENDING_APPROVAL` no teste novo (com os esqueletos correspondentes); quando a decisão for
tomada, saem da lista e a regra passa a cobrá-las. Propostas:

- **Visão Geral** (`app/app/[clientSlug]/page.tsx`): retirar **"Disco crítico"** da fileira. O mesmo
  dado já aparece no gráfico "Uso de disco por máquina" e no painel de críticos, e o card do `/storage`
  filtra a mesma faixa. Fica 4 cards (`md:grid-cols-2 lg:grid-cols-4`, sem `xl:grid-cols-5`).
  Alternativa: deixar a recomposição para a Sprint 18 (duas faixas).
- **`/computers` e `/assets`** (mesmo `components/tenant-computers-table.tsx`): retirar **"Total
  Máquinas"**. A contagem já está no subtítulo do cabeçalho e a aba "Todos" limpa o filtro de status.
  Atenção: hoje o card também limpa o filtro crítico (`clearCriticalFilter`); sem ele, os 4 cards de
  filtro limpam a si mesmos no segundo clique (toggle), que já é o comportamento deles.

### Fora de escopo (não feito)

- Card dentro de card em `/alerts` e `/settings` (lista com `rounded-xl border` dentro da superfície)
  e `h2 text-lg` desses blocos: Sprint 20 (telas remanescentes).
- Ordem e composição da Visão Geral: Sprint 18 (feita — ver Sprint V18; a decisão dos 5 KPI da Visão Geral foi resolvida lá com 3 + 2).

---

## Sprint V18 — Visão Geral em duas faixas e o fim do termo "frota"

**Status**: ✅ Implementada em 2026-10-21 sobre `936ed96`. Contexto: `docs/PROJETO-PADRONIZACAO-VISUAL.md`
§§5–6. Depende das Sprints 16 e 17. Por determinação do usuário, **a suíte inteira não foi rodada
neste contexto** — só os testes dos arquivos tocados (abaixo). Suíte completa e `build` ficam com o
orquestrador. Nenhum arquivo proibido tocado (`app/admin/clients/**`, `app/users/page.tsx`,
`prisma/schema.prisma`).

### Entregas

| # | Entrega | Resultado |
|---|---|---|
| 1 | Faixa 1 — Ação | `<section aria-label="Ação imediata">`: grid `md:grid-cols-3` com **Em atenção**, **Sem coleta recente** e **Disco crítico**, seguida do painel **Dispositivos em alerta crítico** em largura total (antes dividia a linha com a atividade recente). |
| 2 | Separador | `<section>` do retrato com `border-t border-surface-line pt-6` e `h2.section-label` "Retrato do parque". |
| 3 | Faixa 2 — Retrato | Hero de conformidade (antivírus, BitLocker, firewall) → grid `md:grid-cols-2` com **Máquinas monitoradas** e **Online agora** → 3 gráficos (SO, RAM, uso de disco; `lg:grid-cols-2 xl:grid-cols-3`, o terceiro ocupa a linha inteira em `lg` para não ficar órfão) → **Atividade recente** ao lado de **Últimas coletas** (`xl:grid-cols-2`; título do painel era "Últimas atualizações"). |
| 4 | Cards órfãos | Os 5 KPIs passam a 3 + 2 por significado (decisão × contexto), sem inventar um sexto card e sem remover nenhum. A Visão Geral e o esqueleto dela saem de `KPI_ROWS_PENDING_APPROVAL` em `tests/tenant-visual-standard.test.ts`; a fileira de 2 é permitida **só** na Visão Geral (`KPI_GRID_2_ALLOWED`). `/computers` e `/assets` continuam pendentes (decisão da V17). |
| 5 | Donut de Status removido | `StatusChart` sai da página (repetia os 3 KPIs de status). O componente continua exportado em `components/dashboard-charts*.tsx`, agora sem consumidor — candidato a remoção junto com o `StatsGrid` morto. |
| 6 | Pico tipográfico único | `text-4xl` só existe no hero (`components/inventory-security-hero.tsx`); nenhum outro em `app/` ou `components/`. |
| 7 | Esqueleto | `app/app/[clientSlug]/loading.tsx` reescrito na forma das duas faixas (3 KPI + painel, separador, hero, 2 KPI, 3 gráficos, atividade + tabela). |
| 8 | "Frota" → "parque" | Arquivos: `components/fleet-security-hero.tsx` → `components/inventory-security-hero.tsx`, `lib/dashboard/fleet-overview.ts` → `lib/dashboard/inventory-overview.ts`, `tests/fleet-security-hero.test.tsx` → `tests/inventory-security-hero.test.tsx` (`git mv`). Identificadores: `FleetSecurityHero` → `InventorySecurityHero`, `buildFleetSecurityIndicators` → `buildSecurityIndicators`, `FleetSecurityIndicator(Key)` → `SecurityIndicator(Key)`, `FleetComplianceTone` → `ComplianceTone`, `getFleetComplianceTone` → `getComplianceTone`, `FLEET_COMPLIANCE_TONE_THRESHOLDS` → `COMPLIANCE_TONE_THRESHOLDS`, `getFleetStatus` → `getInventoryStatus` (sidebar), id `fleet-security-hero-title` → `inventory-security-hero-title`. Textos com concordância ajustada: "Postura de segurança do parque", pílula do rodapé "Parque ativo", "soma do parque" no PDF, aviso de webhooks em `/settings` ("cujo parque inteiro fica mudo"). `grep -rniE "fleet|frota" app components lib` → vazio. |

Regras mantidas: todo número continua vindo de `getDeviceReportRows` / `buildDeviceReportSummary`
(e `countCriticalDiskDevices` para o disco crítico, como antes); todo KPI navega para a mesma listagem
de antes; o estado vazio (`totalDevices === 0`) não mudou.

### Testes

Novo: `tests/tenant-overview-two-bands.test.tsx` (5 casos) — renderiza a página com máquinas e trava
a ordem faixa de ação → "Retrato do parque" → retrato, 3 KPIs no grid de 3 e 2 no grid de 2 (nada de
`lg:grid-cols-4`/`xl:grid-cols-5`), o separador `border-t` + `h2.section-label`, os 5 `href` dos KPIs, e
a ausência de `text-4xl` fora do hero e de "frota" no HTML.

Execução (só os arquivos tocados):

```
npx vitest run tests/tenant-visual-standard.test.ts tests/tenant-overview-two-bands.test.tsx \
  tests/admin-and-tenant-pages-h1.test.tsx tests/inventory-security-hero.test.tsx \
  tests/critical-devices-panel.test.tsx tests/tenant-recent-devices-table.test.tsx \
  tests/device-report-rn013.test.ts tests/device-report-sprint13.test.ts \
  tests/sidebar-drawer-a11y.test.tsx tests/availability-alerts.test.ts

 Test Files  10 passed (10)
      Tests  161 passed (161)
```

`npx tsc --noEmit` limpo; `eslint` nos arquivos de aplicação alterados com 0 erros e 0 avisos.

### Fora de escopo (não feito)

- Docs fora de `app/`, `components/` e `lib/` (ex.: `CONTEXT.md`, `.agents/skills/inventario-ui/SKILL.md`)
  ainda citam "frota"/`fleet-security-hero` — não estavam no critério do grep.
- Remoção do `StatusChart` agora sem uso e do `StatsGrid` (§5 do projeto): pede OK explícito.
- Validação visual no navegador (visual-qa) em 1440/1024/390 px.

---

## Sprint V19 — Blocos de dado da Visão Geral

**Status**: ✅ Implementada em 2026-10-21 sobre `7fd396d`. Contexto: `docs/PROJETO-PADRONIZACAO-VISUAL.md`
§3 e prompt da Sprint 19. Depende da Sprint V18. Por determinação do usuário, **a suíte inteira não foi
rodada neste contexto** — só os testes dos arquivos tocados (abaixo). Suíte completa e `build` ficam com
o orquestrador. Nenhuma consulta nova ao banco; nenhum arquivo proibido tocado (`app/admin/clients/**`,
`app/users/page.tsx`, `prisma/schema.prisma`).

### Entregas

| # | Entrega | Resultado |
|---|---|---|
| 1 | Legenda do donut com altura previsível | `components/dashboard-charts.tsx`: `splitLegendItems` mostra no máximo `OS_LEGEND_MAX_ITEMS` (4) SOs e agrupa o resto numa linha **"+ N outros"** com a soma de máquinas e o %. Com até 5 itens não agrupa (trocar 1 item por "+ 1 outro" não economiza espaço). Espaçamento `space-y-3` → `space-y-1.5`: 5 linhas cabem nos 180px do donut, então a altura do card não depende do parque. As fatias agrupadas usam a cor do marcador "outros" (`var(--muted-foreground)`) e continuam clicáveis no donut (filtro `?os=` por SO); a linha "outros" não navega, porque "outros" não é um valor de filtro. Nomes longos com `truncate` + `title`. |
| 2 | `StatusChart` removido | Componente morto desde a V18 apagado de `dashboard-charts.tsx` e de `dashboard-charts-lazy.tsx`. `grep -rn StatusChart app components lib tests` → só o teste que trava a ausência. |
| 3 | Hero — mesma escala | `components/inventory-security-hero.tsx`: "Sem dado" passa de `text-3xl` para `text-4xl` (a mesma do percentual), então os três medidores ficam na mesma horizontal. |
| 4 | Hero — rodapé reservado | Base de cálculo + nota agora dentro de `div[data-slot=indicator-footer]` com `min-h-[3.25rem]` nas três colunas; o firewall (sem nota) não termina antes das outras. |
| 5 | Cabeçalhos pela casca `Panel` | `PanelHeader` ganha `titleId` (id do `<h2>`, para `aria-labelledby`). Hero, painel de críticos e os dois blocos da atividade recente montam o cabeçalho **pelas props** `title`/`description`/`action`, sem markup próprio — mesmo recuo e mesma escala de título nos três. |
| 6 | Sem borda dentro de borda | Badge de contagem do painel de críticos perde a `border` (fica só o fundo tonal). Listas de críticos, descobertas e auditoria seguem `divide-y` com linhas limpas; a linha de crítico passa de `py-3.5` para `py-3`, o mesmo respiro da atividade recente ao lado. |

### Testes

Novo: `tests/overview-data-blocks.test.tsx` (10 casos) — `splitLegendItems` (agrupa acima do limite e
soma; não agrupa com max + 1), render do donut com 7 SOs (4 linhas clicáveis + "+ 3 outros" com 12
máquinas), ausência de `StatusChart` no módulo; "Sem dado" e percentual em `text-4xl` (critério de aceite
do projeto); três rodapés com a mesma classe `min-h-*`; região do hero nomeada pelo título; títulos dos
dois painéis no mesmo `PanelHeader` (`pt-5 pb-4`); nenhuma `border` dentro das listas `divide-y`; linhas
com o mesmo `py-3`; badge sem borda.

Execução (só os arquivos tocados e os que renderizam a Visão Geral):

```
npx vitest run tests/overview-data-blocks.test.tsx tests/inventory-security-hero.test.tsx \
  tests/critical-devices-panel.test.tsx tests/recent-activity-panel.test.tsx \
  tests/tenant-overview-two-bands.test.tsx tests/admin-and-tenant-pages-h1.test.tsx \
  tests/tenant-visual-standard.test.ts

 Test Files  7 passed (7)
      Tests  124 passed (124)
```

`npx tsc --noEmit` limpo; `eslint` nos arquivos de aplicação alterados com 0 erros e 0 avisos.

### Fora de escopo (não feito)

- `StatsGrid` morto (§5 do projeto) — não é da Visão Geral; segue pendente de OK.
- Validação visual no navegador (visual-qa) em 1440/1024/390 px.
- Suíte completa e `next build` (orquestrador).

---

## Sprint V20 — Telas remanescentes sob a régua (/reports, /alerts, /settings, /audit)

**Status**: ✅ Implementada em 2026-10-21. Contexto: `docs/PROJETO-PADRONIZACAO-VISUAL.md` §3 e prompt da Sprint 20. Depende das Sprints V16 a V19. Validado com testes focados dos arquivos afetados (96 testes passando). Suíte completa e `build` ficam com o orquestrador. Nenhuma consulta nova ao banco; nenhum arquivo proibido tocado (`app/admin/clients/**`, `app/users/page.tsx`, `prisma/schema.prisma`).

### Entregas

| # | Entrega | Resultado |
|---|---|---|
| 1 | Migração para a casca Panel em `/reports`, `/alerts` e `/settings` | Containers legados com `rounded-lg` (8px), `p-6` e `h2 text-lg` migrados para o componente `Panel` (`components/ui/panel.tsx`) com `rounded-xl` (12px), `px-5` e `text-base font-semibold`. |
| 2 | Padronização de `/reports` | Títulos dos blocos unificados com a casca `Panel`, barras de progresso com semântica padronizada e bloco "Últimas coletas" sem cartões aninhados dentro de card, com linhas limpas em `divide-y` e classe `.data-mono` nos hostnames. |
| 3 | Correção em `/audit` | Removido `shadow-sm` sob borda de 1px na barra de filtros, em conformidade com o `DESIGN.md`. |
| 4 | Unificação de `.section-label` | Rótulos de seção/card artesanais unificados para a classe utilitária oficial `.section-label`. |

### Testes

Execução (só os arquivos tocados):

```
npx vitest run tests/tenant-visual-standard.test.ts tests/alert-rules-panel.test.tsx \
  tests/tenant-alert-settings-form.test.tsx tests/webhook-endpoints.test.ts

 Test Files  4 passed (4)
      Tests  96 passed (96)
```

`npx tsc --noEmit` limpo; `eslint` nos arquivos alterados com 0 erros e 0 avisos.

---

## Sprint V21 — Conta e menu de usuário

**Status**: ✅ Implementada em 2026-10-21. Contexto: `docs/PROJETO-PADRONIZACAO-VISUAL.md` §7 e prompt da Sprint 21. Depende das Sprints V16 a V20. Nenhuma alteração de schema/migration (usa `User.name`, `email`, `passwordHash`); nenhum arquivo proibido tocado (`app/admin/clients/**`, `app/users/page.tsx`, `prisma/schema.prisma`).

### Entregas

| # | Entrega | Resultado |
|---|---|---|
| 1 | Server actions `app/account/actions.ts` | `updateProfileNameAction`, `updateEmailAction`, `changePasswordAction`. Zod estrito (nome 2–80 com regex de caracteres, e-mail normalizado em minúsculas e ≤254, senha 8–72 com letra e número, confirmação e "diferente da atual"). O `user.id` vem só de `auth()` e o usuário é relido do banco (precisa estar ativo); nenhum schema aceita id no payload (RNF004). Senha conferida e gerada com `bcryptjs` (custo 10, mesmo de `lib/auth-credentials.ts` e do signup). |
| 2 | Alteração de e-mail | Exige senha atual; recusa e-mail já usado (checagem prévia + `P2002` do UNIQUE para corrida); reemite a sessão via `unstable_update`. |
| 3 | Auditoria (RNF009) | `account.name_update` (nome anterior/novo), `account.email_update` (`previousEmail`/`newEmail`), `account.password_change` (só o e-mail, nunca senha ou hash). |
| 4 | Reemissão do JWT (`auth.ts`) | Callback `jwt` em runtime Node: no `trigger: 'update'` relê nome/e-mail do banco pelo `sub` e **ignora o payload**, já que `POST /api/auth/session` também dispara update a partir do browser. `auth.config.ts` (proxy) intocado. |
| 5 | `components/account-dialog.tsx` | Dialog acessível com abas "Perfil" (nome; e-mail + senha atual) e "Segurança" (senha atual, nova, confirmação). Mensagens em `role="alert"`/`status`; `router.refresh()` após sucesso de nome/e-mail. |
| 6 | Menu de usuário (`components/sidebar.tsx`) | `ProfileMenu` do header e menu do rodapé da sidebar (telas sem tenant/mobile) ganham "Minha conta", "Alterar senha" (abre direto na aba Segurança), "Preferências" (atalho para `/app/<slug>/settings`, só com tenant) e separador antes de "Sair da conta". O dialog é montado fora do `DropdownMenuContent` para não desmontar junto com o menu. |

### Decisões e pendências

- Troca de senha **não** invalida outras sessões: sem `tokenVersion`/`passwordChangedAt` no `User`, invalidar exigiria mudança de schema, proibida nesta sprint. Fica para o Backlog.
- Troca de e-mail usa senha atual (mínimo do §7), não confirmação por e-mail — o projeto não tem infraestrutura de envio.
- As actions não têm rate limit próprio; exigem sessão válida, o que já limita a superfície de força bruta da senha atual.

### Testes

```
npx vitest run tests/account-actions.test.ts tests/sidebar-drawer-a11y.test.tsx

 Test Files  2 passed (2)
      Tests  20 passed (20)
```

Também passaram os 5 arquivos que importam o shell (`components/sidebar`): 54 testes. `tests/account-actions.test.ts` (novo, 10 testes) cobre RNF004 (payload com `id`/`userId` de outra conta é ignorado), sessão ausente, usuário inativo, senha atual errada, e-mail duplicado/inválido, normalização, hash bcrypt, auditoria sem segredo e reemissão da sessão. `tests/sidebar-drawer-a11y.test.tsx` passou a mockar `@/app/account/actions` (next-auth fora do runtime do Next). `npx tsc --noEmit` limpo; `eslint` nos arquivos alterados com 0 erros e 0 avisos. Suíte completa e `build` ficam com o orquestrador.

---

## Sprint V22 — Tema claro (Claro / Escuro / Sistema)

**Status:** implementada. Depende de V16 e V21.

**Entregas**
- `app/globals.css`: `:root` agora é o tema **claro**, autorado token a token (superfícies, linhas
  translúcidas, tons semânticos, séries de gráfico, sidebar, nova `--surface-shadow`). `.dark`
  (e `:root.dark`) guarda a paleta escura da Fase 1 **sem alteração de valor**. `:root` vem antes
  de `.dark` (mesma especificidade — a ordem decide). `color-scheme: light`/`dark` por tema.
- Variante `dark:` mantida **inerte** de propósito: os ajustes `dark:` dos componentes shadcn
  nunca aplicaram (não existia `.dark` no `<html>`); ligá-la agora mudaria o escuro aprovado.
  Diferença entre temas entra só por token.
- `app/layout.tsx`: `ThemeProvider` (attribute="class", defaultTheme="dark", enableSystem,
  disableTransitionOnChange) + `suppressHydrationWarning` no `<html>`. O script do next-themes
  aplica a classe antes da primeira pintura — sem flash; escolha persiste em `localStorage.theme`.
- `components/sidebar.tsx`: submenu **Aparência** em `AccountMenuItems` (usado pelo ProfileMenu do
  header e pelo menu do rodapé da sidebar) com rádio Tema claro / Tema escuro / Usar do sistema.
- Cor literal eliminada de componentes: `hsl(var(--sidebar-*))` quebrado (token é OKLCH) em
  `ui/sidebar.tsx`; `text-white` → `text-destructive-foreground` (button, badge);
  `bg-white` → `bg-background` (slider); `rgb(0 0 0 / .75)` do hover → `--surface-shadow`.
- Gráficos/esqueletos: Recharts já recebiam `var(--card|--border|--muted-foreground|--chart-n)`
  e o Skeleton usa `bg-muted` — passam a seguir o tema sem mudança de código.

**Contraste medido — tema claro (WCAG 2.1, texto ≥ 4.5:1; objeto gráfico ≥ 3:1)**

| Par | Razão |
|---|---|
| foreground / background | 17.00 |
| card-foreground / card | 17.74 |
| muted-foreground / card | 6.00 |
| muted-foreground / background | 5.74 |
| muted-foreground / muted (= secondary) | 5.26 |
| muted-foreground / accent | 5.20 |
| muted-foreground / sidebar | 5.50 |
| secondary-foreground / secondary | 11.14 |
| primary / card · primary-foreground / primary | 5.81 · 5.81 |
| success / card · branco / success | ≥ 5.5 |
| warning / card · branco / warning | ≥ 5.5 |
| info / card · branco / info | ≥ 5.3 |
| destructive / card · branco / destructive-solid | 6.48 · 6.48 |
| tom a 12% sobre card (success / warning / info / primary) | 4.90 / 5.21 / 4.82 / 4.88 |
| destructive sobre destructive/20 | 4.59 |
| sidebar-accent-foreground / sidebar-accent | 14.44 |
| chart-1…5 / card | 3.79 / 3.33 / 3.50 / 4.36 / 4.67 |
| input (aresta de campo) / card | ≥ 3.0 |

Par mais apertado de texto: destructive sobre `bg-destructive/20` (4.59:1). O escuro segue com o
piso de 5.00:1 já medido na Fase 1.

**Testes** — `tests/theme-v22.test.tsx` (34 casos): ordem `:root`→`.dark` e `color-scheme`;
paleta clara cobre todos os tokens do escuro; razões acima recalculadas a partir do CSS
(OKLCH→sRGB) e travadas ≥ 4.5 / ≥ 3; varredura sem hex/rgb/hsl literal em `app/` e `components/`
(fora das pastas proibidas); escolha persiste em localStorage e sobrevive a remontagem; padrão
escuro; opções do menu. Rodados só os arquivos tocados: `theme-v22` + `sidebar-drawer-a11y`
(44/44). `tsc --noEmit` limpo, eslint limpo nos arquivos tocados, `next build` ok. Suíte completa
**não** executada nesta sessão (ordem do usuário).

**Pendente para aceite:** auditoria `designer-ui` / `visual-qa` no tema claro (critério da
Sprint 22 no documento de padronização) — não rodada nesta sessão.

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

### 8. `proxy.ts#publicRoutes` não tem cobertura de teste — MÉDIO (achado da Sprint 14) — ✅ RESOLVIDO (Sprint V25, 2026-10-29)
**Origem**: `implementation-agent`, durante a verificação com servidor real da Sprint 14.

**Achado**: `/api/agent/discovery` foi implementada, typechecada, lintada, buildada e coberta por 16
testes verdes — e mesmo assim ficava **completamente inacessível ao agente**, porque não estava em
`proxy.ts#publicRoutes` e o proxy respondia `307 → /login` antes de a requisição alcançar o handler.
O bug só apareceu no primeiro `curl` real. A causa estrutural é que os testes de rota importam e
chamam `POST()` diretamente, o que **nunca passa pelo proxy** — nenhum teste da suíte hoje exercita
`proxy.ts`, então a lista pode ficar defasada a cada rota nova sem nada acusar.

**Correção aplicada na Sprint 14**: a rota entrou na lista, com comentário no `proxy.ts` avisando do
requisito. **Não corrigido**: a ausência de teste. Duas opções para uma sprint futura — (a) um teste
que importe `publicRoutes` e afirme que toda rota sob `app/api/agent/**/route.ts` encontrada por glob
está na lista (barato, pega exatamente esta classe de erro); (b) teste de integração HTTP contra um
servidor real, que é decisão de infraestrutura de teste bem maior. A opção (a) parece a proporcional,
mas é escopo novo — fora do que foi aprovado para a Sprint 14.

### 9. `components/ui/table.tsx` é código morto — BAIXO (achado do ajuste pós-Sprint 15) — ✅ RESOLVIDO (Sprint V25, 2026-10-29)
**Origem**: `implementation-agent`, durante a padronização visual das 10 tabelas (ajuste pós-Sprint
15). Levantado pelo orquestrador na auditoria prévia e reconfirmado contra o código atual:
`grep -rn "ui/table" app components lib tests` **não retorna nenhuma linha**.

**Achado**: o componente de tabela do shadcn (`Table`, `TableHeader`, `TableRow`, …) existe no
repositório mas **não é importado por nenhum arquivo**. Todas as 10 tabelas de listagem usam
`<table>`/`<thead>`/`<th>` nativos com os tokens de `lib/table-styles.ts`. O arquivo é, hoje, um
convite a que uma tabela futura seja escrita num padrão diferente do resto do sistema — exatamente
a inconsistência que o ajuste pós-Sprint 15 acabou de eliminar.

**Por que fica pendente**: é uma decisão de escopo (remover de vez, ou adotá-lo como base e migrar
as 10 tabelas para ele), não um bug — o código morto não afeta o bundle de produção, já que o
tree-shaking do Next não inclui módulo não importado. Não foi pedido no escopo aprovado, então
**não foi corrigido**. Candidato barato: `git rm components/ui/table.tsx` numa sprint futura de
débito técnico, junto com uma checagem de que nada mais em `components/ui/` está órfão.

---

### 10. Paginação server-side quando o volume justificar — MÉDIO (achado do Overhaul visual, Fase 3)

**Origem**: decisão arquitetural tomada na Fase 3 do overhaul (2026-09-08).

**Achado**: a paginação entregue é **client-side** — `lib/table-pagination.ts` recorta um array que o
Server Component já carregou inteiro. Resolve a tela (deixa de renderizar 142 linhas de uma vez),
mas **não é ganho de escala**: `prisma.*.findMany` continua sem `skip`/`take` e o payload inteiro
continua trafegando até o navegador.

**Por que ficou assim**: server-side exigiria mover busca e filtros para a URL e para queries
Prisma, o que (a) quebraria os cards de KPI da Sprint 15, que contam sobre o conjunto inteiro e têm
invariantes de soma testadas — passariam a precisar de queries de contagem próprias; e (b) mexeria
em query escopada por tenant, risco de RBAC injustificável numa fase de apresentação.

**Quando encarar**: quando um tenant real tiver volume que torne o payload um problema medido, não
antes. O trabalho é próprio, com teste próprio, e precisa preservar as invariantes de soma dos cards.

---

### 11. `criticalFilter` de `/computers` não sobrevive a recarregar — BAIXO (achado do Overhaul visual, Fase 3) — ✅ RESOLVIDO (Sprint V25, 2026-10-29)
**Achado**: os cards "Pouco Disco" / "Pouca RAM" / "Coleta Atrasada" de `/computers` resetam a
página corretamente ao filtrar, mas **não têm parâmetro de URL**. Recarregar perde o filtro, enquanto
`?search=`, `?status=`, `?tipo=`, `?faixa=` e `?fabricante=` sobrevivem.

**Por que fica pendente**: o escopo verbatim da Fase 3 nomeava `page/limit/search/status`; criar um
parâmetro novo era escopo além do aprovado. Correção é pequena e localizada em
`components/tenant-computers-table.tsx` (adicionar a chave ao `syncUrl` que já existe lá) mais a
leitura em `computers/page.tsx`.

---

### 12. `/audit` não sinaliza o teto de 200 registros — BAIXO (achado do Overhaul visual, Fase 3) — ✅ RESOLVIDO (Sprint V25, 2026-10-29)
**Achado**: `app/app/[clientSlug]/audit/page.tsx` busca `listAuditLogs({ limit: 200 })`. O rodapé de
paginação agora recorta esses até-200, mas nada diz ao usuário quando o teto foi atingido — quem vê
"Exibindo 176–200 de 200 registros" não sabe se são todos ou se há mais atrás.

**Por que fica pendente**: exibir a nota exigiria ou duplicar a constante `200` (hoje só na page)
dentro do componente, ou passar uma prop que não vem de `searchParams` — ambos fora da fronteira de
arquivos da fase. A query ficou intacta, como instruído.

---

### 13. Busca de dispositivos na paleta de comando — BAIXO (achado do Overhaul visual, Fase 2)

**Achado**: o `Ctrl/⌘+K` busca **apenas rotas** do tenant. Buscar dispositivo, software ou usuário
por nome — que é o que um operador espera de uma paleta de comando — não foi implementado.

**Por que fica pendente**: não é trabalho de UI. Exige rota de API própria com escopo por tenant,
paginação e rate limit (o mesmo tratamento que `/api/agent/*` recebeu), além de decidir o que um
`ORG_OPERATOR` pode encontrar por busca. É sprint própria, com auditoria de segurança própria.

---

### 14. `createClientAction` não limita o slug a 64 caracteres — BAIXO (achado da Sprint A1a)

**Achado**: o schema de `app/admin/clients/actions.ts` (linha 19) aceita slug sem `.max(64)`, e o
slug derivado do nome (`slugifyClientName`, linha 133) também não é cortado. Um nome com mais de 64
caracteres grava o cliente e só depois `buildProvisioningArtifacts` lança erro pela allowlist da
A1a; o usuário vê "Erro interno ao criar cliente." com o cliente já criado.

**Por que fica pendente**: `app/admin/clients/**` estava fora dos arquivos liberados da A1a. Nenhum
slug real é afetado (zero violações no banco na Sprint A0). Correção: `.max(64)` no schema da action
e corte no slug derivado, com teste.

---

### 15. `installCommand` ainda expande `%VAR%` do cmd.exe no `serverUrl` — BAIXO (achado da Sprint A1a) — ✅ RESOLVIDO (Sprint V25, 2026-10-29)
**Achado**: `lib/provisioning.ts:128` monta o comando cmd.exe com `-server "${normalizedServerUrl}"`.
A validação da A1a bloqueia aspas, backtick, `$` e caracteres de controle, mas não `%`; um
`serverUrl` com `%NOME%` seria expandido pelo cmd.exe.

**Por que fica pendente**: não estava na lista do plano, e `%` aparece em URL legítima com
percent-encoding. O `serverUrl` vem da configuração do servidor ou do proxy, não de entrada pública.
Correção: rejeitar `%` no `serverUrl` usado pelo `installCommand`, ou escapá-lo como `%%`.

---

### 16. Drawer da `Sidebar` abaixo de `lg` fica no Tab fechado e não fecha com Esc — MÉDIO (achado 3 do visual-qa na Sprint A1; para a Sprint A2)

**Achado**: em 390 px, com o drawer fechado (`aside` com `-translate-x-full`,
`components/sidebar.tsx:363-367`), o Tab passa por três paradas fora da tela ("Fechar menu",
"Clientes", menu do usuário) antes de chegar ao conteúdo. Com o drawer aberto, Esc não o fecha.
Observado no navegador em `/admin/clients`; em `/app/**` é inferido (mesmo componente).

**Por que fica pendente**: é a casca compartilhada do produto inteiro, fora do fluxo "Gerar agente"
da A1. Correção proposta: `inert` (ou `invisible` + `aria-hidden`) no `aside` quando
`!mobileOpen` abaixo de `lg`, e handler de Esc que fecha e devolve o foco a "Abrir menu".

→ Movido para a Sprint A2 (item 12 do Escopo).

---

### 17. Nome do usuário cortado no rodapé da `Sidebar` sem `title` — BAIXO (achado 4 do visual-qa na Sprint A1; para a Sprint A2)

**Achado**: `components/sidebar.tsx:447`, `p.truncate` com "Admin Core TI Expert" mede
`scrollWidth` 143 > `clientWidth` 135 e não tem `title`; aparece "Admin Core TI Ex…" em todas as
larguras.

**Por que fica pendente**: mesma casca compartilhada do item 16. Correção: `title={user.name}`, como
a linha 415 já faz com `title={tenant.name}`.

→ Movido para a Sprint A2 (item 13 do Escopo).

---

### 18. Portal exibe dispositivos de `AgentAuth` revogado — BAIXO (achado do planejamento da Sprint A3) — ✅ RESOLVIDO (Sprint V25, 2026-10-29)
**Achado**: `app/portal/page.tsx:36` (`where: { clientId: context.clientId }`) e
`lib/portal-context.ts:68` (`where: { id: deviceId, clientId }`) filtram só por `clientId`. As telas
do tenant usam `getTenantDeviceWhere` (`lib/tenant-scope.ts:3-13`), que exige
`agentAuth.isActive` e `client.isActive`. Depois que a A3 der revogação pela UI, a máquina revogada
some de `/app/[slug]/*` e continua listada e acessível por id no `/portal` do `CLIENT_VIEWER`.

**Por que fica pendente**: decisão do usuário, ao aprovar a A3, de manter no Backlog. Não é
vazamento entre tenants (o filtro por `clientId` vem da sessão); é inconsistência de exibição dentro
do próprio cliente. Correção: usar o mesmo critério de `getTenantDeviceWhere` (por `clientId`) nas
duas consultas do portal, com teste.

---

### 19. Sprint A4 — Instalador Linux na UI + hash do executável (F4 + N6) — registro

**Achado** (fatos conferidos em 2026-10-15, depois de `e261dd1`):
- Só `public/inventario-agent.exe` é publicado. `scripts/build-agent.mjs` compila o alvo `linux`
  (`:47`), mas só copia para `public/` o `.exe` (`:39-40`).
- `app/api/agent/download-exe/route.ts` só serve o `.exe`.
- Não existe comando de instalação Linux no código (`lib/provisioning.ts` não tem nenhum). Um comando
  Linux montado pela UI com `serverUrl`, `slug` e chave entre aspas de shell é a mesma classe de
  injeção fechada na A1a para o PowerShell, e precisaria da mesma allowlist e escape.
- Não há verificação de hash do binário baixado pelo instalador (N6). O SHA-256 existe só no
  auto-update (RF024).
- `scripts/agent/install-linux-agent.sh` é o modelo antigo (timer + oneshot, check-in horário).
  `agent-go/internal/platform/windows/service/service_linux.go:3-7` registra que o serviço Linux
  atual é systemd `Type=simple` persistente, "não o modelo antigo" desse script, que nunca teve
  métricas nem fila de comandos.
- Nenhum RF promete instalação Linux pelo painel (RF025 trata da coleta). A A4 exige RF novo.

**Por que fica pendente**: decisão do usuário de tirar F4 e N6 da A3. A A4 precisa de RF novo,
de decisão sobre publicar o binário Linux em `public/`, de um instalador que crie o serviço systemd
atual (não o script antigo) e de auditoria de segurança do comando gerado.

→ Planejada como Sprint A4.

---

### 20. Affordance de interação global (`cursor: pointer`) e descoberta da gestão de agentes (`/admin/clients/[id]/agents`) — ALTO (Feedback do Usuário em 2026-10-15)

**Origem**: teste manual do usuário na tela de clientes e na rota `/admin/clients/[id]/agents`.

**Achados do Usuário**:
1. *Descoberta da rota*: na tabela de clientes, o link para a nova tela de agentes estava escondido exclusivamente no número cru da coluna "Agentes" (`0` / `1`). Ninguém esperava que um dígito estático fosse um gatilho de navegação.
2. *Affordance de cursor*: botões, controles e itens interativos em diversos pontos da aplicação mantinham o cursor de seta padrão do sistema operacional (`cursor: default` herdado do reset do Tailwind CSS v4), sem transmitir feedback tátil ou sensação de elemento clicável ao passar o mouse ("no site fica somente a seta").

**Ações realizadas / Resolução**:
- **Descoberta**:
  - Adicionado botão de ação explícito `<Button asChild size="sm" variant="outline">` com rótulo **Agentes** e ícone `Bot` em cada linha da tabela de clientes, entre "Abrir painel" e "Ver credenciais".
  - A coluna "Agentes" foi transformada em um badge interativo estruturado (`[ 🤖 N ]`) com borda suave, fundo em `--secondary`, efeito hover em `--primary` e `cursor-pointer`.
- **Affordance global de cursor**:
  - Adicionada regra global em `app/globals.css` restaurando `cursor: pointer` para `button:not(:disabled)`, `[role="button"]:not([aria-disabled="true"]):not([disabled])`, `[type="button"]`, `[type="submit"]`, `[type="reset"]`, `a[href]`, `select`, `input[type="checkbox"]`, `input[type="radio"]`, `label[for]` e `summary`.
  - Incluído `cursor-pointer` explícito em `buttonVariants` (`components/ui/button.tsx`) e no `CheckboxPrimitive.Root` (`components/ui/checkbox.tsx`).
- **Testes**: suíte atualizada em `tests/clients-panel-agents.test.tsx` com novo teste para o botão de ação e preservação de todos os 970 testes verdes.

---

### 21. Desinstalação Remota de Agente via Painel (Self-Uninstall Command via RMM) — MÉDIO/ALTO (Sugestão de Produto, 2026-10-15)

**Origem**: sugestão do usuário inspirada no modelo do Bitdefender / EDR corporativo.

**Contexto**:
- Hoje (Sprint A3), a revogação de um agente em `/admin/clients/[id]/agents` desativa o registro no banco (`AgentAuth.isActive = false`), cancela comandos pendentes e ignora a máquina nos alertas.
- No entanto, o serviço binário do agente Go continua ativo e rodando no endpoint, recebendo HTTP 403 a cada ciclo de check-in, até que um técnico acesse fisicamente a máquina ou execute desinstalação manual via script/GPO.

**Proposta / Avaliação**:
- **Mecanismo**: Adicionar comando reservado `AGENT_UNINSTALL` na fila assíncrona de comandos (`CommandQueue` / `agent_command`).
- **Fluxo**:
  1. No painel, o administrador clica em *"Revogar e Desinstalar"* (ou *"Desinstalar remotamente"*).
  2. Um diálogo de confirmação de alto atrito explica que a desinstalação do serviço na máquina remota será disparada no próximo check-in.
  3. O agente recebe o comando no ciclo de polling de 90s, executa a rotina nativa de auto-remoção:
     - Windows: agenda a parada do serviço (`sc stop InventarioAgent`), remoção do registro do serviço (`sc delete InventarioAgent`), limpeza de chaves DPAPI e arquivos de configuração, e spawn de processo auxiliar assíncrono para exclusão do binário após o término do processo.
     - Linux: executa `systemctl disable --now inventario-agent`, remove o arquivo de unit `/etc/systemd/system/inventario-agent.service` e os dados em `/opt/inventario-agent`.
  4. O agente reporta ACK de sucesso antes da finalização do processo.
  5. O servidor registra `AuditLog` (`agent_auth.remote_uninstall`) e revoga atomicamente o `AgentAuth`.
- **Veredito**: **Excelente recurso**. Reduz drasticamente o custo operacional de suporte técnico e evita agentes "fantasmas" rodando indefinidamente em máquinas desativadas.

---

### 22. Agente de Rede / Sonda Local (Network Discovery, SNMP e Relay Local) — ALTO (Sugestão de Produto, 2026-10-15)

**Origem**: avaliação solicitada pelo usuário sobre promover agentes a "agentes de rede" para gerenciamento amplo da infraestrutura local.

**Avaliação Arquitetural (Prós e Contras)**:
- **Papéis de um Agente de Rede**:
  1. *Descoberta de Ativos não-gerenciáveis (Network Discovery & SNMP)*:
     - Na maioria das empresas clientes existem impressoras de rede, switches gerenciáveis, roteadores/firewalls, storages NAS, access points Wi-Fi, câmeras IP e dispositivos IoT que **não suportam** a instalação de um agente Windows/Linux.
     - Um agente instalado em um servidor ou máquina ligada permanentemente pode ser configurado como **Sonda de Rede (Network Probe)**. Ele executa varreduras passivas (escuta ARP, mDNS, DHCP) e ativas (ICMP ping sweep, SNMP v2c/v3, banner grabbing) na sub-rede local e envia ao painel o inventário de ativos de rede.
  2. *Proxy / Gateway Relay para Ambientes Restritos (Air-gapped / VLANs sem Internet)*:
     - Em redes corporativas com políticas rígidas de segurança ou DMZs, máquinas locais não possuem acesso direto à internet para alcançar o servidor nuvem.
     - O Agente de Rede atua como um relay/proxy local: escuta em uma porta interna e retransmite o tráfego de métricas e inventário para o servidor central com criptografia TLS mútua.
  3. *Cache Local e Distribuidor P2P de Atualizações*:
     - Em filiais com centenas de computadores e link de internet limitado, o Agente de Rede baixa atualizações de pacotes e binários apenas uma vez e distribui localmente via LAN, economizando banda WAN do cliente.
- **Veredito**: **Recurso de altíssimo valor de mercado (diferencial enterprise)**. Eleva o produto de "inventário de endpoints" para uma plataforma completa de **ITAM (IT Asset Management) e Observabilidade de Infraestrutura**.
- **Recomendações técnicas**:
  - Assegurar que a função de sonda seja estritamente **opt-in** por cliente e com sub-redes configuradas pelo administrador, para não disparar falsos positivos em firewalls/EDR locais.
  - Controle de taxa (throttling) para não sobrecarregar a CPU do host nem saturar a rede.

---

### 23. Matriz de Novas Oportunidades, Ferramentas e Funcionalidades Corporativas (Roadmap Estratégico)

**Origem**: levantamento de recursos de alto impacto para expansão do Inventário Enterprise.

1. **Gestão de Vulnerabilidades de Software (CVE Vulnerability Scanner)**:
   - Cruzar a lista de softwares e versões já coletados pelo agente com a base pública da NVD/NIST de vulnerabilidades conhecidas (CVEs). Exibir painel com alertas de softwares desatualizados com risco crítico (RCE, elevação de privilégio).
2. **Saúde de Hardware e Telemetria SMART (Predição de Falhas de Disco)**:
   - Coletar métricas SMART dos discos/SSDs (temperatura, horas ligado, setores realocados, % de desgaste de células SSD).
   - Gerar alertas preventivos antes da quebra física do disco: *"O SSD da máquina do Financeiro atingiu 95% de desgaste"*.
3. **Status do Windows Update e Conformidade de Segurança**:
   - Telemetria de atualizações do SO pendentes, data da última atualização instalada e identificação de máquinas vulneráveis por falta de KBs de segurança.
4. **Terminal Remoto Seguro / Ferramenta de Ações Rápidas (Live Command Shell / Quick Actions)**:
   - Aproveitar a fila de `agent_command` para criar ações pré-definidas no painel com 1 clique (ex: reiniciar spooler de impressão, limpar cache DNS, reiniciar máquina, forçar coleta de diagnóstico) com auditoria completa.
5. **Auditoria de Conexão de Dispositivos USB e Armazenamento em Massa**:
   - O agente já coleta periféricos USB; criar alertas em tempo real quando um dispositivo de armazenamento USB desconhecido for conectado a uma máquina corporativa (prevenção contra vazamento de dados e ransomware).
6. **Diagrama de Topologia de Rede Interativo**:
   - A partir das tabelas ARP, MACs e vizinhos de switches (LLDP/CDP coletados via SNMP pelo Agente de Rede), renderizar visualmente o mapa da infraestrutura de rede da empresa.
7. **Motor de Automação e Auto-Remediação (Self-Healing Rules)**:
   - Gatilhos automáticos baseados em métricas: *"Se o disco C: ultrapassar 90%, executar rotina de limpeza de arquivos temporários e logs antigos"*.

---

### 24. Auto-update do agente é só Windows — MÉDIO (achado do planejamento da Sprint A4)

**Origem**: orquestrador, durante o planejamento da Sprint A4 (2026-10-19), conferido pelo
`sprint-planner` contra o código depois de `2a4d138`.

**Achado**:
- `app/api/agent/checkin/route.ts:397-411` sempre responde
  `updateMetadata.url: ${serverUrl}/inventario-agent.exe` com `sha256: getAgentBinarySha256()` do
  `.exe`, sem considerar a plataforma do agente. O payload de check-in não informa a plataforma.
- `agent-go/internal/app/updater/updater.go` grava `inventario-agent.update.exe` no diretório
  temporário (`:19`) e troca o binário por um script PowerShell (`:62-85`) que para e reinicia o
  serviço Windows `InventarioAgent`.
- Hoje é inofensivo: `LATEST_AGENT_VERSION = "1.0.0"` (`route.ts:398`) e todos os agentes estão em
  1.0.0, então `updateAvailable` é falso. Na primeira versão nova, os agentes Linux vão baixar o
  `.exe` (o hash confere, porque é o hash do próprio `.exe`) e falhar na troca, pois não há
  `powershell` (`updater.go:80-85`). O agente segue na versão antiga e repete o download inteiro a
  cada check-in.

**Por que fica pendente**: a correção exige mudar o agente Go (reportar a plataforma no check-in e um
updater Linux que troque o binário e reinicie a unidade systemd) e a rota de check-in, os dois
proibidos na Sprint A4. Depois da A4, o binário Linux publicado e
`getAgentBinarySha256('linux')` já existem, então o lado do servidor fica pequeno: escolher URL e
hash pela plataforma reportada. Precisa acontecer **antes** de subir `LATEST_AGENT_VERSION`.

---

### 25. Gestão Corporativa de Conta e Empresa (Benchmark Bitdefender GravityZone / Kaspersky Security Center) — ALTO (Sugestão de Produto, 2026-10-21)

**Status**: ✅ Entregue na **Sprint V24** (2026-10-28) — ver seção "Sprint V24" no fim deste arquivo. Parte do benchmark (2FA/TOTP, lista de sessões com IP/dispositivo, políticas globais de segurança, white-label) continua pendente e exige schema.

**Origem**: crítica e visão estratégica do usuário sobre a insuficiência de um menu que só ofereça "nome, e-mail e senha". Plataformas líderes de segurança e monitoramento enterprise (Bitdefender GravityZone, Kaspersky Security Center, CrowdStrike Falcon) estruturam dados profundos de contato institucional, perfil operacional e governança corporativa.

**Estudo Comparativo de Recursos (Benchmark)**:

1. **Perfil do Usuário / Operador (Identidade & Operações)**:
   - *Identificação profissional*: Nome completo, Iniciais/Avatar, Cargo/Função (ex.: "Analista de Segurança Pleno", "Gerente de TI"), Departamento.
   - *Canais de acionamento imediato*: Telefone de contato direto, Celular/WhatsApp institucional para escalonamento de incidentes.
   - *Preferências de localização*: Fuso horário (`Timezone` — fundamental para alinhamento de timestamps de incidentes e gráficos de telemetria), formato de data/hora (24h/12h, DD/MM/AAAA) e idioma da interface.
   - *Postura de segurança individual*:
     - Autenticação de dois fatores (2FA/MFA via TOTP Google/Microsoft Authenticator).
     - Gerenciamento de sessões ativas (lista com IP de origem, dispositivo, navegador, última atividade e botão *"Desconectar outras sessões"*).
   - *Preferências de notificações*: Matriz de alertas pessoais (quais severidades receber por e-mail, resumo diário executivo).

2. **Perfil da Empresa / Tenant (Organização & Governança)**:
   - *Dados cadastrais institucionais*: Razão Social, Nome Fantasia, CNPJ/Tax ID, Endereço da sede e unidades.
   - *Pontos de contato de emergência (NOC / SOC / Plantão)*:
     - Responsável Técnico Principal (Nome, E-mail, Telefone 24/7).
     - Ponto de contato alternativo / Escalonamento para desastres.
     - E-mail corporativo consolidado para envio de relatórios e faturamento.
   - *Políticas globais de segurança (Security Policies)*:
     - Tempo limite de inatividade para encerramento automático de sessão (ex.: 15m, 30m, 1h).
     - Bloqueio por tentativas consecutivas de login incorreto.
     - Allowlist de endereços IP para acesso ao painel administrativo.
     - Retenção de histórico de telemetria e logs de auditoria (LGPD: 30, 90, 180, 365 dias).
   - *Identidade Visual & Relatórios (White-labeling)*:
     - Logotipo personalizado da empresa para aplicação automática em cabeçalhos de relatórios executivos em PDF gerados pelo sistema.

**Arquitetura e Implementação Sugerida**:
- **Banco de Dados (`prisma/schema.prisma`)**:
  - Extensão do modelo `User`: campos `phone`, `jobTitle`, `department`, `timezone`, `mfaSecret`, `mfaEnabled`.
  - Extensão do modelo `Client`: campos `legalName`, `taxId` (CNPJ), `phone`, `emergencyContactName`, `emergencyContactEmail`, `emergencyContactPhone`, `logoUrl`, `sessionTimeoutMinutes`.
- **Interface**:
  - Aba ou tela `/settings/organization` (Dados da Empresa, Contatos de Emergência, Políticas).
  - Diálogo enriquecido de "Minha Conta" com 4 abas estruturadas: **Perfil Profissional**, **Segurança & 2FA**, **Sessões Ativas** e **Preferências**.

---

## Sprint V23 — Redesign de Identidade Visual: Carbon/Obsidian Neutro, Seletor de Cor de Destaque (Accent Swatches) e Bento Grid Alinhado

**Status**: ✅ Implementada (2026-10-28) — fundo `.dark` neutro (croma <= 0.006), 6 variantes `data-accent` (laranja padrão) com boot script sem flash, swatches + botão de tema no rodapé da sidebar, `KpiCard`/`Panel` com `h-full` e ícone em badge, hero com brilho radial. Testes: `tests/accent-theme-v23.test.tsx` (novo), `tests/theme-v22.test.tsx`, `tests/kpi-card.test.tsx` e testes de sidebar/hero/visão geral — verdes; `tsc --noEmit` limpo.
**Origem**: Solicitação direta do usuário com 4 telas de referência de outro sistema construído pelo Claude Code ("Finanças"), substituindo o "tema azulado morto" atual por uma estética dark neutra (Carbon/Obsidian), vibrante, com seletor dinâmico de cor de destaque (Accent Color Swatches) e alinhamento rigoroso de cards (Bento Grid).

### 1. Diagnóstico do Problema Atual vs. Referência Enviada

1. **Fim do "Tema Azulado Morto" (Saturação fria em `globals.css`)**:
   - **Problema atual**: Todos os tokens de superfície escura do Inventário (`--background`, `--card`, `--popover`, `--sidebar`, `--surface-line`) possuem matiz azulado/ardósia (`hue ~250–265` em OKLCH com croma residual), deixando a tela inteira com aspecto frio, acinzentado-azulado e monótono. Além disso, a cor primária ciano/azul pálido se mistura ao fundo azulado, matando o contraste visual.
   - **Padrão da Referência ("Finanças")**:
     - **Fundo base (`--background`)**: Preto carbono quase puro e neutro (`#09090b` / `oklch(0.14 0.004 285)`), sem contaminação azulada.
     - **Superfície de Card (`--card`)**: Grafite escuro neutro (`#111114` / `oklch(0.175 0.005 285)`) com bordas finas e nítidas (`#1f1f24` / `oklch(0.24 0.006 285)`).
     - **Superfície interna / Sub-card (`--surface-raise`)**: Tom levemente elevado (`#16161a` / `oklch(0.20 0.006 285)`).

2. **Seletor Dinâmico de Cor de Destaque (Accent Color Swatches na Sidebar)**:
   - **Padrão da Referência**: No rodapé da sidebar (logo acima do botão de alternância de Tema Claro/Escuro), há uma fileira de **6 círculos cromáticos (swatches)** permitindo trocar instantaneamente a cor de destaque (`--primary` / `--ring` / halo do hero) do sistema inteiro:
     1. **Laranja / Âmbar Queimado (Default)**: `#f97316` / `oklch(0.70 0.19 45)` — traz calor, energia e destaque imediato sobre o fundo carbono neutro.
     2. **Azul Royal Vibrante**: `#3b82f6` / `oklch(0.62 0.21 255)`
     3. **Esmeralda / Verde**: `#10b981` / `oklch(0.69 0.17 162)`
     4. **Rosa / Magenta**: `#ec4899` / `oklch(0.65 0.24 350)`
     5. **Violeta / Roxo**: `#8b5cf6` / `oklch(0.61 0.24 292)`
     6. **Neutro / Prata Monocromático**: `#a1a1aa` / `oklch(0.71 0.01 285)`
   - **Mecanismo**: Atributo `data-accent="orange|blue|emerald|pink|violet|mono"` no `<html>` (persistido em `localStorage`) recalibrando `--primary`, `--primary-foreground`, `--ring` e o gradiente sutil do Hero e do item ativo da Sidebar.

3. **Anatomia e Alinhamento de Cards (Bento Grid & Hero Split)**:
   - **Hero com Gradiente Radial Sutil**: Brilho radial suave na cor de destaque (`radial-gradient` em `--primary/12%`) no canto superior esquerdo do card principal.
   - **Cards Selecionáveis com Borda Viva e Halo (`Card Ativo`)**: Borda na cor de destaque (`border-primary`), brilho suave ao redor (`shadow-[0_0_24px_-8px_var(--primary)]`) e ícone em badge quadrado (`rounded-lg bg-primary/15 text-primary`) posicionado no canto superior direito do card.
   - **Cabeçalhos de Painel com Ícone em Badge + Botão de Ação à Direita**: Todos os painéis mantêm a mesma altura (`h-full flex flex-col`) na mesma fileira de grid, mesmo quando em estado vazio.

### 2. Entregas Planejadas para a Sprint V23

1. **Nova Paleta Base Carbon/Obsidian (`app/globals.css`)**:
   - Substituir os tons azulados mortos de `.dark` por neutros puros de carbono/obsidiana (`chroma <= 0.006`).
   - Definir os 6 temas de cor de destaque (`data-accent="orange" | "blue" | "emerald" | "pink" | "violet" | "mono"`), com **`orange` (Âmbar/Laranja vibrante)** como padrão.
2. **Componente Seletor de Cor de Destaque (`AccentPicker` na Sidebar e Menu)**:
   - Adicionar no rodapé da `Sidebar` os 6 círculos de cor + botão direto de alternância de tema (`Tema claro` / `Tema escuro`), persistindo em `localStorage` sem flash de hidratação.
3. **Refinamento do `KpiCard` e `Panel` (`components/ui/kpi-card.tsx` e `components/ui/panel.tsx`)**:
   - Alinhar a anatomia do `KpiCard` e `Panel` com alturas simétricas (`h-full`), ícone em caixa quadrada no canto superior direito do KPI e suporte a ícone no cabeçalho do `Panel`.
4. **Hero da Visão Geral no Estilo Bento (`components/inventory-security-hero.tsx`)**:
   - Aplicar fundo com brilho sutil na cor de destaque (`radial-gradient`) e alinhar colunas.
5. **Testes Focados**:
   - Validar exclusivamente o teste de tema/accent e dos componentes `KpiCard`/`Panel`, sem rodar a suíte inteira de 1.300 testes.

---

## Sprint V24 — Menu de Conta Enterprise, Acessos Recentes e Dados da Empresa/NOC

**Status**: ✅ Implementada (2026-10-28). Origem: Item 25 do backlog.
**Restrição**: `prisma/schema.prisma` intocado. Metadados estendidos de perfil e do tenant são gravados com `recordAuditLog` e lidos do último registro (`prisma.auditLog.findFirst`) — o histórico de alterações vem de graça.

### Escopo entregue

1. **`app/account/actions.ts`**: `updateAccountProfileDetailsAction` (`account.profile_details_update` — cargo, departamento, telefone de plantão), `updateAccountPreferencesAction` (`account.preferences_update` — fuso, formato 24h/12h, 3 flags de notificação) e `getAccountOverviewAction` (hidrata perfil/preferências do último registro, revalidando com Zod e caindo nos defaults; últimos 8 eventos onde a conta é ator ou alvo). RNF004: id sempre de `auth()`.
2. **`components/account-dialog.tsx`**: 4 abas — Perfil (nome, cargo & contato, e-mail), Preferências (selects nativos de fuso/formato + checkboxes), Segurança (badge do papel + capacidades RBAC + alterar senha), Acessos (sessão atual com "Encerrar sessão" e atividade recente traduzida, data no fuso/formato escolhidos). Rótulos V21 preservados.
3. **`components/sidebar.tsx`**: menu de usuário com "Minha conta", "Preferências da conta", "Alterar senha", "Acessos e atividade" e "Configurações da empresa" (quando há tenant). `ROLE_LABELS` movido para `lib/permissions.ts` (compartilhado com o diálogo).
4. **`/app/[clientSlug]/settings`**: `updateTenantCompanyProfileAction` (`tenant.company_profile_update`, guard `canManageTenantAlerts`) + `getTenantCompanyProfile` (fallback de razão social = nome do tenant); `components/tenant-company-profile-form.tsx` em modo edição ou somente leitura; painel acima de Webhooks.

### Verificação

- `npx vitest run tests/account-actions.test.ts tests/account-enterprise-v24.test.tsx tests/theme-v22.test.tsx` — 3 arquivos, 63 testes verdes.
- `npm run typecheck` e `npm run lint` limpos.

### Fora de escopo / pendências

- 2FA/TOTP, lista de sessões com IP/dispositivo e "desconectar outras sessões" exigem persistência de sessão (schema).
- As preferências de notificação são registradas mas ainda não filtram nenhum envio de alerta.
- Políticas globais (timeout de sessão, allowlist de IP, retenção) e logotipo white-label.

---

## Sprints V25–V29 — Unificação visual Bento Grid

Todas as páginas passaram a usar os mesmos blocos de composição (`KpiCard`, `Panel`, `PanelHeader`, `StatusPill`), eliminando estilos ad hoc.

- **Tenant:** `/storage`, `/processors`, `/software`, `/peripherals`, `/alerts`, `/audit`, `/reports`, `/settings`, `/network`, `/assets/[id]`.
- **Portal:** `/portal`, `/portal/reports`, `/portal/devices/[id]`.
- **Admin:** `/admin/clients`, `/admin/clients/[id]/agents`, `/admin/clients/audit`, `/admin/users`.

---

## Sprints A5–A13 — Arquitetura Enterprise do Agente Go (`v1.1.0`)

| Sprint | Commit | Entrega |
|---|---|---|
| **A5** | `812a459` | Coleta passiva de `anydeskId` (`ad.anynet.id`), coluna `Device.anydeskId`, validação Zod e `<AnydeskBadge />` com cópia em 1 clique e deep link `anydesk:<id>`. |
| **A6** | `a7dad8c` | Instalação idempotente em `C:\Program Files\InventarioAgent\inventario-agent.exe` / `/usr/local/bin/inventario-agent` (removendo o trailer `<<INV_CONFIG>>`), auto-recovery no SCM, registro em `Add/Remove Programs`, resolução do usuário interativo (`Win32_ComputerSystem.UserName`) e Console Local PowerUser (`manage`, `status`, `stop`, `start`, `restart`, `unlink`, `purge`). |
| **A7** | `5613aea` | Auto-updater atômico com backup `.bak` e rollback automático em `ProgramData\InventarioAgent\updates`; busca por AnyDesk ID em `/computers`; KPIs + AnyDesk em `/servers` e `/portal`. |
| **A8** | `e89c4ef` | Versão unificada `1.1.0` (`internal/version`) reportada no check-in e nas métricas; comando remoto `update_agent` ("Atualizar agente agora") individual e em lote. |
| **A9 & A10** | `0d4e288` | Central de Documentação in-app (`/docs`, Master-Detail Bento Grid com blocos copiáveis), `docs/AGENT.md` e atualização do serviço local `InventarioAgent` para `v1.1.0`. |
| **A11** | `df24887` | Ações diretas de atualização individual e em massa em `/admin/clients/[id]/agents`, badges de versão (`Atualizado` / `v1.1.0 disponível`) e cobertura completa de `AUDIT_ACTION_LABEL`. |
| **A12** | `d214304` | Busca global por AnyDesk ID na paleta `Ctrl+K` (`GET /api/tenant/[clientSlug]/devices/search`) e coluna `AnyDesk ID` na exportação CSV. |
| **A13** | — | `EnqueueUpdateAgentButton` (comando `update_agent` em 1 clique) e badge de versão no cabeçalho de `/app/[clientSlug]/assets/[id]` (`info` se atual, `warning` com "vX disponível" se desatualizado; botão só aparece para quem opera e com agente desatualizado). Versão do agente também em `/computers`, `/servers` (tabela e cartões) e `/portal/devices/[id]`; `/computers` passa a buscar por versão. |
