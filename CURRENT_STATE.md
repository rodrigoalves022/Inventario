# CURRENT_STATE

Última atualização: 2026-04-23

## O que funciona

- **Cadastro de clientes/tenants** e registro de agentes por cliente
- **Geração de `enrollmentKey` e `apiKey`** para provisionamento
- **Bootstrap remoto** do agente via endpoint web + download do binário
- **Check-in autenticado** com coleta de hardware, redes, discos, software e logs
- **Painel tenant-aware** parcialmente implementado:
  - Rotas tenant-scoped em `app/tenant/[clientSlug]/*`
  - Helpers em `lib/tenant-context.ts` e `lib/tenant-scope.ts`
  - Sidebar com contexto tenant-aware
  - APIs `dashboard/stats` e `inventory/computers` exigem `clientSlug`
  - API `collect/windows` neutralizada com `410`
  - Páginas globais legadas redirecionam para `/clients`
- **typecheck (`tsc --noEmit`)** passa
- **lint** passa
- **Runtime dev local** funciona (`next dev` em `localhost:3000`)

## O que está bloqueado

1. **Build de produção** — `next build` trava no estágio de compile (timeout >600s). Já foram testados builds seletivos, remoções de CSS/analytics, entrypoints mínimos — o problema parece estar no pipeline global Next/webpack, não em uma rota específica.

2. **Autenticação/RBAC do painel** — Hoje a proteção é por `ADMIN_SECRET` (header) e por `enrollmentKeyHash` por tenant. Não existe login de usuário, sessão nem controle de permissões. Primitivas reutilizáveis existem em `lib/auth.ts`.

3. **Validação do check-in** — O payload do agente não tem validação forte no server.

4. **DPAPI no agente** — Secrets do agente Go não usam DPAPI ainda.

## Próximos passos

1. **Resolver o build** — Investigar se é problema de versão/ambiente (Node, Next.js 16, webpack) ou de dependência compartilhada
2. **Implementar auth do painel** — Escolher framework (NextAuth, Better Auth, etc.) e implementar login + RBAC
3. **Hardening do check-in** — Validação e sanitização do payload na API `collect`
4. **DPAPI no agente** — Proteção de secrets em Windows

## Baseline Git

- Último commit de normalização: `058f90b`
- O working tree tem mudanças da Fase 2 que ainda não foram commitadas em slices

## Histórico

Documentação arquivada das fases anteriores está em `.omx/archive/` para consulta se necessário.
