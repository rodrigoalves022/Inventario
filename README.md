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

- Cadastro de clientes/tenants, com registro de agentes por cliente via `enrollmentKey` e `apiKey`
- Bootstrap remoto via endpoint web + download do binário Windows, com verificação de integridade (SHA-256) no auto-update
- Check-in autenticado com validação forte (Zod) e coleta de hardware, redes, discos, software e logs
- Login e RBAC (`SUPER_ADMIN`/`CLIENT_ADMIN`) com isolamento por tenant no painel
- Canal de comandos ao agente (força coleta, reinicia serviço, roda script de catálogo pré-aprovado)
- Log de auditoria (login/logout, credenciais, exclusão de ativos, comandos)

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
