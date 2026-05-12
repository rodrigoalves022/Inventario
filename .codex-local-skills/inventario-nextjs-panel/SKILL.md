---
name: inventario-nextjs-panel
description: Use when editing the Next.js 16 App Router panel in this repo, especially tenant routes, fail-closed admin pages, generated route types, and runtime-vs-build distinctions.
---

# Inventario Next.js Panel

Use this skill for App Router work in `app/**`.

## Key repo specifics

- Next.js 16 + App Router + TypeScript
- tenant pages live under `app/tenant/[clientSlug]/**`
- `/` redirects to `/clients`
- `/clients` is intentionally admin-gated and fail-closed
- route/layout typing must align with Next 16 generated types

## Read first

- `app/layout.tsx`
- `app/page.tsx`
- `app/clients/page.tsx`
- `app/tenant/[clientSlug]/layout.tsx`
- `CURRENT_STATE.md`

## Important distinctions

- A fail-closed `404` on `/clients` without header is not “site broken”
- Runtime success does not mean production build is healthy
- Build timeout must be tracked separately from access/runtime behavior

## When editing route props

- Prefer `PageProps<'/route'>` and `LayoutProps<'/route'>` where applicable
- Keep param handling aligned with Next 16 expectations

## Do not

- weaken `/clients` just to make browser access easier
- conflate build issues with runtime issues
- bypass tenant context checks for convenience
