---
name: inventario-api-security
description: "Project-specific API security checklist for Inventario Enterprise routes and admin surfaces."
risk: medium
source: local
date_added: "2026-04-07"
---

# Inventario API Security

Use this skill when changing API routes, admin surfaces, agent provisioning, or secrets-related code in this repository.

## Focus areas
- Preserve tenant isolation and fail-closed behavior.
- Protect `/clients` and admin-only routes.
- Never persist secrets in plaintext.
- Reuse existing auth primitives before introducing new trust boundaries.
- Require explicit security review for sensitive changes.

## Checklist
1. Validate authentication and authorization expectations.
2. Verify tenant scoping on every query and mutation.
3. Sanitize inputs and avoid data leaks in errors.
4. Keep secrets hashed, scoped, and out of docs/source control.
5. Record residual risks in `CURRENT_STATE.md` or `.omx/TEAM_SYNC.md` when relevant.

## Companion skills
- `api-security-best-practices`
- `secrets-management`
- `prisma-expert`
