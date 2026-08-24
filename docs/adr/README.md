Status: canonical
Scope: permanent
Last-reviewed: 2026-08-20
Owner: architect

# ADR

Esta pasta é reservada para **Architecture Decision Records**.

Use um novo ADR quando uma decisão:

- alterar a direção do projeto
- afetar múltiplas áreas
- substituir uma abordagem anterior
- precisar sobreviver a trocas de sessão, agentes ou pessoas

## Formato sugerido

- contexto
- decisão
- consequências
- status

## Registradas

1. [0001](./0001-device-identity-by-agentauthid.md) — Identidade de device por `agentAuthId`
2. [0002](./0002-go-agent-scripts-as-fallback.md) — Agente principal em Go; scripts como bootstrap/compatibilidade
3. [0003](./0003-postgresql-only.md) — PostgreSQL como único banco, inclusive em desenvolvimento
4. [0004](./0004-tenant-isolation-fail-closed.md) — Segregação obrigatória por tenant, fail-closed via `notFound()`
