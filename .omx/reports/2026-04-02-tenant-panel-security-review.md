# Tenant Panel Security Review

Date: 2026-04-02
Worker: worker-1
Task: 3
Role: security-reviewer
Status: review-only (no self-approval)

## Scope Reviewed

- `app/tenant/[clientSlug]/*`
- `components/sidebar.tsx`
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`
- `app/api/collect/windows/route.ts`
- tenant helper files in `lib/tenant-*`

## Positive Findings

1. **Fail-closed route structure improved**
   - operational pages now require explicit tenant slug in the URL
   - legacy global inventory routes redirect to `/clients`

2. **Main asset detail no longer uses mock data**
   - main inventory detail route now queries Prisma under tenant scope

3. **Legacy stale asset ingestion path was neutralized**
   - `app/api/collect/windows/route.ts` now returns `410`

4. **Panel APIs now require tenant context**
   - `GET /api/dashboard/stats`
   - `GET /api/inventory/computers`

## Findings

### HIGH — Tenant routes and APIs are still unauthenticated

The new tenant-aware design improves data partitioning, but it does **not** establish a trust boundary by itself.

Current risk:

- `app/tenant/[clientSlug]/*` pages rely on `clientSlug` only
- `GET /api/dashboard/stats?clientSlug=<slug>` has no admin/session check
- `GET /api/inventory/computers?clientSlug=<slug>` has no admin/session check
- if a slug is known or guessed, tenant data may still be viewable without user authentication

Impact:

- cross-user data exposure remains possible even if cross-tenant leakage by coding mistake is reduced
- the implementation is **tenant-scoped**, but not yet **access-controlled**

Recommendation:

1. add panel authentication before considering the tenant panel security-complete
2. bind tenant access to authenticated principal/session, not only to URL slug
3. reject unauthenticated requests at page/API boundaries

### MEDIUM — `/clients` remains a discovery surface without auth

The clients page currently acts as a hub and exposes tenant names/slugs plus direct panel entry points.

Impact:

- makes tenant enumeration easier
- increases exploitability of the missing auth issue above

Recommendation:

- require admin/operator auth on `/clients`
- avoid exposing panel-entry actions before auth is in place

### MEDIUM — Verification pipeline is incomplete

Observed gaps:

- no working local lint execution (`eslint` unavailable)
- no `npm test` script
- full `tsc` and bounded `next build` verification remain inconclusive in current runtime

Impact:

- regressions can slip through despite correct local logic
- security-sensitive routing changes lack strong automated guardrails

Recommendation:

- add/restore lint and test tooling
- add CI checks for tenant-scoped routes and APIs

## Conclusion

The delivery materially improves **tenant isolation by route and query scope**, but it should **not** be treated as security-approved.

Reason:

- isolation by `clientSlug` is implemented
- authentication/authorization for panel access is still missing

## Required Follow-up Before Security Approval

1. add panel auth/session enforcement
2. bind tenant access to authenticated identity
3. protect `/clients` as an authenticated admin surface
4. rerun review after auth/RBAC work lands
