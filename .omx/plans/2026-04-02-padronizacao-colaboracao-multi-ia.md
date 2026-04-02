# Plano — Padronização de colaboração multi-IA

Status: approved-draft
Created: 2026-04-02
Owner: plan

## Requirements Summary

Padronizar a continuidade do projeto entre múltiplas IAs, separando instruções permanentes de estado operacional e definindo rituais claros de leitura inicial, atualização final, papéis entre agentes, integração com skills e checkpoints de segurança.

## Acceptance Criteria

- `CONTINUITY.md` define retomada, leitura inicial, papéis e atualização obrigatória
- `CURRENT_STATE.md` reflete o estado operacional atual e o plano ativo
- `direcionamento.md` define papéis, fluxo entre agentes e uso de skills
- `docs/AI_COLLABORATION.md` consolida a governança permanente multi-IA
- `README.md` aponta para os arquivos de entrada corretos
- existe ao menos um checkpoint explícito de segurança para mudanças sensíveis

## Implementation Steps

1. Revisar os arquivos de contexto existentes e identificar lacunas de governança
2. Reestruturar `CONTINUITY.md` para servir como arquivo oficial de retomada e coordenação
3. Atualizar `CURRENT_STATE.md` para refletir o novo estado operacional pós-padronização
4. Expandir `direcionamento.md` com papéis, fluxo, skills e rituais obrigatórios
5. Atualizar `docs/AI_COLLABORATION.md` com a arquitetura permanente de colaboração
6. Ajustar `README.md` para apontar à nova ordem de leitura e aos arquivos canônicos
7. Verificar consistência entre os arquivos e revisar riscos de segurança/governança

## Risks and Mitigations

- **Risco:** duplicação entre arquivos de contexto  
  **Mitigação:** definir responsabilidade clara por arquivo
- **Risco:** agentes futuros atualizarem só um dos arquivos  
  **Mitigação:** checklist obrigatório de fechamento de sessão
- **Risco:** uso incorreto de skills ou papéis  
  **Mitigação:** formalizar em `direcionamento.md`
- **Risco:** mudanças sensíveis sem revisão adequada  
  **Mitigação:** checkpoint obrigatório de segurança

## Verification Steps

1. Ler os arquivos atualizados e confirmar que cada um tem papel distinto
2. Confirmar que a ordem de leitura inicial é consistente em todos os docs
3. Confirmar que a atualização obrigatória ao final da sessão está explícita
4. Confirmar que os papéis `$plan`, `$architect`, `$executor`, `$review`, `$security-reviewer` estão definidos
5. Confirmar que skills locais e antigravity-awesome-skills estão integradas conceitualmente
