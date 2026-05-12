---
name: inventario-secrets-management
description: Use when handling ADMIN_SECRET, enrollment keys, API keys, provisioning artifacts, secret hashing, and secret exposure risks in the Inventario repository.
---

# Inventario Secrets Management

Use this skill when touching secrets, provisioning, bootstrap flows, or credential storage.

## Existing secret model

- `process.env.ADMIN_SECRET` protects admin surfaces
- `Client.enrollmentKeyHash` stores tenant provisioning keys hashed
- `AgentAuth.apiKeyHash` stores agent API keys hashed
- plaintext keys are intended to be shown once at issuance time

## Read first

- `lib/auth.ts`
- `lib/provisioning.ts`
- `app/api/clients/route.ts`
- `app/api/agent/register/route.ts`
- `app/clients/actions.ts`
- `prisma/schema.prisma`

## Rules

- Never persist plaintext secrets into docs or source
- Prefer hash comparison over plaintext storage
- Treat bootstrap/install commands as secret-bearing artifacts
- Note that generated install commands may leak secrets into shell history if mishandled

## When reviewing a change

Check:

1. where the secret is generated
2. whether plaintext is returned only once
3. where hash storage occurs
4. whether logs/errors could expose the value
5. whether docs or scripts accidentally normalize insecure handling

## Do not

- commit `.env` values
- store enrollment/API keys unhashed
- log secrets in console output
- assume admin secret alone equals full user authentication
