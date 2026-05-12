# Build de produção (Next.js)

Este repositório usa **Next.js 16.1.6**.

## Objetivo

Garantir que `next build` finalize de forma confiável (sem travar/timeout) para permitir deploy em produção.

## Comandos

- Build (webpack, recomendado para produção neste repo):
  - `npm run build`
- Verificação com watchdog + timeout (usado em CI/local para detectar travamentos):
  - `npm run build:verify`

## Observações

- O script `scripts/verification/run-build.mjs` força:
  - `--webpack`
  - `NEXT_TELEMETRY_DISABLED=1` (por padrão)
  - `NODE_OPTIONS=--max-old-space-size=4096` (se não estiver definido)

## Resultado (Windows / PowerShell)

Executado em 2026-05-12:

- `NODE_OPTIONS=--max-old-space-size=4096 npm run build` finalizou (~20s).
- `npm run build:verify` finalizou (<60s).

