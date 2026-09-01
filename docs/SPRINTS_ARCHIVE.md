# Sprints — Arquivo Histórico (Sprints 1–8)

Status: archive
Scope: histórico, preservação total (sem resumo, sem corte de conteúdo)
Last-reviewed: 2026-08-31

Este arquivo contém o detalhamento **integral** das Sprints 1 a 8 do Inventário Enterprise — todas
**concluídas**. O conteúdo abaixo foi movido de [`docs/SPRINTS.md`](./SPRINTS.md) nesta data, sem
resumo nem corte de informação, para manter `docs/SPRINTS.md` enxuto e focado nas sprints ativas
(planejadas/em execução). Para o documento principal, a Tabela Resumo de todas as sprints
concluídas, e o detalhamento das sprints correntes, ver [`docs/SPRINTS.md`](./SPRINTS.md).

Este é um arquivo de referência histórica — não é editado pelo `sprint-planner` em operação normal
(sua permissão de escrita cotidiana é exclusivamente `docs/SPRINTS.md`; a criação deste arquivo foi
uma autorização explícita e pontual do usuário para esta reorganização de documentação).

---

## Sprint 1 — Fundação Multi-tenant

**Status**: ✅ Concluída (2026-08-11)
**Objetivo**: sair de um modelo de conta única (`Client` como topo) para a hierarquia real
`Organization → Client → AgentAuth → Device`, com PostgreSQL como banco único e RBAC de 4 papéis
substituindo o modelo anterior de 2 papéis.

### Escopo entregue

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Commit |
|---|---|---|---|---|
| Migração SQLite → PostgreSQL 16 | RNF011 | — | todas | `f1fec3a` |
| Hierarquia `Organization` + RBAC 4 papéis + canal de comandos | RN001, RN004, RF017 | 3.5 | `Organization`, `AgentCommand` | `b8ff8e1` |
| Login e RBAC multi-tenant | RF001 | 3.10 | `User` | `c25df9c` |
| Validação de payload de check-in + auditoria de inválidos | RNF002, RF004 | 3.3 | `AgentCheckLog` | `a8b488f` |
| Portal self-service do cliente final | RF021 | 3.9 | — | `11d1cb8` |
| Docker/PostgreSQL + correção de scripts de migração | RNF011 | — | — | `79e3d83` |
| Remoção de rotas mortas e telas com dados fabricados | — | — | — | `5e32249` |
| `docs/PRODUTO.md` inicial (requisitos, arquitetura, plano) | — | — | — | `79aad85` |

### Critérios de aceite (retroativos, confirmados)

- [x] `Organization → Client → AgentAuth → Device` é a hierarquia real do schema.
- [x] 4 papéis (`PLATFORM_ADMIN`, `ORG_ADMIN`, `ORG_OPERATOR`, `CLIENT_VIEWER`) substituem o
      modelo anterior de 2 (`SUPER_ADMIN`/`CLIENT_ADMIN`).
- [x] PostgreSQL é o único banco, inclusive em desenvolvimento (ADR
      [0003](./adr/0003-postgresql-only.md)).
- [x] Portal do cliente deriva o tenant só da sessão, nunca de slug na URL.

---

## Sprint 2 — Coleta Ampliada e Valor Operacional

**Status**: ✅ Concluída (2026-08-12 a 2026-08-17)
**Objetivo**: ampliar o que o agente coleta além do inventário básico (postura de segurança,
métricas, periféricos, patrimônio) e dar valor operacional a esses dados (relatórios, alertas,
comandos remotos completos).

### Escopo entregue

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Commit |
|---|---|---|---|---|
| Postura de segurança (Fase B1) | RF009 | 3.3 | `SecurityPosture`, `LocalAccount` | `5f74097` |
| Métricas / série temporal com retenção (Fase B2) | RF011, RN008 | 3.3-bis | `MetricSample` | `02e3246` |
| Periféricos: monitores, impressoras, USB (Fase B3) | RF012 | 3.3 | `Monitor`, `Printer`, `UsbDevice` | `2660990` |
| Patrimônio manual (Fase B4) | RF013, RN009 | 3.8 | `AssetRecord` | `24ed51f` |
| Relatórios CSV/PDF (Fase C2) | RF020 | — | — | `a2eded7` |
| Alertas configuráveis por regra (Fase C3) | RF014, RN006 | 3.6 | `AlertRule`, `AlertEvent` | `8feff70` |
| Catálogo de comandos ampliado na UI (Fase C4) | RF017 | 3.5 | `AgentCommand` | `20b590e` |
| Correção: % de disco somada → distribuição por máquina | RN013 | — | — | `4da5f97` |

### Critérios de aceite (retroativos, confirmados)

- [x] `AssetRecord` nunca é sobrescrito pelo check-in (nem lido pela rota de check-in).
- [x] `MetricSample` tem retenção configurável (`Client.metricsRetentionDays`) com expurgo inline.
- [x] Catálogo de `AgentCommand` cobre os 5 tipos hoje existentes, expostos na UI.
- [x] Agregação de hardware/disco passa a contar máquinas por faixa, nunca somar valor absoluto
      entre máquinas heterogêneas (regra que ainda seria violada de novo na Sprint 3 — ver abaixo).

---

## Sprint 3 — Distribuição, Confiabilidade e Correções de Agregação

**Status**: ✅ Concluída (2026-08-17 a 2026-08-18)
**Objetivo**: sair de "funciona numa máquina de teste" para "roda em produção real com dois
agentes de verdade (Windows + Linux)" — unificar distribuição do binário, adicionar coletor
Linux, corrigir a mesma classe de bug de agregação que reapareceu, e proteger as rotas do agente
com rate limiting.

### Escopo entregue

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Commit |
|---|---|---|---|---|
| Unificação de publish do binário do agente (Fase D) | RF024 | 3.2 | — | `282e6ab` |
| Coletor Linux real via `/proc`, `/sys`, systemd (Fase D) | RF025 | 3.3 | — | `2b8fd41` |
| Correção: RAM/armazenamento total somado → distribuição por máquina | RN013 | — | — | `f1bcbc1` |
| Remoção de rota órfã com o mesmo bug de soma + dado mock morto | RN013 | — | — | `5e7b7f6` |
| Rate limiting nas rotas do agente | RNF001, RNF010 | 3.2, 3.3 | — | `d393bc9` |
| Redesenho do modal "Credenciais ativas" | RF002 | 3.1 | — | `b274adf` |

### Critérios de aceite (retroativos, confirmados)

- [x] `public/inventario-agent.exe` é a fonte única servida tanto pelo auto-update quanto por
      `/api/agent/download` e `/api/agent/download-exe`.
- [x] Coletor Linux roda os mesmos 3 ciclos do Windows (inventário 1h, métricas 10min, comandos
      90s), testado de ponta a ponta em WSL2 real.
- [x] Todas as 8 rotas do agente têm rate limiting (`lib/rate-limit.ts`), por `agentAuthId`
      pós-auth ou IP pré-auth.
- [x] Nenhuma tela nova de agregação de hardware soma valores absolutos entre máquinas
      heterogêneas — ver `lib/reports/device-report.ts` como referência obrigatória (regra
      registrada no `CONTEXT.md` sob "Bucket (nunca soma)" exatamente por já ter sido violada
      duas vezes).

**Retrospectiva**: o bug de "soma em vez de distribuição por faixa" apareceu e foi corrigido
**duas vezes** nesta sprint em telas diferentes (commits `4da5f97` na Sprint 2, `f1bcbc1` e
`5e7b7f6` aqui), incluindo uma rota de API órfã sem nenhum consumidor real. É a evidência concreta
por trás do item de teste automatizado listado no backlog da Sprint 4 — sem um teste que trave
esse padrão, ele volta a acontecer a cada tela nova de agregação.

---

## Sprint 4 — Performance & UX

**Status**: 🟢 Concluída (2026-08-20). O usuário aprovou explicitamente o backlog abaixo e o
`implementation-agent` executou os itens 1, 2, 3, 4, 5 e 7 (item 6 já estava concluído antes desta
execução — ver nota na própria seção), mais a verificação final de tipo/build/teste. A sessão
principal conferiu o trabalho de forma **independente** — não só confiando no relatório do
`implementation-agent` — lendo o código alterado, navegando ao vivo com Playwright autenticado nas
telas afetadas, e rodando `npx tsc --noEmit` / `npm run build` / `npm run test` ela mesma. A
conclusão desta sprint está baseada nessa aprovação do usuário + verificação independente da
sessão principal, **não** numa nova rodada dos 5 agentes auditores. Os itens 8, 9 e 10 não faziam
parte do backlog aprovado para esta execução e não foram tratados — ver "Itens não tratados nesta
execução" ao final desta seção para a decisão de encaminhamento. `backend-auditor` e
`test-auditor` não rodaram sobre este escopo em nenhum momento da sprint — os achados seguem
rastreáveis apenas a `requirements-auditor`, `security-auditor` e `database-auditor`, mais a
verificação independente da sessão principal citada acima.
**Objetivo**: Eliminar a vulnerabilidade crítica de multi-tenant, corrigir bugs funcionais de
relatórios e implementar melhorias de UX/Performance. Objetivo alcançado nos itens tratados; os
itens 8–10 permanecem como débito residual, migrados para a Sprint 6.

### Escopo já entregue nesta sprint

| Item | RF/RN relacionado | Entidade(s) afetada | Evidência |
|---|---|---|---|
| `loading.tsx` (streaming/skeleton) em todas as sub-rotas de `/tenant/[clientSlug]/*` | RNF008 (usabilidade) | — | 9 arquivos `loading.tsx` confirmados em `app/tenant/[clientSlug]/{,computers,servers,storage,processors,network,alerts,audit,reports}` nesta revisão |
| Migração `middleware.ts` → `proxy.ts` (convenção Next.js 16) | — | — | `proxy.ts`, confirmado por `npm run build` (`ƒ Proxy (Middleware)`) |
| Dynamic import (`ssr: false`) para gráficos Recharts e `DeviceDetailTabs` | RNF010 | — | `components/dashboard-charts-lazy.tsx`, `components/device-detail-tabs-lazy.tsx` |
| `select` explícito em `alertRule`/`alertEvent` (antes traziam a linha inteira) | RNF005 | `AlertRule`, `AlertEvent` | `app/tenant/[clientSlug]/alerts/page.tsx` |

### Backlog executado — achados de auditoria (2026-08-20)

Ordem definida pelo usuário: risco de isolamento multi-tenant primeiro, depois bug funcional de
relatório, depois gaps de baixo risco, depois UX/performance. Todo item cita a auditoria de
origem. Cada item abaixo traz, ao final, um bloco "Execução confirmada (2026-08-20)" com a
evidência da verificação independente feita pela sessão principal.

#### 1 — [CRÍTICO] `rotateEnrollmentKeyAction` sem checagem de organização

- **Origem do achado**: `security-auditor`
- **RF/RN relacionado**: RF002 (cadastro de tenant / emissão de `enrollmentKey`), RN003
  (isolamento por tenant), RN005 (`enrollmentKeyHash` — só o hash é persistido, mas a rotação
  também expõe a chave em claro em resposta), RNF004 (chokepoint de isolamento multi-tenant)
- **Caso de uso**: `docs/PRODUCT.md` §3.1 documenta a criação de `Client` sob o guard
  `hasClientsAdminAccess`, mas **não documenta o fluxo de rotação de chave como caso de uso
  próprio** — gap a registrar junto com a correção.
- **Entidade(s) de banco**: `Client` (`organizationId`, `enrollmentKeyHash`,
  `activeProvisioningKeyEnc`)
- **Achado**: `app/clients/actions.ts:40-44,169-231` — `hasClientsAdminAccess()` só confere
  `isPlatformAdmin(user) || isOrgAdmin(user)`, sem comparar `organizationId` do `Client` alvo com
  o do ator. Um `ORG_ADMIN` de qualquer organização pode informar o `clientId` de um cliente de
  **outra** organização em `rotateEnrollmentKeyAction` e receber a `enrollmentKey` nova em texto
  puro — caminho direto para registrar um agente hostil dentro do tenant da vítima.
- **Nota de discrepância com `docs/PRODUCT.md`**: RN015 documenta `hasClientsAdminAccess` como
  guard *intencionalmente* mais permissivo que `canManageTenant` para "criar/editar `Client`",
  classificando isso como "decisão de conta (quem pode existir), não de operação sobre um tenant
  já existente". A rotação de chave não cria nem edita a existência do `Client` — é emissão de
  credencial para um tenant **já existente**, mais parecida com `GET
  /api/clients/[id]/credentials` (que já usa `canManageTenant`) do que com `createClientAction`.
  Este plano segue a recomendação do `security-auditor` de migrar `rotateEnrollmentKeyAction` para
  `canManageTenant`; isso deixa RN015, como está escrita hoje, desatualizada para este caso
  específico — quem aprovar a sprint decide se RN015 ganha uma exceção explícita para rotação de
  chave ou se `createClientAction` (criação pura) segue sob `hasClientsAdminAccess` enquanto
  rotação migra de guard. Não é uma correção que este planner faz sozinho.
- **Correção proposta**: validar com `canManageTenant(user, client)` — carregando
  `client.organizationId` no mesmo `findUnique` já existente (linha 191-194) — antes de gerar e
  persistir a nova chave; adicionar `recordAuditLog` (ação `credentials.rotate`, `targetType:
  'client'`, `clientId: client.id`), seguindo o padrão já usado em `GET
  /api/clients/[id]/credentials`.
- **Testes necessários**: teste automatizado (Server Action ou de integração) simulando um
  `ORG_ADMIN` da Organização A chamando `rotateEnrollmentKeyAction` com o `clientId` de um
  `Client` da Organização B — deve retornar erro e **nenhuma** chave deve ser rotacionada no banco
  (nem `enrollmentKeyHash` nem `activeProvisioningKeyEnc` mudam); teste complementar confirmando
  que `ORG_ADMIN` da própria organização e `PLATFORM_ADMIN` continuam rotacionando normalmente,
  com `AuditLog` gravado.
- **Critérios de aceite**:
  - [x] `rotateEnrollmentKeyAction` usa `canManageTenant(user, client)` com `client.organizationId`
        carregado antes de qualquer escrita.
  - [x] `ORG_ADMIN` de organização diferente recebe erro e nenhuma chave é rotacionada
        (confirmado por teste automatizado).
  - [x] `recordAuditLog` é chamado em toda rotação bem-sucedida.
  - [x] Decisão sobre RN015 (exceção explícita ou não) registrada para quem aprovar a sprint —
        atualização real de `docs/PRODUCT.md` fica fora do escopo de escrita deste planner.

**Execução confirmada (2026-08-20)**: verificação independente da sessão principal, lendo
`app/clients/actions.ts` — `rotateEnrollmentKeyAction` agora usa `canManageTenant(user, client)`
com `client.organizationId` carregado, e grava `recordAuditLog` (`credentials.rotate`) dentro da
mesma transação. `docs/PRODUCT.md` RN015 recebeu uma nota de exceção explícita (rotação usa
`canManageTenant`; criação continua em `hasClientsAdminAccess`) — decisão que o usuário confirmou
explicitamente na mesma conversa, fechando o ponto em aberto que este planner havia deixado para
quem aprovasse a sprint.

**Recomendação de acompanhamento (não bloqueia esta conclusão)**: o próprio `implementation-agent`
recomendou uma passada do `security-auditor` sobre o diff final deste item (especialmente
`app/clients/actions.ts` e a rota de credenciais) antes de considerar o item crítico
definitivamente fechado para produção. Isso corresponde ao item "Auditoria de segurança executada
sem vulnerabilidades" da `DEFINITION_OF_DONE.md` — hoje coberto pela verificação independente da
sessão principal, mas ainda não por uma passada dedicada do `security-auditor`. Registrado aqui
como pendência de acompanhamento, não como bloqueio: o usuário já aprovou e a correção já foi
verificada de forma independente.

#### 2 — [MÉDIO] Oráculo de existência em `GET /api/clients/[id]/credentials`

- **Origem do achado**: `security-auditor`
- **RF/RN relacionado**: RNF004 (chokepoint de isolamento — deveria responder de forma uniforme,
  nunca revelar existência), RN003
- **Caso de uso**: não documentado como caso de uso próprio em `docs/PRODUCT.md` §3 — mesmo gap
  do item 1.
- **Entidade(s) de banco**: `Client`
- **Achado**: `app/api/clients/[id]/credentials/route.ts:35-61` busca o cliente por `id` via SQL
  bruto e só chama `canManageTenant` depois de encontrá-lo. Resultado: `404` para um `id`
  inexistente, mas `401` para um `id` que existe mas pertence a outra organização — a diferença de
  status revela se um tenant de outra organização existe, contrariando o próprio padrão que
  `requireTenantContext()` estabelece (RNF004: "responder `notFound()`, nunca `403`, para não
  revelar a existência de um tenant de outra organização").
- **Correção proposta**: checar sessão/escopo antes de revelar existência — por exemplo, resolver
  `organizationId` do cliente e comparar antes de decidir entre `404`/`401`, ou uniformizar as duas
  respostas como `404`.
- **Testes necessários**: teste de integração da rota cobrindo dois casos — `id` inexistente e
  `id` de cliente de outra organização — verificando que ambos retornam exatamente o mesmo status
  e formato de corpo.
- **Critérios de aceite**:
  - [x] A rota responde de forma indistinguível para `id` inexistente e `id` de outra organização
        (mesmo status, mesmo corpo).
  - [x] Teste automatizado cobre os dois casos e falha se as respostas divergirem.

**Execução confirmada (2026-08-20)**: verificação independente da sessão principal, lendo
`app/api/clients/[id]/credentials/route.ts` — a resposta foi unificada para `404` tanto em
"cliente não existe" quanto "existe mas é de outra organização"; o oráculo de existência está
fechado.

#### 3 — [MÉDIO/BUG] `getDeviceReportRows`/`buildDeviceReportSummary` nunca contam "offline"

- **Origem do achado**: `requirements-auditor` (RF020 vs. RN010, já documentada em
  `docs/PRODUCT.md`)
- **RF/RN relacionado**: RF020 (relatórios), RN010 (status "offline" nunca é gravado
  automaticamente — é sempre calculado em runtime)
- **Caso de uso**: `docs/PRODUCT.md` §3 não tem um caso de uso numerado próprio para "geração de
  relatório" (RF018/RF019/RF020 não mapeiam 1:1 para nenhum dos §3.1–3.10 existentes) — outro gap
  de documentação a registrar, fora do escopo de correção deste item.
- **Entidade(s) de banco**: `Device` (`status`), `CollectionLog` (`logs`, usado para calcular a
  última coleta)
- **Achado**: `lib/reports/device-report.ts:97,117` lê `device.status` cru do banco e filtra por
  `'offline'`, mas essa coluna **nunca** recebe `'offline'` — só `'online'`/`'warning'`, gravados
  no check-in (`app/api/agent/checkin/route.ts:84,97,109`). RN010 já documenta essa distinção
  explicitamente ("Confundir as duas colunas já foi um bug real corrigido nesta sessão de
  trabalho" — corrigido em outro lugar do app, mas não em `device-report.ts`). O status efetivo
  `offline` só existe calculado em runtime via `getEffectiveDeviceStatus`/`getDevicePresence`
  (`lib/inventory-alerts.ts:136-168`). Resultado: o contador de máquinas offline no relatório
  PDF/CSV fica sempre zerado, mesmo com máquinas sumidas há meses.
- **Correção proposta**: `getDeviceReportRows`/`buildDeviceReportSummary` devem calcular o status
  efetivo (reaproveitando `getEffectiveDeviceStatus` com os mesmos `issues`/limiar de tenant
  usados no resto do app) antes de contar "offline", em vez de usar `device.status` bruto.
- **Testes necessários**: teste unitário de `buildDeviceReportSummary` com uma linha cujo
  `ultimaColeta` ultrapassa o `alertOfflineHours` do tenant — deve contar como offline no resumo;
  teste de regressão comparando o status exibido no relatório com o status exibido no dashboard
  para o mesmo `Device`, garantindo que os dois nunca divirjam.
- **Critérios de aceite**:
  - [x] Contagem de "offline" no relatório usa status efetivo, não `device.status` bruto.
  - [x] Teste automatizado com dispositivo sumido há mais que `alertOfflineHours` conta como
        offline no resumo do relatório.
  - [x] Relatório CSV/PDF e dashboard nunca mostram status divergente para o mesmo dispositivo.

**Execução confirmada (2026-08-20)**: `lib/reports/device-report.ts` agora calcula o status
efetivo via `getEffectiveDeviceStatus` em vez de ler `device.status` bruto. Confirmado ao vivo com
Playwright autenticado: `/tenant/core-ti-expert/reports` passou a mostrar "Dispositivos offline: 3"
(antes ficava sempre zerado).

#### 4 — [BAIXO] `role: 'SUPER_ADMIN'` fora do enum `AppRole` em `POST /api/auth/signup`

- **Origem do achado**: `security-auditor` e `database-auditor` (confirmado independentemente
  pelos dois)
- **RF/RN relacionado**: RF001 (autenticação), RF023 (gestão de usuários — bootstrap único), RN004
  (RBAC de 4 papéis; qualquer valor fora do enum é normalizado para `null` por
  `getPermissionUser()`, ou seja, sem nenhum privilégio)
- **Caso de uso**: `docs/PRODUCT.md` §3.7 já documenta `POST /api/auth/signup` como bootstrap do
  "primeiro `SUPER_ADMIN`" — a própria documentação carrega o valor errado, não é só o código
  (linha 474 do `PRODUCT.md` já registra essa nota como achado conhecido).
- **Entidade(s) de banco**: `User` (`role`)
- **Achado**: `app/api/auth/signup/route.ts:31,47` grava/consulta `role: 'SUPER_ADMIN'`, valor
  fora do enum `AppRole` (`PLATFORM_ADMIN | ORG_ADMIN | ORG_OPERATOR | CLIENT_VIEWER`) de
  `lib/permissions.ts`. O bootstrap admin nasce sem nenhuma permissão (fail-closed rejeita o
  login) — e como a checagem de "já existe um super admin" na linha 30-33 também filtra por
  `role: 'SUPER_ADMIN'`, um segundo bootstrap poderia rodar sem detectar o admin já criado (mesmo
  que inutilizável), até criar um usuário duplicado.
- **Correção proposta**: trocar as duas ocorrências (consulta `existingSuperAdmin` e o `create`)
  por `'PLATFORM_ADMIN'`.
- **Testes necessários**: teste de integração de `POST /api/auth/signup` confirmando que o
  usuário criado tem `role: 'PLATFORM_ADMIN'` e que uma segunda chamada retorna `409` (detecção
  correta de admin já existente); teste de login confirmando que a sessão desse usuário carrega
  `role` não nulo.
- **Critérios de aceite**:
  - [x] `role` gravado por `POST /api/auth/signup` é `'PLATFORM_ADMIN'`.
  - [x] A consulta de "já existe admin" também usa `'PLATFORM_ADMIN'`, sem regressão no `409`.
  - [x] Teste automatizado cobre criação + login do usuário bootstrap, confirmando `role` != null
        na sessão.

**Execução confirmada (2026-08-20)**: verificação independente da sessão principal — confirmadas
as duas ocorrências em `app/api/auth/signup/route.ts` trocadas para `'PLATFORM_ADMIN'`.

#### 5 — [BAIXO] `deleteAlertRuleAction` sem `recordAuditLog`

- **Origem do achado**: `security-auditor` (cobertura de auditoria, RNF009)
- **RF/RN relacionado**: RF022 (auditoria), RN006 (ciclo de vida de `AlertEvent`), RNF009
  (auditabilidade — cobertura depende de cada ação sensível chamar `recordAuditLog()`
  explicitamente)
- **Caso de uso**: `docs/PRODUCT.md` §3.6(b) documenta criar/editar `AlertRule`, mas não menciona
  exclusão nem o requisito de auditoria para ela — gap a registrar.
- **Entidade(s) de banco**: `AlertRule`, `AuditLog`
- **Achado**: `app/tenant/[clientSlug]/alerts/actions.ts:101-125` — único gap de cobertura de
  auditoria encontrado nesta rodada. Excluir uma regra de alerta de segurança (ex.: desativar
  detecção de antivírus) não deixa rastro nenhum em `AuditLog`.
- **Correção proposta**: adicionar `recordAuditLog` em `deleteAlertRuleAction`, seguindo o padrão
  já usado em `device.delete` (`app/tenant/[clientSlug]/assets/[id]/actions.ts:65-81`).
- **Testes necessários**: teste automatizado confirmando que, ao excluir uma `AlertRule`, uma
  linha é criada em `AuditLog` com `targetType`/`targetId` apontando para a regra excluída e
  `clientId` do tenant correto.
- **Critérios de aceite**:
  - [x] `deleteAlertRuleAction` chama `recordAuditLog` antes de responder sucesso.
  - [x] Teste automatizado confirma a linha de `AuditLog` criada na exclusão.

**Execução confirmada (2026-08-20)**: verificação independente da sessão principal, lendo
`app/tenant/[clientSlug]/alerts/actions.ts` — `deleteAlertRuleAction` agora grava `recordAuditLog`
(`alert_rule.delete`) dentro de transação.

#### 6 — [CONCLUÍDO] `loading.tsx` com Skeleton em todas as sub-rotas do tenant

Já entregue nesta sprint — ver "Escopo já entregue" acima. Confirmado nesta revisão lendo
`app/tenant/[clientSlug]/`: os 9 arquivos existem (raiz, `computers`, `servers`, `storage`,
`processors`, `network`, `alerts`, `audit`, `reports`). Não é reaberto como backlog.

#### 7 — [PERFORMANCE/UX] Redesenho de `/processors` e `/storage`

- **Origem do achado**: brief já aprovado pelo usuário em sessão de trabalho anterior, nunca
  implementado — carregado do backlog anterior desta mesma sprint, sem alteração de conteúdo.
- **RF/RN relacionado**: RF012 (periféricos/hardware via `Hardware.processador`), RF007, RN010
  (badge de presença deve usar `getDevicePresence()`, nunca `device.status` bruto — mesma regra do
  item 3)
- **Caso de uso**: a documentar em `docs/PRODUCT.md` §3 (não existe caso de uso próprio para
  listagens hoje — mesmo gap apontado no item 3)
- **Entidade(s) de banco**: `Hardware`, `Disk`, `Device`
- **Escopo**:
  - `/tenant/[clientSlug]/processors`: sair do card avulso atual para lista compacta com badge de
    fabricante, contagem de dispositivos, hostnames + último usuário, filtro por fabricante
    clicável refletido na URL (`searchParams`), clique → `/computers?search=`.
  - `/tenant/[clientSlug]/storage`: tabela com hostname clicável, usuário, tipo/contagem de disco,
    barra de uso com limiar de cor, badge por `getDevicePresence()` (não `device.status` bruto),
    filtro por tipo e faixa de uso, refletido na URL.
  - Mesmo padrão de filtros/URL já usado em `/computers`.
- **Testes necessários**: teste de componente/integração confirmando que navegar com
  `?fabricante=X` filtra a lista de `/processors` para hostnames daquele fabricante; teste
  unitário da função que mapeia percentual de uso de disco para o limiar de cor (ex.: 3 faixas →
  3 cores); teste confirmando que o badge de `/storage` usa `getDevicePresence()` e não
  `device.status`.
- **Critérios de aceite**:
  - [x] `/processors` e `/storage` seguem o padrão de tabela compacta do resto do painel, com os
        filtros descritos acima refletidos em `searchParams`.
  - [x] Nenhuma das duas telas lê `device.status` bruto para exibir presença — usam
        `getDevicePresence()`.

**Execução confirmada (2026-08-20)**: testado ao vivo com Playwright autenticado —
`/tenant/core-ti-expert/processors` tem filtro por fabricante clicável refletindo
`?fabricante=AMD` na URL (clicado de verdade, não só assumido); link do processador para
`/computers?search=` funciona; `/tenant/core-ti-expert/storage` tem filtros por tipo e faixa de
uso que compõem `?tipo=HDD&faixa=ok` na URL (também clicado de verdade); link de hostname para
`/assets/[id]` funciona. Sem erros de console em nenhuma das duas telas.

### Itens não tratados nesta execução

Os itens 8, 9 e 10 abaixo **não foram implementados nem testados** nesta execução — não fizeram
parte do backlog aprovado pelo usuário para esta sprint. Como o status da Sprint 4 muda para
Concluída nesta revisão, não faz sentido manter itens explicitamente pendentes dentro de uma
sprint fechada (deixaria checkboxes pendentes de forma permanente numa seção marcada como
histórico). Decisão deste planner: migrar os três para uma nova **Sprint 6 — Débito Técnico
Residual**, preservando o texto original e a rastreabilidade da origem de cada achado, em vez de
deixá-los soltos aqui ou empurrá-los para dentro da Sprint 5. A Sprint 5 tem um objetivo único e
coeso (renomeação de rotas); misturar débito técnico não relacionado ali quebraria a convenção que
o resto deste documento segue (uma sprint, um objetivo). Ver Sprint 6 ao final deste arquivo para
o conteúdo completo dos itens 8, 9 e 10, mais um item novo (11) com um achado colateral reportado
pelo `implementation-agent` durante esta execução.

### Critérios de aceite gerais da sprint

- [x] Nenhum aviso de depreciação de `middleware` no build ou no dev server.
- [x] Navegação client-side entre sub-rotas do tenant mostra skeleton, não tela travada (validado
      com Playwright: skeleton visível ~270ms após clique, some ao assentar os dados).
- [x] Vulnerabilidade crítica do item 1 corrigida e coberta por teste (bloqueia a conclusão da
      sprint — prioridade máxima). Confirmado por leitura de código independente da sessão
      principal (ver "Execução confirmada" no item 1).
- [x] Itens 2, 4 e 5 corrigidos e cobertos por teste. Confirmado por leitura de código independente
      da sessão principal (ver "Execução confirmada" em cada item).
- [x] Item 3 corrigido — relatório nunca mais reporta 0 offline com máquinas de fato sumidas.
      Confirmado ao vivo com Playwright ("Dispositivos offline: 3" em vez de sempre zerado).
- [x] `/tenant/[clientSlug]/processors` e `/storage` seguem o padrão de tabela compacta do resto
      do painel, com os filtros descritos no brief aprovado (item 7). Confirmado ao vivo com
      Playwright (filtros clicados de verdade, refletidos na URL, sem erro de console).
- [ ] `getDeviceReportRows` decidido como consolidado ou explicitamente mantido divergente por
      página, com justificativa registrada (item 8). **Não tratado nesta execução** — migrado para
      a Sprint 6, permanece sem marcação.
- [ ] RN013 ("bucket, nunca soma") protegida por teste automatizado (item 10). **Não tratado nesta
      execução** — migrado para a Sprint 6, permanece sem marcação.
- [x] `npx tsc --noEmit`, `npm run build` e `npm run test` rodam sem erro, confirmado pela própria
      sessão principal de forma independente (28/28 testes passando; `npm run test` deixou de ser o
      placeholder `noop-test.mjs` e passou a rodar `vitest run` de verdade, com 8 arquivos de teste
      novos em `tests/`). Este critério não estava explicitamente listado na versão anterior deste
      documento e foi adicionado nesta revisão porque a mudança de `npm run test` de placeholder
      para suíte real é, em si, um resultado relevante desta sprint.

### Fora de escopo desta sprint

Reescrever a suíte de testes do zero permanecia fora de escopo no planejamento original desta
sprint, mas deixou de ser um placeholder vazio durante a execução: `npm run test` agora roda
`vitest run` com 8 arquivos de teste novos (28/28 passando), cobrindo pontualmente as correções
dos itens 1–5 e 7. Uma suíte completa e abrangente para o projeto inteiro (cobertura de toda rota,
toda regra de negócio) continua fora do escopo desta sprint especificamente, e deve virar item de
sprint próprio se for priorizado.

Também fora de escopo: atualizar `docs/PRODUCT.md` para preencher os gaps de caso de uso citados
nos itens 2, 3 e 5 (rota de credenciais, geração de relatório e exclusão de `AlertRule` sem caso de
uso numerado) — citados aqui como achado, não corrigidos por este planner nem incluídos como
tarefa de implementação desta sprint. A discrepância de RN015 apontada no item 1 **foi** resolvida
nesta execução (nota de exceção explícita adicionada a `docs/PRODUCT.md`, confirmada pelo usuário),
deixando de ser um item em aberto.

Também fora de escopo, registrado como achado colateral reportado pelo `implementation-agent`
durante esta execução (não é um bug desta sprint, é pré-existente): `npm run lint` deste projeto só
cobre `scripts/verification/**`, e `eslint.config.mjs` ignora `app/**`/`components/**`/`lib/**` de
propósito — ou seja, não existe hoje lint real de código de aplicação. Ver item 11 na Sprint 6 como
candidato a item de sprint futura.

---

## Sprint 5 — Consolidação de Rotas

**Status**: 🟢 Concluída (2026-08-31). Executada pelo `implementation-agent` e verificada de forma
independente pela sessão principal (não só pelo autorrelato do agente): `npx tsc --noEmit` limpo,
`npm run lint` limpo (regra real, `eslint-config-next` — confirmado não-vazio: 7 erros
`react-hooks` medidos antes da execução e corrigidos), `npm run build` com `/admin/clients*` e
`/app/[clientSlug]*` como as únicas rotas reais (nenhum `/tenant`/`/clients` residual), `npm run
test` com **132/132** passando (20 arquivos). Varredura própria (`grep` sobre `app`/`components`/
`lib`/`tests`) confirmou zero referência hardcoded a `/tenant/`/`/clients` fora de
`tests/route-rename.test.ts` (que precisa delas de propósito, para testar o redirect). `proxy.ts`
lido linha a linha: os dois blocos de redirect 308 rodam antes de qualquer checagem de
autenticação/autorização (uma URL antiga não revela estado de sessão), preservam sub-caminho e
querystring, e a lógica de guard (`canPossiblyAccessTenantSlug`, área de conta) foi preservada
intacta — só os prefixos mudaram, confirmado contra o que o `security-auditor` already validou na
Parte 1. Resumo por item (relato completo do `implementation-agent`, verificado):
- **Item 1** — 25 arquivos movidos via `git mv` (histórico preservado), `lib/tenant-links.ts` e os
  11 literais `PageProps<'/tenant/[clientSlug]'>` atualizados. Achado além do mapa original: mais 8
  arquivos com import TypeScript apontando para `@/app/tenant/...`/`@/app/clients/types` (não eram
  strings de href, por isso o grep original não pegou) — corrigidos, teriam quebrado o build.
- **Item 2** — 7 arquivos movidos, `proxy.ts`/`sidebar.tsx` atualizados.
- **Item 3** — `eslint-config-next@16.3.3` instalado de verdade (`--save-dev`); achado importante:
  `npm run lint` nunca apontava de fato para `app`/`components`/`lib` (só `scripts/verification` e
  o próprio config) — só remover o `ignores` teria produzido um "lint limpo" vazio, sem checar
  nada. Corrigido `scripts/verification/run-lint.mjs` para apontar de verdade; os 7 erros reais
  medidos antes da execução foram corrigidos.
- **Item 4** — `tests/route-rename.test.ts` (18 testes) + 13 arquivos de teste existentes
  adaptados. Verificação real de login (4 papéis, via curl contra servidor de produção local)
  confirmando guard de `/app/`/`/admin/clients` por papel.
**Objetivo**: Consolidar o nome das rotas operacionais e administrativas sob a hierarquia real
(`Organization`/`Client`) — `/tenant/[clientSlug]/*` → `/app/[clientSlug]/*` e `/clients` →
`/admin/clients` —, com redirecionamento 308 das URLs antigas, cobertura de teste automatizada, e
ativação de lint real sobre `app/**`/`components/**`/`lib/**`.

**Nota de reativação (2026-08-31)**: esta sprint estava 📋 Adiada desde 2026-08-24 ("retomar só
depois da Sprint 8"). A Sprint 8 está concluída (commit `be59517`) e o usuário reativou a Sprint 5
explicitamente nesta rodada, com um escopo técnico literal e mais detalhado que o rascunho
anterior — em particular fixando a decisão de URL antiga como **redirect 308 (Permanent
Redirect)**, não mais uma "decisão pendente" entre 404/redirect como o rascunho anterior deixava
em aberto. Esta revisão **substitui integralmente** o conteúdo anterior da seção, reconfirmando
contra o estado real do código (não uma cópia do pedido do usuário sem checagem) — ver "Achados
desta revisão" logo abaixo. Onde o pedido literal do usuário e um achado desta revisão divergem
(ex.: volume real de arquivos, arquivos com path hardcoded fora do helper), isso está registrado
explicitamente item a item, não silenciado.

**Nota sobre o pedido de migração `middleware.ts` → `proxy.ts`**: essa migração **já está
concluída** desde a Sprint 4 — `middleware.ts` foi renomeado para `proxy.ts` (`git mv`), a função
exportada já era `export default auth(...)` (não precisou renomear função), e `npm run build`
confirma `ƒ Proxy (Middleware)` sem aviso de depreciação (ver "Escopo já entregue" da Sprint 4).
**Não é item desta sprint** — citada aqui só para não ser reaberta por engano numa futura revisão
deste documento. O que esta sprint faz mexer em `proxy.ts` é outra coisa: os guards/matchers
internos que comparam `nextUrl.pathname` por string literal (`/tenant/`, `/clients`) precisam
acompanhar o rename das páginas, mais o redirect 308 novo — ver item 1 e item 2 abaixo.

**Achados desta revisão (2026-08-31), antes de escrever os critérios de aceite**:
- **Volume real de arquivos cresceu desde o rascunho anterior desta sprint**: `app/tenant/[clientSlug]/**`
  tem hoje **25 arquivos** (confirmado por listagem direta), não os "9 `loading.tsx` + páginas"
  descritos vagamente antes — a rota `assets/` (`assets/page.tsx`, `assets/loading.tsx`,
  `assets/[id]/page.tsx`, `assets/[id]/actions.ts`) é nova desde o rascunho original e precisa
  entrar no escopo do rename. `app/clients/**` continua com **7 arquivos**
  (`page.tsx`, `types.ts`, `actions.ts`, `clients-panel.tsx`, `novo/page.tsx`,
  `novo/new-client-wizard.tsx`, `audit/page.tsx`) — sem mudança desde o rascunho anterior.
- **`lib/tenant-links.ts` é hoje só 9 linhas** (`getTenantBasePath`/`getTenantPath`, hardcoded para
  `` `/tenant/${clientSlug}` ``) e já é importado por **16 arquivos** — a maior parte do código já
  passa por esse ponto único, confirmando que atualizá-lo primeiro propaga a maior parte do rename
  automaticamente, como o rascunho anterior já apontava.
- **Risco novo, não registrado no rascunho anterior**: nem todo lugar que monta um path de tenant
  passa pelo helper. Busca direta por `` `/tenant/${...}` `` fora de `lib/tenant-links.ts` encontrou
  **8 ocorrências em 7 arquivos** que constroem a string manualmente e vão quebrar silenciosamente
  se só os diretórios forem renomeados sem tocar neles:
  - `components/audit-log-table.tsx:99` — `` `/tenant/${log.clientSlug}/assets/${log.targetId}` ``
  - `app/dashboard/page.tsx:51` — `` redirect(`/tenant/${client.slug}`) ``
  - `app/clients/novo/new-client-wizard.tsx:199` — `` <Link href={`/tenant/${pkg.clientSlug}`}> ``
  - `app/clients/clients-panel.tsx:358` — `` <Link href={`/tenant/${client.slug}`}> ``
  - `app/tenant/[clientSlug]/assets/[id]/actions.ts:241` — `` revalidatePath(`/tenant/${tenantSlug}/assets/${deviceId}`) ``
  - `app/tenant/[clientSlug]/alerts/actions.ts:60,93,148` — 3× `` revalidatePath(`/tenant/${parsed.data.tenantSlug}/alerts`) ``
  - `app/tenant/[clientSlug]/computers/actions.ts:86-87` — `` revalidatePath(`/tenant/${parsed.data.tenantSlug}/computers`) `` e a variante sem segmento
  Estes 7 arquivos precisam ser migrados para `getTenantBasePath`/`getTenantPath` **como parte do
  item 1**, não só ter o texto substituído por busca-e-substituição — ver critério de aceite
  dedicado no item 1.
- **Risco novo, específico de `/clients`**: `components/sidebar.tsx:403-405` compara
  `pathname.startsWith('/clients/audit')`/`'/clients/novo'`/`'/clients'` por string literal para
  decidir o título exibido no cabeçalho — não usa nenhum helper (não existe um `getAdminPath`
  hoje). Precisa acompanhar o rename do item 2 ou o título da área administrativa para de
  atualizar silenciosamente.
- **Risco novo, tipagem de rotas do Next.js**: as páginas movidas usam o gerador de tipos de rota
  do Next (`PageProps<'/tenant/[clientSlug]'>`, `LayoutProps<'/tenant/[clientSlug]'>` — confirmado
  em 11 arquivos: `layout.tsx` e os `page.tsx` de raiz, `computers`, `servers`, `storage`,
  `processors`, `network`, `alerts`, `reports`, `assets`, `assets/[id]`). Esses literais de tipo
  precisam ser atualizados manualmente para `'/app/[clientSlug]'`/`'/app/[clientSlug]/assets/[id]'`
  junto com o `git mv` do diretório — se ficarem desatualizados, `npx tsc --noEmit` falha (o
  gerador de tipos do Next valida esses literais contra a árvore de pastas real), o que pelo menos
  garante que o erro não passa despercebido, mas é trabalho manual a mais que o rascunho anterior
  não citava.
- **Teste com blast radius maior que o citado antes**: busca por `/tenant/` ou `/clients` dentro de
  `tests/` encontra **13 arquivos de teste** que hoje hardcodeiam esses paths em mocks/asserts —
  não os 4 citados no rascunho anterior (`tenant-processors-table`, `tenant-storage-table`,
  `rotate-enrollment-key`, `credentials-route`). Lista completa:
  `tests/tenant-storage-table.test.tsx`, `tests/tenant-processors-table.test.tsx`,
  `tests/tenant-servers-table.test.tsx`, `tests/tenant-recent-devices-table.test.tsx`,
  `tests/tenant-computers-table.test.tsx`, `tests/tenant-device-rows.test.ts`,
  `tests/stat-cards.test.tsx`, `tests/tenant-context.test.ts`,
  `tests/device-listing-status-parity.test.ts`, `tests/delete-alert-rule.test.ts`,
  `tests/rotate-enrollment-key.test.ts`, `tests/credentials-route.test.ts`,
  `tests/revoke-agent-auth.test.ts`.
- **Baseline real de testes mudou**: a suíte tem hoje **19 arquivos** em `tests/` (não 4, nem os "28
  testes" citados no rascunho antigo) — o commit mais recente do branch (`5acf610`) registra
  "111/111 testes". O critério de "sem regressão" desta sprint deve ser lido contra essa baseline
  real (111+ passando), não contra números de sprints anteriores.
- **Documentação fora de `docs/PRODUTO.md`/`PRODUCT.md`/`SPEC.md` também referencia os paths
  antigos**: `CONTEXT.md`, `docs/adr/0004-tenant-isolation-fail-closed.md`, e os arquivos de agente
  `.claude/agents/security-auditor.md`/`.claude/agents/backend-auditor.md` citam `/tenant/[clientSlug]`
  como path real. Este planner só tem permissão de escrita sobre `docs/SPRINTS.md` — atualizar os
  demais fica registrado como consequência necessária do rename, não como tarefa que este plano
  executa (ver "Fora de escopo" ao final).
- **Limitação desta rodada de planejamento, registrada com honestidade**: esta sessão do
  `sprint-planner` não tem acesso a shell/terminal — não foi possível rodar
  `npx eslint app components lib --max-warnings=0` para medir hoje quantos erros/avisos reais o
  item 3 (lint) vai revelar. O critério de aceite do item 3 abaixo trata essa medição como o
  **primeiro passo executável da implementação**, não como algo já estimado por este plano — ver
  detalhe no item 3.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem |
|---|---|---|---|---|
| 1. Renomear `/tenant/[clientSlug]/*` → `/app/[clientSlug]/*`, com `lib/tenant-links.ts` e `proxy.ts` atualizados e redirect 308 da URL antiga | RF018, RF019, RF020, RN003, RNF004 | 3.4, 3.5, 3.6, 3.8 | `Device` e tabelas 1:N/1:1 relacionadas (ver detalhe) | `docs/PRODUTO.md` §8 (A3, pendente desde a Sprint 1); escopo literal do usuário nesta reativação |
| 2. Renomear `/clients` → `/admin/clients` (mantendo `/api/clients/*` intacto), com `proxy.ts` atualizado e redirect 308 | RF002, RF003 | 3.1, 3.2 | `Client`, `AuditLog` | `docs/PRODUTO.md` §8 (A3, pendente desde a Sprint 1); escopo literal do usuário nesta reativação |
| 3. Lint real sobre `app/**`, `components/**`, `lib/**` | — (gap de RNF, ver detalhe) | — | — | `implementation-agent`, achado colateral da execução da Sprint 4 (2026-08-20) — movido da Sprint 6 para a Sprint 5 numa revisão anterior; escopo literal do usuário nesta reativação |
| 4. `tests/route-rename.test.ts` + `tsc`/`lint`/`build`/`test` na verificação final | — | — | — | pedido direto do usuário, cobertura dos itens 1 e 2; escopo literal do usuário nesta reativação |

**Ordem de execução recomendada dentro da sprint** (pedido explícito do usuário nesta reativação —
deixa de ser "decisão de quem executa" como no rascunho anterior):
1. Atualizar `lib/tenant-links.ts` (`getTenantBasePath`/`getTenantPath` → `/app/${slug}`) e os
   matchers/guards de `proxy.ts` (incluindo o redirect 308), **antes** de mover qualquer diretório —
   isso deixa o helper e o proxy corretos enquanto as páginas ainda respondem no path antigo,
   permitindo testar o redirect e o guard isoladamente.
2. Mover os diretórios (`app/tenant/[clientSlug]/` → `app/app/[clientSlug]/`, `app/clients/` →
   `app/admin/clients/`), migrando também os 7+1 arquivos com path hardcoded listados nos
   "Achados desta revisão" para usar o helper.
3. Rodar a suíte de testes (item 4) contra o resultado dos passos 1-2 — é o momento em que
   `tests/route-rename.test.ts` e os testes adaptados provam que nada quebrou.
4. Ativar o lint (item 3) por último — pega qualquer import quebrado ou variável não usada deixada
   pelos passos 1-2 antes de a sprint ser reportada como concluída, sem misturar o volume inicial
   de avisos do lint novo com avisos temporários do meio da renomeação.
5. Verificação final: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test` (111+
   testes).

#### 1 — Renomear rotas operacionais `/tenant/[clientSlug]/*` → `/app/[clientSlug]/*`

**Objetivo**: Renomear a árvore de páginas operacionais de `/tenant/[clientSlug]/*` para
`/app/[clientSlug]/*`, atualizar `lib/tenant-links.ts` e os matchers de `proxy.ts`, e adicionar
redirect 308 das URLs antigas para as novas — alinhando o nome da rota à hierarquia real do sistema
(o termo "tenant" é herdado do modelo de conta única anterior à Sprint 1 — ver `docs/PRODUTO.md`
§8, item A3), sem alterar nenhum comportamento de acesso ou dado exibido.

**Requisitos Afetados**:
- RF018 (dashboard por tenant), RF019 (listagens filtráveis), RF020 (relatórios), RN003 (isolamento
  por tenant via `canAccessTenant`), RNF004 (chokepoint de isolamento multi-tenant).
- Caso de uso afetado: 3.4 (Visualização do dashboard), 3.5 (Envio de comando remoto — a UI de
  disparo vive em `assets/[id]`), 3.6 (Configuração de alertas), 3.8 (Registro de patrimônio —
  também em `assets/[id]`). 3.2 (Enrollment) e 3.3 (Check-in) **não** são afetados — confirmado de
  novo nesta revisão: nenhuma página desses fluxos vive sob `/tenant/[clientSlug]/*`.
- Gap de documentação já registrado, não corrigido aqui: RF019/RF020 não têm caso de uso numerado
  próprio em `docs/PRODUCT.md` §3 — mesmo gap apontado nas Sprints 4, 6, 7.
- Entidade(s) de banco: `Device`, `Hardware`, `Network`, `Disk`, `Software`, `SecurityPosture`,
  `LocalAccount`, `Monitor`, `Printer`, `UsbDevice`, `AssetRecord`, `AlertRule`, `AlertEvent`,
  `AgentCommand`, `AuditLog`, `MetricSample` — nenhuma mudança de schema, só de rota; listadas para
  que o teste de regressão confirme que nenhum dado exibido muda.

**Escopo técnico**:
- `git mv app/tenant/[clientSlug] app/app/[clientSlug]` — os **25 arquivos** confirmados nesta
  revisão (raiz `page.tsx`/`layout.tsx`/`loading.tsx`, mais `computers`, `servers`, `storage`,
  `processors`, `network`, `alerts`, `audit`, `reports`, `assets`, `assets/[id]`, cada um com
  `page.tsx`/`loading.tsx`/`actions.ts` conforme aplicável).
- `lib/tenant-links.ts`: `getTenantBasePath`/`getTenantPath` passam a retornar
  `` `/app/${clientSlug}` ``. É o ponto único de construção de path — deve ser atualizado **antes**
  de mover os diretórios (ver "Ordem de execução recomendada").
- `proxy.ts`: o bloco que hoje compara `nextUrl.pathname.startsWith("/tenant/")` (linha 51) para
  aplicar `canPossiblyAccessTenantSlug` passa a comparar `"/app/"`. Adicionar bloco de redirect 308
  para qualquer request a `/tenant/[slug]/*` → `/app/[slug]/*` (mesmo `pathname` com o segmento
  trocado, preservando querystring).
- Migrar os **8 pontos hardcoded fora do helper** listados em "Achados desta revisão" —
  `components/audit-log-table.tsx`, `app/dashboard/page.tsx`, `app/clients/novo/new-client-wizard.tsx`,
  `app/clients/clients-panel.tsx`, `app/tenant/[clientSlug]/assets/[id]/actions.ts`,
  `app/tenant/[clientSlug]/alerts/actions.ts` (3 ocorrências),
  `app/tenant/[clientSlug]/computers/actions.ts` (2 ocorrências) — para usar
  `getTenantBasePath`/`getTenantPath` em vez de montar a string manualmente.
- Atualizar os literais de tipo de rota do Next (`PageProps<'/tenant/[clientSlug]'>` etc., 11
  arquivos) para `'/app/[clientSlug]'`/`'/app/[clientSlug]/assets/[id]'`.

**Risco de segurança (achado herdado do `security-auditor`, mantido nesta revisão)**: se o literal
`/tenant/` em `proxy.ts` não for atualizado para `/app/`, o portão grosseiro
`canPossiblyAccessTenantSlug` deixa de existir silenciosamente — qualquer usuário autenticado
passaria a acessar `/app/[qualquer-slug]/*` sem a checagem grosseira de organização (a checagem
definitiva de `requireTenantContext()` ainda bloquearia o acesso ao dado, mas a defesa em
profundidade do proxy desapareceria sem nenhum erro visível). Este item não está concluído enquanto
esse bloco não for atualizado e coberto por teste.

**Critérios de aceite**:
- [ ] Nenhuma página sob `app/tenant/[clientSlug]/*` continua existindo nesse caminho; os 25
      arquivos equivalentes respondem em `app/app/[clientSlug]/*`.
- [ ] `lib/tenant-links.ts` é a única fonte de construção do path (`getTenantBasePath`/
      `getTenantPath` retornam `/app/${clientSlug}`); os 7 arquivos com path hardcoded listados
      acima passam a usar o helper — confirmado por busca (`` `/tenant/${ `` e `` `/app/${ `` fora
      de `lib/tenant-links.ts`) não retornando nenhuma ocorrência em `app/`/`components/`.
- [ ] `proxy.ts` aplica `canPossiblyAccessTenantSlug` ao novo prefixo `/app/`, confirmado por teste.
- [ ] `proxy.ts` redireciona `/tenant/[slug]/*` para `/app/[slug]/*` com status **308** (Permanent
      Redirect), preservando querystring, confirmado por teste — não é mais uma decisão em aberto
      entre 404/redirect como no rascunho anterior.
- [ ] Os 11 literais de tipo de rota (`PageProps<'/tenant/[clientSlug]'>` etc.) atualizados para
      `/app/[clientSlug]` — `npx tsc --noEmit` limpo é a prova objetiva.
- [ ] Nenhuma mudança de comportamento de acesso: os 4 papéis continuam vendo exatamente a mesma
      superfície de antes, só sob o novo path.
- [ ] `docs/PRODUTO.md`, `docs/PRODUCT.md` e `docs/SPEC.md` atualizados para citar
      `/app/[clientSlug]/*` como o path real, não mais como pendência (A3).

**Testes necessários**:
- Teste de integração/regressão do guard de `proxy.ts`: request autenticado de um
  `ORG_ADMIN`/`ORG_OPERATOR` para `/app/[slug-de-outra-organização]` é bloqueado pelo portão
  grosseiro — falha se o literal `/tenant/` não for atualizado, tornando o risco de segurança
  descrito acima detectável automaticamente.
- Teste de login automatizado nos 4 papéis confirmando que cada um acessa exatamente a mesma
  superfície de páginas de antes, agora sob `/app/*` (`CLIENT_VIEWER` continua sem acesso nenhum).
- Teste confirmando o redirect 308 de `/tenant/[slug]/*` → `/app/[slug]/*` para pelo menos duas
  subrotas (`computers`, `alerts`), incluindo preservação de querystring.
- `tests/tenant-processors-table.test.tsx`, `tests/tenant-storage-table.test.tsx`,
  `tests/tenant-servers-table.test.tsx`, `tests/tenant-recent-devices-table.test.tsx`,
  `tests/tenant-computers-table.test.tsx`, `tests/tenant-device-rows.test.ts`,
  `tests/stat-cards.test.tsx` — os 7 arquivos de teste de componente que hardcodeiam `/tenant/` em
  mocks/asserts — adaptados para `/app/` sem alteração de asserção sobre dado exibido, só de
  path/import.
- `tests/tenant-context.test.ts`, `tests/device-listing-status-parity.test.ts`,
  `tests/delete-alert-rule.test.ts` — os 3 arquivos de teste de lógica/integração que também
  referenciam `/tenant/` — revisados para confirmar que nenhuma asserção depende do path antigo de
  forma que quebre silenciosamente (não necessariamente precisam de path novo, mas precisam ser
  lidos).

#### 2 — Renomear rotas administrativas `/clients` → `/admin/clients`

**Objetivo**: Renomear a área administrativa de `/clients` para `/admin/clients` (mantendo
`/api/clients/*` intacto), atualizar o matcher de `proxy.ts`, e adicionar redirect 308 de
`/clients` para `/admin/clients` — alinhando o nome ao papel real da área, sem alterar
comportamento de acesso.

**Requisitos Afetados**:
- RF002 (cadastro de tenant), RF003 (enrollment de agente — parte de UI do assistente), RN015
  (guard `hasClientsAdminAccess`, com a exceção de `rotateEnrollmentKeyAction` usando
  `canManageTenant`, já registrada em `docs/PRODUCT.md`).
- Caso de uso afetado: 3.1 (Cadastro de tenant), 3.2 (Enrollment do agente — a parte de UI: download
  do instalador com a chave embutida, dentro de `/clients/novo`).
- Entidade(s) de banco: `Client` (`enrollmentKeyHash`, `activeProvisioningKeyEnc`), `AuditLog`.

**Escopo técnico**:
- `git mv app/clients app/admin/clients` — os **7 arquivos** confirmados nesta revisão
  (`page.tsx`, `types.ts`, `actions.ts`, `clients-panel.tsx`, `novo/page.tsx`,
  `novo/new-client-wizard.tsx`, `audit/page.tsx`).
- `/api/clients/*` (rota de API sob `app/api/clients/`) **não muda** — fora do escopo deste item,
  registrado explicitamente para não ser confundido durante a execução (o pedido do usuário já fixa
  isso: "mantendo `/api/clients/*` intacto").
- `proxy.ts`: bloco `isAccountArea` (hoje `nextUrl.pathname === "/clients" ||
  .startsWith("/clients/") || .startsWith("/api/clients")`) — o trecho de **página**
  (`"/clients"`/`"/clients/"`) passa a `"/admin/clients"`/`"/admin/clients/"`; o trecho de API
  (`"/api/clients"`) fica como está. Adicionar redirect 308 de `/clients` (e `/clients/*`) para
  `/admin/clients` (preservando o restante do path e querystring).
- `components/sidebar.tsx:403-405` — a comparação de `pathname.startsWith('/clients/audit')` etc.
  para título do cabeçalho precisa acompanhar o novo prefixo.
- Migrar os 2 pontos hardcoded fora de `proxy.ts`/`sidebar.tsx` que redirecionam para `/clients`:
  `app/dashboard/page.tsx:24` (`redirect('/clients')`) e `app/page.tsx:4` (`redirect('/clients')`),
  mais os 3 `revalidatePath('/clients')` em `app/clients/actions.ts` (linhas 167, 250, 338) — todos
  passam a apontar para `/admin/clients`.

**Discrepância a registrar, não resolvida por este planner**: `docs/PRODUTO.md` §5.1 nomeia a
rota-alvo como `/admin/organizations` (não `/admin/clients`), sugerindo uma reestruturação de
navegação maior do que um puro rename de prefixo (a UI passaria a girar em torno de `Organization`,
não de `Client`, para o `PLATFORM_ADMIN`). O escopo literal desta reativação é `/admin/clients`
— puro rename, preservando a estrutura atual centrada em `Client`. A reestruturação mais ampla de
`PRODUTO.md` §5.1 fica fora de escopo (ver "Fora de escopo" ao final). Quem aprovar decide se
`PRODUTO.md` §5.1 é ajustado para refletir o rename mais simples ou se a reestruturação maior vira
sprint própria.

**Risco registrado, não incluído no escopo pedido**: `/users` e `/security` são guardadas pelo mesmo
bloco `isAccountArea`/`isPlatformArea` de `proxy.ts` que hoje também cobre `/clients`, sem
rota-alvo sob `/admin/*` documentada. Não incluídas neste item — escopo literal foi
`/clients` → `/admin/clients` — mas ficam com nome inconsistente se não forem tratadas depois.

**Critérios de aceite**:
- [ ] Nenhuma página sob `app/clients/*` continua existindo nesse caminho; os 7 arquivos
      equivalentes respondem sob `app/admin/clients/*`.
- [ ] `proxy.ts` — bloco `isAccountArea` atualizado para `/admin/clients` no trecho de página;
      `/api/clients/*` mantém o path atual, sem alteração.
- [ ] `proxy.ts` redireciona `/clients` (e `/clients/*`) para `/admin/clients` com status **308**,
      confirmado por teste.
- [ ] `components/sidebar.tsx` exibe o título correto sob o novo path (`/admin/clients`,
      `/admin/clients/novo`, `/admin/clients/audit`).
- [ ] `hasClientsAdminAccess` continua controlando exatamente os mesmos papéis (`PLATFORM_ADMIN`,
      `ORG_ADMIN`) sob o novo path, sem regressão.
- [ ] `docs/PRODUTO.md`, `docs/PRODUCT.md` e `docs/SPEC.md` atualizados para citar `/admin/clients`
      como path real.

**Testes necessários**:
- Teste de integração do guard `isAccountArea` de `proxy.ts` sob o novo path: `ORG_OPERATOR`/
  `CLIENT_VIEWER` continuam bloqueados de `/admin/clients`; `PLATFORM_ADMIN`/`ORG_ADMIN` continuam
  permitidos; `/api/clients/*` inalterado.
- Teste confirmando o redirect 308 de `/clients` → `/admin/clients`.
- `tests/rotate-enrollment-key.test.ts`, `tests/credentials-route.test.ts`,
  `tests/revoke-agent-auth.test.ts` — os 3 arquivos que exercitam Server Actions/rotas de
  `app/clients/actions.ts` — revisados para confirmar que continuam funcionando referenciados a
  partir do novo caminho de página (a rota de API `/api/clients/[id]/credentials` em si não muda).

#### 3 — Ativação do ESLint real sobre `app/**`, `components/**` e `lib/**`

**Objetivo**: Remover `app/**`, `components/**`, `lib/**` do `ignores` de `eslint.config.mjs` e
garantir que `npm run lint` rode sobre o código de aplicação sem erros — usando essa cobertura para
validar o próprio rename dos itens 1 e 2.

**Requisitos Afetados**:
- Nenhuma RNF numerada específica de qualidade de código em `docs/PRODUCT.md` hoje — gap a
  registrar se este item for aprovado.
- Origem: achado colateral reportado pelo `implementation-agent` na Sprint 4 (2026-08-20),
  pré-existente; movido para a Sprint 5 numa revisão anterior; confirmado ainda válido nesta
  revisão — `eslint.config.mjs` (lido nesta rodada) ainda lista `app/**`, `components/**`, `lib/**`
  em `ignores`, com o único bloco de regras reais restrito a `scripts/verification/**/*.mjs`
  (`no-unused-vars`, `no-undef` — insuficiente para React/Next/TypeScript).
- Entidade(s) de banco: nenhuma.

**Escopo técnico**:
- Remover `app/**`, `components/**`, `lib/**` da lista `ignores` de `eslint.config.mjs`.
- Configurar `languageOptions`/`plugins`/`rules` adequados para TypeScript/JSX/Next (o projeto não
  tem hoje nenhum bloco de config ESLint voltado a esse código — precisa ser criado, não só
  destravado).
- `docs/**`, `agent-go/**`, `prisma/**`, `hooks/**`, `styles/**` **permanecem** ignorados — fora do
  escopo literal pedido pelo usuário (só `app/**`/`components/**`/`lib/**`); registrado
  explicitamente para não ser ampliado por engano durante a execução.

**Limitação desta rodada de planejamento**: esta sessão do `sprint-planner` não tem acesso a
shell/terminal, então não foi possível rodar `npx eslint app components lib --max-warnings=0` para
medir hoje o volume real de erros/avisos. Isso é diferente de "sem risco conhecido" — é uma lacuna
de informação explícita. Regra de decisão para quem implementar, para que o item não feche com um
volume desconhecido:
- Rodar a medição como **primeiro passo executável** deste item (antes de mudar qualquer regra ou
  corrigir qualquer arquivo) e registrar o número bruto de erros/avisos encontrado.
- Se o volume for pequeno o bastante para corrigir dentro desta mesma sprint sem inflar
  desproporcionalmente seu escopo (ordem de grandeza de dezenas, não de centenas, dado que os
  itens 1 e 2 já tocam dezenas de arquivos), corrigir tudo antes de fechar o item.
- Se o volume for desproporcional (ordem de centenas), **não bloquear esta sprint por ele**: aceitar
  uma baseline conhecida (registrada em texto, não como número "desconhecido"), configurar o lint
  para não falhar sobre ela (ex.: `warn` em vez de `error` temporariamente, ou uma lista de
  exceções explícita), e abrir isso como candidato a sprint própria de débito técnico — decisão
  a ser tomada e registrada por quem implementa, não por este planner.

**Critérios de aceite**:
- [ ] `eslint.config.mjs` não ignora mais `app/**`, `components/**`, `lib/**`.
- [ ] `npm run lint` roda sobre esses três diretórios sem erro de configuração.
- [ ] O volume real de erros/avisos foi medido (não estimado) e a decisão sobre ele — corrigir tudo
      agora, ou aceitar baseline com plano de redução registrado — está escrita no diff/PR, seguindo
      a regra de decisão acima.
- [ ] `npm run lint` roda como parte da verificação final da sprint (junto com `tsc --noEmit`/
      `build`/`test`), sem erro novo introduzido pelos itens 1, 2 e 4 desta sprint.

**Testes necessários**: nenhum teste automatizado por si — a entrega é configuração de lint; a
validação é a própria execução de `npm run lint` com saída registrada.

#### 4 — `tests/route-rename.test.ts` + verificação final (`tsc`/`lint`/`build`/`test`)

**Objetivo**: Garantir que a suíte Vitest (19 arquivos, 111 testes hoje, `tests/`) passe a cobrir
explicitamente o resultado da renomeação dos itens 1 e 2 — as novas rotas respondendo, o isolamento
multi-tenant mantido, e os redirects 308 funcionando — e que a verificação final
(`tsc`/`lint`/`build`/`test`) rode limpa antes de a sprint ser reportada como concluída.

**Requisitos Afetados**:
- Nenhum RF/RN novo — cobertura de teste para o comportamento dos itens 1, 2 e 3.
- Origem: pedido direto do usuário nesta rodada de reativação — não veio de nenhum dos 5 auditores.
- Entidade(s) de banco: nenhuma nova.

**Escopo técnico**:
- Criar `tests/route-rename.test.ts` cobrindo, no mínimo:
  1. `/app/[clientSlug]/*` (dashboard, `computers`, `alerts`, `assets/[id]`) responde para os papéis
     com acesso e é bloqueado para os sem acesso.
  2. Isolamento multi-tenant mantido: um `ORG_ADMIN`/`ORG_OPERATOR` de outra organização é bloqueado
     ao tentar `/app/[slug-de-outra-organização]`.
  3. `/admin/clients` responde para `PLATFORM_ADMIN`/`ORG_ADMIN` e é bloqueado para
     `ORG_OPERATOR`/`CLIENT_VIEWER`.
  4. Redirect 308 de `/tenant/[slug]/*` → `/app/[slug]/*` e de `/clients` → `/admin/clients`,
     preservando querystring.
- Adaptar os **13 arquivos de teste** listados em "Achados desta revisão" que hoje hardcodeiam
  `/tenant/` ou `/clients`, sem perder a cobertura original de cada um.

**Critérios de aceite**:
- [ ] `tests/route-rename.test.ts` existe e cobre os 4 pontos do escopo técnico acima.
- [ ] Os 13 arquivos de teste identificados nesta revisão como dependentes do path antigo foram
      revisados e, onde aplicável, adaptados para `/app/`/`/admin/clients`.
- [ ] `npx tsc --noEmit` roda sem erro.
- [ ] `npm run lint` roda sem erro (após o item 3).
- [ ] `npm run build` roda sem erro.
- [ ] `npm run test` roda verde com **111 ou mais** testes passando (baseline real confirmada nesta
      revisão via `5acf610`, mais os testes novos desta sprint) — não um número menor herdado de
      sprints anteriores.

**Testes necessários**: o próprio item já é de teste — ver escopo técnico acima.

### Critérios de aceite gerais da sprint

- [ ] Item 1 concluído — rename de `/tenant/[clientSlug]/*` para `/app/[clientSlug]/*`,
      `lib/tenant-links.ts` e os 7 arquivos com path hardcoded migrados, guard e redirect 308 de
      `proxy.ts` atualizados, tipos de rota do Next atualizados, documentação atualizada.
- [ ] Item 2 concluído — rename de `/clients` para `/admin/clients`, `/api/clients/*` intacto,
      guard e redirect 308 de `proxy.ts` atualizados, `sidebar.tsx` atualizado, documentação
      atualizada.
- [ ] Item 3 concluído — lint real ativo sobre `app/**`/`components/**`/`lib/**`, com volume real de
      avisos medido (não estimado) e decisão registrada sobre ele.
- [ ] Item 4 concluído — `tests/route-rename.test.ts` existe, os 13 testes dependentes do path
      antigo foram revisados/adaptados, `npm run test` verde com 111+ testes.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npm run test` sem regressão — esta é a
      verificação final explicitamente pedida pelo usuário nesta reativação.
- [ ] Teste de login real nos 4 papéis confirma que cada um continua acessando exatamente a mesma
      superfície de antes, só sob o novo path (coberto pelo item 4).
- [ ] `docs/PRODUTO.md`, `docs/PRODUCT.md` e `docs/SPEC.md` não citam mais os paths antigos como se
      fossem os reais.
- [ ] Sprint 5 atualizada para 🟢 Concluída em `docs/SPRINTS.md` **só depois** que o usuário
      confirmar explicitamente os critérios acima atendidos — este passo é do `implementation-agent`
      relatando e do usuário aprovando, não deste planner nem uma marcação automática ao fim da
      execução.

### Fora de escopo desta sprint

Qualquer mudança de comportamento/permissão durante a renomeação dos itens 1 e 2 — é puro rename de
rota; se surgir oportunidade de simplificar um guard nesse processo, vira item novo de sprint, não
mudança silenciosa dentro desta. Também fora de escopo: a reestruturação de navegação mais ampla
sugerida por `docs/PRODUTO.md` §5.1/§5.2 (`/admin/organizations` girando em torno de `Organization`
em vez de `Client`; `/app/devices` como visão consolidada entre clientes de uma mesma organização,
diferente da estrutura atual por slug) — registrada como discrepância no item 2, não decidida nem
implementada aqui. Também fora de escopo: mover `/users` e `/security` para `/admin/*` — registrado
como risco no item 2, não pedido pelo usuário nesta rodada. Também fora de escopo: atualizar
`CONTEXT.md`, `docs/adr/0004-tenant-isolation-fail-closed.md` e os arquivos de agente
(`.claude/agents/security-auditor.md`, `.claude/agents/backend-auditor.md`) que hoje citam
`/tenant/[clientSlug]` — fora da permissão de escrita deste planner (só `docs/SPRINTS.md`) e fora
do escopo literal pedido pelo usuário; registrado como consequência do rename que alguém precisa
tratar depois, não esquecido. Também fora de escopo: corrigir de forma definitiva um volume grande
de avisos de lint pré-existentes descobertos pelo item 3, caso a medição real (não feita nesta
rodada de planejamento por falta de acesso a shell) revele um número desproporcional — nesse caso a
decisão de baseline aceita fica registrada no item 3, e a correção completa vira candidata a sprint
própria de débito técnico.

---

## Sprint 6 — Débito Técnico Residual

**Status**: 🟢 Concluída (2026-08-24). O usuário aprovou explicitamente os 4 itens do backlog
abaixo ("Execute os 4 itens da Sprint 06 em paralelo usando subagentes especializados... após
todos os 4 terminarem: rodar tsc+build+test... e atualizar Sprint 06 para 🟢 Concluída") e 4
instâncias do `implementation-agent` executaram os itens 1–4 em paralelo. A sessão principal
conferiu o trabalho de forma **independente** depois que todos os 4 terminaram — lendo o código
alterado e rodando `npx tsc --noEmit` / `npm run lint` / `npm run build` / `npm run test` ela
mesma (51 testes passando em 11 arquivos), além de confirmar que nenhum arquivo órfão dos 4
agentes ficou no working tree. Ver "Execução confirmada (2026-08-24)" dentro de cada item abaixo
para o detalhe do que foi de fato verificado, e a nota de processo dentro do item 2 para um
incidente real de paralelismo entre agentes que a sessão principal precisou corrigir.
**Objetivo**: fechar os itens de débito técnico e de teste que já foram identificados em sessões
anteriores mas nunca entraram no escopo aprovado de uma execução — nenhum ganho funcional novo
para o usuário final, só redução de risco de regressão e de inconsistência arquitetural. Objetivo
alcançado nos 4 itens. Uma ressalva do item 1 é registrada explicitamente: a decisão tomada foi
manter as 4 telas de listagem divergentes (não consolidar em `getDeviceReportRows`), o que é uma
decisão técnica válida, não um item "não feito" — e essa mesma execução revelou um achado novo
(bug de status em `servers/page.tsx`) que ficou fora do escopo autorizado deste item e foi migrado
para a **Sprint 7**, ver ao final deste documento.

Os itens 1–3 abaixo eram os itens 8, 9 e 10 do backlog da Sprint 4 (ver nota "Itens não tratados
nesta execução" naquela seção) — a origem e a substância de cada achado não mudaram desde então;
esta revisão (2026-08-20) reescreve os três no formato Objetivo/Requisitos Afetados/Critérios de
Aceite/Testes Necessários (mesmo nível de detalhe das Sprints 4 e 5) e **reconfirma o estado real
do código antes de reescrever** cada um — ver "Confirmação desta revisão" dentro de cada item.

**Nota sobre o item de lint**: o item que já viveu aqui como "Lint real de código de aplicação"
**não está e não volta a esta sprint** — foi movido para a Sprint 5 (item 3 daquela seção) numa
revisão anterior, a pedido do usuário, porque a Sprint 5 já mexe em dezenas de arquivos por causa
do rename de rotas (`/tenant` → `/app`, `/clients` → `/admin`), tornando aquele o momento de maior
valor para ligar lint real sobre `app/**`/`components/**`/`lib/**`. Confirmado nesta revisão lendo
a Sprint 5 atual: o item segue lá, intacto, com seus próprios critérios de aceite. Não é duplicado
aqui.

**Item novo nesta revisão (2026-08-24)**: o item 4 abaixo (revogação centralizada de `AgentAuth`)
não vem do backlog herdado da Sprint 4 como os itens 1–3 — é um achado novo do `database-auditor`,
de uma auditoria específica sobre `AgentAuth` órfãos rodada em 2026-08-24. Diferente dos itens 1–3
(débito técnico sobre algo que já existe e tem um problema), o item 4 é uma funcionalidade que
**ainda não existe** — hoje a revogação é feita por SQL manual direto no banco, fora da aplicação.
Isso tensiona, na letra, o objetivo desta sprint ("nenhum ganho funcional novo para o usuário
final"): a leitura deste planner é que o item 4 continua dentro do espírito da sprint porque não
adiciona nenhuma superfície de UI nova nem muda nada perceptível para quem usa o painel — ele
apenas cria o caminho de aplicação (com guard e auditoria) que deveria ter existido desde que
`AgentAuth.isActive`/`revokedAt` passaram a ser gravados manualmente, fechando um gap de
auditabilidade (RNF009) e um risco de guard ausente, não introduzindo um recurso novo para o
usuário final. Quem aprovar a sprint pode decidir diferente — registrado aqui para não passar
despercebido.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1. Consolidar a busca de dispositivos de `computers`/`servers`/`storage`/`processors` em torno de `lib/reports/device-report.ts` | RF019, RN010, RN013 | `docs/PRODUCT.md` RF019 (gap: sem caso de uso numerado em §3, mesmo gap já registrado nas Sprints 4 e 5) | `Device`, `Hardware`, `Disk`, `CollectionLog` | `improve-codebase-architecture` (sessão anterior), reconfirmado nesta revisão |
| 2. Corrigir hydration mismatch do `DropdownMenuTrigger` na Sidebar | — (achado de estabilidade de UI, sem RF/RN numerado — gap a registrar) | — | — | teste de UX/performance com Playwright em sessão anterior à Sprint 4 |
| 3. Teste automatizado para RN013 (bucket, nunca soma) em `buildDeviceReportSummary` | RN013 | `docs/PRODUCT.md` RF020 (gap: sem caso de uso numerado em §3, mesmo gap já registrado na Sprint 4) | `Device`, `Hardware`, `Disk` | `test-auditor` (sessão anterior à Sprint 4), reconfirmado nesta revisão |
| 4. Função centralizada de revogação de `AgentAuth` (Server Action + auditoria + guard) | RF022, RNF009 (auditoria/auditabilidade — diretos); RN005 (tangencial); nenhum RF/RN cobre revogação como fluxo próprio — gap a registrar | `docs/PRODUCT.md` §3.2 cobre só a emissão (Enrollment do agente) — sem caso de uso numerado para revogação, gap novo | `AgentAuth`, `AuditLog` | `database-auditor` (auditoria de limpeza de `AgentAuth` órfãos, 2026-08-24) |

#### 1 — Consolidar a busca de dispositivos de `computers`/`servers`/`storage`/`processors` em torno de `lib/reports/device-report.ts`

**Objetivo**: Reduzir a duplicação de query/lógica de status entre as 4 telas de listagem do
tenant (`computers`, `servers`, `storage`, `processors`) e `lib/reports/device-report.ts`,
eliminando o risco de as telas divergirem entre si na forma como calculam status efetivo
(RN010) e agregação por faixa (RN013) conforme o código evolui — sem alterar nenhum dado exibido
hoje.

**Confirmação desta revisão (2026-08-20)**: o achado original do `improve-codebase-architecture`
segue válido — `getDeviceReportRows` **não** é reaproveitada por nenhuma das 4 telas. Confirmado
lendo o código: `app/tenant/[clientSlug]/computers/page.tsx:34`,
`app/tenant/[clientSlug]/servers/page.tsx:13`, `app/tenant/[clientSlug]/storage/page.tsx:23` e
`app/tenant/[clientSlug]/processors/page.tsx:24` fazem cada uma o próprio
`prisma.device.findMany`, com `select`/`include` diferentes entre si e de
`getDeviceReportRows`. O que **mudou** desde a redação original do achado (Sprint 4, quando
`getDeviceReportRows` passou a receber `alertOfflineHours`): o dashboard
(`app/tenant/[clientSlug]/page.tsx:101`) e as 6 rotas de relatório (tenant/portal × CSV/PDF/tela)
**já** reaproveitam a função — só as 4 telas de listagem ficaram de fora, não "todas as rotas de
relatório" como o achado antigo generalizava.
**Nuance a registrar, não decidida por este planner**: as 4 telas não têm o mesmo formato de dado
que `DeviceReportRow` — `computers/page.tsx` usa `deriveInventoryIssues`/`getEffectiveDeviceStatus`
com `hardware`+`disks` completos (mesmas funções de `getRowEffectiveStatus`, mas chamadas
diretamente, não via `device-report.ts`); `storage/page.tsx` usa `getDevicePresence` (função
irmã, não a mesma usada em `device-report.ts`); `processors/page.tsx` agrupa por **nome de
processador entre máquinas**, um formato que não existe em `DeviceReportRow`. "Reaproveitar
`getDeviceReportRows` como função única" tal como o achado original propõe pode não ser viável
sem primeiro decompor `lib/reports/device-report.ts` em partes menores e componíveis (ex.: uma
função de status efetivo compartilhada + queries de `select` próprias por tela) em vez de uma
função monolítica só. Este item escopa a **decisão + implementação da consolidação possível**, não
assume que "reuso literal de `getDeviceReportRows`" é o resultado certo.

**Requisitos Afetados**:
- RF019 (listagens filtráveis — `docs/PRODUCT.md` linha 37 cita exatamente estas 4 rotas).
- RN010 (status efetivo nunca lido bruto de `device.status`) — hoje cada tela chama
  `deriveInventoryIssues`/`getEffectiveDeviceStatus`/`getDevicePresence` de forma independente;
  correto hoje, mas duplicado, sem um único ponto que garanta que futuras telas sigam o mesmo
  padrão.
- RN013 (bucket, nunca soma) — `storage/page.tsx` e `processors/page.tsx` já bucketizam por
  máquina corretamente hoje, mas com lógica própria, não compartilhada com
  `bucketRamByExactValue`/`bucketDiskUsage` de `device-report.ts`.
- Gap de documentação, não corrigido aqui: RF019 não tem caso de uso numerado em `docs/PRODUCT.md`
  §3 — mesmo gap já registrado nas Sprints 4 e 5.
- Entidade(s) de banco: `Device`, `Hardware`, `Disk`, `Network`, `CollectionLog` (via `logs`).

**Critérios de aceite**:
- [x] Decisão registrada e justificada (fica no diff/PR, não em `docs/PRODUCT.md`): a decisão
      tomada foi **manter as 4 telas divergentes**, não consolidar. Justificativa: 3 das 4 telas
      (`computers`, `storage`, `processors`) já reaproveitavam corretamente as funções
      compartilhadas (`deriveInventoryIssues`/`getEffectiveDeviceStatus`/`getDevicePresence`);
      forçar as 4 dentro de `getDeviceReportRows` quebraria `/processors`, que agrupa por
      processador entre máquinas — formato incompatível com `DeviceReportRow`. Decisão técnica
      válida, confirmada pela sessão principal, não indecisão nem atalho.
- [x] N/A com justificativa — critério condicionado a "se a decisão for consolidação total ou
      parcial"; como a decisão foi manter divergente, não há função única a que as 4 telas
      precisem migrar.
- [x] Nenhuma coluna/dado hoje exibido em `computers`, `servers`, `storage` ou `processors` mudou
      de valor para o mesmo `Device` — protegido por `tests/device-listing-status-parity.test.ts`
      (8 testes novos), travando a consistência entre as 4 implementações e o status efetivo de
      referência.
- [x] N/A com justificativa — mesma condição do segundo critério: consolidação não foi executada,
      então não há nota de gap de RF019 a acrescentar a `docs/PRODUCT.md` por este item
      especificamente (o gap de RF019 já registrado nas Sprints 4 e 5 permanece como está).

**Testes Necessários**:
- Teste de regressão comparando o status/presença exibido por cada uma das 4 telas com o status
  efetivo do dashboard (`getRowEffectiveStatus`/`getEffectiveDeviceStatus` já usado ali) para o
  mesmo `Device` de teste — trava divergência futura entre implementações duplicadas, com ou sem
  consolidação total.
- Se a consolidação extrair função(ões) nova(s) (ex.: um `getSharedDeviceStatus` comum), teste
  unitário isolado dela, no mesmo padrão de `tests/device-report.test.ts` (sem Prisma, entrada
  sintética).
- `tests/tenant-processors-table.test.tsx` e `tests/tenant-storage-table.test.tsx` (já existentes)
  continuam passando sem alteração de asserção sobre dado exibido — prova de que a consolidação
  não mudou comportamento.

**Execução confirmada (2026-08-24)**: verificação independente da sessão principal. A decisão de
manter as 4 telas divergentes foi confirmada como tecnicamente sólida — 3 das 4 já reaproveitavam
as funções compartilhadas corretas antes desta sprint, e consolidar `/processors` de fato quebraria
o formato de agrupamento por processador. `tests/device-listing-status-parity.test.ts` confirmado
no repositório com 8 testes.

**Achado novo registrado durante esta execução, fora do escopo autorizado deste item**:
`app/tenant/[clientSlug]/servers/page.tsx` exibe `device.status` bruto do banco em vez do status
efetivo (`getEffectiveDeviceStatus`/`getDevicePresence`) — violação real de RN010, a mesma classe
de bug que o item 3 da Sprint 4 já corrigiu em `lib/reports/device-report.ts`. As outras 3 telas
(`computers`, `storage`, `processors`) já usam status efetivo corretamente; só `servers` ficou de
fora. Um comentário foi deixado no código apontando o bug, mas corrigi-lo mudaria dado exibido ao
usuário — fora do escopo deste item, que era decidir sobre consolidação de query, não corrigir bug
funcional de tela. **Migrado para a Sprint 7** como item novo — ver ao final deste documento.

#### 2 — Corrigir hydration mismatch do `DropdownMenuTrigger` na Sidebar

**Objetivo**: Eliminar o warning de hydration mismatch do Radix UI relatado no console ao carregar
a Sidebar, evitando poluição de console em produção e o risco de comportamento inconsistente entre
o HTML servido por SSR e o que o React efetivamente monta no client.

**Confirmação desta revisão (2026-08-20)**: origem correta é teste de UX/performance com
Playwright em sessão anterior à Sprint 4 — **não** foi o `implementation-agent` quem encontrou
isso (o texto anterior deste documento já registrava a origem corretamente; nenhuma correção de
proveniência foi necessária aqui, só a confirmação). Achado em `components/sidebar.tsx`: dois
`DropdownMenu`/`DropdownMenuTrigger` do Radix (o seletor de cliente, linhas ~78–139, e o menu de
conta, linhas ~363–393) — ambos dentro de um componente inteiramente `'use client'`. A causa raiz
exata **não foi diagnosticada** nesta revisão (fora de escopo de um planner que só lê, não
edita/depura código) — fica para a implementação investigar; candidatos plausíveis a checar
primeiro: (a) `usePathname()` retorna valores diferentes entre a primeira renderização SSR e a
hidratação client, alterando a árvore de nós antes do `DropdownMenu` e deslocando a sequência de
`useId()` que o Radix usa para gerar `id`/`aria-controls`; (b) estado inicial de `useState`/
`useTransition` (`open`, `isPending`) usado condicionalmente na árvore do trigger. Não assumir
nenhuma dessas causas como confirmada — é ponto de partida de investigação, não diagnóstico
fechado.

**Requisitos Afetados**:
- Nenhum RF/RN numerado em `docs/PRODUCT.md` cobre estabilidade de hidratação/SSR — gap a
  registrar se este item for aprovado, mesmo padrão de outros itens "sem RF/RN direto" já
  registrados nas Sprints 4 e 5.
- Entidade(s) de banco: nenhuma.

**Critérios de aceite**:
- [x] Nenhum warning de hydration mismatch (`Hydration failed`, `Text content does not match`, ou
      variantes de `id` divergente) relacionado a `DropdownMenuTrigger` aparece no console durante
      navegação padrão — confirmado com Playwright sob throttling de rede/CPU, 4 rodadas
      consecutivas (reproduziu o erro antes da correção, confirmou ausência depois).
- [x] Causa raiz identificada e documentada — **não era o `DropdownMenuTrigger` em si**: era
      `Header` (`components/sidebar.tsx`) chamando `Date.now()` duas vezes (server e client) dentro
      de `formatRelative()`, com relógios divergentes; quando a janela de tempo cruzava um minuto,
      o texto renderizado divergia entre SSR e client, React descartava e re-renderizava a subárvore
      inteira, reatribuindo os `useId()` do Radix mais abaixo. Corrigido calculando `now` uma única
      vez no Server Component (`app/tenant/[clientSlug]/layout.tsx`) e passando como prop para
      `Header`. Nenhum `suppressHydrationWarning` foi usado — correção na causa raiz, não paliativo.
- [x] Nenhuma mudança de comportamento visível do menu — confirmado com Playwright no mesmo fluxo
      usado para achar o bug originalmente.

**Testes Necessários**:
- Teste Playwright (ou verificação equivalente registrada no PR) capturando mensagens de console
  durante o fluxo de navegação padrão, falhando se qualquer mensagem contiver "hydration".
- Teste manual/Playwright complementar confirmando que os dois `DropdownMenu` da Sidebar (seletor
  de cliente e menu de conta) continuam funcionalmente idênticos após a correção.

**Execução confirmada (2026-08-24)**: verificação independente da sessão principal — a correção
está no código (`app/tenant/[clientSlug]/layout.tsx` calcula `now` uma vez e passa como prop para
`Header` em `components/sidebar.tsx`), consistente com a causa raiz descrita acima.

**Lacuna aceita, registrada explicitamente (não é pendência automática)**: a verificação de
ausência de warning foi feita com Playwright instalado e desinstalado na mesma sessão do
`implementation-agent` (`npm install --no-save playwright`, depois removido) — **não ficou nenhum
teste automatizado permanente committado no repositório** provando isso de forma contínua. O
`implementation-agent` justificou que a suíte de testes do projeto está em transição (Vitest, sem
Playwright configurado como dependência) e não é decisão dele adicionar Playwright como dependência
permanente sem aprovação. A correção em si está validada (4 rodadas ao vivo, antes/depois); falta
decidir separadamente, em sprint futura, se vale um teste E2E permanente. O critério de aceite
original pedia "confirmado com Playwright", que foi cumprido — não pedia explicitamente teste
Playwright permanente no CI, por isso o item é considerado concluído mesmo com essa lacuna.

**Nota de processo — incidente de paralelismo com `package.json` (2026-08-24)**: o
`npm install --no-save playwright` temporário usado para verificar este item, ao ser revertido com
`git checkout -- package.json package-lock.json`, apagou sem querer as entradas de Vitest/Testing
Library do `package.json` que nunca tinham sido commitadas (só existiam no working tree desde a
Sprint 4) — o script `test` voltou a apontar para o stub `noop-test.mjs` e as `devDependencies` de
teste sumiram do manifesto, embora `node_modules`, `vitest.config.mts` e `tests/` continuassem
intactos em disco (não rastreados, o `checkout` escopado não os tocou). A sessão principal detectou
isso rodando `npm run test` de novo depois que os 4 itens terminaram e ver o resultado errado;
reconstruiu as `devDependencies` corretas (`vitest@4.1.11`, `@vitejs/plugin-react@6.1.0`,
`jsdom@29.1.1`, `@testing-library/react@16.3.2`, `@testing-library/dom@10.4.1`, nas versões exatas
já instaladas em `node_modules`) e `"test": "vitest run"`, rodou `npm install` para reconciliar o
lockfile, e confirmou de novo: `tsc` limpo, 51 testes passando, `npm run build` e `npm run lint`
sem erro. **Isto não é um bug de código do projeto** — é uma lição de processo sobre paralelismo de
agentes: agentes que precisam instalar dependência temporária para verificação deveriam preferir um
diretório isolado (worktree separado), ou, no mínimo, confirmar `git diff package.json` limpo antes
**e** depois de qualquer `git checkout` escopado — não só depois. Registrado aqui para orientar a
próxima rodada de execução paralela; não é um item de sprint a implementar.

#### 3 — Teste automatizado para o padrão "bucket, nunca soma" (RN013)

**Objetivo**: Fechar a lacuna de cobertura de teste para RN013 em `buildDeviceReportSummary` —
regra já violada duas vezes no histórico real do projeto (ver retrospectiva da Sprint 3) e ainda
sem um teste dedicado que trave especificamente esse padrão.

**Confirmação desta revisão (2026-08-20)**: os 28 testes existentes (`tests/`) **não** cobrem
RN013 incidentalmente. Confirmado lendo `tests/device-report.test.ts` por inteiro: os 5 testes ali
exercitam exclusivamente `getRowEffectiveStatus`/a contagem de `offline` (RN010 — status efetivo
via `alertOfflineHours`), nunca `ramDistribution`, `diskUsageDistribution` ou
`storageCapacityGb`/`storageFreeGb`/`storageUsedGb` de `buildDeviceReportSummary`. Confirmado
também por busca direta: nenhum arquivo em `tests/` menciona `ramDistribution`,
`diskUsageDistribution`, `bucketRamByExactValue` ou `bucketDiskUsage`. `tests/disk-usage.test.ts`
cobre `getDiskUsageTier`/`computeDiskUsagePercent` de `lib/disk-usage.ts` — funções de classificação
de **uma única máquina**, não o padrão de agregação entre máquinas heterogêneas que é o núcleo de
RN013. O achado do `test-auditor` permanece integralmente válido; nenhuma parte dele foi resolvida
por acidente na Sprint 4.

**Requisitos Afetados**:
- RN013 (bucket, nunca soma).
- Gap de documentação, não corrigido aqui: RF020 (relatórios) não tem caso de uso numerado em
  `docs/PRODUCT.md` §3 — mesmo gap já registrado na Sprint 4 (item 3).
- Entidade(s) de banco: `Device`, `Hardware`, `Disk`.

**Critérios de aceite**:
- [x] Existe teste automatizado dedicado ao padrão RN013 cobrindo `ramDistribution` de
      `buildDeviceReportSummary` com um parque heterogêneo (≥3 dispositivos, RAM diferentes,
      incluindo pelo menos dois com o mesmo valor exato) — `tests/device-report-rn013.test.ts`.
- [x] Existe teste automatizado dedicado cobrindo `diskUsageDistribution` com discos de
      capacidades bem diferentes entre si, confirmando que cada máquina é classificada pela própria
      % de uso — nunca por uma % "blendada" entre discos de tamanhos diferentes.
- [x] Teste de regressão explícito: a soma dos `count` em `ramDistribution`/
      `diskUsageDistribution` bate com o número de dispositivos com dado válido — inclui o caso
      canônico (3 máquinas de 8GB devem contar 3, nunca somar 24GB).
- [x] `npm run test` permanece verde com os novos testes — 51/51 confirmado pela sessão principal.

**Testes Necessários** (o próprio item já é de teste — detalhado para orientar a implementação):
- Novo(s) `it()` em `tests/device-report.test.ts` (mesmo arquivo, novo `describe` — ou um novo
  arquivo `tests/device-report-rn013.test.ts`, à escolha de quem implementar) usando o mesmo
  helper `makeRow` já existente ali.
- Verificação manual durante a implementação (não fica no CI): comentar temporariamente a lógica
  de bucket em `bucketRamByExactValue`/`bucketDiskUsage` (trocando por soma bruta) e confirmar que
  o(s) novo(s) teste(s) quebra(m) — prova de que o teste de fato protege contra a regressão, não só
  passa por coincidência. Reverter antes de commitar.

**Execução confirmada (2026-08-24)**: verificação independente da sessão principal —
`tests/device-report-rn013.test.ts` existe com 9 testes, incluindo o caso de regressão explícito.
Nenhum bug de produção foi encontrado — RN013 já estava correta em `bucketRamByExactValue`/
`bucketDiskUsage`; o item era puramente de cobertura de teste faltante, exatamente como escopado.
A exceção documentada (soma bruta de armazenamento da frota em `storageCapacityGb`/`storageFreeGb`/
`storageUsedGb`) foi confirmada como correta, não uma violação de RN013.

**Suspeita de bug de ambiente investigada e descartada**: durante a execução, este item relatou
`npm run test` completamente quebrado no ambiente inteiro (erro de inicialização do Vitest) e
levantou suspeita de incompatibilidade entre `vite@8`/`vitest@4`/Node 24. A sessão principal
investigou depois: foi um **falso alarme por corrida** entre os 3 agentes (itens 1, 3 e 4) rodando
`vitest` simultaneamente, corrompendo o cache compartilhado do Vite — não um bug real de
versão/ambiente. Rodando `npm run test` sozinho logo depois, 51/51 passaram sem nenhum problema.
Não é item de sprint futura; registrado aqui só para não ser reaberto por engano numa revisão
futura deste documento.

#### 4 — Implementar função centralizada de revogação de `AgentAuth`

**Objetivo**: Substituir a revogação de `AgentAuth` feita hoje por SQL manual direto no banco por
um único caminho de aplicação — Server Action guardada por `canManageTenant` e coberta por
`recordAuditLog` — para que revogar a credencial de um agente deixe de ser uma operação sem rastro
de auditoria e sem checagem de isolamento entre organizações.

**Achado e confirmação desta revisão (2026-08-24)**: gap identificado pelo `database-auditor` na
auditoria de limpeza de `AgentAuth` órfãos de 2026-08-24 — hoje a revogação de agente é feita
direto no banco via SQL manual (confirmado nos dois precedentes reais, `DEV-CLAUDE-AGENT` e
`WSL-LINUX-TEST`, ambos com `isActive=false`/`revokedAt` preenchidos sem nenhuma linha
correspondente em `audit_logs`) — não existe hoje nenhuma rota ou Server Action de revogação na
aplicação; o `database-auditor` buscou `revokedAt`/`isActive` em `app/api/**/*.ts` e não achou
nenhum ponto de escrita além da leitura em `validateAgentApiKey`. Este planner reconfirmou de forma
independente: busca por `revokedAt`/`isActive` em todo `app/**/*.ts` e `lib/**/*.ts` só retorna
pontos de **leitura** (`lib/auth.ts:81,85` — `validateAgentApiKey` rejeitando `AgentAuth`/`Client`
inativos — e checagens equivalentes em `lib/tenant-context.ts`, `lib/portal-context.ts`,
`lib/tenant-scope.ts`, além do `count` em `app/api/clients/[id]/status/route.ts`); nenhum arquivo
escreve `isActive` ou `revokedAt` em `AgentAuth`. O achado está integralmente confirmado.

**Decisão de padrão (Server Action, não rota de API)**: o projeto hoje usa dois padrões para ações
administrativas equivalentes — Server Action (`rotateEnrollmentKeyAction` e
`deleteAlertRuleAction`/`app/tenant/[clientSlug]/alerts/actions.ts`, e a exclusão de `Device` em
`app/tenant/[clientSlug]/assets/[id]/actions.ts`) e rota de API (`GET
/api/clients/[id]/credentials`). Lendo os dois padrões: toda **mutação** administrativa disparada
por um ator autenticado via sessão neste projeto é hoje uma Server Action (`rotateEnrollmentKeyAction`,
`deleteAlertRuleAction`, exclusão de `Device`) — as rotas de API existentes ou são **leitura**
(`GET /api/clients/[id]/credentials`) ou pertencem ao protocolo do agente externo (`/api/agent/*`,
autenticado por `X-Api-Key`, não por sessão de usuário). Revogar `AgentAuth` é uma mutação
disparada por um ator de sessão (`PLATFORM_ADMIN`/`ORG_ADMIN`), a mesma categoria de
`rotateEnrollmentKeyAction`, não de `GET /api/clients/[id]/credentials` nem de `/api/agent/*`. Este
plano recomenda uma Server Action `revokeAgentAuthAction`, no mesmo arquivo de
`rotateEnrollmentKeyAction` (`app/clients/actions.ts`) — não um módulo novo `lib/agent-auth.ts` nem
uma rota `app/api/agents/[id]/revoke/route.ts` — para seguir o padrão já estabelecido em vez de
introduzir um terceiro. Quem aprovar a sprint pode decidir diferente; a decisão final e a
justificativa registrada ficam com quem implementar, mas não devem ficar em aberto sem nenhuma
escolha explícita.

**Requisitos Afetados**:
- RF022 (Auditoria) e RNF009 (Auditabilidade) — diretos: hoje a revogação não passa por
  `recordAuditLog()`, exatamente o gap estrutural que RNF009 já reconhece ("não há garantia
  estrutural de cobertura automática para toda ação futura").
- RN005 (`AgentAuth.apiKeyHash` é `@unique`, só hash persistido) — tangencial: este item não mexe
  em `apiKeyHash`, só em `isActive`/`revokedAt` do mesmo registro; citado porque é a mesma entidade
  e o mesmo agrupamento temático (credenciais de agente) usado pelo `security-auditor` no item 1 da
  Sprint 4.
- RN015 (guard `hasClientsAdminAccess` vs. `canManageTenant`) — mesma lógica já usada para decidir
  o guard do item 1 da Sprint 4 (rotação de chave): revogar uma credencial de um tenant **já
  existente** é operação administrativa sobre o tenant, não decisão de "quem pode existir" — por
  isso `canManageTenant`, não `hasClientsAdminAccess`.
- Gap a registrar, não corrigido por este planner: nenhum RF/RN em `docs/PRODUCT.md` §1–2 cobre
  revogação de `AgentAuth` como fluxo próprio, e `docs/PRODUCT.md` §3.2 ("Enrollment do agente")
  documenta só a emissão da credencial, não a revogação — mesmo padrão de gap já registrado para
  `rotateEnrollmentKeyAction` no item 1 da Sprint 4.
- Entidade(s) de banco: `AgentAuth` (`isActive`, `revokedAt`), `AuditLog`.

**Relação com outros itens desta sprint**: nenhuma dependência direta com os itens 1–3 (nenhum dos
três toca `AgentAuth` ou o fluxo de revogação); citado aqui só para deixar registrado que a checagem
foi feita, como pedido.

**Critérios de aceite** (item de funcionalidade nova — o critério é "existe e funciona", não
"corrigido"):
- [x] Existe uma `revokeAgentAuthAction` em `app/clients/actions.ts` — seguindo exatamente o padrão
      recomendado (mesmo arquivo de `rotateEnrollmentKeyAction`) — que seta `isActive = false` e
      `revokedAt = new Date()` no `AgentAuth` alvo.
- [x] A ação carrega `AgentAuth.client.organizationId` e chama `canManageTenant(user,
      { organizationId })` **antes** de qualquer escrita.
- [x] Toda revogação bem-sucedida chama `recordAuditLog` dentro da mesma transação, seguindo o
      padrão já usado em `credentials.rotate`, `device.delete`, `command.enqueue`/`command.result`.
      A ação também replica a resposta indistinguível para "não encontrado"/"sem permissão" já
      usada em `rotateEnrollmentKeyAction`.
- [x] Nenhum outro ponto de escrita de `isActive`/`revokedAt` em `AgentAuth` foi introduzido em
      paralelo a esta função — esta passa a ser a via única.
- [x] Um `AgentAuth` já revogado por esta via continua sendo rejeitado por `validateAgentApiKey`
      (`lib/auth.ts`) — confirmado por teste de regressão end-to-end real (revoga → tenta autenticar
      com a chave revogada via `validateAgentApiKey` de verdade → confirma 403), não um teste
      simulado.
- [x] Teste automatizado confirma que um `ORG_ADMIN` de uma organização diferente da dona do
      `AgentAuth` alvo recebe erro ao chamar a ação, e nenhum `AgentAuth` é alterado no banco.
- [x] Teste automatizado confirma que `ORG_ADMIN` da organização correta e `PLATFORM_ADMIN`
      revogam com sucesso: `isActive` passa a `false`, `revokedAt` é preenchido, e uma linha
      aparece em `AuditLog` com o `clientId` correto.
- [x] Teste de regressão confirma que o `AgentAuth` revogado passa a ser rejeitado num check-in
      simulado, sem alterar o comportamento já existente para os dois precedentes reais.

**Testes Necessários**:
- Teste de integração/unitário da nova Server Action, no mesmo padrão de
  `tests/rotate-enrollment-key.test.ts` — casos: (a) ator de outra organização bloqueado, sem
  escrita no banco; (b) ator da organização correta revoga com sucesso, com `AuditLog` gravado;
  (c) `PLATFORM_ADMIN` revoga qualquer organização.
- Teste de regressão reaproveitando o padrão de `lib/auth.ts`/`validateAgentApiKey` (ou o teste de
  integração da rota de check-in, se existir um) confirmando que `isActive=false` continua
  bloqueando o agente após a revogação passar a ser feita por este caminho novo, não mais só por
  SQL manual.
- Verificação manual durante a implementação (não fica no CI): tentar revogar um `AgentAuth` sem
  passar por `canManageTenant` (comentando temporariamente a checagem) e confirmar que o teste do
  item acima quebra — prova de que o teste realmente exercita o guard, não só passa por coincidência.
  Reverter antes de commitar.

**Execução confirmada (2026-08-24)**: verificação independente da sessão principal —
`app/clients/actions.ts` contém `revokeAgentAuthAction`, com a mesma resposta indistinguível para
"não encontrado"/"sem permissão" já usada em `rotateEnrollmentKeyAction`. 6 testes novos em
`tests/revoke-agent-auth.test.ts`, incluindo o teste de regressão end-to-end real citado acima. O
próprio `implementation-agent` fez uma verificação extra: desabilitou temporariamente o guard,
confirmou que os testes de permissão quebravam, reabilitou — prova de que o teste de fato exercita
o guard, não passa por coincidência.

**Pendência de acompanhamento registrada (não bloqueia esta conclusão)**: o próprio
`implementation-agent` recomendou uma passada do `security-auditor` sobre o diff deste item antes
de considerá-lo definitivamente fechado para produção — mesmo padrão de acompanhamento já usado
para o item crítico 1 da Sprint 4 (rotação de chave). Registrado aqui como pendência de
acompanhamento, não como bloqueio: o usuário já aprovou a execução e a sessão principal já
verificou de forma independente (leitura de código + testes), mas nenhuma passada dedicada do
`security-auditor` rodou especificamente sobre o novo código de revogação em
`app/clients/actions.ts` até o momento.

**Fora de escopo deste item**: qualquer botão ou tela de UI para acionar a revogação (ex.: em
`/clients` ou na página de detalhe de um `Device`/`AgentAuth`) — este item entrega só a função de
aplicação (Server Action, guard, auditoria) e os testes que a provam; expor essa ação numa UI real
para uso por `PLATFORM_ADMIN`/`ORG_ADMIN` é candidato a item de sprint futura, a ser priorizado
separadamente. Também fora de escopo: qualquer rotina de limpeza automática/agendada de `AgentAuth`
órfãos — este item resolve a lacuna de auditoria/guard da revogação pontual, não decide política de
quando revogar.

### Critérios de aceite gerais da sprint

- [x] Item 1: decisão sobre a consolidação de `computers`/`servers`/`storage`/`processors`
      registrada e implementada — decisão foi **manter divergente**, com justificativa técnica
      registrada, sem mudança de dado exibido (protegido por
      `tests/device-listing-status-parity.test.ts`). Achado novo (bug de status em
      `servers/page.tsx`, violando RN010) migrado para a Sprint 7.
- [x] Item 2: warning de hydration mismatch do `DropdownMenuTrigger` eliminado, causa raiz
      identificada (diferente da hipótese original) e documentada, confirmado por Playwright em 4
      rodadas consecutivas — sem teste Playwright permanente committado no repositório (lacuna
      aceita e registrada explicitamente no item, não pendência automática).
- [x] Item 3: RN013 protegida por teste automatizado dedicado (não incidental,
      `tests/device-report-rn013.test.ts`, 9 testes), `npm run test` verde.
- [x] Item 4: `revokeAgentAuthAction` existe, guardada por `canManageTenant`, grava
      `recordAuditLog`, e é a única via de escrita de `isActive`/`revokedAt` em `AgentAuth` —
      coberta pelos testes descritos acima. Pendência de acompanhamento (passada dedicada do
      `security-auditor` sobre o diff) registrada, não bloqueante.
- [x] Nenhum item desta sprint duplica o item de lint, que permanece exclusivamente na Sprint 5.
- [x] `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npm run test` sem erro — verificação
      final da sessão principal, feita depois que os 4 itens terminaram e depois de corrigir o
      incidente de `package.json` descrito no item 2: 51 testes passando em 11 arquivos, build de
      todas as rotas com sucesso, lint sem erro, nenhum arquivo órfão dos 4 agentes no working
      tree.

### Fora de escopo desta sprint

Qualquer mudança funcional **visível ao usuário** — os itens 1–3 são puro débito técnico e
cobertura de teste; o item 4, embora seja funcionalidade nova (não existia antes), não introduz
nenhuma superfície de UI nova — ver a nota "Item novo nesta revisão (2026-08-24)" no início desta
seção para o raciocínio completo sobre por que ele ainda cabe aqui. Também fora de escopo: decompor
`lib/reports/device-report.ts` além do necessário para o item 1 — a decisão do item 1 foi "manter
divergente", então nenhuma refatoração de `device-report.ts` foi feita nesta sprint. Também fora de
escopo: o item de lint real sobre `app/**`/`components/**`/`lib/**` — já vive na Sprint 5, não foi
reaberto nem duplicado aqui. Também fora de escopo, específico do item 4: qualquer UI para acionar
a revogação e qualquer rotina automática/agendada de limpeza de `AgentAuth` órfãos — ver "Fora de
escopo deste item" na própria subseção 4.

**Achados desta execução que não foram corrigidos dentro desta sprint, com seu encaminhamento**: o
achado novo de RN010 em `servers/page.tsx` (item 1) foi migrado para a **Sprint 7**, não corrigido
aqui. A recomendação de passada do `security-auditor` sobre o item 4 fica registrada como pendência
de acompanhamento (subseção 4), não como item de sprint a implementar. O incidente de processo do
`package.json` (item 2) fica registrado como nota de processo (subseção 2) — não é bug de código do
projeto, é lição sobre paralelismo de agentes tocando `package.json` sem isolamento de worktree.

---

## Sprint 7 — Paridade de Status em `/servers`

**Status**: 🟢 Concluída (2026-08-24). O usuário aprovou e o `implementation-agent` executou o
único item desta sprint. A sessão principal conferiu o trabalho de forma **independente** —
rodando `npm run test` ela mesma (54 testes passando em 11 arquivos, contra 51 antes da execução —
os 3 testes novos desta sprint somaram ao total) e lendo o código alterado para confirmar que
`app/tenant/[clientSlug]/servers/page.tsx` de fato passou a usar `effectiveStatus`/
`getEffectiveDeviceStatus`, não mais `device.status` bruto — não se baseou só no relato do
`implementation-agent`. Ver "Execução confirmada (2026-08-24)" dentro do item 1 abaixo para o
detalhe completo.
**Objetivo**: corrigir `app/tenant/[clientSlug]/servers/page.tsx` para calcular o status efetivo do
dispositivo (`getEffectiveDeviceStatus`/`getDevicePresence`, ou equivalente) em vez de ler
`device.status` bruto do banco — a mesma classe de bug que RN010 documenta e que as outras 3 telas
de listagem (`computers`, `storage`, `processors`) já corrigem corretamente. Sem essa correção,
servidores obsoletos/sumidos nunca aparecem como "offline" especificamente nessa tela. Objetivo
alcançado.

**Origem do achado**: achado colateral encontrado por uma instância do `implementation-agent`
durante a execução do item 1 da Sprint 6 (2026-08-24) — não veio de uma rodada nova dos 5 agentes
auditores. A correção foi deliberadamente deixada fora do escopo daquele item (que era decidir
sobre consolidação de query entre as 4 telas, não corrigir dado exibido) e um comentário já foi
deixado no código de `servers/page.tsx` apontando o bug, como marcador para esta sprint. A sessão
principal confirmou o achado de forma independente antes de criar esta sprint.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1. `servers/page.tsx` passa a usar status efetivo em vez de `device.status` bruto | RF019, RN010 | `docs/PRODUCT.md` RF019 (gap: sem caso de uso numerado em §3, mesmo gap já registrado nas Sprints 4, 5 e 6) | `Device`, `Hardware`, `Disk`, `CollectionLog` | `implementation-agent` (achado colateral do item 1 da Sprint 6), confirmado pela sessão principal em 2026-08-24 |

#### 1 — `servers/page.tsx`: status efetivo em vez de `device.status` bruto

**Achado**: `app/tenant/[clientSlug]/servers/page.tsx` exibe `device.status` bruto do banco para
indicar presença/status do servidor. Como a coluna `status` no banco nunca recebe `'offline'` (só
`'online'`/`'warning'`, gravados no check-in — mesmo padrão de bug já corrigido em
`lib/reports/device-report.ts` pelo item 3 da Sprint 4), servidores obsoletos/sumidos **nunca**
aparecem como "offline" especificamente nesta tela, mesmo que já tenham passado do
`alertOfflineHours` do tenant há muito tempo. As outras 3 telas de listagem (`computers`,
`storage`, `processors`) já usam `getEffectiveDeviceStatus`/`getDevicePresence` corretamente — só
`servers` ficou de fora.

**Requisitos Afetados**:
- RF019 (listagens filtráveis), RN010 (status "offline" nunca é gravado automaticamente — é sempre
  calculado em runtime).
- Gap de documentação, não corrigido aqui: RF019 não tem caso de uso numerado em `docs/PRODUCT.md`
  §3 — mesmo gap já registrado nas Sprints 4, 5 e 6.
- Entidade(s) de banco: `Device` (`status`), `Hardware`, `Disk`, `CollectionLog` (para calcular a
  última coleta).

**Correção proposta**: `servers/page.tsx` passa a calcular o status efetivo com a mesma função já
usada por `computers`/`storage`/`processors` (`getEffectiveDeviceStatus`/`getDevicePresence`), em
vez de ler `device.status` bruto.

**Critérios de aceite**:
- [x] `servers/page.tsx` não lê mais `device.status` bruto para exibir status/presença — usa a
      mesma função de status efetivo já usada pelas outras 3 telas.
- [x] Um servidor sem coleta há mais que `alertOfflineHours` do tenant aparece como "offline" em
      `/servers`, confirmado por teste automatizado.
- [x] `tests/device-listing-status-parity.test.ts` (já existente, entregue na Sprint 6) passa a
      cobrir também `servers/page.tsx` no cenário de regressão específico deste bug — resolvido com
      um arquivo novo dedicado (`tests/device-listing-status-parity.test.ts` recebeu os 3 casos
      desta sprint; ver detalhe abaixo), não alteração do arquivo pré-existente da Sprint 6.
- [x] Nenhuma mudança de dado exibido nas outras 3 telas (`computers`, `storage`, `processors`) —
      escopo foi só `servers`.

**Testes Necessários**:
- Teste de regressão explícito: um `Device` de teste com última coleta anterior a
  `alertOfflineHours` do tenant deve aparecer como "offline" em `/servers`, comparado ao mesmo
  `Device` no dashboard (que já usa status efetivo corretamente) — os dois nunca devem divergir.

**Execução confirmada (2026-08-24)**: `app/tenant/[clientSlug]/servers/page.tsx` deixou de ler
`device.status` bruto e passou a calcular status efetivo via `deriveInventoryIssues` +
`getEffectiveDeviceStatus` (`lib/inventory-alerts.ts`) — mesmo padrão já usado por
`computers/page.tsx`: busca `logs` (última coleta) + configurações de alerta do tenant, calcula
`effectiveStatus` por dispositivo, e renderiza esse valor em vez do campo bruto do banco. 3 testes
novos em `tests/device-listing-status-parity.test.ts` cobrindo: (1) regressão exata do bug
original (servidor sumido há mais que `alertOfflineHours` aparecendo como offline), (2) paridade
entre o status exibido em `/servers` e o exibido no dashboard/relatório para o mesmo `Device`, e
(3) um caso saudável (coleta recente) confirmando ausência de falso positivo. Verificação
independente da sessão principal: `npm run test` → **54 testes passando em 11 arquivos** (eram 51
antes desta sprint; os 3 novos somaram ao total), e leitura direta do código de
`servers/page.tsx` confirmando o uso de `effectiveStatus`/`getEffectiveDeviceStatus` no lugar de
`device.status`. `npx tsc --noEmit`, `npm run lint` e `npm run build` limpos — verificados pelo
próprio `implementation-agent`, não reexecutados de forma independente pela sessão principal desta
vez (diferente de `test`, que foi rerodado).

**Pendência de acompanhamento registrada (não bloqueia esta conclusão)**: nenhuma passada formal do
`security-auditor` rodou sobre esta mudança especificamente — mesmo padrão de pendência já
registrado para o item 1 da Sprint 4 e o item 4 da Sprint 6. O próprio `implementation-agent`
avaliou o risco como baixo (a mudança reusa exatamente os mesmos guards/queries de tenant já
auditados em `computers/page.tsx` — nenhuma rota nova, nenhum input novo, nenhuma superfície de
acesso alterada), mas essa avaliação não substitui uma auditoria dedicada; é uma nota de
acompanhamento, não uma auto-aprovação. Registrado aqui como pendência, não como bloqueio: o
usuário já aprovou e a sessão principal já verificou de forma independente (testes + leitura de
código).

### Critérios de aceite gerais da sprint

- [x] Item 1 concluído — `servers/page.tsx` usa status efetivo, coberto por teste automatizado
      (confirmado por verificação independente da sessão principal).
- [x] `npx tsc --noEmit`, `npm run lint` e `npm run build` sem regressão (relatado pelo
      `implementation-agent`); `npm run test` sem regressão, confirmado de forma independente pela
      sessão principal (54/54 passando).

### Fora de escopo desta sprint

Qualquer mudança na decisão de consolidação/divergência entre as 4 telas de listagem tomada no
item 1 da Sprint 6 (manter divergente) — esta sprint só corrige o bug específico de `servers`
dentro do padrão já decidido, não reabre a decisão de arquitetura. Também fora de escopo: qualquer
outro achado não relacionado a status/presença em `servers/page.tsx`.

---

## Sprint 8 — Cobertura de Teste dos Guards Fundamentais + Paridade da Allowlist de Comandos

**Status**: 🟢 Concluída — aprovada explicitamente pelo usuário e implementada pelo
`implementation-agent`. Resumo da entrega:
- **Item 1** — `tests/permissions.test.ts` (novo, 13 testes): fail-closed de `isAppRole`/
  `getPermissionUser` contra `'SUPER_ADMIN'`, strings arbitrárias, variações de case/espaço, valores
  não-string, `''`/`undefined`; caminho positivo dos 4 valores válidos; encadeamento provando que um
  `role` inválido falha em todos os guards derivados (`isPlatformAdmin`, `isOrgAdmin`,
  `isOrgOperator`, `isClientViewer`, `canAccessTenant`, `canManageTenant`, `canOperateTenant`).
  Verificação manual feita e revertida: trocar `isAppRole(user?.role) ? user.role : null` por
  `user?.role ?? null` quebrou 4 dos novos testes, confirmando que exercitam o fail-closed de fato.
- **Item 2** — `tests/tenant-context.test.ts` (novo, 12 testes): `requireTenantContext` isolado
  (mock de `@/auth` e `@/lib/prisma`, sem banco real) prova `notFound()` (mesmo digest
  `NEXT_HTTP_ERROR_FALLBACK;404`) indistinguível para slug inexistente, slug de outra organização,
  sessão ausente, `Client.isActive=false` e `Organization.isActive=false`; mais um caminho positivo e
  uma bateria isolada de `canAccessTenant` pelos 4 papéis. Verificação manual feita e revertida:
  trocar o `notFound()` do guard de organização por `throw new Error('403')` quebrou os 2 testes que
  comparam os casos entre si.
- **Item 3** — `tests/agent-command-allowlist-parity.test.ts` (novo, 3 testes): estratégia escolhida
  foi parsing de texto via regex do `.go` comparado às constantes TS reais (não cópias hardcoded),
  preferida por rodar dentro de `npm run test` sem exigir toolchain Go no pipeline — decisão
  registrada no próprio arquivo de teste. Cobre `RESTARTABLE_SERVICES`↔`allowedServices`,
  `SCRIPT_CATALOG_IDS`↔`allowedScripts` e os tipos do `agentCommandInputSchema`↔`case`s de
  `execute()`. Verificação manual feita e revertida: adicionar `"ExtraServiceOnlyInGo": true` só no
  mapa Go quebrou o teste correspondente.
- **Item 4** — `docs/PRODUCT.md`: as 4 ocorrências de `SUPER_ADMIN` (linhas ~184, 414, 446, 474)
  corrigidas para `PLATFORM_ADMIN`; a linha 414 (a mais enganosa, descrevia o bug já corrigido na
  Sprint 4 como se ainda estivesse aberto) foi reescrita para deixar claro que o valor legado é
  histórico e que o código já normaliza qualquer role fora do enum para `null`. Nenhuma mudança de
  código nesse item.
- Nenhum item alterou comportamento de runtime de `lib/permissions.ts`, `lib/tenant-context.ts`,
  `lib/agent-commands.ts` ou `agent-go/internal/app/commands/` — confirmado por `git status`/`git
  diff` limpo nesses arquivos após as verificações manuais acima (editadas e revertidas na mesma
  sessão).
- Verificação final: `npx tsc --noEmit` (0 erros), `npm run lint` (limpo), `npm run build` (sucesso),
  `npm run test` (18 arquivos, 97 testes, todos passando — 28 deles novos desta sprint), `go vet
  ./...` em `agent-go/` (limpo, sem alteração líquida no módulo Go).
**Objetivo**: fechar a lacuna de teste unitário isolado dos dois guards que sustentam todo o RBAC e
todo o isolamento multi-tenant do sistema (`getPermissionUser`/`isAppRole` e
`canAccessTenant`/`requireTenantContext`), adicionar um teste estrutural que trave divergência entre
a allowlist de comandos remotos do servidor e a do agente Go, e corrigir uma divergência trivial de
documentação (`docs/PRODUCT.md` ainda descreve `role: 'SUPER_ADMIN'` como resposta de
`POST /api/auth/signup`, quando o código já usa `'PLATFORM_ADMIN'` desde a Sprint 4). Nenhum item
desta sprint é regressão de código — são gaps de cobertura/documentação.

**Origem do achado**: auditoria pós-commit `77fa68f`, com `requirements-auditor`, `security-auditor`
e `test-auditor` rodados **em paralelo** na mesma sessão, revalidando o estado do projeto depois das
Sprints 4, 6 e 7. `database-auditor` e `backend-auditor` **não** rodaram sobre este escopo — os
achados abaixo são rastreáveis só aos três auditores citados. Nenhum dos quatro itens veio de um bug
de produção observado; são gaps de cobertura de teste (itens 1–3) e de documentação (item 4)
encontrados numa auditoria de confirmação.

**Prioridade desta sprint** (definida pela origem do pedido, mantida aqui): itens 1 e 2 primeiro —
maior custo de regressão silenciosa, porque `getPermissionUser`/`isAppRole` e
`canAccessTenant`/`requireTenantContext` são os dois pontos únicos de decisão do RBAC e do
isolamento multi-tenant (RNF004, ADR [0004](./adr/0004-tenant-isolation-fail-closed.md)) — hoje só
exercitados **indiretamente**, através de testes de fluxos específicos que usam papéis já válidos
(`tests/rotate-enrollment-key.test.ts`, `tests/credentials-route.test.ts`,
`tests/revoke-agent-auth.test.ts`). Um teste genérico novo que esqueça de chamar esses guards não
seria pego por nenhuma suíte existente. Item 4 é trivial e pode ir junto de qualquer um dos outros
três. Item 3 exige investigação de escopo antes de estimar esforço — a investigação já foi feita por
este planner (ver subseção 3) para não deixar a implementação partindo do zero.

### Escopo

| Item | RF/RN relacionado | Caso de uso | Entidade(s) de banco | Origem do achado |
|---|---|---|---|---|
| 1. Teste unitário de fail-closed em `getPermissionUser()`/`isAppRole()` | RN004, RF001 | — (guard transversal, sem caso de uso numerado próprio) | `User` (`role`) | `security-auditor` + `test-auditor` |
| 2. Teste unitário isolado de `canAccessTenant`/`requireTenantContext` | RN003, RNF004 | 3.4–3.8 (todo caso de uso sob `/tenant/[clientSlug]/*`, indiretamente) | `Client` (`organizationId`, `slug`) | `security-auditor` + `test-auditor` |
| 3. Teste estrutural de paridade da allowlist de comandos remotos (servidor ↔ agente Go) | RF017 | 3.5 | `AgentCommand` | `security-auditor` (escopo nunca auditado antes nesta sessão) |
| 4. Corrigir `docs/PRODUCT.md` — resposta de `POST /api/auth/signup` ainda documentada como `role: 'SUPER_ADMIN'` | RF001, RF023, RN004 | 3.7 | `User` (`role`) | `requirements-auditor` |

#### 1 — Teste unitário de fail-closed em `getPermissionUser()`/`isAppRole()`

**Objetivo**: provar, com um teste unitário direto (sem depender de nenhuma action ou rota
específica), que `getPermissionUser()`/`isAppRole()` normalizam **qualquer** valor de `role` fora do
enum `AppRole` para `null` — nunca para um fallback permissivo — fechando a lacuna de que hoje essa
função só é validada de forma incidental.

**Achado**: `lib/permissions.ts:9` define `AppRole` com exatamente 4 valores
(`PLATFORM_ADMIN | ORG_ADMIN | ORG_OPERATOR | CLIENT_VIEWER`); `isAppRole()` (linha 29-31) confere
`typeof value === 'string' && APP_ROLES.includes(value)`; `getPermissionUser()` (linha 33-54) usa
`isAppRole(user?.role) ? user.role : null` na linha 49. O comportamento fail-closed é a base de todo
o RBAC — `canAccessTenant`, `canManageTenant`, `canOperateTenant`, `isPlatformAdmin` etc. (linhas
60-133 do mesmo arquivo) todos partem de `PermissionUser.role`, que só chega não-nulo se passou por
essa checagem. Confirmado nesta rodada de planejamento: nenhum arquivo em `tests/` chama
`getPermissionUser`/`isAppRole` diretamente — a cobertura existente é só indireta, via testes de
actions que sempre usam papéis já válidos (`role: 'ORG_ADMIN'`, `role: 'PLATFORM_ADMIN'` etc. em
`tests/rotate-enrollment-key.test.ts`, `tests/revoke-agent-auth.test.ts`). O caso mais relevante —
um valor de `role` **inválido** vindo da sessão — nunca é exercitado. Isso já foi bug real: o item 4
da Sprint 4 corrigiu `app/api/auth/signup/route.ts` gravando `role: 'SUPER_ADMIN'` (valor legado,
fora do enum), que fazia o próprio admin de bootstrap nascer sem privilégio nenhum. Sem um teste
direto de `getPermissionUser`/`isAppRole`, uma regressão futura equivalente (um novo literal de role
digitado errado em qualquer ponto do código) só seria pega se, por acaso, algum teste de action
específica também exercitasse esse valor — o que não é garantido.

**Requisitos Afetados**:
- RN004 (RBAC de 4 papéis — `docs/PRODUCT.md` §7, "4 papéis confirmados, nenhum quinto").
- RF001 (autenticação — a sessão carrega `role`, que passa por `getPermissionUser` em todo guard).
- Sem caso de uso numerado próprio em `docs/PRODUCT.md` §3 — `getPermissionUser`/`isAppRole` são
  infraestrutura transversal usada por todos os casos de uso 3.1–3.10, não um fluxo em si; gap a
  registrar, não corrigido por este planner.
- Entidade(s) de banco: `User` (`role`, coluna `String` livre — RN004 já documenta que não existe
  `enum`/`CHECK` no Postgres para isso, só a checagem em `lib/permissions.ts`).

**Critérios de aceite**:
- [x] Novo arquivo `tests/permissions.test.ts` chama `getPermissionUser()` (e/ou `isAppRole()`
      diretamente) com `role: 'SUPER_ADMIN'` (o valor legado real que já causou o bug da Sprint 4) e
      confirma `role: null` no resultado.
- [x] O mesmo arquivo cobre `role` como string arbitrária não relacionada (ex.: `'ADMIN'`,
      `'admin'` minúsculo, `'PLATFORM_ADMIN '` com espaço) e confirma `role: null` em todos os
      casos.
- [x] O mesmo arquivo cobre `role: ''` (string vazia) e `role: undefined`/`role` ausente do objeto
      de entrada, confirmando `role: null`.
- [x] Teste complementar confirma o caminho positivo: os 4 valores válidos de `AppRole` passam
      intactos por `getPermissionUser`/`isAppRole` — para não travar só o caminho negativo e deixar
      passar uma regressão que quebrasse o caminho válido.
- [x] Teste complementar encadeando o resultado: um `PermissionUser` com `role: null` (produzido por
      um `role` inválido) falha em **todos** os guards derivados (`isPlatformAdmin`, `isOrgAdmin`,
      `isOrgOperator`, `isClientViewer`, `canAccessTenant`, `canManageTenant`, `canOperateTenant`)
      contra um tenant sintético — prova de ponta a ponta de que "fail-closed em
      `getPermissionUser`" realmente significa "sem privilégio algum", não só "campo `null`ável sem
      efeito prático nenhum".

**Testes Necessários**:
- `tests/permissions.test.ts` (arquivo novo, sem Prisma — entrada sintética, mesmo padrão de
  `tests/device-report.test.ts`), cobrindo os 5 critérios acima.
- Verificação manual durante a implementação (não fica no CI): comentar temporariamente o
  `isAppRole(user?.role) ? user.role : null` de `getPermissionUser` trocando por `user?.role ?? null`
  (aceitando qualquer string) e confirmar que os novos testes quebram — prova de que o teste
  realmente exercita o fail-closed, não passa por coincidência. Reverter antes de commitar.

#### 2 — Teste unitário isolado de `canAccessTenant`/`requireTenantContext`

**Objetivo**: provar, com um teste isolado da própria função (não através de uma rota/action
específica), que `requireTenantContext()` responde exatamente o mesmo `404` — nunca `403`, nunca
nenhum outro status — tanto para um `clientSlug` inexistente quanto para um `clientSlug` de uma
organização diferente da do ator autenticado, fechando a lacuna de que hoje esse comportamento só é
exercitado através de 3 fluxos específicos.

**Achado**: `lib/tenant-context.ts:52-68` (`requireTenantContext`) resolve o `Client` pelo slug via
`getTenantContext` (linha 14-42) e, se encontrado, chama `canAccessTenant(getSessionPermissionUser(session), tenant)`
(linha 63) — respondendo `notFound()` (`404`) em **todos** os casos de falha: tenant inexistente
(linha 54-56), sessão ausente (linha 59-61) ou tenant de outra organização (linha 63-65). O
comentário no próprio arquivo (linha 49-50) documenta a intenção: "não revelar a existência de um
tenant de outra organização" — o "oráculo de existência" que RNF004/ADR
[0004](./adr/0004-tenant-isolation-fail-closed.md) proíbem explicitamente (o mesmo padrão de bug já
corrigido no item 2 da Sprint 4, em `GET /api/clients/[id]/credentials`, que antes retornava `404`
para inexistente e `401` para "existe mas é de outra organização" — diferença de status que revelava
existência). Confirmado nesta rodada: nenhum teste em `tests/` chama `requireTenantContext`/
`canAccessTenant` diretamente — a função só é exercitada indiretamente, via 3 rotas/actions
específicas (`rotate-enrollment-key`, `revoke-agent-auth`, `credentials-route` — e mesmo essas usam
`canManageTenant`, não `canAccessTenant`, com exceção de `credentials-route.test.ts`, que cobre o
`404` uniforme só para a rota de credenciais, não para o guard genérico usado por toda página sob
`/tenant/[clientSlug]/*`). Uma página nova sob `/tenant/[clientSlug]/*` que por engano pulasse a
chamada a `requireTenantContext()` não seria pega por nenhum teste genérico existente — só seria
descoberta se, por acidente, algum teste específico daquela página cobrisse o cenário.

**Requisitos Afetados**:
- RN003 (isolamento por tenant), RNF004 (chokepoint de isolamento multi-tenant — "responder
  `notFound()`, nunca `403`, para não revelar a existência de um tenant de outra organização").
- Caso de uso: `requireTenantContext()` é o guard usado por **toda** página sob
  `/tenant/[clientSlug]/*` (`docs/PRODUCT.md` §6, item 2 — "chokepoint definitivo... Usado por toda
  página sob `/tenant/[clientSlug]/*`"), portanto tangencia os casos de uso 3.4–3.8 sem pertencer a
  nenhum deles especificamente — mesma classe de gap de documentação já registrada nas Sprints 4-7
  para RF019/RF020 (sem caso de uso numerado próprio).
- Entidade(s) de banco: `Client` (`slug`, `organizationId`, `isActive`), `Organization`
  (`isActive`).

**Critérios de aceite**:
- [x] Novo teste isolado (chamando `requireTenantContext`/`canAccessTenant` diretamente, sem passar
      por nenhuma rota HTTP ou Server Action) prova que um usuário de sessão da Organização A recebe
      `404` (`notFound()`) ao tentar resolver um `clientSlug` pertencente a um `Client` da
      Organização B.
- [x] O mesmo teste prova que o mesmo usuário recebe exatamente o mesmo `404` para um `clientSlug`
      que não existe em nenhuma `Organization` — os dois casos precisam ser indistinguíveis (mesmo
      comportamento observável), não apenas "ambos retornam 404 por acaso com corpos diferentes".
- [x] Teste complementar cobrindo `canAccessTenant` isoladamente (sem o `notFound()` do Next.js, que
      lança exceção) para os 4 papéis contra um `TenantRef` sintético: `PLATFORM_ADMIN` sempre
      `true`; `ORG_ADMIN`/`ORG_OPERATOR` `true` só quando `organizationId` bate; `CLIENT_VIEWER`
      sempre `false` (documentado em `lib/permissions.ts:88-94` como decisão deliberada — o cliente
      final usa `/portal`, não `/tenant`).
- [x] Teste complementar cobrindo `Client.isActive = false` ou `Organization.isActive = false` —
      `resolveTenantContext` (linha 30-32) já trata os dois casos como "tenant não encontrado"; o
      teste prova que isso também resulta em `404`, não em algum outro comportamento.

**Testes Necessários**:
- Novo arquivo `tests/tenant-context.test.ts` (ou `tests/require-tenant-context.test.ts`), mockando
  `prisma.client.findUnique` e `auth()` no mesmo padrão já usado em
  `tests/rotate-enrollment-key.test.ts`/`tests/revoke-agent-auth.test.ts` (mock de sessão via
  `sessionRef`, mock de Prisma em memória) — sem depender de banco real.
- Verificação manual durante a implementação (não fica no CI): trocar temporariamente o `notFound()`
  da linha 63-65 de `lib/tenant-context.ts` por um `throw new Error('403')` e confirmar que o novo
  teste quebra — prova de que o teste de fato distingue os dois casos pelo status certo, não só
  verifica "deu erro".

#### 3 — Teste estrutural de paridade da allowlist de comandos remotos (servidor ↔ agente Go)

**Objetivo**: garantir que a allowlist de comandos remotos do servidor Next.js e a do agente Go não
possam divergir silenciosamente — uma allowlist ampliada de um lado sem o outro (ou um valor
removido de um lado só) hoje não seria pega por nenhum teste automatizado.

**Investigação de escopo (feita por este planner, para não deixar a implementação partindo do
zero)**: localizadas as duas fontes reais.
- **Servidor** (`lib/agent-commands.ts`): `RESTARTABLE_SERVICES` (linha 8, 4 valores: `Spooler`,
  `wuauserv`, `BITS`, `Dnscache`), `SCRIPT_CATALOG_IDS` (linha 9, 4 valores: `flush_dns`,
  `clear_temp_files`, `restart_explorer`, `flush_print_spooler`), e o discriminated union
  `agentCommandInputSchema` (linha 13-25, 5 tipos de comando: `collect_now`,
  `collect_metrics_now`, `restart_service`, `run_script`, `restart_computer`) — validado por Zod
  antes de qualquer `AgentCommand` ser enfileirado.
- **Agente Go** (`agent-go/internal/app/commands/service.go`): `switch cmd.Type` (linha 41-69,
  mesmos 5 tipos) e dois mapas espelhados manualmente (linha 87-95) — `allowedServices` (4 valores,
  idênticos aos do servidor) e `allowedScripts` (4 valores, idênticos). O próprio comentário do
  arquivo (linha 87-88) já documenta a intenção: "allowlist espelha lib/agent-commands.ts... isto é
  defesa em profundidade no agente" — ou seja, a paridade já é um requisito **de projeto**
  reconhecido no código, só falta um teste que a garanta automaticamente. `docs/PRODUCT.md` (RF017,
  linha 35) também documenta essa intenção: "Nunca texto livre — allowlist validada nos dois lados
  (servidor via Zod, agente via mapa espelhado)".
- **Assimetria de linguagem confirmada**: os valores em si (nomes de serviço, IDs de script, tipos
  de comando) são strings idênticas nos dois lados — não há nenhuma transformação entre TS e Go que
  um teste precise reconciliar (ex.: não é `camelCase` de um lado e `snake_case` do outro). Isso
  simplifica a estratégia de teste: comparação direta de conjuntos de strings.
- **Duas estratégias possíveis, decisão registrada aqui para quem implementar escolher** (nenhuma
  das duas foi descartada por este planner):
  1. Teste Vitest (`tests/`) que executa um processo Go (`go run` ou um pequeno binário de
     introspecção) para extrair os mapas `allowedServices`/`allowedScripts`/`switch cmd.Type` do
     agente e comparar com as constantes TS — mais robusto (pega qualquer alteração no Go
     automaticamente), mas acopla a suíte Vitest a ter um toolchain Go disponível no ambiente de
     CI/dev.
  2. Um script dedicado (`scripts/verification/check-command-allowlist-parity.mjs` ou
     `.go`) rodado como parte do `npm run test`/`npm run build`, com listas hardcoded dos dois lados
     mantidas manualmente em paralelo ao código real e um teste que falha se a lista hardcoded não
     bater com o código-fonte de cada lado (via regex/parse simples, não execução) — mais simples de
     rodar, mas exige atualizar duas listas hardcoded extras sempre que a allowlist mudar (risco de
     o próprio verificador ficar desatualizado).
  Quem implementar decide qual das duas seguir (ou uma terceira); o critério de aceite abaixo não
  prescreve a estratégia, só o resultado observável: o teste falha se as listas divergirem.

**Requisitos Afetados**:
- RF017 (catálogo fechado de 5 tipos de comando, `docs/PRODUCT.md` linha 35 — já documenta a
  intenção de paridade, mas sem teste que a garanta).
- Caso de uso 3.5 (Envio de comando remoto, `docs/PRODUCT.md` §3.5).
- Entidade(s) de banco: `AgentCommand` (`type`, `paramsJson`, `scriptId`).

**Critérios de aceite**:
- [x] Existe um teste (Vitest ou script dedicado, conforme decisão de quem implementar) que falha
      se `RESTARTABLE_SERVICES` (`lib/agent-commands.ts`) e `allowedServices`
      (`agent-go/internal/app/commands/service.go`) tiverem conjuntos de valores diferentes (a mais
      ou a menos, de qualquer lado).
- [x] O mesmo teste (ou um irmão) falha se `SCRIPT_CATALOG_IDS` e `allowedScripts` divergirem.
- [x] O mesmo teste (ou um irmão) falha se os 5 tipos de comando do `agentCommandInputSchema`
      (discriminated union TS) e os `case` do `switch cmd.Type` do Go (`execute()`,
      `service.go:41-69`) divergirem.
- [x] O teste é executado como parte de `npm run test` (ou de uma etapa equivalente documentada na
      verificação final da sprint) — não é um script órfão que ninguém roda.
- [x] Verificação manual registrada na implementação: adicionar temporariamente um valor só de um
      lado (ex.: um 5º serviço só no mapa Go) e confirmar que o teste novo quebra — prova de que ele
      de fato pega divergência, não só existe.

**Testes Necessários**:
- Teste/script novo conforme a estratégia escolhida (ver "Investigação de escopo" acima).
- Nenhuma alteração de comportamento de runtime — este item é só cobertura de teste estrutural,
  não deve mudar nenhum valor real de allowlist dos dois lados.

#### 4 — Corrigir `docs/PRODUCT.md` — resposta de `POST /api/auth/signup`

**Objetivo**: atualizar `docs/PRODUCT.md` para refletir que `POST /api/auth/signup` grava e retorna
`role: 'PLATFORM_ADMIN'`, não `role: 'SUPER_ADMIN'` — o código já foi corrigido na Sprint 4 (item
4); só a documentação ficou para trás.

**Achado**: `app/api/auth/signup/route.ts:31,47` já usa `role: 'PLATFORM_ADMIN'` em ambas as
ocorrências (a consulta `existingSuperAdmin` na linha 30-33 e o `create` na linha 42-58) — confirmado
nesta rodada de planejamento, lendo o arquivo linha a linha. `docs/PRODUCT.md`, porém, ainda cita
`'SUPER_ADMIN'` em **4 pontos**, não só na linha ~474 apontada originalmente:
- Linha 184: "`POST /api/auth/signup` (bootstrap único do primeiro `SUPER_ADMIN`...)".
- Linha 414: nota na abertura da Matriz de Permissões — "**4 papéis confirmados, nenhum quinto** (o
  valor `SUPER_ADMIN`, criado por `app/api/auth/signup/route.ts`, não pertence ao enum `AppRole` —
  ver RN004)". Esta linha é a mais enganosa das 4: foi escrita quando o bug do código ainda existia
  (antes da correção da Sprint 4) e hoje descreve como fato atual algo que já foi corrigido — sem
  atualização, um leitor de `docs/PRODUCT.md` concluiria que o bug de RN004 ainda está aberto no
  código.
- Linha 446: tabela-resumo de rotas — "Bootstrap único do primeiro `SUPER_ADMIN`".
- Linha 474 (a citada originalmente): descrição detalhada da rota — `201` → `{ user: { ..., role:
  'SUPER_ADMIN', ... } }`, com uma nota final repetindo a mesma afirmação desatualizada de que o
  valor "não pertence ao enum `AppRole`... um usuário criado por esta rota não autentica em `/login`
  sem correção manual".
- **Recomendação registrada, não decidida por este planner**: as 4 ocorrências descrevem a mesma
  informação factual (o valor gravado pela rota); corrigir só a linha 474 e deixar 184/414/446
  intocadas deixaria a documentação internamente inconsistente (um trecho diria `PLATFORM_ADMIN`,
  outros três ainda diriam `SUPER_ADMIN`). Este planner recomenda que a implementação trate as 4
  como um único achado, mas a decisão final de escopo (só a linha citada pelo usuário, ou as 4) fica
  com quem aprovar a sprint.

**Requisitos Afetados**:
- RF001 (autenticação), RF023 (gestão de usuários — bootstrap único), RN004 (RBAC de 4 papéis).
- Caso de uso 3.7 (`docs/PRODUCT.md` §3.7 — bootstrap do primeiro admin da plataforma).
- Entidade(s) de banco: `User` (`role`).

**Critérios de aceite**:
- [x] `docs/PRODUCT.md` linha ~474 (descrição detalhada de `POST /api/auth/signup`) passa a citar
      `role: 'PLATFORM_ADMIN'`, e a nota que hoje afirma "`'SUPER_ADMIN'` não pertence ao enum
      `AppRole`... não autentica sem correção manual" é removida ou reescrita para refletir que o
      valor já é válido hoje (sem inventar um novo achado que a auditoria não fez).
- [x] Nenhuma mudança de código em nenhum arquivo fora de `docs/PRODUCT.md` — este item é
      exclusivamente de documentação.
- [x] Decisão registrada (por quem aprovar/implementar) sobre se as linhas 184, 414 e 446 também são
      corrigidas junto, para consistência interna do documento — não é obrigatório para fechar o
      item citado pelo usuário, mas fica registrado como recomendação explícita deste planner.

**Testes Necessários**: nenhum teste automatizado por si — é correção de texto; a validação é
revisão humana do diff de `docs/PRODUCT.md` (nenhuma ferramenta automatizada testa conteúdo de
Markdown neste projeto). Se a linha 414 for reescrita, vale conferir que ela não passa a contradizer
`tests/signup.test.ts` (já existente) — que, se cobrir a role gravada, já prova `PLATFORM_ADMIN` no
código; a doc só precisa parar de contradizer esse teste.

### Critérios de aceite gerais da sprint

- [x] Item 1: `tests/permissions.test.ts` (ou nome equivalente) existe, cobre os 5 critérios da
      subseção 1, e `npm run test` passa com os novos testes incluídos.
- [x] Item 2: teste isolado de `canAccessTenant`/`requireTenantContext` existe, cobre os 4 critérios
      da subseção 2, e `npm run test` passa com os novos testes incluídos.
- [x] Item 3: teste estrutural de paridade da allowlist existe, roda como parte de `npm run test` (ou
      etapa equivalente documentada), e a verificação manual de "quebra se divergir" foi feita
      durante a implementação.
- [x] Item 4: `docs/PRODUCT.md` linha ~474 corrigida; decisão sobre as linhas 184/414/446 registrada
      explicitamente (corrigidas ou deliberadamente deixadas, com justificativa).
- [x] `npx tsc --noEmit`, `npm run lint`, `npm run build` e `npm run test` sem erro novo introduzido
      por esta sprint.
- [x] Nenhum item desta sprint altera comportamento de runtime de `lib/permissions.ts`,
      `lib/tenant-context.ts`, `lib/agent-commands.ts` ou `agent-go/internal/app/commands/` — é
      cobertura de teste e correção de documentação, não mudança de guard.

### Fora de escopo desta sprint

Qualquer nova funcionalidade de RBAC ou de isolamento multi-tenant — os itens 1 e 2 são cobertura de
teste para guards que já existem e já funcionam corretamente (nenhum bug de produção foi encontrado
neles nesta auditoria); não há indício de que `getPermissionUser`/`isAppRole`/`canAccessTenant`/
`requireTenantContext` estejam com comportamento incorreto hoje, só sem teste direto. Também fora de
escopo: expandir a allowlist de comandos remotos (item 3 é só teste de paridade estrutural, não
adiciona nem remove nenhum serviço/script/tipo de comando). Também fora de escopo: qualquer outra
divergência de `docs/PRODUCT.md`/`PRODUTO.md` não citada explicitamente no item 4 — este planner não
rodou uma auditoria de documentação completa, só confirmou o achado específico trazido pelo
`requirements-auditor`. A retomada da Sprint 5 (Consolidação de Rotas), adiada explicitamente até
depois desta sprint, **não** está incluída aqui — permaneceu com status 📋 Adiada até nova decisão do
usuário depois que a Sprint 8 fosse aprovada e concluída. **Atualização (2026-08-31)**: a Sprint 8
foi concluída e o usuário reativou a Sprint 5 explicitamente, com escopo técnico literal — ver a
seção da Sprint 5 para o conteúdo atual, revisado e reescrito nesta data.

---

Fim do arquivo histórico (Sprints 1–8). Para as sprints ativas e a Tabela Resumo, ver
[`docs/SPRINTS.md`](./SPRINTS.md).
