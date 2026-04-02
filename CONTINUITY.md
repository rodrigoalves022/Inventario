Status: entrypoint
Scope: resume-handoff
Last-reviewed: 2026-04-02
Owner: architect

# CONTINUITY

Este é o **arquivo oficial de retomada** do projeto.

Se uma nova sessão for iniciada após reinício da máquina, troca de IA, troca de contexto ou handoff entre agentes, este arquivo deve ser lido para recuperar:

- o modelo de colaboração
- a ordem de leitura
- as regras de atualização de contexto
- o ponto atual do projeto

## Leitura obrigatória no início de cada sessão

Ordem mínima:

1. instruções do usuário ativas na sessão
2. `AGENTS.md` **se existir no escopo local**; se não existir, usar `direcionamento.md` como diretiva complementar do repositório
3. `CONTINUITY.md`
4. `CURRENT_STATE.md`
5. `docs/AI_COLLABORATION.md`
6. `README.md`
7. documentação específica da frente ativa (`docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`, etc.)
8. código relevante da área em execução

## Papel de cada arquivo de contexto

### `AGENTS.md`
Contrato global de comportamento do agente quando existir no escopo do diretório.

### `direcionamento.md`
Diretiva operacional do repositório para papéis (`$plan`, `$architect`, `$executor`, `$review`, `$security-reviewer`), leitura inicial, skills e regras de handoff.

### `CONTINUITY.md`
Arquivo de **retomada e coordenação**. Resume como continuar o projeto sem perda de contexto e como os agentes devem operar juntos.

### `CURRENT_STATE.md`
Arquivo de **estado operacional vivo**. Deve refletir foco atual, avanços da sessão, próximos passos, bloqueios e riscos.

### `docs/AI_COLLABORATION.md`
Documento **permanente e canônico** de governança multi-IA: separação entre contexto permanente e operacional, ownership, consistência, segurança e ciclo de atualização.

## Regras de colaboração entre agentes

### `$architect`
- define ou ajusta o modelo estrutural
- resolve drift entre documentos e implementação
- atualiza documentação permanente quando a arquitetura mudar
- pode atualizar `CONTINUITY.md` quando a estratégia de continuidade mudar

### `$plan`
- transforma objetivos aprovados em etapas executáveis e ordenadas
- salva plano em `.omx/plans/`
- atualiza `CURRENT_STATE.md` com próximos passos aprovados
- não implementa código

### `$executor`
- executa apenas a etapa aprovada e atual
- atualiza `CURRENT_STATE.md` ao final da sessão
- atualiza docs canônicos quando a implementação mudar contratos ou arquitetura
- não deve autoaprovar a própria entrega

### `$review`
- revisa de forma independente a etapa executada
- registra problemas, regressões, inconsistências e pendências
- valida se contexto e docs foram atualizados corretamente

### `$security-reviewer`
- faz revisão independente de trust boundaries, scripts, automação, segredos, autenticação e governança multi-IA
- deve ser acionado para mudanças em auth, provisioning, scripts, automação, agent install, secrets ou APIs sensíveis

## Regras de atualização entre os arquivos

### Atualizar `CURRENT_STATE.md` quando
- uma sessão produzir avanço material
- o foco do ciclo mudar
- surgirem novos bloqueios, riscos ou próximos passos
- houver conclusão parcial de uma etapa planejada

### Atualizar `CONTINUITY.md` quando
- a ordem de leitura mudar
- o modelo de colaboração entre agentes mudar
- houver nova regra de handoff, checkpoint ou governança
- uma verdade canônica do projeto mudar

### Atualizar `direcionamento.md` quando
- papéis mudarem
- skills obrigatórias/opcionais mudarem
- o fluxo padrão entre agentes mudar
- houver necessidade de instrução curta e prática para sessões futuras

### Atualizar `docs/AI_COLLABORATION.md` quando
- houver mudança permanente de governança
- houver nova política de consistência, ownership ou Definition of Done
- houver mudança durável na integração entre skills locais e antigravity-awesome-skills

## Regras de consistência entre múltiplas IAs

- **um agente implementa, outro revisa**; sem autoaprovação
- **um arquivo operacional tem um único último responsável por sessão**
- alterações permanentes devem ser refletidas também no estado operacional se impactarem a sessão atual
- se houver conflito entre docs, confirmar no código e corrigir a divergência
- se o trabalho tocar segurança, automação ou secrets, a sessão só fecha após checkpoint de segurança explícito

## Atualização obrigatória no final de cada sessão

Checklist mínimo:

1. atualizar `CURRENT_STATE.md`
2. atualizar `CONTINUITY.md` se a forma de continuidade mudou
3. atualizar `direcionamento.md` se papéis/skills/rituais mudaram
4. atualizar docs permanentes impactados
5. registrar plano ativo ou próximo plano em `.omx/plans/`
6. registrar riscos remanescentes e próximo passo recomendado

## Checkpoints obrigatórios de segurança

Executar checkpoint de segurança antes de encerrar a sessão quando houver mudanças em:

- `app/api/agent/*`
- `lib/auth.ts`
- provisioning / bootstrap / instalação do agente
- `scripts/agent/*`
- secret store / DPAPI / credenciais
- automações administrativas

O checkpoint deve verificar, no mínimo:

- nenhum segredo em plaintext foi persistido em docs ou código
- scripts não ampliaram privilégios sem necessidade
- automação não quebrou isolamento por tenant
- headers e credenciais sensíveis continuam corretos
- handoff multi-IA continua consistente

## Verdades canônicas atuais

- o agente principal atual está em `agent-go/`
- `scripts/agent/` é suporte, bootstrap e compatibilidade
- `checkin` identifica `Device` por `agentAuthId`
- o backend web usa Next.js 16 + App Router + TypeScript + Prisma
- SQLite permanece em desenvolvimento e PostgreSQL segue como alvo de produção

## Próxima continuidade recomendada

Ao retomar o projeto, começar por:

1. ler `CONTINUITY.md`
2. ler `CURRENT_STATE.md`
3. se existir, ler o relatório arquitetural de normalização mais recente em `.omx/reports/`
4. abrir o plano mais recente em `.omx/plans/`
5. executar a próxima etapa ainda não concluída

## Regra extraordinária para retomada após interrupção de workers

Se o runtime/board anterior do team não estiver disponível no workspace atual (por exemplo, ausência de `.omx/state/team/*` ou interrupção explícita dos workers):

- não tratar claims, leases e tasks antigas como estado vivo confiável
- tratar `CURRENT_STATE.md` como resumo operacional canônico
- tratar o relatório arquitetural de normalização mais recente como explicação oficial do reset
- replanejar a execução a partir do workspace real antes de relançar workers
