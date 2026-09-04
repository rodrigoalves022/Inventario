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

### 8. `proxy.ts#publicRoutes` não tem cobertura de teste — MÉDIO (achado da Sprint 14)

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

### 9. `components/ui/table.tsx` é código morto — BAIXO (achado do ajuste pós-Sprint 15)

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
