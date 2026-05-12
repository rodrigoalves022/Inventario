Status: canonical
Scope: permanent
Last-reviewed: 2026-04-02
Owner: architect

# AI_COLLABORATION

## Objetivo

Definir a arquitetura permanente de colaboração entre múltiplas IAs e agentes no projeto, separando claramente:

- **instruções permanentes**
- **estado operacional**
- **ritual de retomada**
- **papéis e checkpoints de segurança**

## Papel de cada arquivo

### `AGENTS.md`
Contrato global do agente quando existir no escopo do projeto.

### `direcionamento.md`
Diretiva curta, operacional e repo-local para papéis, fluxo entre agentes, skills e rituais de sessão.

### `CONTINUITY.md`
Arquivo oficial de retomada. Deve permitir a qualquer IA continuar o trabalho sem reiniciar a descoberta do projeto.

### `CURRENT_STATE.md`
Snapshot operacional do ciclo atual. Deve mostrar foco, progresso, próximos passos, bloqueios, riscos e último handoff válido.

### `README.md`
Visão geral canônica do produto, stack e documentos de entrada.

## Separação entre permanente e operacional

### Permanente
Muda pouco.

- `AGENTS.md`
- `direcionamento.md`
- `docs/AI_COLLABORATION.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/adr/*`
- `README.md`

### Operacional
Muda sempre que a sessão avançar.

- `CURRENT_STATE.md`

### Retomada
Sintetiza como continuar sem perda de contexto.

- `CONTINUITY.md`

## Ordem de leitura no início de cada sessão

1. instruções ativas do usuário
2. `AGENTS.md` se existir
3. `direcionamento.md`
4. `CONTINUITY.md`
5. `CURRENT_STATE.md`
6. `README.md`
7. docs específicas da frente ativa
8. código relevante

## Atualização obrigatória no final de cada sessão

### Sempre
- `CURRENT_STATE.md`

### Quando o fluxo ou a governança mudar
- `CONTINUITY.md`
- `direcionamento.md`
- `docs/AI_COLLABORATION.md`

### Quando contratos ou arquitetura mudarem
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/adr/*` quando a decisão for durável

## Modelo de consistência entre agentes

### Princípios

1. um agente implementa, outro revisa
2. contexto permanente e operacional não devem ser misturados
3. toda sessão deve deixar handoff explícito
4. conflitos entre docs devem ser resolvidos contra o código real
5. mudanças sensíveis exigem checkpoint de segurança

### Fluxo recomendado

1. `$architect` define a direção e elimina ambiguidades estruturais
2. `$plan` transforma a direção em plano executável salvo em `.omx/plans/`
3. `$executor` executa a etapa aprovada
4. `$review` valida qualidade e consistência
5. `$security-reviewer` valida segurança, automação e governança nas mudanças sensíveis

### Regra de independência

- quem executa não aprova
- quem planeja não encerra sozinho uma mudança sensível
- toda revisão deve verificar também os arquivos de contexto

## Integração com skills

### Skills locais
Usar para orquestração do workflow:

- `plan`
- `code-review`
- `security-review`
- `deep-interview`
- `team`
- `ralph`

### antigravity-awesome-skills
Usar para especialização de domínio:

Obrigatórias nas frentes principais:
- `nextjs-best-practices`
- `prisma-expert`
- `api-security-best-practices`
- `secrets-management`

Contextuais:
- `postgresql-optimization`
- `software-architecture`
- `senior-fullstack`
- `clean-code`
- `powershell-windows`
- `bash-linux`

## Checkpoints de segurança

Checklist obrigatório para mudanças em auth, provisioning, scripts, automação, secrets ou instalação do agente:

- segredos não foram persistidos em plaintext
- privilégios de scripts continuam mínimos
- isolamento por tenant foi preservado
- automação continua idempotente quando aplicável
- docs de contexto não induzem execução insegura por agentes futuros

## Definition of Done para colaboração multi-IA

Um ciclo só fecha quando:

- a entrega técnica foi revisada de forma independente
- `CURRENT_STATE.md` foi atualizado
- `CONTINUITY.md` foi atualizado se necessário
- docs permanentes impactadas foram revisadas
- riscos e próximo passo ficaram explícitos
