# Inventário Enterprise — Diretrizes de Execução (Claude Code)

> **Papéis:**
> - **Coordenação & Arquitetura:** Antigravity + Usuário
> - **Execução Operacional:** Claude Code

---

## 1. Limite Rígido de Consumo de Tokens (75%)
- **TETO DE 75%**: Ao atingir **75% da capacidade de contexto ou do orçamento de tokens**, interrompa imediatamente qualquer tarefa em andamento.
- Nunca encadeie novas tarefas pesadas quando o consumo atingir ou ultrapassar 75%.
- Ao bater o teto de 75%, garanta que o código funcional esteja commitado na branch `main`, registre o status detalhado da entrega e solicite ao usuário rodar `/compact` ou abrir nova sessão para continuar.
- **NUNCA** execute `npm test` completo (mais de 1.400 testes). Execute exclusivamente o teste focado do arquivo alterado:
  `npx vitest run tests/<arquivo>.test.tsx`
- Perfis de modelo recomendados:
  - Comandos simples e ajustes pontuais: `sonnet` (`--effort low`).
  - Implementação de tarefas especificadas: `sonnet` (`--effort medium`).
  - Arquitetura crítica ou auditoria: `opus` (`--effort high`).

---

## 2. Estado Atual do Sistema
- Servidor Next.js rodando na porta 3000 (`npm run dev`).
- Banco PostgreSQL ativo no container Docker `inventario-db` na porta 5432.
- Sprints 1–16, A0–A4, V17–V25 e A70–A85 concluídas e commitadas.
- Documentação limpa em `components/docs-hub.tsx`, sem nenhum caminho interno de servidor exposto.

---

## 3. Tarefas Prioritárias para o Claude Executar

### Tarefa A — Filtrar e Eliminar Impressoras Virtuais/Padrão
**Objetivo:** Não poluir o inventário com impressoras de software do Windows (`Microsoft Print to PDF`, `Microsoft XPS Document Writer`, `Fax`, `OneNote`, portas `PORTPROMPT:`, `nul:`, `FILE:`).
1. Criar helper `isVirtualPrinter` em `lib/printers.ts` detectando nomes, drivers e portas virtuais.
2. Filtrar a exibição em `app/app/[clientSlug]/peripherals/page.tsx` e `app/portal/peripherals/page.tsx`.
3. Filtrar na ingestão de check-in (`app/api/agent/checkin/route.ts`) para não gravar impressoras virtuais no banco.
4. Filtrar na coleta do agente Windows (`agent-go/internal/collectors/windows/peripherals.go`).
5. Remover registros legados de impressoras virtuais da tabela `Printer` no banco.
6. Criar teste unitário em `tests/printers-filter.test.ts` e rodar somente ele.

### Tarefa B — Motor de Descoberta de Infraestrutura sem Agente
**Objetivo:** Identificar ativos corporativos na rede local sem necessidade de agente instalado:
1. **VMware ESXi e vCenter:** Varredura nas portas 443 e 902 com requisição SOAP (`/sdk` `RetrieveServiceContent`) para classificar `HostAgent` (ESXi) e `VirtualCenter` (vCenter).
2. **Servidores via Active Directory:** Varredura de servidores habilitados no AD com teste de portas (Ping, RDP 3389, SMB 445, WinRM 5985, Zabbix 10050) classificando `ONLINE`, `ONLINE_SEM_PING`, `OFFLINE` ou `SEM_DNS`.
3. **Equipamentos de Rede:** Detecção de impressoras de rede físicas (portas 9100 / 631 / SNMP) e switches/roteadores (SNMP `sysDescr`).

### Tarefa C — Continuidade do Backlog
- Executar os itens pendentes do backlog em `docs/SPRINTS.md` mantendo commits pontuais e sem ultrapassar a cota de 75%.

---

## 4. Arquivos Protegidos (Não alterar sem autorização da coordenação)
- `prisma/schema.prisma`
- `app/admin/clients/**`
- `app/users/page.tsx`

---

## 5. Regra de UI — Placeholders
- **PROIBIDO** usar nomes fictícios/aleatórios em placeholders (ex.: `Acme Indústria Ltda`, `Contoso`, `João`, `Maria`, `Foo`).
- Use sempre rótulos neutros e descritivos do campo: `Nome da empresa`, `nome-da-empresa`, `Nome do usuário`, `Nome do responsável`.
- **PROIBIDO** criar cards ou inputs esticados de ponta a ponta (full-width solto em widescreen).
- Páginas de configuração/gerenciamento (ex.: `/admin/clients/[id]`) usam o padrão Mestre-Detalhe de `/account` e `/docs`: 4 `KpiCard` no topo (`grid gap-4 sm:grid-cols-2 lg:grid-cols-4`, clicáveis para trocar a aba) + `Tabs orientation="vertical"` com `grid lg:grid-cols-[18rem_minmax(0,1fr)]`, alinhados à largura total do `<main>`. **NUNCA** usar `mx-auto max-w-*` solto no painel: desalinha do título da página e deixa buracos laterais.
- Dentro da coluna de detalhe, use `grid gap-6 xl:grid-cols-2` para blocos pareados; campos longos (hash SHA-256, chave de instalação) ficam empilhados, sem truncar nem rolagem horizontal.
