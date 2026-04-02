Status: canonical
Scope: permanent
Last-reviewed: 2026-04-02
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

## Decisões candidatas imediatas

1. Agente principal em Go; scripts como bootstrap/compatibilidade
2. Identidade de device por `agentAuthId`
3. SQLite somente em dev; PostgreSQL como alvo de produção
4. Segregação obrigatória por tenant no painel e nas consultas
