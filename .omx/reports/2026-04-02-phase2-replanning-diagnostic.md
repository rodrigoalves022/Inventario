# Phase 2 replanning diagnostic — workspace-first baseline

Date: 2026-04-02
Owner: plan
Status: finalized

## Objective

Inventory the real Phase 2 state from the current workspace, compare it with the approved tenant-isolation plan, and define what is already implemented, partial, inconsistent, unverifiable, or security-sensitive before a safe relaunch.

## Sources used

- `CONTINUITY.md`
- `CURRENT_STATE.md`
- `direcionamento.md`
- `docs/AI_COLLABORATION.md`
- `README.md`
- `.omx/plans/2026-04-02-isolamento-real-por-tenant-no-painel.md`
- `.omx/reports/2026-04-02-architect-normalization-reset.md`
- `.omx/reports/2026-04-02-phase2-architect-readiness.md`
- `.omx/reports/2026-04-02-tenant-panel-security-review.md`
- `.omx/reports/2026-04-02-tenant-panel-verification.md`
- current workspace under `app/`, `lib/`, `components/`, `prisma/`, `scripts/`
- `git status`
- `git log --oneline -10`

## Executive diagnosis

Phase 2 is **materially advanced in the workspace**. It is not a greenfield implementation anymore.

However, it is **not yet governable as finished work** because:

1. git history still stops at the Phase 1 closure chain
2. the workspace contains broad untracked state
3. security review explicitly says tenant isolation is **not** security approval
4. verification evidence is useful but still incomplete/noisy
5. the prior multi-worker runtime cannot be treated as the live execution source anymore

## Progress map

### Implemented in the workspace

1. **Central tenant helpers**
   - `lib/tenant-context.ts`
   - `lib/tenant-scope.ts`
   - `lib/tenant-links.ts`

2. **Tenant-scoped panel shell**
   - `app/tenant/[clientSlug]/layout.tsx`
   - `components/sidebar.tsx` with tenant-aware navigation/banner

3. **Tenant-scoped operational pages**
   - `app/tenant/[clientSlug]/page.tsx`
   - `app/tenant/[clientSlug]/computers/page.tsx`
   - `app/tenant/[clientSlug]/servers/page.tsx`
   - `app/tenant/[clientSlug]/storage/page.tsx`
   - `app/tenant/[clientSlug]/processors/page.tsx`
   - `app/tenant/[clientSlug]/network/page.tsx`
   - `app/tenant/[clientSlug]/reports/page.tsx`
   - `app/tenant/[clientSlug]/assets/[id]/page.tsx`

4. **Fail-closed legacy inventory entry points**
   - `app/page.tsx`
   - `app/computers/page.tsx`
   - `app/servers/page.tsx`
   - `app/storage/page.tsx`
   - `app/processors/page.tsx`
   - `app/network/page.tsx`
   - `app/reports/page.tsx`
   - `app/assets/[id]/page.tsx`
   all redirect to `/clients`

5. **Tenant-aware panel APIs**
   - `app/api/dashboard/stats/route.ts`
   - `app/api/inventory/computers/route.ts`

6. **Neutralized stale ingest surface**
   - `app/api/collect/windows/route.ts` returns `410`

7. **Verification support exists**
   - `scripts/verification/verify-tenant-panel.mjs`

### Partially implemented / needs hardening

1. **Security boundary**
   - pages/APIs are tenant-scoped by slug
   - but access control/auth is still missing

2. **Administrative surface**
   - `/clients` remains a global discovery/admin surface
   - `app/clients/actions.ts` still performs sensitive provisioning actions without panel auth boundary

3. **Verification posture**
   - source-level and live-data checks exist
   - but lint/test/typecheck/build evidence remains incomplete or environment-limited

4. **Governance/versioning**
   - implementation exists in workspace
   - but is not normalized into reviewed/versioned slices yet

### Inconsistent or needing explicit review

1. **Historical evidence drift**
   - earlier reports mention environments where repo/tooling differed materially
   - current workspace must now override those older assumptions

2. **Plan order vs actual implementation order**
   - the workspace appears to have implemented most tenant routes before governance normalisation and before authenticated hardening
   - this is workable, but must be reviewed as already-landed reality rather than re-built from scratch

3. **Security posture mismatch**
   - architect readiness says “GO with constraints”
   - security review says “not security-approved”
   - these are compatible only if read temporally: execution may continue, but phase closure cannot claim security completion

### Sensitive areas requiring mandatory security review before closure

- `app/clients/page.tsx`
- `app/clients/actions.ts`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`
- `app/api/collect/windows/route.ts`
- any future changes to `lib/auth.ts`

## Comparison against the approved plan

### Plan items already materially present

- central tenant context/scope helpers
- tenant-scoped routes
- tenant-aware navigation
- fail-closed legacy inventory entry behavior
- tenant-aware stats/computers APIs
- real tenant-aware asset detail route
- stale/mock main-flow cleanup

### Plan items still not sufficiently closed

- security hardening sufficient to prevent unauthenticated panel/data access
- independent review of the already-materialized implementation
- stronger verification coverage
- documentation/API/architecture refresh tied to the real landed state
- working-tree normalization/versioning

## Planning conclusion

The correct continuation point is:

**Do not rebuild Phase 2 from zero. Do not close Phase 2 from current workspace state either.**

Continue from the materialized workspace by:

1. reviewing what already exists
2. hardening sensitive surfaces
3. correcting any gaps found by review
4. verifying again
5. only then normalizing/versioning and closing
