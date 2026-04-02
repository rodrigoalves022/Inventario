# Phase 2 initial technical review

Date: 2026-04-02
Owner: review
Status: initial-findings

## Scope reviewed

- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`
- `lib/tenant-links.ts`
- `app/tenant/[clientSlug]/layout.tsx`
- tenant-scoped loaders under `app/tenant/[clientSlug]/*`
- `components/sidebar.tsx` only as supporting shell/boundary evidence

## What is coherent

1. **Fail-closed tenant resolution is centralized**
   - `lib/tenant-context.ts` resolves by slug, rejects inactive tenants, and calls `notFound()` through `requireTenantContext`.

2. **Tenant scoping helpers are centralized**
   - `lib/tenant-scope.ts` consistently pushes filtering through `device -> agentAuth -> client`.
   - reviewed tenant pages consume these helpers instead of writing ad-hoc global queries.

3. **Tenant shell boundary is structurally explicit**
   - `app/tenant/[clientSlug]/layout.tsx` requires tenant context before rendering the shell.
   - `components/sidebar.tsx` uses tenant-aware link builders for operational routes.

4. **Reviewed tenant pages are scoped**
   - dashboard, computers, servers, storage, processors, network, reports, and asset detail all use tenant-scoped Prisma queries.
   - no accidental global `findMany()` or aggregate was found in the reviewed tenant route files.

## Objective gaps

1. **Slug normalization is not reused consistently after tenant resolution**
   - files:
     - `app/tenant/[clientSlug]/page.tsx`
     - `app/tenant/[clientSlug]/computers/page.tsx`
     - `app/tenant/[clientSlug]/servers/page.tsx`
     - `app/tenant/[clientSlug]/storage/page.tsx`
     - `app/tenant/[clientSlug]/processors/page.tsx`
     - `app/tenant/[clientSlug]/network/page.tsx`
     - `app/tenant/[clientSlug]/reports/page.tsx`
     - `app/tenant/[clientSlug]/assets/[id]/page.tsx`
   - finding:
     - these pages call `requireTenantContext(clientSlug)` but continue querying with the raw route param instead of the normalized `tenant.slug`.
   - impact:
     - this appears fail-closed rather than leak-prone, but it can create inconsistent false negatives if route casing diverges.

2. **Tenant relation helper accepts raw slug without internal normalization**
   - file:
     - `lib/tenant-scope.ts`
   - finding:
     - helpers assume callers already normalized the slug.
   - impact:
     - consistent use today is mostly safe, but the contract is implicit and easy to misuse later.

3. **Admin links remain visible from the tenant shell**
   - file:
     - `components/sidebar.tsx`
   - finding:
     - tenant shell still exposes `/clients`, `/users`, `/security`, `/settings`.
   - impact:
     - the route boundary is still technically preserved, but the shell intentionally surfaces global/admin areas and therefore deserves security attention.

## Accidental global access risk

- **No direct accidental global access was found** in the reviewed tenant route loaders.
- Current risk is more about:
  1. future misuse of unnormalized slug inputs, and
  2. global/admin surface discoverability outside auth.

## `/clients` vs `/tenant/[clientSlug]/*` boundary

**Technically preserved in the reviewed code.**

Evidence:

- tenant-operational pages live under explicit tenant routes
- tenant shell builds tenant-scoped operational links
- global/admin routes remain separate top-level routes

Important limitation:

- preserved boundary does **not** equal access control
- `/clients` remains a sensitive discovery/admin surface and still requires security hardening

## Explicit findings for Worker B

1. after `requireTenantContext(clientSlug)`, reuse the returned `tenant.slug` for tenant-scoped queries and links instead of the raw param
2. make slug normalization/usage contract explicit in tenant page loaders to avoid future inconsistent lookups
3. preserve the current route split between global/admin and tenant-operational surfaces while applying any shell/page consistency fixes

## Security attention needed

**Yes.**

Files and reason:

- `components/sidebar.tsx`
  - global/admin destinations are visible from tenant shell
- `/clients` surface and related admin/API files
  - boundary is visible, but access control still must remain fail-closed and explicitly reviewed
