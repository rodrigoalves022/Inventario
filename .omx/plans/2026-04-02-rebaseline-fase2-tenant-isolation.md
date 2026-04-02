# Plano operacional — rebaseline seguro da Fase 2 tenant isolation

Status: approved-draft
Created: 2026-04-02
Owner: plan

## Context

A Fase 2 já possui artefatos reais no workspace, mas a execução anterior foi interrompida e o git não representa o estado técnico atual. Este plano reorganiza a continuidade a partir do **workspace real**, preservando governança, review independente e checkpoint de segurança.

## Goals

1. Continuar a Fase 2 sem repetir trabalho já existente
2. Revisar e endurecer o que foi materializado no workspace
3. Garantir separação clara entre `/clients` e `/tenant/[clientSlug]/*`
4. Manter fail-closed por padrão
5. Fechar a fase apenas após review, security review e normalização/versionamento

## Ground rules

- não recomeçar a implementação do zero
- não assumir que git já representa a verdade do projeto
- não tratar tenant isolation como auth/RBAC completo
- não fechar segurança nesta fase sem checkpoint explícito
- não usar ownership/claims antigos do runtime interrompido

## Progress baseline from workspace

### Already present

- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`
- `lib/tenant-links.ts`
- `components/sidebar.tsx` tenant-aware
- rotas `app/tenant/[clientSlug]/*` para dashboard, lists, reports e asset detail
- rotas globais legadas de inventário fechadas por redirect para `/clients`
- `app/api/dashboard/stats/route.ts` e `app/api/inventory/computers/route.ts` com `clientSlug`
- `app/api/collect/windows/route.ts` desativada com `410`
- `scripts/verification/verify-tenant-panel.mjs`

### Still open

- hardening de `/clients` e actions sensíveis
- revisão independente da implementação já materializada
- revalidação da consistência entre helpers, rotas, APIs e docs
- estratégia de versionamento/integração do working tree atual
- checkpoint de segurança antes de qualquer fechamento

## Reorganized execution stages

### Etapa 0 — Congelamento lógico e inventário final

Objetivo:
- usar o workspace atual como baseline técnico oficial da retomada
- impedir que a continuidade parta de premissas antigas do board interrompido

Saída obrigatória:
- relatório de diagnóstico
- plano reorganizado
- `CURRENT_STATE.md` atualizado

Status atual:
- concluída nesta sessão de planejamento

### Etapa 1 — Review técnico do que já existe

Objetivo:
- revisar a implementação real já presente antes de expandir ou corrigir

Escopo:
- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`
- `lib/tenant-links.ts`
- `components/sidebar.tsx`
- `app/tenant/[clientSlug]/**/*`
- redirects legados em `app/*`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`

Perguntas de saída:
- há duplicação ou inconsistência entre helpers e páginas?
- há algum ponto que ainda consulta dados fora do escopo tenant?
- a fronteira `/clients` vs `/tenant/[clientSlug]/*` está realmente clara?
- o comportamento fail-closed é consistente?

Dependência:
- nenhuma além da Etapa 0

Review obrigatório:
- `$review`

### Etapa 2 — Hardening de superfícies sensíveis

Objetivo:
- reduzir risco real enquanto auth/RBAC completo ainda não existe

Escopo prioritário:
- `app/clients/page.tsx`
- `app/clients/actions.ts`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`
- qualquer boundary relacionada em `lib/auth.ts` se for estritamente necessário

Regras:
- não expandir escopo para redesign completo de auth
- endurecer descoberta/admin surfaces e pontos tenant-operacionais
- preservar fail-closed quando contexto exigido estiver ausente

Dependências:
- revisão mínima da Etapa 1

Review obrigatório:
- `$review`

Security review obrigatório:
- `$security-reviewer`

### Etapa 3 — Correções de consistência e lacunas remanescentes

Objetivo:
- corrigir gaps encontrados na revisão/hardening sem reabrir toda a fase

Escopo típico:
- ajustes em helpers tenant-aware
- correções em links/shell
- correções em pages loaders
- correções em asset detail
- alinhamento fino de APIs

Dependências:
- findings das Etapas 1 e 2

Review obrigatório:
- `$review`

Security review:
- obrigatório se tocar páginas/APIs sensíveis, auth ou ações administrativas

### Etapa 4 — Verificação consolidada

Objetivo:
- produzir evidência atualizada e temporalmente coerente do estado da Fase 2

Escopo:
- `scripts/verification/verify-tenant-panel.mjs`
- validações manuais/independentes sobre:
  - fail-closed das rotas globais legadas
  - persistência de links tenant-aware
  - asset detail tenant-scoped
  - comportamento de `/clients`
  - APIs com tenant context

Importante:
- registrar claramente o que é PASS real
- registrar o que continua inconclusivo por limitação de runtime
- não mascarar ausência de auth/RBAC completo

Dependências:
- Etapas 1–3

Review obrigatório:
- `$review`

Security review obrigatório:
- `$security-reviewer`

### Etapa 5 — Normalização/versionamento do working tree

Objetivo:
- transformar o estado materializado e revisado em baseline versionado governável

Estratégia:
- evitar commit monolítico cego do workspace inteiro
- integrar por slices coerentes e revisadas
- preservar rastreabilidade por ownership

Slices sugeridos:
1. helpers + links tenant-aware
2. shell/navigation + redirects legados
3. páginas tenant-scoped
4. APIs/hardening
5. verification/docs/contexto

Dependências:
- Etapa 4 com evidência suficiente

Review obrigatório:
- `$review`

Security review:
- obrigatório no slice de APIs/admin/auth

### Etapa 6 — Fechamento controlado da fase

Objetivo:
- decidir se a Fase 2 pode ser considerada concluída tecnicamente

Pré-condições:
- review independente concluído
- checkpoint de segurança explícito concluído
- docs/contexto atualizados
- normalização/versionamento executados
- riscos remanescentes explícitos

Não permitir:
- declarar “segurança completa”
- declarar “auth/RBAC completos”

## Ownership boundaries for relaunch

### Worker A — review/architecture consistency

Ownership:
- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`
- `lib/tenant-links.ts`
- `app/tenant/[clientSlug]/layout.tsx`
- relatório técnico de review

Role:
- `$review` ou executor com escopo estrito seguido de `$review`

### Worker B — shell and tenant routes

Ownership:
- `components/sidebar.tsx`
- `app/page.tsx`
- `app/computers/page.tsx`
- `app/servers/page.tsx`
- `app/storage/page.tsx`
- `app/processors/page.tsx`
- `app/network/page.tsx`
- `app/reports/page.tsx`
- `app/assets/[id]/page.tsx`
- `app/tenant/[clientSlug]/**/*` exceto se houver conflito com Worker A/C

Role:
- `$executor`

### Worker C — sensitive/admin/API hardening

Ownership:
- `app/clients/page.tsx`
- `app/clients/actions.ts`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`
- `app/api/collect/windows/route.ts`
- `lib/auth.ts` somente se estritamente necessário

Role:
- `$executor`

Constraint:
- mudanças deste worker exigem `$security-reviewer`

### Worker D — verification/docs/versioning prep

Ownership:
- `scripts/verification/**`
- relatórios em `.omx/reports/`
- planos em `.omx/plans/`
- `CURRENT_STATE.md`
- docs canônicas impactadas

Role:
- `$review` / `$plan` / executor de verificação

## Safe relaunch sequence

1. **Primeiro:** Worker A em review técnico do que já existe
2. **Em paralelo controlado:** Worker C prepara hardening das superfícies sensíveis
3. **Depois:** Worker B corrige inconsistências de rotas/shell/pages encontradas pelo review
4. **Depois:** Worker D consolida verificação atualizada
5. **Depois:** `$security-reviewer` fecha checkpoint de segurança
6. **Depois:** normalização/versionamento por slices
7. **Só então:** decisão de fechamento da Fase 2

## Mandatory gates

### Review gate

Obrigatório antes de considerar a fase pronta:
- coerência entre helpers e queries
- ausência de acesso global acidental nas rotas operacionais
- consistência entre redirects legados e rotas tenant-scoped

### Security gate

Obrigatório antes de qualquer fechamento:
- `/clients` tratado como superfície sensível
- APIs tenant-operacionais fail-closed quando contexto exigido faltar
- nenhuma conclusão afirmar auth/RBAC completos
- riscos residuais explicitados

### Versioning gate

Obrigatório antes do handoff final:
- working tree materializado integrado de forma rastreável
- evitar “estado real só no workspace”

## Definition of success for this replanned cycle

Ao final da retomada deve ficar claro:

- o que já existia na Fase 2
- o que foi apenas revisado vs o que precisou correção
- quais riscos de segurança continuam abertos
- qual baseline versionado passa a representar o estado real
- se a Fase 2 está pronta para encerrar ou se ainda precisa de follow-up
