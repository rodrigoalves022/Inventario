# Definition of Done — Inventário Enterprise

Status: canonical
Scope: permanent
Last-reviewed: 2026-08-20

Checklist oficial de aceite para encerrar qualquer tarefa ou sprint. Uma entrega só está "pronta"
quando **todos** os itens aplicáveis estão marcados — não é uma lista de sugestões. Itens que não
se aplicam a uma entrega específica (ex.: uma correção de documentação não tem "banco de dados
adequado" para conferir) devem ser marcados como **N/A com justificativa**, nunca simplesmente
omitidos.

Esta checklist é o contrato entre o `sprint-planner` (que escreve os critérios de aceite de cada
item de sprint em [`SPRINTS.md`](./SPRINTS.md)) e o `implementation-agent` (único agente com
permissão de alterar código — ver `.claude/agents/`), que confere cada item explicitamente antes
de reportar uma entrega como concluída.

## Checklist

- [ ] **Requisito atende [`docs/PRODUTO.md`](./PRODUTO.md) e [`docs/PRODUCT.md`](./PRODUCT.md)** —
      a mudança está alinhada com o modelo de negócio narrado em `PRODUTO.md` e não contradiz
      nenhuma regra já validada em `PRODUCT.md`. Se a mudança exige alterar um desses documentos,
      isso está listado explicitamente como parte da entrega, não esquecido.
- [ ] **RF e RN mapeados e documentados** — o Requisito Funcional e/ou Regra de Negócio que a
      mudança implementa ou altera tem um ID rastreável em `docs/PRODUCT.md` §1–2. Requisito novo
      sem RF/RN correspondente precisa ganhar um ID antes de ser considerado concluído.
- [ ] **Caso de uso documentado** — se a mudança introduz ou altera um fluxo (`docs/PRODUCT.md`
      §3), o caso de uso está escrito no formato Ator/Pré-condição/Fluxo/Alternativos/
      Pós-condição/Exceções.
- [ ] **Código backend/frontend implementado** — a funcionalidade existe de fato no código, não
      só na documentação. Este é exatamente o veredito que `requirements-auditor` audita: ✅
      implementado, nunca 📄 só documentação.
- [ ] **Validação Zod e isolamento de tenant ativos** — toda entrada externa (payload de API,
      formulário) é validada por schema Zod antes de tocar o banco; toda query/ação que toca
      `Device`, `MetricSample`, `AgentCommand`, `AlertRule`, `AlertEvent` ou qualquer outra tabela
      escopada por cliente está filtrada por `clientId`/`organizationId`, seguindo o padrão de
      `requireTenantContext()` e dos guards de `lib/permissions.ts`.
- [ ] **Banco de dados e migrations adequados** — constraints (`@unique`, `NOT NULL`), índices
      (`@@index`) e cascades (`Cascade` vs `SetNull`) condizem com o uso real da nova consulta;
      migration gerada e aplicada, não só o `schema.prisma` editado à mão.
- [ ] **Testes implementados e passando** — existe teste automatizado que prova o comportamento
      novo e protege contra regressão futura (a pergunta padrão do `test-auditor`: "cadê o teste
      que prova isso?"). `npm run test` roda verde. Se a entrega genuinamente não comporta teste
      automatizado, isso está justificado explicitamente, não omitido.
- [ ] **Auditoria de segurança executada sem vulnerabilidades** — `security-auditor` (ou revisão
      equivalente) rodou sobre a mudança e não encontrou furo de isolamento multi-tenant, rota sem
      guard, ou segredo tratado incorretamente. Achados encontrados foram corrigidos ou
      conscientemente aceitos e registrados, não ignorados.
- [ ] **Nenhuma regressão no build** — `npx tsc --noEmit`, `npm run lint` e `npm run build` rodam
      sem erro novo. Mudança em `agent-go/` também passa `go vet ./...` e builda para Windows e
      Linux.
- [ ] **Critérios de aceite aprovados pelo usuário** — os critérios de aceite específicos listados
      para o item em [`SPRINTS.md`](./SPRINTS.md) foram confirmados pelo usuário como atendidos.
      Nenhuma sprint é marcada como Concluída sem essa confirmação explícita.

## Como isso se encaixa na arquitetura de agentes

```
requirements-auditor ─┐
security-auditor      ├─→ relatórios ──→ sprint-planner ──→ docs/SPRINTS.md
database-auditor      │                  (escreve só         (aguarda aprovação
backend-auditor       │                   este arquivo)        do usuário)
test-auditor         ─┘
                                                                      │
                                                                      ▼
                                                        implementation-agent
                                                     (único que altera código,
                                                      confere esta checklist
                                                          antes de reportar)
```

Os 5 agentes auditores (`.claude/agents/requirements-auditor.md`, `security-auditor.md`,
`database-auditor.md`, `backend-auditor.md`, `test-auditor.md`) são somente leitura e alimentam o
`sprint-planner`, que traduz achados em sprints formais. O `implementation-agent` só age depois
que uma sprint está aprovada, e usa esta checklist para saber quando parar.
