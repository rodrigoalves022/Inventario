---
name: inventario-prisma-tenant
description: Use when working on Prisma schema, tenant-linked queries, Client-AgentAuth-Device relationships, and tenant-scoped filtering in the Inventario repository.
---

# Inventario Prisma Tenant

Use this skill for schema and query work involving tenant isolation.

## Read first

- `prisma/schema.prisma`
- `lib/prisma.ts`
- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`

## Core model

- `Client`
- `AgentAuth`
- `Device`
- dependent inventory tables (`Hardware`, `Network`, `Disk`, `Software`, `CollectionLog`)

Tenant isolation currently depends on:

- `Client.slug`
- active client checks
- traversal through `AgentAuth`

## Query rules

- Prefer central tenant-scope helpers over ad hoc filters
- Ensure tenant filters are applied through the proper relation chain
- Preserve `isActive` checks where intended

## Do not

- introduce direct global inventory reads in tenant pages
- duplicate tenant filter logic inconsistently
- assume slug scoping equals full authorization
