Status: operational
Scope: phase2-replanned
Last-reviewed: 2026-04-23
Owner: plan

# CURRENT_STATE

## Projeto

Inventario Enterprise

## Fase atual

**Fase 1 permanece formalmente concluída.**

**A Fase 2 foi parcialmente materializada no workspace, mas a execução multi-worker foi interrompida antes de uma normalização segura de governança/contexto.**

Estado canônico a partir desta revisão arquitetural:

- a Fase 2 **não deve ser tratada como “não iniciada”**
- a Fase 2 também **não deve ser tratada como governada de forma limpa** neste momento
- o projeto está em **rebaseline arquitetural e de governança** antes de um novo relançamento organizado

A frente técnica continua sendo o plano de **isolamento real por tenant no painel web**, agora reinterpretado a partir do **estado real do workspace**, e não apenas do histórico git ou do board interrompido.

Checkpoint de governança em 2026-04-23: o ciclo `executar-a-padroniza-o-complet` foi reaberto apenas para padronização documental mínima. O único writer autorizado é `worker-2`, com escopo restrito a `CURRENT_STATE.md` e `.omx/reports/team-padronizacao-governanca-final.md`; não há autorização para alterar código de produto neste checkpoint.

## Resultado desta sessão

- checkpoint documental de governança de 2026-04-23 registrado para o team `executar-a-padroniza-o-complet`
- criação do relatório `.omx/reports/team-padronizacao-governanca-final.md` consolidando os achados disponíveis sem alterar código de produto
- correção de inconsistência pequena na enumeração dos próximos passos recomendados neste arquivo
- achado de revisão do `worker-3` incorporado: este ciclo deve ser tratado como preflight documental/Step 0, com task files e lifecycle OMX como fonte canônica do runtime, sem iniciar implementação de produto nesta rodada
- achado arquitetural do `worker-1` incorporado: o plano `2026-04-07-team-exec-fundacao-do-sistema.md` fica declarado como plano ativo de execução; planos de 2026-04-02 permanecem como referência estrutural/histórica
- achado de segurança do `worker-4` incorporado: este preflight não aprova auth/RBAC nem check-in; `.omx/` está ignorado em `.git/info/exclude`, permissões locais amplas são apenas aceitáveis em dev, e operações Git devem ser estritamente direcionadas
- normalização obrigatória do workspace executada antes do relançamento da Fase 2
- commit de baseline criado: `058f90b` — `chore: workspace normalization before Phase 2 relaunch`
- artefatos temporários/runtime passaram a ser ignorados explicitamente em `.gitignore`
- o workspace versionado agora representa o baseline real revisado para o relançamento controlado
- revisão arquitetural completa do estado canônico após interrupção dos workers
- confirmação de que existem artefatos reais de Phase 2 no workspace, incluindo:
  - `app/tenant/[clientSlug]/*`
  - `lib/tenant-context.ts`
  - `lib/tenant-scope.ts`
  - arquivos de navegação/suporte tenant-aware
- confirmação de que o histórico git ainda para no fechamento da Fase 1 e **não representa o estado real atual do projeto**
- confirmação de que o runtime anterior do team/board não está disponível de forma confiável no snapshot atual
- normalização deste `CURRENT_STATE.md` para servir como **fonte canônica de retomada**
- criação do relatório `.omx/reports/2026-04-02-architect-normalization-reset.md`
- inventário do workspace real da Fase 2 concluído pelo `$plan`
- confirmação de que a maior parte do escopo técnico de tenant isolation já existe no workspace, mas ainda sem governança/validação suficientes para fechamento
- criação do relatório `.omx/reports/2026-04-02-phase2-replanning-diagnostic.md`
- criação do plano reorganizado `.omx/plans/2026-04-02-rebaseline-fase2-tenant-isolation.md`
- revisão técnica inicial concluída pelo Worker A com finding principal sobre slug normalizado vs raw route param
- relatório de review técnico salvo em `.omx/reports/2026-04-02-phase2-initial-technical-review.md`
- hardening sensível concluído pelo Worker C em `/clients`, `lib/auth.ts` e APIs tenant-operacionais
- correções de consistência concluídas pelo Worker B no shell tenant e nas páginas tenant-scoped
- checkpoint de verificação/contexto registrado em `.omx/reports/2026-04-02-phase2-verification-context.md`
- checkpoint de segurança concluído com **PASS with constraints** em `.omx/reports/2026-04-02-phase2-security-checkpoint.md`
- `scripts/verification/verify-tenant-panel.mjs` atualizado para classificar fixture live ausente como `INCONCLUSIVE`
- fixture local de verificação foi seedada em `dev.db` e `live-tenant-scope` passou para `PASS` no verificador de tenant panel
- validação execution-side desbloqueou o `typecheck` real: `tsc` agora passa após exclusão de escopos externos e alinhamento de tipos/layouts do Next 16
- runtime live local foi validado fora do sandbox em `127.0.0.1:3000` com `ADMIN_SECRET` local de execução
- probes locais confirmados:
  - `GET /api/collect/windows` → `410`
  - `GET /api/dashboard/stats?clientSlug=core-ti-expert` com `x-admin-secret` → `200`
- `app/layout.tsx` deixou de depender de `next/font/google` para evitar bloqueio local por fetch externo de fontes
- `scripts/verification/run-build.mjs` passou a usar `next build --webpack` com timeout padrão configurável de `600s`
- o root layout foi marcado como `force-dynamic` para evitar pré-render estático indevido sobre superfícies dependentes de banco/runtime
- páginas tenant-scoped foram alinhadas ao contrato `PageProps` esperado pelo Next 16; `tsc --noEmit` voltou a passar
- validação live local do tenant visual foi confirmada novamente em `GET /tenant/core-ti-expert` → `200`
- investigação posterior do team separou acesso/configuração/build/runtime e confirmou que `/clients` sem secret é fail-closed intencional, não indisponibilidade global
- isolamento adicional do build com `--debug-build-paths` continuou expirando ainda na fase `Creating an optimized production build ...`, inclusive para caminhos seletivos (`app/page.tsx`, `app/api/dashboard/stats/route.ts`, `app/api/collect/windows/route.ts`)
- novos probes execution-side indicam que o gargalo não ficou restrito a tenant pages nem a superfícies admin: builds seletivos de `app/layout.tsx` e `app/security/page.tsx` também não avançaram além da fase global de compile
- experimentos temporários de diagnóstico removendo complexidade de `app/globals.css` e `@vercel/analytics/next` não destravaram o build seletivo de `app/layout.tsx`; o sintoma permaneceu o mesmo e os arquivos foram restaurados em seguida
- nova rodada focada no pipeline Tailwind/PostCSS/Next confirmou:
  - `app/globals.css` usa apenas `@import 'tailwindcss'`, `@import 'tw-animate-css'` e tema inline
  - remover temporariamente o import de `globals.css` do layout **não** alterou o timeout do build seletivo
  - remover temporariamente apenas `tw-animate-css` **não** alterou o timeout do build seletivo
- nova rodada focada em módulos compartilhados/entrypoints mínimos também não isolou um culpado simples:
  - uma versão mínima temporária de `app/security/page.tsx` ainda expirou no build seletivo
  - uma versão mínima temporária de `app/api/collect/windows/route.ts` ainda expirou no build seletivo
  - isso enfraquece a hipótese de que o gargalo esteja apenas em lógica tenant/admin, Prisma ou auth dessas superfícies específicas
- validação operacional do setup Antigravity -> Codex confirmou três fatos distintos:
  - **remediação global concluída:** as skills `nextjs-best-practices`, `prisma-expert`, `api-security-best-practices` e `secrets-management` foram instaladas com sucesso em `/root/.codex/skills`, e uma sessão real de `codex exec` confirmou todas como disponíveis (`true`)
  - **remediação local concluída:** o arquivo legado `.codex` foi substituído por um diretório `.codex/skills` funcional (com backup em `.codex.file-backup-20260407-empty`), e uma skill marcador local `inventario-workspace-skills` confirmou via `codex exec` que o projeto agora carrega skills locais normalmente
  - a skill global `inventario-api-security`, que estava vazia e quebrava o carregamento, foi normalizada com frontmatter YAML válido
  - **mitigação local do runtime `omx team` concluída:** o hang vinha do preflight síncrono de `git status --porcelain --untracked-files=all`; o OMX instalado localmente foi ajustado para usar probes rápidos com timeout e fallback para `workspace_mode=single` quando o worktree detached/default encontra workspace dirty/timeout, e um team diagnóstico real passou a subir + limpar corretamente
- auditoria técnica arquitetural da integração **Antigravity -> Codex** concluída nesta sessão, com relatório em `.omx/reports/2026-04-07-antigravity-codex-audit.md`
- confirmação de que as 4 skills comunitárias obrigatórias em `.codex/skills/` permanecem byte-a-byte alinhadas ao upstream em `antigravity-awesome-skills/skills/*`
- `inventario-api-security` foi promovida para `.codex/skills/` e alinhada ao conteúdo local do repositório, removendo dependência exclusiva do fallback global para essa skill do projeto
- a governança permanente foi endurecida para distinguir explicitamente:
  - `antigravity-awesome-skills/skills/*` como fonte upstream comunitária
  - `.codex-local-skills/*` como acervo local auxiliar
  - `.codex/skills/*` como runtime workspace-local canônico/versionado
  - `/root/.codex/skills/*` como fallback machine-local não canônico
  - metadados `.codex-plugin` do clone Antigravity como capability disponível, **não** como integração ativa do workspace
- `.gitignore` foi corrigido para não ocultar mais `.codex/skills/**` do baseline auditável do projeto, mantendo apenas backups `.codex.file-backup-*` fora do versionamento
- a skill marcador `inventario-workspace-skills` foi normalizada no workspace para reduzir risco de parsing/drift do frontmatter local
- revisão adicional da frente de autenticação confirmou que o projeto **não** possui framework de auth web pronto já instalado (ex.: NextAuth, Clerk, Lucia, Better Auth), mas já possui primitivas reutilizáveis:
  - gate administrativo por `ADMIN_SECRET`
  - `enrollmentKeyHash` por tenant
  - `apiKeyHash` por agente
  - vínculo `Client` ↔ `AgentAuth` ↔ `Device` no schema Prisma
- limpeza documental do contexto multi-IA concluída para reduzir leitura redundante e arquivos transitórios
- criação de `.omx/README.md` como índice operacional da árvore `.omx/`
- `CONTINUITY.md`, `direcionamento.md`, `docs/AI_COLLABORATION.md`, `.omx/TEAM_SYNC.md` e `README.md` foram simplificados e realinhados
- `PROJECT_LOG.md`, `skills_necessarias.md`, snapshots transitórios supersedidos de `.omx/context/` e artefatos gerados de `team-commit-hygiene` deixaram de compor o conjunto canônico de continuidade

## Status real do ambiente

### Confirmado como real no workspace

- Git está disponível e o diretório é um repositório válido
- existem evidências de destravamento operacional herdadas da Fase 1
- existe trabalho real de tenant isolation já materializado no workspace
- existem helpers centrais em `lib/tenant-context.ts` e `lib/tenant-scope.ts`
- existem rotas tenant-scoped em `app/tenant/[clientSlug]/*`, incluindo detalhe de ativo
- páginas globais legadas de inventário em `app/*` foram fechadas por redirect para `/clients`
- `components/sidebar.tsx` já preserva contexto tenant-aware
- `app/api/dashboard/stats/route.ts` e `app/api/inventory/computers/route.ts` já exigem `clientSlug`
- `app/api/collect/windows/route.ts` já foi neutralizada com `410`
- existem relatórios de readiness, verificação e segurança já produzidos para a frente de tenant panel
- o plano ativo de tenant isolation continua sendo a referência estrutural correta
- o database local foi sincronizado com `prisma db push` e recebeu fixture local suficiente para validar `live-tenant-scope`
- o runtime live local responde corretamente nos endpoints validados de execução

### Ainda não plenamente normalizado ou endurecido

- o runtime/board anterior da execução multi-worker não está disponível como fonte confiável de continuidade
- a evidência de verificação continua parcial e sensível ao ambiente
- a postura de segurança continua incompleta enquanto auth/RBAC do painel não existir
- `/clients` e ações administrativas seguem superfície sensível sem proteção autenticada
- a validação existente confirma isolamento por slug/consulta, mas não aprovação de segurança
- a frente de autenticação do painel tem base reutilizável, mas ainda sem camada completa de login/sessão/RBAC de usuário
- permanecem artefatos locais ignorados e não versionados de runtime/ambiente (por exemplo `.env`, `.next/` e um handle ocupado em `.codex`), mas eles não participam mais do baseline auditável
- a integração Antigravity -> Codex agora está funcional pelo path versionado `.codex/skills`, mas o caminho de plugin/marketplace continua apenas disponível no clone upstream, não ativado no workspace do projeto
- o fallback global `/root/.codex/skills` continua útil operacionalmente, porém não deve ser tratado como fonte canônica ou suficiente para reprodutibilidade do repositório
- após a correção do `.gitignore`, a árvore `.codex/skills/**` ficou novamente auditável pelo Git, mas ainda depende de versionamento explícito para virar baseline persistido do repositório

## Blocking issues

### Para retomar execução organizada

1. **O estado canônico estava em drift antes desta normalização**
   - havia incompatibilidade entre fechamento formal da Fase 1 e existência prática de trabalho de Fase 2 no workspace
   - esta sessão corrigiu a interpretação canônica, mas o relançamento ainda depende de replanejamento

2. **Git ainda não é a fonte suficiente de verdade operacional**
   - o histórico anterior terminava no fechamento da Fase 1
   - esta sessão criou um baseline de normalização, mas a retomada ainda não deve depender de boards/runtime antigos

3. **O runtime/board anterior não deve ser reutilizado cegamente**
   - o estado live anterior de team execution não está disponível de forma confiável no snapshot atual
   - ownership, claims e sequência de execução devem ser reconstruídos com segurança pelo próximo ciclo de planejamento

4. **A segurança do painel ainda não está aprovada como completa**
   - o checkpoint atual passou com restrições e postura fail-closed
   - tenant isolation por `clientSlug` e shared secret não substituem autenticação/autorização real
   - `/clients` continua superfície sensível e auth/RBAC seguem como follow-up obrigatório

5. **Ainda falta normalização segura de versionamento**
   - o baseline de normalização já foi criado
   - a execução controlada já produziu mudanças revisadas, mas ainda falta integrá-las por slices antes de qualquer fechamento

6. **A verificação completa ainda depende de runtime mais estável**
   - `live-tenant-scope` já passou com fixture local
   - `typecheck` foi destravado e agora passa
   - `build:verify` continua limitado por timeout mesmo após migração para webpack e aumento do teto para `600s`
   - a investigação com build-paths seletivos sugere que o gargalo atual está no estágio global de compile/build, não claramente em uma rota tenant/admin específica
   - os probes com layout mínimo/CSS simplificado também não mudaram o comportamento, reduzindo a probabilidade de que a causa esteja apenas em `globals.css` ou `Analytics`
   - os probes mais recentes também reduziram a probabilidade de que `tw-animate-css` ou o simples import do CSS global sejam a causa única
   - os probes com páginas/rotas temporariamente mínimas também não alteraram o sintoma

## Non-blocking issues

1. `verify-tenant-panel`, `lint`, `typecheck` e probes de runtime live local passaram, mas `build:verify` continua expirando no runtime atual
2. há relatórios históricos com conclusões de momentos diferentes, exigindo leitura temporal cuidadosa
3. `safe.directory` continua sendo nuance operacional do ambiente `/mnt/e`
4. ainda existe dívida de normalização/versionamento do working tree amplo
5. parte da implementação atual ainda depende de validação independente e checkpoint de segurança para ganhar status de entrega governada
6. o build seletivo por rota ainda não isolou um único arquivo culpado; o sintoma atual parece mais amplo que uma superfície protegida específica
7. os experimentos temporários mais simples em layout/CSS não alteraram o sintoma, sugerindo que o problema pode estar em pipeline global do Next/Tailwind/webpack ou em dependência compartilhada carregada cedo
8. mesmo após remover o CSS global do entrypoint em probe temporário, o estágio `Creating an optimized production build ...` continuou travando
9. mesmo após reduzir temporariamente uma page e uma route a implementações mínimas, o build seletivo continuou expirando
10. o path workspace-local do Codex agora também está funcional via `.codex/skills`, além da instalação global em `/root/.codex/skills`
11. o runtime `$team`/`omx team` teve o hang mitigado localmente nesta máquina; a limitação remanescente é operacional: neste repo dirty em `/mnt/e`, o runtime agora faz fallback para `workspace_mode=single`, exigindo cuidado maior com colisões entre workers
12. o caminho plugin/marketplace do Antigravity segue não integrado no root deste workspace; a integração funcional atual continua sendo por cópia/versionamento em `.codex/skills`
13. `.codex-local-skills/` continua sendo acervo auxiliar do projeto, não runtime ativo do Codex; futuras skills locais devem ser promovidas explicitamente para `.codex/skills/` quando fizerem parte do contrato do workspace
14. a política de ignore foi corrigida, mas `.codex/skills/**` e `.codex-local-skills/**` ainda precisam de versionamento explícito para consolidar a rastreabilidade desta auditoria no histórico Git

## Readiness atual

**Readiness atual: execução controlada avançada, com review + verification + security checkpoint concluídos, `typecheck` revalidado, runtime live local validado, acesso fail-closed corretamente classificado e build ainda bloqueado por timeout no estágio global de compile mesmo após probes em layout/CSS; pronta para nova evidência de build, não para fechamento.**

Leitura prática:

- existe base técnica suficiente para continuar a frente de tenant isolation
- existe evidência de que grande parte da Fase 2 já foi iniciada no workspace
- a governança de execução foi reorganizada nesta sessão pelo `$plan`
- o próximo passo correto agora é normalizar/versionar as mudanças revisadas em slices auditáveis

Portanto:

- o projeto está pronto para **organização pelo `$plan`**
- o projeto **não** está em estado limpo para simplesmente retomar workers como se o board anterior ainda fosse a verdade canônica

## Próximos passos recomendados

1. integrar por slices as mudanças já revisadas desta retomada
2. manter visível que tenant isolation **não** equivale a auth/RBAC concluído
3. para o próximo ciclo com `$plan`, tratar seleção de skills como problema de roteamento:
   - OMX/Codex para workflow/orquestração
   - `.codex/skills/` para skills operacionais do workspace
   - `antigravity-awesome-skills/` apenas como fonte complementar quando agregar especialização real
   - evitar nova frente de auditoria de skills sem falha concreta de runtime/carregamento
4. continuar a investigação do build no estágio de compile, preferencialmente com isolamento mais profundo do pipeline webpack/Next e/ou das dependências compartilhadas carregadas logo no bootstrap do App Router
5. priorizar agora a investigação de módulos compartilhados carregados cedo (`@/lib/prisma`, `@/lib/tenant-context`, `@/lib/tenant-scope`, `@/lib/auth`) antes de atribuir o problema ao pipeline CSS
6. se a próxima rodada mantiver o mesmo sintoma com entrypoints mínimos, tratar a hipótese principal como problema mais baixo nível do pipeline Next/webpack do ambiente atual
7. antes de novo fechamento de fase, exigir:
   - revisão independente
   - checkpoint de segurança
   - atualização coerente dos arquivos canônicos

## Plano ativo

- **plano ativo de execução atual:** `.omx/plans/2026-04-07-team-exec-fundacao-do-sistema.md`
- **snapshot ativo de intake para o team:** `.omx/context/system-execution-foundation-20260407T150620Z.md`
- referência estrutural histórica: `.omx/plans/2026-04-02-isolamento-real-por-tenant-no-painel.md`
- referência operacional histórica de rebaseline: `.omx/plans/2026-04-02-rebaseline-fase2-tenant-isolation.md`
- plano histórico supersedido da retomada anterior: `.omx/plans/2026-04-02-team-relaunch-fase2-tenant-isolation.md`

## Relançamento controlado da execução

Baseline de relançamento:

- commit limpo de normalização: `058f90b`
- sem dependência de board/runtime anterior
- execução reaberta apenas a partir do plano de team relaunch

Workers e ownership desta retomada:

1. **Worker A — review técnico/consistência**
   - status: `completed`
   - ownership:
     - `lib/tenant-context.ts`
     - `lib/tenant-scope.ts`
     - `lib/tenant-links.ts`
     - `app/tenant/[clientSlug]/layout.tsx`
     - revisão dos loaders/queries tenant-scoped necessários para validar boundary
   - checkpoint de saída:
     - coerência arquitetural
     - risco de acesso global acidental
     - findings objetivos para Worker B

2. **Worker C — hardening sensível/admin/API**
   - status: `completed`
   - ownership:
     - `app/clients/page.tsx`
     - `app/clients/actions.ts`
     - `app/api/dashboard/stats/route.ts`
     - `app/api/inventory/computers/route.ts`
     - `app/api/collect/windows/route.ts`
     - `lib/auth.ts` somente se estritamente necessário
   - checkpoint de saída:
     - fail-closed em superfícies sensíveis
     - riscos residuais explícitos
     - handoff obrigatório para security review

3. **Worker B — shell/redirects/pages tenant**
   - status: `completed`
   - correções aplicadas após findings de Worker A e hardening de Worker C
   - ownership:
     - `components/sidebar.tsx`
     - `app/page.tsx`
     - `app/computers/page.tsx`
     - `app/servers/page.tsx`
     - `app/storage/page.tsx`
     - `app/processors/page.tsx`
     - `app/network/page.tsx`
     - `app/reports/page.tsx`
     - `app/assets/[id]/page.tsx`
     - `app/tenant/[clientSlug]/**/*`

4. **Worker D — verification/context/versioning prep**
   - status: `completed`
   - concluiu checkpoint de verificação/contexto desta retomada
   - ownership:
     - `scripts/verification/**`
     - `.omx/reports/**`
     - `.omx/plans/**`
     - `CURRENT_STATE.md`
     - docs impactadas

5. **Security reviewer — checkpoint de segurança**
   - status: `completed`
   - relatório: `.omx/reports/2026-04-02-phase2-security-checkpoint.md`
   - decisão: `PASS with constraints`

Checkpoints obrigatórios desta retomada:

- **architecture checkpoint**: saída de Worker A antes de abrir correções do Worker B
- **security checkpoint**: concluído com `PASS with constraints`; não equivale a auth/RBAC completo
- **context checkpoint**: Worker D consolida evidências, limites e baseline versionado antes de decisão final

## Não fazer agora

- não fingir que a Fase 2 ainda não começou no workspace
- não fingir que a Fase 2 já está governada/fechada de forma limpa
- não tratar o histórico git atual como representação completa do estado do projeto
- não declarar aprovação de segurança do painel
- não relançar workers a partir de ownership/claims antigos sem novo planejamento
- não tratar os relatórios de verificação/readiness como substitutos de review independente novo sobre o workspace atual
- não normalizar o working tree por commit amplo sem recorte explícito de ownership e revisão

## Último handoff válido

Sessão de 2026-04-02 — relançamento controlado da Fase 2:

- Fase 1 continua encerrada formalmente
- a Fase 2 já deixou artefatos reais no workspace
- o runtime/board anterior não está disponível como verdade confiável de continuidade
- o workspace foi normalizado em `058f90b`
- review técnico, hardening, correções de consistência, verificação e security checkpoint foram executados
- o checkpoint de segurança passou com restrições; auth/RBAC continuam pendentes
- próximo passo recomendado: versionamento por slices das mudanças revisadas e novo handoff sem declarar fechamento de fase
