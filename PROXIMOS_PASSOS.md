# Próximos Passos — Inventario Enterprise

Para transformar o sistema em um produto comercial/Enterprise completo, dividi as tarefas em frentes de valor:

## ✅ Concluído Nesta Sessão
- [x] **Agente v1.1.0**: Compilado com versão real para self-updater.
- [x] **Dashboard Real**: Timestamp da última atualização agora é dinâmico.
- [x] **Visualização de Credenciais**: Ver chaves ativas sem rotacionar (Milestone 3).
- [x] **Exportação de Dados**: JSONs prontos para migração PostgreSQL.

## 🔴 Bloqueios Imediatos
- [ ] **PostgreSQL**: Necessário instalar para sair do SQLite (melhorar performance e concorrência).

## 🟡 Funcionalidades "Enterprise" (O que falta)
### 📊 Relatórios e Visibilidade
- [x] **Filtros Avançados**: Listar máquinas com < 10GB de disco, < 4GB de RAM, ou sem coleta há 7 dias.
- [ ] **Exportação CSV/PDF**: Gerar relatórios de inventário para auditoria com um clique.
- [ ] **Histórico de Performance**: Gráficos de uso de RAM e Disco ao longo do tempo (série temporal).

- [x] **Alertas de Sistema**: Ícones de atenção/vermelho no painel para máquinas com problemas de hardware ou software.
- [x] **Notificações**: Envio de Webhook (Discord/Slack/Teams) para eventos críticos de hardware.

### 🔐 Segurança e Gestão
- [ ] **Multi-Admin**: Diferentes níveis de permissão (SuperAdmin vs Admin de Cliente).
- [ ] **Code Signing**: Assinar o executável (`.sig`) para remover o aviso de "Fornecedor Desconhecido" do Windows.
- [ ] **Logs de Auditoria**: Registro de quem visualizou credenciais ou deletou máquinas.

### 🚀 Infraestrutura de Produção
- [ ] **Dockerização**: `Dockerfile` e `docker-compose.yml` para subir Next.js + Postgres de forma profissional.
- [ ] **SSL / HTTPS**: Configurar Nginx para acesso seguro fora da rede local.

---
**Minha recomendação**: O próximo grande salto é o sistema de **Alertas e Filtros**. Isso dá valor imediato ao dono da empresa sem precisar de grandes mudanças na arquitetura.
