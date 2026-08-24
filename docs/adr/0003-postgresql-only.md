---
status: accepted
---

# PostgreSQL como único banco, inclusive em desenvolvimento

Candidato original desta decisão era "SQLite só em dev, Postgres como alvo de produção" — isso já
foi superado: a migração para PostgreSQL 16 (via Docker) está concluída também em desenvolvimento
(829 registros migrados sem órfãos; o SQLite anterior ficou só como backup em
`prisma/dev.db.backup-pre-postgres`, não como ambiente ativo). Não existe mais um provider SQLite
no `schema.prisma`.

**Por quê a migração**: `MetricSample` é a tabela de maior volume de escrita do sistema
(amostra a cada ~10 min por dispositivo) e passou a exigir índices compostos
(`deviceId, collectedAt`) e concorrência de escrita que SQLite não sustenta bem em produção;
manter dois providers (SQLite em dev, Postgres em prod) arriscava divergência de comportamento
de índice/constraint entre ambientes.

**Consequência**: `docker compose up -d db` é pré-requisito para rodar o projeto em qualquer
ambiente, inclusive local — não há mais caminho "sem Docker" para desenvolvimento.
