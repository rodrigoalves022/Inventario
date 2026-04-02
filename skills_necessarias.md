# Skills necessárias

Status: canonical
Scope: project-guidance
Last-reviewed: 2026-04-02

Este arquivo resume as skills relevantes para o projeto. A versão permanente das regras de colaboração está em `docs/AI_COLLABORATION.md`.

## Skills obrigatórias

Estas devem orientar decisões técnicas nas frentes principais do projeto:

- `nextjs-best-practices`
- `prisma-expert`
- `api-security-best-practices`
- `secrets-management`

## Skills opcionais / contextuais

Usar quando a frente justificar:

- `postgresql-optimization`
- `software-architecture`
- `senior-fullstack`
- `clean-code`
- `powershell-windows`
- `bash-linux`

## Observação importante sobre o agente

O projeto mantém scripts em `scripts/agent/`, mas o **agente principal atual está em `agent-go/`**.

Portanto:

- para o core do endpoint, priorizar arquitetura e implementação em Go
- para bootstrap e suporte Windows/Linux, as skills de PowerShell/Bash continuam úteis

## Como pedir o uso de uma skill

Basta mencionar a skill explicitamente no pedido.

Exemplos:

- “Leia `api-security-best-practices` e `prisma-expert` antes de mexer nas rotas.”
- “Use `powershell-windows` para revisar o bootstrap de instalação.”

## Regra prática

Se houver dúvida sobre quais skills usar:

1. seguir `AGENTS.md`
2. seguir `docs/AI_COLLABORATION.md`
3. usar o menor conjunto de skills que cubra o trabalho com segurança
