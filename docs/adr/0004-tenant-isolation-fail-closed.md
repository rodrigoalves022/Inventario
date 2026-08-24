---
status: accepted
---

# Segregação obrigatória por tenant, fail-closed via notFound()

Todo acesso a dado de um `Client` passa por `requireTenantContext()` (`lib/tenant-context.ts`),
que resolve o tenant pelo slug **e** valida `canAccessTenant()` na mesma chamada. Quando o
usuário não tem acesso, a resposta é `notFound()` (HTTP 404), nunca 403 — de propósito, para não
revelar a um usuário de uma organização que um tenant de *outra* organização sequer existe
naquele slug. `clientId` é desnormalizado (denormalizado) em `Device`, `MetricSample` e
`AgentCommand` para que o isolamento vire filtro de índice simples em vez de JOIN em tabelas de
alto volume.

**Consequência**: uma tela ou rota de API nova sob `/tenant/[clientSlug]/*` deve chamar
`requireTenantContext`/`canAccessTenant` (ou o guard mais específico equivalente,
`canManageTenant`/`canOperateTenant`) antes de tocar qualquer dado — nunca confiar só no slug da
URL. `CLIENT_VIEWER` é excluído de `canAccessTenant` por design (usa `/portal`, que deriva o
cliente da sessão, nunca da URL); as duas superfícies não compartilham layout nem componentes
administrativos.
