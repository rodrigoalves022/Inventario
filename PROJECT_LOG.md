# PROJECT_LOG

Status: historical
Scope: rolling-history
Last-reviewed: 2026-04-02

> Este arquivo permanece como histórico resumido.
> A fonte operacional atual é `CURRENT_STATE.md`.
> O arquivo de retomada rápida é `CONTINUITY.md`.

## Visão geral

Inventario Enterprise é uma plataforma de inventário corporativo com arquitetura cliente-servidor, postura Zero Trust, backend em Next.js/Prisma e agente principal em Go.

## Marcos já consolidados

- modelagem de dados com `Client`, `AgentAuth`, `Device`, `Hardware`, `Network`, `Disk`, `Software` e `CollectionLog`
- agente principal em Go com comandos operacionais e estrutura modular
- registro seguro de agentes com emissão única de `apiKey`
- provisioning multi-tenant com `Client` e `enrollmentKey`
- upsert de device por `agentAuthId`
- bootstrap web e download do binário Windows do agente

## Estado validado anteriormente

- `go test ./...` e `go build ./cmd/inventario-agent` executados com sucesso em ciclos anteriores
- `npx prisma generate` e `npx prisma db push` executados com sucesso em ciclos anteriores
- fluxo HTTP local já validado para:
  - `POST /api/clients`
  - `POST /api/agent/register`
  - `POST /api/agent/checkin`

## Roadmap ainda prioritário

1. DPAPI / proteção data-at-rest no agente
2. validação forte de payloads
3. rate limiting / anti-abuso
4. RBAC no painel
5. isolamento completo por tenant na web
6. melhoria do provisioning e da UX de instalação

## Nota de governança documental

Desde 2026-04-02 a estratégia documental do projeto foi separada em:

- `docs/*.md` para regras permanentes
- `CURRENT_STATE.md` para estado operacional
- `CONTINUITY.md` para retomada entre sessões
