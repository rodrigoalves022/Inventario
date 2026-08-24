# Inventario Enterprise

Plataforma de inventário corporativo de TI com arquitetura **agent-based**, foco em **segurança**, **multi-tenant** e **provisioning remoto**.

## Stack

| Camada | Tecnologia |
|---|---|
| Web / API | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI, Recharts |
| ORM | Prisma v5 |
| Banco | PostgreSQL 16 (via Docker) |
| Agente coletor | Go 1.25 (`agent-go/`) |

## Capacidades atuais

- Cadastro de clientes/tenants, com registro de agentes por cliente via `enrollmentKey` e `apiKey`
- Bootstrap remoto via endpoint web + download do binário Windows, com verificação de integridade (SHA-256) no auto-update
- Check-in autenticado com validação forte (Zod) e coleta de hardware, redes, discos, software e logs
- Login e RBAC de 4 papéis (`PLATFORM_ADMIN`/`ORG_ADMIN`/`ORG_OPERATOR`/`CLIENT_VIEWER`) com isolamento por tenant no painel
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

- [PRODUTO.md](./docs/PRODUTO.md) — modelo de negócio, papéis, plano de execução, como retomar uma sessão
- [PRODUCT.md](./docs/PRODUCT.md) — especificação técnica formal: requisitos, regras de negócio, casos de uso, modelagem de dados, arquitetura, RBAC, inventário de APIs, diagrama ER, glossário
- [SPEC.md](./docs/SPEC.md) — diagramas de sequência, contratos de API do agente, regras de validação Zod, estratégia de segurança
- [docs/adr/](./docs/adr/) — decisões de arquitetura registradas
- [BUILD_PRODUCTION.md](./docs/BUILD_PRODUCTION.md) — build de produção do Next.js

## Desenvolvimento

```bash
cp .env.example .env      # preencha AUTH_SECRET e ADMIN_SECRET
npm install
docker compose up -d db   # PostgreSQL 16 em localhost:5432
npx prisma db push
node scripts/seed-rbac.ts # usuários iniciais dos 4 papéis
npm run dev               # http://localhost:3000
```

Para migrar dados de uma base existente: `node scripts/export-data.ts` na origem
e `node scripts/import-data.ts` no destino.
