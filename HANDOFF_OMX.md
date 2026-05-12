# Handoff Context — Inventario Enterprise

Este documento serve como ponto de entrada para a próxima sessão de desenvolvimento (OMX/Codex).

## 🚀 Estado Atual do Projeto
O sistema é um inventário de TI multi-tenant funcional. As bases da arquitetura (Coleta, Agent, Auth e Dashboard) estão sólidas.

### 🛑 Bloqueio Técnico:
- **Banco de Dados**: Atualmente rodando em **SQLite** (`prisma/dev.db`). A migração para **PostgreSQL** está **parcialmente pronta** (scripts de exportação e importação criados em `scripts/`), mas o usuário **não tem** o servidor Postgres instalado localmente.

## ✅ Entregas Recentes
1. **Autenticação & RBAC (Fase 4)**:
   - Login centralizado em `/login` com detecção automática de empresa.
   - Roles: `SUPER_ADMIN` (gere Tenants), `ADMIN_TENANT` (gere um Tenant), `USER` (vê máquinas).
   - Redirecionamento inteligente via `/dashboard`.
   - Isolamento de dados entre clientes via Middleware (checa `clientSlug` na sessão).
   - Botão de Logout polido dentro de um dropdown no perfil.

2. **Agente Go v1.1.0**:
   - Binário em `public/inventario-agent.exe` com versão embutida.
   - Lógica de auto-update funcional.

3. **Dashboard Real-time**:
   - Cabeçalho mostra tempo real da última coleta ("há 2 min") dinamicamente.

## 🛠 Próximos Passos (Product Roadmap)
1. **Inteligência de Inventário**:
   - Criar filtros no dashboard para máquinas com pouco disco (<10GB) ou sem coleta há X dias.
   - Relatórios em PDF/CSV para auditoria.
   2. **Alertas**:
   - Sistema de notificações no painel e via Webhook (Discord/Slack) quando máquinas críticas ficam offline.
3. **Migração PostgreSQL**:
   - Assim que o ambiente tiver Postgres, rodar `scripts/import-data.ts`.

## 📦 Credenciais de Teste (DB Local)
- **Super Admin**: `admin@inventario.local` / `admin`
- **Admin Tenant**: `admin@core-ti-expert.local` / `admin`

---
**Nota para o Agente**: O `PrismaClient` foi regenerado com sucesso após desbloqueio de DLL. O login está funcional usando uma estratégia de fetch em dois passos no `auth.ts` para evitar erros de relacionamento do Turbopack.
