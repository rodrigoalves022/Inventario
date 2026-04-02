# Phase 2 security checkpoint — tenant isolation relaunch

Date: 2026-04-02  
Owner: security-reviewer  
Status: pass-with-constraints

## Scope reviewed

- `app/clients/page.tsx`
- `app/clients/actions.ts`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`
- `app/api/collect/windows/route.ts`
- `components/sidebar.tsx`
- `app/tenant/[clientSlug]/**/*`
- `lib/auth.ts`
- current verification/context reports under `.omx/reports/`

## Security checkpoint decision

**PASS with constraints.**

The relaunch now enforces the intended fail-closed posture for the scoped surfaces in this phase:

- `/clients` is treated as a sensitive admin/discovery surface
- tenant-operational APIs fail closed when the required admin secret or tenant context is missing
- the legacy collect path is neutralized
- the tenant shell no longer exposes direct global/admin navigation links

This is **not** a declaration that panel auth/RBAC is complete.

## Gate decisions

### `/clients` treated as sensitive surface

**Confirmed.**

Evidence:

- `app/clients/page.tsx` rejects access without the admin secret
- `app/clients/actions.ts` refuses provisioning mutations without the admin secret
- the page remains a privileged admin/discovery entry point, not a public panel surface

### Tenant-operational APIs fail-closed when required context/auth secret is missing

**Confirmed.**

Evidence:

- `app/api/dashboard/stats/route.ts` returns `404` if the admin secret is missing
- `app/api/inventory/computers/route.ts` returns `404` if the admin secret is missing
- both routes still require `clientSlug` and reject missing/unknown inactive tenants
- `app/api/collect/windows/route.ts` now returns `410` for all common verbs

### No claim of full auth/RBAC completion

**Confirmed.**

The implementation still relies on shared-secret hardening and URL/tenant scoping.
It does **not** yet establish a complete authenticated user/session boundary for the web panel.

### Residual risks explicitly documented

**Confirmed.**

Residual risks are documented below and also reflected in `CURRENT_STATE.md` and the verification checkpoint report.

## Positive security findings

1. **Fail-closed admin/sensitive gating is present**
   - `/clients` and its server actions are no longer open by default.

2. **Tenant-operational APIs are protected against anonymous access**
   - dashboard and inventory APIs now require the admin secret before tenant resolution and data access.

3. **Legacy ingest surface is neutralized**
   - `app/api/collect/windows/route.ts` now consistently returns `410 Gone`.

4. **Tenant shell no longer advertises admin destinations directly**
   - `components/sidebar.tsx` keeps the tenant shell focused on tenant-operational links and only references `/clients` as a separate admin area.

## High findings

### HIGH — Shared secret hardening is not full panel auth/RBAC

The current gate is effective as a fail-closed barrier for this relaunch step, but it is still a shared-secret control.

Impact:

- if the admin secret is leaked, tenant and admin surfaces remain accessible
- there is still no end-user/session-level authorization model for the web panel

### HIGH — `/clients` remains a privileged discovery/admin surface

Even though access is now gated, the surface still exposes provisioning capability and tenant discovery.

Impact:

- it remains a high-value target
- it should continue to be treated as sensitive until a proper auth boundary exists

## Medium findings

### MEDIUM — Live tenant verification remains data-dependent

The verification context reports show the structural checks are green, but live tenant-scope validation is still constrained by the current database state and seeded fixture availability.

Impact:

- security confidence is good at the code-path level
- runtime confidence remains incomplete without seeded tenant data

### MEDIUM — Tenant shell still depends on URL scoping, not authenticated principal scoping

The tenant route split is preserved and fail-closed, but tenant access is still primarily established by URL slug plus server-side helper resolution.

Impact:

- this is acceptable for the relaunch checkpoint
- it is not a substitute for a full authenticated access-control model

## Conclusion

The Phase 2 relaunch now meets the security checkpoint required for this stage:

- sensitive surfaces are treated as sensitive
- tenant-operational APIs fail closed
- the legacy collect surface is disabled
- the tenant shell is no longer advertising global/admin destinations directly

However:

- security is **not complete**
- auth/RBAC is **not complete**
- follow-up hardening remains required for a full panel access-control story

## Changed file

- `.omx/reports/2026-04-02-phase2-security-checkpoint.md`
