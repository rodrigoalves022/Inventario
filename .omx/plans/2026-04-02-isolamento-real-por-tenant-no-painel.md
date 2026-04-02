# Plano técnico — isolamento real por tenant no painel

Status: approved-draft
Created: 2026-04-02
Owner: plan

## Requirements Summary

Implementar isolamento real por tenant no painel web para que páginas, componentes e APIs de inventário exibam apenas dados do tenant selecionado, com falha fechada quando o contexto de tenant estiver ausente ou inválido.

O escopo desta fase cobre **isolamento de dados e navegação do painel**. Não substitui a fase posterior de **RBAC/autenticação completa**, mas deve reduzir imediatamente o risco de vazamento cruzado de dados entre clientes.

## Codebase Findings

1. O modelo relacional já permite escopo por tenant através de `Device -> AgentAuth -> Client` (`prisma/schema.prisma:25-66`).
2. O dashboard principal usa consultas globais sem filtro por tenant em `app/page.tsx:6-77`.
3. A tela de computadores usa `prisma.device.findMany()` sem escopo por tenant em `app/computers/page.tsx:5-15`.
4. A API de estatísticas do dashboard agrega tudo globalmente em `app/api/dashboard/stats/route.ts:10-49`.
5. A navegação atual não carrega nenhum contexto de tenant em `components/sidebar.tsx:17-35` e `components/sidebar.tsx:114-150`.
6. A tela de detalhe de ativo ainda usa `mockAssets`, portanto não é tenant-aware nem baseada no banco real (`app/assets/[id]/page.tsx:7-15`).
7. Existe ao menos uma rota potencialmente obsoleta, `app/api/inventory/computers/route.ts:4-29`, que consulta `prisma.asset.findMany()` apesar de o schema atual não possuir `Asset`.
8. A tela administrativa de clientes já existe e pode servir como ponto de entrada para seleção/encaminhamento de tenant (`app/clients/page.tsx:11-39`).
9. Não existe hoje contexto de tenant nem guarda de painel em `lib/auth.ts:1-92`; o helper atual cobre apenas admin secret e auth do agente.

## Decision / Recommendation

### Opção recomendada: tenant explícito na URL + resolver centralizado de contexto

Adotar um **tenant scope explícito por rota**, preferencialmente com um prefixo claro do tipo:

- `/tenant/[clientSlug]/*`

ou estrutura equivalente com route group.

#### Por que esta opção é a recomendada

- **fail-closed por construção**: se a rota não tem tenant, a tela de inventário não deve carregar
- **mais segura que cookie-only**: o escopo fica visível, bookmarkável e auditável
- **mais simples para Server Components**: o `clientSlug` chega no `params`
- **mais testável**: facilita verificar 404/redirect quando o tenant é inválido ou não pertence ao contexto permitido
- **reduz omissões acidentais**: força a equipe a pensar no tenant em toda página protegida

### Opção rejeitada para esta fase: apenas cookie/query global invisível

Pros:
- menor refactor inicial

Cons:
- maior risco de páginas carregarem sem escopo
- contexto implícito e mais difícil de auditar
- mais fácil esquecer filtro em links e loaders

## Acceptance Criteria

1. Toda página de inventário no painel exige contexto explícito de tenant.
2. Dashboard, computadores, servidores, armazenamento, processadores, rede, relatórios e detalhe de ativo retornam apenas dados do tenant selecionado.
3. Se o tenant estiver ausente ou inválido, a navegação protegida falha de forma segura com redirect controlado ou `notFound()`.
4. APIs usadas pelo painel não retornam agregados cross-tenant sem intenção explícita.
5. O detalhe de ativo não usa mais `mockAssets` para a rota principal de inventário multi-tenant.
6. A navegação do painel preserva o tenant atual em todos os links relevantes.
7. O tenant atual é exibido visualmente no shell do painel.
8. A rota antiga ou obsoleta baseada em `prisma.asset` é corrigida, removida ou marcada fora do fluxo principal.
9. A verificação final prova que um tenant não enxerga dados do outro nas telas e endpoints desta fase.

## Implementation Steps

### Etapa 1 — Introduzir contexto central de tenant no servidor

Criar utilitários dedicados, por exemplo:

- `lib/tenant-context.ts`
- `lib/tenant-scope.ts`

Responsabilidades:
- resolver o tenant a partir do `clientSlug` da rota
- validar existência e `isActive`
- expor helpers reutilizáveis para filtros Prisma
- padronizar comportamento de falha (redirect/notFound/erro)

Referências de modelo:
- `prisma/schema.prisma:10-23`
- `prisma/schema.prisma:25-66`
- `lib/clients.ts:17-25`

### Etapa 2 — Mover o painel de inventário para rotas tenant-scoped

Estruturar as páginas principais sob tenant explícito, por exemplo:

- `app/tenant/[clientSlug]/page.tsx`
- `app/tenant/[clientSlug]/computers/page.tsx`
- `app/tenant/[clientSlug]/servers/page.tsx`
- `app/tenant/[clientSlug]/storage/page.tsx`
- `app/tenant/[clientSlug]/processors/page.tsx`
- `app/tenant/[clientSlug]/network/page.tsx`
- `app/tenant/[clientSlug]/reports/page.tsx`
- `app/tenant/[clientSlug]/assets/[id]/page.tsx`

Manter `app/clients/page.tsx` fora deste grupo como área administrativa/global.

Referências atuais a migrar:
- `app/page.tsx:80-165`
- `app/computers/page.tsx:5-94`
- `app/servers/page.tsx:5-106`
- `app/storage/page.tsx:4-106`
- `app/processors/page.tsx:12-70`
- `app/network/page.tsx:9-99`
- `app/reports/page.tsx:17-184`
- `app/assets/[id]/page.tsx:10-242`

### Etapa 3 — Aplicar filtros Prisma tenant-aware em todos os loaders

Padronizar o filtro via relação:

- `device.agentAuth.client.slug = clientSlug`

ou equivalente por `clientId`, centralizado em helper.

Exemplos de áreas hoje globais:
- dashboard em `app/page.tsx:6-77`
- computers em `app/computers/page.tsx:5-15`
- servers em `app/servers/page.tsx:5-27`
- storage em `app/storage/page.tsx:4-39`
- processors em `app/processors/page.tsx:12-31`
- network em `app/network/page.tsx:9-40`
- reports em `app/reports/page.tsx:17-66`
- dashboard stats API em `app/api/dashboard/stats/route.ts:10-49`

Observação técnica:
para entidades filhas (`hardware`, `network`, `disk`, `collectionLog`), o filtro deve sempre subir via `device -> agentAuth -> client` para evitar agregações órfãs.

### Etapa 4 — Ajustar a navegação para preservar o tenant atual

Atualizar o shell do painel em `components/sidebar.tsx` para:

- receber e exibir tenant atual
- gerar links tenant-aware
- destacar visualmente o escopo atual
- opcionalmente oferecer um seletor/trocador de tenant apenas na camada administrativa

Referências:
- `components/sidebar.tsx:17-35`
- `components/sidebar.tsx:37-112`
- `components/sidebar.tsx:114-150`

### Etapa 5 — Corrigir a tela de detalhe de ativo e remover caminho mock/stale da rota principal

Substituir a dependência de `mockAssets` em:

- `app/assets/[id]/page.tsx:7-15`

por consulta real com validação dupla:
- buscar o ativo pelo `id`
- confirmar que o ativo pertence ao tenant atual

Também revisar:
- `app/api/inventory/computers/route.ts:4-29`

A rota deve ser:
- migrada para o modelo atual (`Device`/`Hardware`/etc.), ou
- removida do fluxo principal se for legado morto.

### Etapa 6 — Definir comportamento de entrada no painel

Escolher e implementar comportamento claro quando o usuário acessar o painel sem tenant explícito:

Recomendação desta fase:
- `/clients` continua como hub administrativo
- o acesso ao inventário operacional deve partir de um tenant explícito
- `/` pode ser redirecionado para um tenant selecionado recentemente **apenas se houver contexto confiável**, caso contrário redireciona para `/clients`

Isso reduz risco de dashboard global acidental.

### Etapa 7 — Endurecer APIs do painel e pontos de agregação

Revisar endpoints consumidos pelo painel para garantir que não exponham dados globais por padrão.

Prioridades:
- `app/api/dashboard/stats/route.ts:8-68`
- qualquer rota futura de inventory/reporting

Regra:
- endpoints tenant-operacionais devem exigir `clientSlug` ou `clientId`
- endpoints administrativos globais devem ser explicitamente marcados como tais

### Etapa 8 — Testes e verificação de isolamento

Adicionar testes cobrindo:

#### Unit
- resolução de tenant em helper central
- montagem correta dos filtros Prisma tenant-aware

#### Integration
- página/tela com tenant A não retorna dados do tenant B
- asset detail fora do tenant retorna `notFound`/403/redirect conforme a decisão
- dashboard stats muda corretamente por tenant

#### Manual
- navegar entre tenants e confirmar persistência correta dos links
- validar que `/clients` permanece global/admin
- validar que rotas sem tenant não mostram inventário consolidado por engano

## File-Level Worklist

### Fundação
- `lib/tenant-context.ts` (novo)
- `lib/tenant-scope.ts` (novo)
- possivelmente `lib/clients.ts` (extensões utilitárias)

### Shell / navegação
- `components/sidebar.tsx`

### Páginas a migrar ou reescrever para tenant scope
- `app/page.tsx`
- `app/computers/page.tsx`
- `app/servers/page.tsx`
- `app/storage/page.tsx`
- `app/processors/page.tsx`
- `app/network/page.tsx`
- `app/reports/page.tsx`
- `app/assets/[id]/page.tsx`

### APIs
- `app/api/dashboard/stats/route.ts`
- `app/api/inventory/computers/route.ts`

### Documentação / contexto
- `CURRENT_STATE.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `CONTINUITY.md` (apenas se o fluxo de retomada mudar)

## Risks and Mitigations

### Risco 1 — Vazamento por esquecer filtro em uma página
**Mitigação:** centralizar resolução de tenant e filtros Prisma em helper único; evitar filtros copiados manualmente por arquivo.

### Risco 2 — Links perderem o tenant atual
**Mitigação:** mover geração de navegação tenant-aware para o shell (`components/sidebar.tsx`) em vez de concatenar links manualmente em cada página.

### Risco 3 — Mistura entre área administrativa global e área tenant-operacional
**Mitigação:** separar explicitamente `/clients` da navegação operacional tenant-scoped; documentar essa fronteira.

### Risco 4 — Mock data mascarar falhas de isolamento
**Mitigação:** remover `mockAssets` da rota principal de detalhe de ativo antes de considerar a fase concluída.

### Risco 5 — Endpoint legado continuar expondo dados fora do novo modelo
**Mitigação:** revisar `app/api/inventory/computers/route.ts` como item obrigatório da fase.

## Verification Steps

1. Confirmar que o tenant é resolvido por helper central e não por lógica duplicada.
2. Confirmar que todas as páginas operacionais usam rotas tenant-scoped.
3. Confirmar que `device`, `hardware`, `network`, `disk` e `collectionLog` passam por filtro de tenant.
4. Confirmar que o shell preserva o tenant em todos os links relevantes.
5. Confirmar que o dashboard global antigo deixou de exibir inventário cross-tenant por padrão.
6. Confirmar que a tela de ativo não usa mais `mockAssets` no fluxo principal.
7. Confirmar que rotas obsoletas baseadas em `prisma.asset` foram tratadas.
8. Executar checkpoint de segurança focando em isolamento por tenant e superfícies de dados.

## Suggested Execution Order

1. criar helpers de tenant context/scope
2. migrar shell/navegação
3. migrar dashboard e páginas de listagem mais usadas (`dashboard`, `computers`, `servers`)
4. migrar páginas analíticas (`storage`, `processors`, `network`, `reports`)
5. corrigir detalhe de ativo e endpoints relacionados
6. revisar docs e executar verificação final

## Out of Scope for This Phase

- RBAC completo por usuário
- autenticação web final
- mTLS entre agente e servidor
- redesign visual amplo do painel

## Follow-up Recommendation

Após concluir esta fase, a próxima deve ser:

1. autenticação do painel com escopo administrativo real
2. RBAC por tenant/perfil
3. endurecimento de APIs administrativas e auditoria de acesso
