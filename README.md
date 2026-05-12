# Inventario Enterprise

Plataforma de inventário corporativo de TI com arquitetura **agent-based**, foco em **segurança**, **multi-tenant** e **provisioning remoto**.

## Stack

| Camada | Tecnologia |
|---|---|
| Web / API | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, Recharts |
| ORM | Prisma v5 |
| Banco (dev) | SQLite |
| Banco (prod) | PostgreSQL |
| Agente coletor | Go 1.25 (`agent-go/`) |

## Capacidades atuais

- Cadastro de clientes/tenants
- Registro de agentes por cliente com `enrollmentKey` e `apiKey`
- Bootstrap remoto via endpoint web + download do binário Windows
- Check-in autenticado com coleta de hardware, redes, discos, software e logs
- Painel tenant-aware (parcialmente implementado)

## Estrutura principal

```
app/                  → Aplicação Next.js (pages, API routes)
agent-go/             → Agente coletor em Go
lib/                  → Helpers compartilhados (auth, tenant, prisma)
prisma/               → Schema e migrations
components/           → Componentes React (shadcn/ui)
scripts/              → Scripts de suporte e verificação
docs/                 → Documentação técnica
```

## Documentação

- [Estado atual do projeto](./CURRENT_STATE.md)
- [Arquitetura](./docs/ARCHITECTURE.md)
- [API](./docs/API.md)
- [Banco de Dados](./docs/DATABASE.md)
- [Agente Go](./docs/AGENT.md)

## Desenvolvimento

```bash
npm install
npx prisma db push
npm run dev         # http://localhost:3000
```
