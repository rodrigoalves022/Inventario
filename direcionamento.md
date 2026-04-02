Status: canonical
Scope: repo-guidance
Last-reviewed: 2026-04-02
Owner: architect

# direcionamento

Este arquivo complementa `AGENTS.md` no contexto do repositório.

Se não houver `AGENTS.md` local no diretório do projeto, trate `direcionamento.md` como a diretiva curta principal do repositório para papéis, fluxo e atualização de contexto.

## Leitura obrigatória no início da sessão

1. `CONTINUITY.md`
2. `CURRENT_STATE.md`
3. `docs/AI_COLLABORATION.md`
4. `README.md`
5. docs específicas da frente ativa

## Papéis

### `$architect`
- valida coerência arquitetural
- corrige drift entre implementação e documentação
- atualiza decisões estruturais permanentes
- atualiza `CONTINUITY.md` quando a estratégia de continuidade mudar

### `$plan`
- converte objetivo em etapas ordenadas e executáveis
- salva plano em `.omx/plans/`
- atualiza próximos passos em `CURRENT_STATE.md`
- não implementa

### `$executor`
- implementa apenas a etapa aprovada e atual
- registra o que foi concluído, o que ficou pendente e riscos remanescentes
- atualiza `CURRENT_STATE.md` ao final da sessão
- atualiza docs afetadas se houver mudança real de contrato, fluxo ou arquitetura

### `$review`
- revisa de forma independente
- aponta regressões, inconsistências, problemas de qualidade e gaps de contexto
- valida que a documentação foi atualizada junto com a entrega

### `$security-reviewer`
- revisa auth, scripts, automação, secrets, provisioning e trust boundaries
- valida se o fluxo multi-IA continua seguro e governável
- é obrigatório em mudanças sensíveis

## Fluxo padrão entre agentes

1. `$architect` define ou ajusta a direção estrutural
2. `$plan` gera o plano executável
3. `$executor` aplica a etapa corrente
4. `$review` faz revisão independente
5. `$security-reviewer` revisa mudanças sensíveis ou fecha checkpoint de segurança
6. `$architect` ou `$plan` consolida o handoff final em `CURRENT_STATE.md` quando necessário

## Skills locais e antigravity-awesome-skills

### Skills locais de workflow
Usar para orquestração do trabalho:

- `plan`
- `code-review`
- `security-review`
- `deep-interview`
- `team`
- `ralph`

### Skills técnicas do projeto
Usar conforme a área:

Obrigatórias nas frentes principais:
- `nextjs-best-practices`
- `prisma-expert`
- `api-security-best-practices`
- `secrets-management`

Opcionais/contextuais:
- `postgresql-optimization`
- `software-architecture`
- `senior-fullstack`
- `clean-code`
- `powershell-windows`
- `bash-linux`

## Regra de atualização obrigatória ao final da sessão

Sempre atualizar:

- `CURRENT_STATE.md`

Atualizar se houver impacto estrutural ou de processo:

- `CONTINUITY.md`
- `direcionamento.md`
- `docs/AI_COLLABORATION.md`
- demais docs canônicas afetadas

## Regras de consistência

- sem autoaprovação
- confirmar no código quando houver conflito entre docs
- um agente escreve, outro revisa
- toda mudança sensível passa por checkpoint de segurança
- todo handoff deve deixar claro: concluído, pendente, riscos, próximo passo
