# Instrução operacional de relançamento — Fase 2 tenant isolation

Status: ready-for-team-read
Created: 2026-04-02
Owner: plan

## Leitura obrigatória antes de executar

Ler nesta ordem:

1. `CONTINUITY.md`
2. `CURRENT_STATE.md`
3. `direcionamento.md`
4. `docs/AI_COLLABORATION.md`
5. `README.md`
6. `.omx/plans/2026-04-02-isolamento-real-por-tenant-no-painel.md`
7. `.omx/reports/2026-04-02-architect-normalization-reset.md`
8. `.omx/reports/2026-04-02-phase2-architect-readiness.md`
9. `.omx/reports/2026-04-02-tenant-panel-security-review.md`
10. `.omx/reports/2026-04-02-tenant-panel-verification.md`
11. `.omx/reports/2026-04-02-phase2-replanning-diagnostic.md`
12. `.omx/plans/2026-04-02-rebaseline-fase2-tenant-isolation.md`

Depois disso, inspecionar o workspace real:

- `app/`
- `lib/`
- `components/`
- `prisma/`
- `scripts/`
- `git status`
- `git log --oneline -10`

---

## Verdade canônica para esta retomada

- Fase 1 está encerrada formalmente
- Fase 2 **já possui artefatos reais no workspace**
- o board/runtime multi-worker anterior **não é fonte confiável**
- o **workspace real** é a verdade técnica atual
- o **git não representa sozinho** o estado atual do projeto
- tenant isolation **não equivale** a auth/RBAC completo
- **não declarar segurança concluída**

---

## O que já existe no workspace

### Implementado

- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`
- `lib/tenant-links.ts`
- `components/sidebar.tsx` tenant-aware
- rotas `app/tenant/[clientSlug]/*`
- detalhe de ativo em `app/tenant/[clientSlug]/assets/[id]/page.tsx`
- redirects legados fail-closed em:
  - `app/page.tsx`
  - `app/computers/page.tsx`
  - `app/servers/page.tsx`
  - `app/storage/page.tsx`
  - `app/processors/page.tsx`
  - `app/network/page.tsx`
  - `app/reports/page.tsx`
  - `app/assets/[id]/page.tsx`
- APIs tenant-aware:
  - `app/api/dashboard/stats/route.ts`
  - `app/api/inventory/computers/route.ts`
- endpoint legado neutralizado:
  - `app/api/collect/windows/route.ts` com `410`
- verificador:
  - `scripts/verification/verify-tenant-panel.mjs`

### Ainda aberto

- hardening de `/clients`
- hardening de `app/clients/actions.ts`
- review independente do que já existe
- checkpoint de segurança
- normalização/versionamento do working tree real
- revalidação técnica antes de fechamento

---

## Objetivo desta retomada

**Não reconstruir a Fase 2 do zero.**

Objetivo correto:

1. revisar o que já existe
2. endurecer superfícies sensíveis
3. corrigir gaps remanescentes
4. verificar novamente
5. normalizar/versionar
6. só então decidir fechamento

---

## Regras obrigatórias de execução

- não implementar fora do ownership definido
- não usar claims/leases antigos
- não fingir que git já representa o estado real
- não fazer commit amplo cego do workspace inteiro
- não tratar `clientSlug` sozinho como fronteira de segurança completa
- toda mudança sensível exige `security-review`
- sem autoaprovação

---

## Organização de execução

### Worker A — review técnico / consistência arquitetural

**Role sugerido:** `$review`

**Ownership:**
- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`
- `lib/tenant-links.ts`
- `app/tenant/[clientSlug]/layout.tsx`
- relatório técnico de review

**Missão:**
- revisar helpers centrais
- validar coerência de boundary tenant-aware
- apontar inconsistências entre helpers, loaders, rotas e shell
- confirmar se há algum acesso fora do escopo tenant

**Não fazer:**
- não expandir escopo para auth completa
- não fechar fase

---

### Worker B — shell, redirects e páginas tenant

**Role sugerido:** `$executor`

**Ownership:**
- `components/sidebar.tsx`
- `app/page.tsx`
- `app/computers/page.tsx`
- `app/servers/page.tsx`
- `app/storage/page.tsx`
- `app/processors/page.tsx`
- `app/network/page.tsx`
- `app/reports/page.tsx`
- `app/assets/[id]/page.tsx`
- `app/tenant/[clientSlug]/**/*`

**Missão:**
- ajustar inconsistências encontradas no review
- preservar fail-closed nas rotas legadas
- manter coerência tenant-aware no shell e nas páginas operacionais

**Dependência:**
- executar depois dos findings iniciais do Worker A

---

### Worker C — hardening sensível/admin/API

**Role sugerido:** `$executor`

**Ownership:**
- `app/clients/page.tsx`
- `app/clients/actions.ts`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`
- `app/api/collect/windows/route.ts`
- `lib/auth.ts` apenas se estritamente necessário

**Missão:**
- reduzir risco real nas superfícies sensíveis
- endurecer `/clients`
- endurecer ações administrativas
- reforçar fail-closed nos pontos tenant-operacionais

**Obrigatório:**
- passar por `$security-reviewer`

**Não fazer:**
- não tentar resolver o programa completo de auth/RBAC nesta fase

---

### Worker D — verificação, contexto e preparação de versionamento

**Role sugerido:** `$review` ou executor de verificação

**Ownership:**
- `scripts/verification/**`
- `.omx/reports/**`
- `.omx/plans/**`
- `CURRENT_STATE.md`
- docs impactadas

**Missão:**
- atualizar evidência de verificação
- registrar claramente PASS / FAIL / inconclusivo
- preparar slices de normalização/versionamento
- consolidar contexto operacional

---

## Sequência obrigatória

### Etapa 1 — Review técnico inicial

Executar primeiro:
- Worker A

Saída esperada:
- relatório técnico do que está consistente
- gaps objetivos para correção

### Etapa 2 — Hardening sensível

Executar em seguida:
- Worker C

Saída esperada:
- mudanças mínimas necessárias para reduzir risco real
- sem prometer auth/RBAC completo

### Etapa 3 — Correções de consistência

Executar depois:
- Worker B

Saída esperada:
- ajustes focados nos findings de review/hardening

### Etapa 4 — Verificação consolidada

Executar depois:
- Worker D

Saída esperada:
- evidência atualizada
- limites do runtime explicitados

### Etapa 5 — Security review obrigatório

Executar depois:
- `$security-reviewer`

Saída esperada:
- checkpoint explícito
- riscos remanescentes documentados

### Etapa 6 — Normalização/versionamento

Executar depois:
- integrar por slices, não por commit amplo cego

Slices sugeridos:
1. helpers tenant-aware
2. shell + redirects legados
3. páginas tenant-scoped
4. APIs/hardening
5. verification + docs + contexto

### Etapa 7 — Decisão de fechamento

Só pode acontecer se houver:
- review independente
- security review explícito
- verificação atualizada
- versionamento normalizado
- contexto atualizado

---

## Gates obrigatórios

### Gate de review

Confirmar:
- helpers centrais coerentes
- ausência de consultas globais acidentais nas rotas operacionais
- fronteira `/clients` vs `/tenant/[clientSlug]/*` preservada

### Gate de segurança

Confirmar:
- `/clients` tratado como superfície sensível
- APIs tenant-operacionais fail-closed
- nenhuma conclusão afirma “segurança completa”
- nenhuma conclusão afirma “auth/RBAC completos”

### Gate de versionamento

Confirmar:
- o baseline versionado passa a representar o estado real revisado
- sem depender de “verdade só no workspace”

---

## Resultado esperado desta retomada

Ao final deve ficar claro:

- o que já estava implementado
- o que precisou correção
- quais riscos continuam abertos
- qual baseline versionado representa o estado real
- se a Fase 2 pode ou não ser fechada

---

## Instrução final para o team

Executar **de acordo com este arquivo**, usando o workspace atual como fonte técnica de verdade, sem reutilizar automaticamente estado antigo de board/runtime.

Prioridade:

1. review técnico
2. hardening sensível
3. correções
4. verificação
5. security review
6. normalização/versionamento
7. decisão de fechamento
