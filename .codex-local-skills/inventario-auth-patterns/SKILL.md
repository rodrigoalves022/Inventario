---
name: inventario-auth-patterns
description: Use when designing or reviewing authentication/authorization for the Inventario panel, especially when deciding how to evolve from existing secret and key primitives toward safer web auth and RBAC.
---

# Inventario Auth Patterns

Use this skill when the task is about auth direction, reuse, or migration strategy.

## Current state

The repo does **not** currently include a complete web auth framework such as:

- NextAuth / Auth.js
- Clerk
- Lucia
- Better Auth
- Auth0
- Passport

But it already has reusable primitives:

- admin secret gate for privileged surfaces
- tenant enrollment key issuance and hashing
- agent API key issuance and hashing
- tenant-agent-device data relationships

## Read first

- `lib/auth.ts`
- `prisma/schema.prisma`
- `app/api/clients/route.ts`
- `app/api/agent/register/route.ts`
- `app/api/agent/checkin/route.ts`
- `CURRENT_STATE.md`
- `.omx/TEAM_SYNC.md`

## Guidance

- Do not propose “auth from zero” without checking reuse of existing primitives
- Do not treat current admin-secret gating as complete user auth
- Separate:
  - machine/agent auth
  - tenant provisioning auth
  - web user auth
  - authorization / RBAC

## Preferred reasoning path

1. Identify which auth problem is being solved
2. Reuse existing primitives where possible
3. Preserve fail-closed behavior while migrating
4. Require security review for any auth/RBAC change

## Do not

- collapse agent auth and web user auth into one mechanism without justification
- remove current gates before a replacement is validated
- claim security completion before RBAC exists
