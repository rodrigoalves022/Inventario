# AGENTS.md

Ponto de entrada para qualquer agente ou sessão de IA neste repositório.

## Leitura obrigatória (nesta ordem)

1. `AGENTS.md` (este arquivo)
2. `CURRENT_STATE.md`
3. `README.md`
4. Código da frente ativa

## Sobre o projeto

**Inventario Enterprise** — plataforma de inventário corporativo de TI.

- **Web/API:** Next.js 16, React 19, TypeScript, Prisma v5, SQLite (dev) / PostgreSQL (prod)
- **UI:** Tailwind CSS v4, shadcn/ui, Radix UI, Recharts
- **Agente coletor:** Go 1.25 (`agent-go/`)
- **Scripts legado:** `scripts/agent/` (suporte/bootstrap, não é o coletor principal)

## Regras mínimas

- Ler `CURRENT_STATE.md` para saber o que funciona, o que está bloqueado e o que fazer
- Não criar documentação nova sem finalidade clara — manter o mínimo de arquivos
- Mudanças em auth, secrets, APIs ou scripts precisam de revisão de segurança
- Conflitos entre documentação e código → o código é a verdade
- Se precisar de contexto histórico, consultar `.omx/archive/`

## Docs técnicas

- [Arquitetura](./docs/ARCHITECTURE.md)
- [API](./docs/API.md)
- [Banco de Dados](./docs/DATABASE.md)
- [Agente Go](./docs/AGENT.md)
