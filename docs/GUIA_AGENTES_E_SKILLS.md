# Guia — Agentes e Skills do Inventário Enterprise

Como usar os 8 agentes auditores e as 8 skills instaladas no Claude Code.

---

## 1. Agentes vs Skills — Qual a diferença?

| | Agentes | Skills |
|---|---|---|
| **Onde ficam** | `.claude/agents/` | `.agents/skills/` |
| **Como chamar** | Em linguagem natural no chat | Com barra `/` no chat |
| **Contexto** | Isolado (cada um roda em janela própria) | Compartilhado (roda na conversa atual) |
| **Exemplo** | `Use o security-auditor para...` | `/domain-modeling` |

---

## 2. Os 8 Agentes — Como usar cada um

### Auditores (Somente Leitura ❌ — nunca alteram código)

```
Use o requirements-auditor para verificar se RF001 e RN005 estão implementados.
```
> Compara `PRODUTO.md` → `PRODUCT.md` → código → testes. Responde com rastreabilidade.

```
Use o security-auditor para revisar o isolamento de tenant em app/api/agent/.
```
> Verifica RBAC, Zod, DPAPI, allowlist de comandos, middleware, guards.

```
Use o database-auditor para auditar cascades e índices no schema.prisma.
```
> Valida PK, FK, UNIQUE, retenção de MetricSample, AuditLog append-only.

```
Use o backend-auditor para mapear o fluxo RF → endpoint → service → Prisma do check-in.
```
> Rastreia a esteira completa de uma funcionalidade e detecta fluxos quebrados.

```
Use o test-auditor para verificar se todas as RNs críticas têm teste automatizado.
```
> Pergunta: "Cadê o teste que prova isso?" para cada regra de negócio.

```
Use o designer-ui para auditar a tela de comandos no tema escuro.
```
> Verifica controles nativos fora do tema, hover states, interatividade de gráficos.

### Planejador (Somente Leitura ❌ — só escreve em docs/SPRINTS.md)

```
Use o sprint-planner para montar a Sprint 08 com base nos achados dos auditores.
```
> Coleta relatórios dos auditores e monta o backlog formal com critérios de aceite.

### Executor (Permissão de Alteração ✅)

```
Use o implementation-agent para executar os itens aprovados da Sprint 08.
```
> Único que modifica código. Só executa Sprints que você aprovou.

---

## 3. As 8 Skills — Como usar cada uma

### Design e UI
```
/shape           → Planejar uma interface nova (wireframe + decisões)
/typeset         → Melhorar tipografia e hierarquia visual
/colorize        → Ajustar paleta de cores e tokens
/harden          → Verificar acessibilidade e robustez de componentes
/audit           → Auditoria técnica de qualidade de UI
/polish          → Acabamento final de uma tela
/optimize        → Performance de frontend (loading, bundle, render)
```

### Engenharia de Software
```
/domain-modeling                → Modelar entidades, glossário, regras de negócio
/improve-codebase-architecture  → Escanear arquitetura e sugerir refatorações
/to-spec                        → Gerar especificação técnica formal
/codebase-design                → Analisar profundidade de módulos e testabilidade
/research                       → Investigar tema técnico com fontes confiáveis
/diagnosing-bugs                → Diagnosticar bugs difíceis e regressões
/tdd                            → Desenvolvimento orientado a testes (red-green-refactor)
```

---

## 4. O Fluxo Completo por Sprint

```
┌─────────────────────────────────────────────────┐
│  1. AUDITAR                                     │
│  "Use o requirements-auditor para verificar..." │
│  "Use o security-auditor para revisar..."       │
│  "Use o database-auditor para auditar..."       │
│                    ↓                            │
│  2. PLANEJAR                                    │
│  "Use o sprint-planner para montar a Sprint N"  │
│                    ↓                            │
│  3. VOCÊ APROVA (ou pede ajustes)               │
│                    ↓                            │
│  4. EXECUTAR                                    │
│  "Use o implementation-agent para executar..."  │
│                    ↓                            │
│  5. VALIDAR                                     │
│  "Use o test-auditor para confirmar cobertura"  │
│  "Use o security-auditor para revisar o diff"   │
│                    ↓                            │
│  6. COMMIT                                      │
│  "Faça o commit com mensagem descritiva"        │
└─────────────────────────────────────────────────┘
```

---

## 5. Dicas Práticas

- **Rodar auditores em paralelo:** basta pedir vários na mesma mensagem.
  ```
  Use o security-auditor e o database-auditor para auditar app/clients/actions.ts.
  ```

- **Combinar skill + agente:**
  ```
  /domain-modeling
  Depois use o requirements-auditor para validar os RFs gerados.
  ```

- **Nunca pedir ao auditor para corrigir:** eles são somente leitura por design.
  Se encontrar um bug, peça ao `sprint-planner` para registrar e depois ao
  `implementation-agent` para corrigir.

- **Definition of Done** (`docs/DEFINITION_OF_DONE.md`): toda entrega deve atender
  a checklist antes de ser considerada concluída.
