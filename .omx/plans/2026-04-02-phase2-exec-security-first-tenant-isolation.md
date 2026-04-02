# Plano de execução — Phase 2 (security-first tenant isolation)

Status: approved
Date: 2026-04-02
Owner: plan

## Objective

Executar a Phase 2 como implementação de **isolamento real por tenant com priorização de segurança/fail-closed**, preservando `/clients` como superfície global/admin e migrando o painel operacional para `/tenant/[clientSlug]/*`.

## Go / No-Go

- **GO** para execução
- sem autoaprovação de release final
- timeouts atuais de typecheck/build são **non-blocking para início**, mas precisam continuar explícitos

## Scope

### In scope
1. hardening de superfícies sensíveis que possam invalidar o rollout
2. helpers centrais de tenant context/scope
3. rotas tenant-scoped e navegação tenant-aware
4. loaders/APIs tenant-aware e fail-closed
5. remoção/correção de caminhos mock/stale no fluxo principal
6. atualização de docs/contexto ao final

### Out of scope
1. RBAC completo
2. redesign de auth web completo
3. redesign visual amplo

## Workstreams

### Lane A — Architecture + guardrails
Owner role: architect

- validar boundary `/clients` vs `/tenant/[clientSlug]/*`
- definir comportamento de entrada em `/`
- revisar drift documental durante a implementação

### Lane B — Security-first hardening
Owner role: security-reviewer / executor

- revisar/proteger superfícies sensíveis mínimas para não comprometer a fase
- garantir fail-closed quando tenant/contexto necessário estiver ausente
- checkpoint de segurança ao fim

### Lane C — Tenant context + routes + navigation
Owner role: executor

- criar helpers centrais
- migrar shell/sidebar
- migrar dashboard/computers primeiro, depois páginas restantes

### Lane D — APIs + verification + closure
Owner role: review/executor

- endurecer APIs do painel
- corrigir stale paths (`prisma.asset`, `mockAssets` no fluxo principal)
- registrar verificação, atualizar CURRENT_STATE.md e docs afetadas

## Ordered execution priorities

1. security-first hardening / fail-closed boundaries
2. tenant helpers
3. dashboard + computers + sidebar
4. remaining inventory routes/pages
5. API cleanup and asset detail
6. verification, reports, CURRENT_STATE/docs

## Blocking for execution

- cross-tenant exposure in any migrated page/API
- sensitive/global surfaces left effectively open and conflicting with migration
- stale main-flow route still depending on invalid model path

## Non-blocking for execution

- test stub
- narrow lint
- typecheck timeout in current runtime
- build timeout / .next lock contention in current runtime

## Expected deliverables

- tenant helpers landed
- operational panel under explicit tenant routes
- shell/navigation preserves tenant
- panel APIs fail-closed and tenant-aware
- stale/mock main-flow paths corrected
- CURRENT_STATE.md updated after Phase 2 progress
