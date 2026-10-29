# Inventário Enterprise — orientações para sessões do Claude Code

## Estado atual
Sprints 1–16, A0–A4 e V17–V25 estão concluídas e commitadas na `main` (veja `docs/SPRINTS.md`).

## Como iniciar o sistema (quando pedirem para rodar/iniciar o app)
1. Suba o banco: `docker start inventario-db` (ou `docker compose up -d db`).
2. Inicie o servidor: `npm run dev` (já usa `--webpack`, porta 3000).
3. **NUNCA** rode `npm test` (1.460 testes) nem `npm run build:verify` quando o objetivo for apenas iniciar o servidor ou verificar se o app está no ar.

## Economia de tokens e uso de modelos/effort
- Nunca execute a suíte inteira (`npm test`); rode só o arquivo tocado:
  `npx vitest run tests/<arquivo>.test.tsx`.
- Tarefas simples, correções pontuais e execução de comandos: `sonnet` com `--effort low`.
- Implementação de features especificadas: `sonnet` com `--effort medium`.
- Arquitetura complexa ou auditoria de segurança multi-tenant: `opus` com `--effort high`.

## Arquivos protegidos
- `prisma/schema.prisma`
- `app/admin/clients/**`
- `app/users/page.tsx`
