# Architect validation — Phase 2 readiness

Date: 2026-04-02
Owner: architect
Status: approved-with-constraints

## Go / No-Go recommendation

**GO, with constraints.**

Phase 2 may start now because:
- Phase 1 is formally closed
- git/tooling baseline exists
- no active claim_conflict blocks the board
- remaining typecheck/build failures are currently bounded and classified as non-blocking operational risks

Phase 2 must **not** assume:
- full web authentication/RBAC is complete
- lint/test are full quality gates
- repo normalization is finished

## Is the current architecture ready for Phase 2?

**Yes, for tenant-isolation implementation.**

The architecture is ready for the approved next step:
- explicit tenant scope in URL (`/tenant/[clientSlug]/*`)
- central server-side tenant resolver/helpers
- fail-closed tenant-operational pages and APIs
- `/clients` preserved as the global/admin entry surface

## Exact goals of Phase 2

Phase 2 should implement the approved tenant-isolation scope in this order:

1. **Security-first guardrails on exposed admin/sensitive surfaces**
   - review/protect `/clients` entry points and sensitive server actions
   - keep tenant-operational APIs fail-closed by default
   - do not expand public/global surfaces while migration is in progress

2. **Introduce central tenant context / scope helpers**
   - resolve tenant from `clientSlug`
   - validate active tenant
   - expose reusable Prisma filter helpers

3. **Move inventory UI to explicit tenant-scoped routes**
   - dashboard, computers, servers, storage, processors, network, reports, assets

4. **Preserve tenant in shell/navigation**
   - sidebar links tenant-aware
   - current tenant visible in panel shell

5. **Harden panel APIs and remove stale/mock paths**
   - stats and inventory endpoints tenant-aware
   - stale `prisma.asset` paths corrected/disabled
   - asset detail path uses real data, not `mockAssets`

## Do typecheck/build timeouts introduce architectural risk?

**Not architectural blocking risk right now.**

They are operational verification risks, not evidence that the tenant architecture is wrong.
They become architectural risk only if they hide:
- incorrect route/module boundaries
- invalid type contracts in new tenant helpers
- broken server/client component boundaries

So for Phase 2:
- treat them as **non-blocking for start**
- treat them as **must-monitor during delivery**
- require re-verification in a cleaner runtime before declaring the phase fully hardened

## Should security/authentication work be prioritized first?

**Yes, but narrowly.**

Priority first in Phase 2 should be:
- securing exposed admin/sensitive surfaces that would undermine tenant isolation while the migration happens
- fail-closing tenant-operational APIs/pages when tenant/auth context is missing

Out of scope for this phase:
- full RBAC redesign
- complete web-auth rollout across the whole product

So the correct interpretation is:
- **security-first hardening that protects the tenant-isolation rollout = in scope and priority 1**
- **full authentication/RBAC program = next phase / follow-up**

## Blocking vs Non-blocking for Phase 2

### Blocking

1. Any page/API in Phase 2 that can still expose cross-tenant data without explicit tenant context
2. Any sensitive/admin surface left effectively open while tenant migration is underway
3. Any route/API still depending on stale model paths (`prisma.asset`) in the main inventory flow
4. Any architecture change that breaks the explicit boundary between `/clients` and `/tenant/[clientSlug]/*`

### Non-blocking

1. `npm run test` still being a stub
2. narrow lint scope
3. deterministic typecheck timeout in this runtime
4. deterministic build timeout / `.next` lock contention in this runtime
5. `safe.directory` nuance in `/mnt/e`
6. broader repo normalization outside the minimum working baseline

## Recommended Phase 2 scope

**Phase 2 scope: security-first tenant isolation.**

Recommended concrete scope:
- central tenant helpers in `lib/tenant-context.ts` / `lib/tenant-scope.ts`
- explicit tenant routes under `app/tenant/[clientSlug]/*`
- tenant-aware sidebar/navigation
- tenant-aware dashboard/stats/computers first, then remaining inventory pages
- real tenant-aware asset detail
- stale inventory/API paths corrected or fail-closed
- targeted security hardening on `/clients` and sensitive related actions/APIs sufficient to avoid undermining the migration

## Execution priorities

1. **Priority 1:** security-first hardening and fail-closed boundaries
2. **Priority 2:** central tenant resolver/helpers
3. **Priority 3:** route migration and shell/navigation
4. **Priority 4:** panel APIs + stale/mock path cleanup
5. **Priority 5:** verification + docs/context refresh

## Risks to carry into execution

- auth/RBAC remains incomplete beyond narrow hardening
- verification runtime is noisy/contended
- stale repo-state normalization can confuse attribution if ownership is not enforced strictly
- migration can leave mixed global/tenant routes unless shell and entry behavior are changed early

## Architect final conclusion

**GO for Phase 2 execution now.**

Proceed with a **security-first tenant-isolation rollout**, not with a full auth/RBAC redesign.
