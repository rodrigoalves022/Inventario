# Inventario Enterprise

Status: canonical  
Scope: project-overview  
Last-reviewed: 2026-04-02

Plataforma de inventário corporativo de TI com arquitetura **agent-based**, foco em **segurança**, **multi-tenant** e **provisioning remoto**.

## Estado atual do produto

O repositório possui duas camadas principais:

- **Aplicação web** em `Next.js 16 + TypeScript + Prisma`
- **Agente principal** em `Go`, localizado em `agent-go/`

Os arquivos em `scripts/agent/` continuam úteis para bootstrap, compatibilidade e suporte, mas **não são mais a implementação principal do coletor**.

## Arquivos de entrada recomendados

Para retomar ou continuar o trabalho sem perder contexto:

1. `AGENTS.md` se existir no escopo
2. `direcionamento.md`
3. `CONTINUITY.md`
4. `CURRENT_STATE.md`
5. `docs/AI_COLLABORATION.md`
6. docs técnicas da frente ativa

## Stack oficial

- **Web / API:** Next.js 16, React 19, TypeScript
- **UI:** Tailwind CSS v4, shadcn/ui, Radix UI, Recharts
- **Banco / ORM:** Prisma v5
- **Banco em dev:** SQLite
- **Banco alvo em produção:** PostgreSQL
- **Agente:** Go 1.25

## Capacidades atuais

- cadastro de clientes/tenants
- registro de agentes por cliente
- geração de `enrollmentKey` e `apiKey`
- bootstrap remoto via endpoint web
- download do binário Windows do agente
- check-in autenticado com persistência de hardware, redes, discos, software e logs

## Documentação canônica

- [Direcionamento repo-local](./direcionamento.md)
- [Colaboração entre agentes e IAs](./docs/AI_COLLABORATION.md)
- [Arquitetura](./docs/ARCHITECTURE.md)
- [Guia do Agente](./docs/AGENT.md)
- [API](./docs/API.md)
- [Banco de Dados](./docs/DATABASE.md)
- [Estado operacional atual](./CURRENT_STATE.md)
- [Retomada rápida](./CONTINUITY.md)

## Direção atual

Os próximos investimentos principais do projeto são:

1. revisão, testes e endurecimento do painel tenant-aware em `/tenant/[clientSlug]/*`
2. validação forte do payload de check-in
3. proteção de segredos no agente com DPAPI
4. autenticação/RBAC do painel
5. eliminação contínua de drift documental
