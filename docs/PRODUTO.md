# Produto — Requisitos, Arquitetura e Plano de Execução

Documento de referência do Inventario Enterprise. Define **o que o sistema é**, **o que coleta**, **como os dados se relacionam**, **quais páginas existem** e **em que ordem construir**.

---

## 1. Modelo de negócio

O sistema atende **dois modelos ao mesmo tempo**:

| Modelo | Quem contrata | O que enxerga |
|---|---|---|
| **MSP / prestador de TI** | Uma empresa de TI que atende vários clientes | Todas as empresas-cliente que ela atende |
| **SaaS direto** | Uma empresa que quer inventariar a si mesma | Apenas o próprio parque |

### Consequência arquitetural

Isso exige **um nível hierárquico que hoje não existe**. Hoje o topo é `Client`, o que não distingue "quem paga/opera" de "quem é inventariado".

Solução: introduzir **`Organization`** acima de `Client`.

```
Organization  (conta contratante — quem loga e opera)
   │  type: MSP | DIRECT
   │
   ├── User            (operadores da conta)
   │
   └── Client          (empresa inventariada / unidade)
         ├── User      (portal self-service do cliente)
         └── AgentAuth (1 credencial por agente instalado)
               └── Device
```

- **MSP**: `Organization(type=MSP)` → N `Client`
- **SaaS direto**: `Organization(type=DIRECT)` → exatamente 1 `Client` (ela mesma)

> **Por que não tratar o modelo direto sem `Client`?** Porque manteria dois caminhos de código para tudo abaixo (device, métricas, relatórios, comandos). Com o `Client` sempre presente, existe **um único caminho de escopo** — o custo é uma linha redundante no modo direto, e o ganho é não ter `if (isMsp)` espalhado pelo sistema.

---

## 2. Papéis e permissões

| Papel | Escopo | Pode |
|---|---|---|
| `PLATFORM_ADMIN` | Global (você, dono da plataforma) | Gerenciar Organizations, ver auditoria global |
| `ORG_ADMIN` | Uma Organization | Gerenciar clients, usuários, chaves, alertas, comandos |
| `ORG_OPERATOR` | Uma Organization | Ver tudo da org e **disparar comandos**; não gerencia usuários nem credenciais |
| `CLIENT_VIEWER` | Um Client | Portal self-service **somente leitura** |

> `ORG_OPERATOR` existe para separar "quem administra a conta" de "quem executa ação remota na máquina do cliente" — hoje qualquer `CLIENT_ADMIN` teria poder irrestrito de execução remota, o que é risco desnecessário.

**Migração dos papéis atuais:** `SUPER_ADMIN` → `PLATFORM_ADMIN`; `CLIENT_ADMIN` → `ORG_ADMIN`.

---

## 3. O que o inventário coleta

### 3.1 Já coletado hoje
- **Identificação**: hostname, serial, fabricante, modelo, domínio, usuário logado
- **Hardware**: SO, versão, processador, RAM total, slots de memória, placa-mãe
- **Rede**: IP, MAC, gateway, DNS, DHCP, interface primária
- **Disco**: unidade, modelo, tipo, capacidade, espaço livre
- **Software**: nome, versão, editor, data de instalação

### 3.2 Segurança / compliance *(novo)*
O que mais pesa em auditoria e é o principal argumento de venda B2B.

- Antivírus: nome, ativo?, assinaturas atualizadas?
- Firewall ativo por perfil
- Criptografia de disco (BitLocker) por volume
- Secure Boot, TPM presente, UAC ativo
- **Atualizações pendentes**: KB, título, severidade
- **Contas locais**: usuário, é administrador?, ativo?, último logon, senha nunca expira

### 3.3 Uso ao longo do tempo *(novo)*
Série temporal para gráficos e detecção de máquina saturada.

- CPU %, RAM usada/total, disco usado/livre, uptime
- Amostragem a cada ~10 min, **retenção padrão de 90 dias**

> Esta é a tabela que mais cresce: ~4.300 amostras/máquina/mês. Exige índice `(deviceId, collectedAt)`, política de expurgo e é a principal razão para sair do SQLite.

### 3.4 Periféricos *(novo)*
- **Monitores**: fabricante, modelo, serial, polegadas, conexão, ano
- **Impressoras**: nome, porta, driver, padrão?, é de rede?
- **Dispositivos USB**: nome, vendorId, productId, serial

### 3.5 Patrimônio / financeiro *(novo — entrada manual, não coletado)*
- Etiqueta de patrimônio, data de compra, nota fiscal, fornecedor, valor
- Garantia até, centro de custo, localização, responsável, observações

> Estes campos **não vêm do agente** — são preenchidos no painel e nunca podem ser sobrescritos por um check-in.

---

## 4. Modelo relacional

### 4.1 Diagrama

```mermaid
erDiagram
    Organization ||--o{ Client : possui
    Organization ||--o{ User : "operadores"
    Client ||--o{ User : "portal (CLIENT_VIEWER)"
    Client ||--o{ AgentAuth : credenciais
    AgentAuth ||--o| Device : identifica
    AgentAuth ||--o{ AgentCommand : fila
    AgentAuth ||--o{ AgentCheckLog : "tentativas"

    Device ||--o| Hardware : possui
    Device ||--o| SecurityPosture : possui
    Device ||--o| AssetRecord : "patrimônio (manual)"
    Device ||--o{ Network : interfaces
    Device ||--o{ Disk : volumes
    Device ||--o{ Software : instalados
    Device ||--o{ PendingUpdate : atualizações
    Device ||--o{ LocalAccount : contas
    Device ||--o{ Monitor : monitores
    Device ||--o{ Printer : impressoras
    Device ||--o{ UsbDevice : usb
    Device ||--o{ MetricSample : "série temporal"
    Device ||--o{ CollectionLog : coletas
```

### 4.2 Invariantes que não podem ser violadas

1. **Identidade do endpoint é `agentAuthId`**, nunca `hostname` (hosts colidem entre clientes).
2. **Todo dado de inventário pertence a exatamente um `Client`**; toda consulta é escopada por ele.
3. **Segredos só existem em plaintext uma vez** (emissão); o banco guarda apenas hash.
4. **Dados manuais (`AssetRecord`) jamais são sobrescritos pelo check-in.**
5. **Um `Client` pertence a exatamente uma `Organization`.**

### 4.3 Decisão: desnormalizar `clientId` no `Device`

Hoje o isolamento é `Device → AgentAuth → Client`, ou seja, **um JOIN em toda consulta**. Com as tabelas novas (métricas, monitores, updates), isso vira JOIN duplo em tabelas grandes.

**Decisão**: gravar `clientId` diretamente em `Device`, `MetricSample` e `AgentCommand`, indexado.

- *Custo*: redundância controlada, preenchida no check-in.
- *Ganho*: toda query de tenant vira índice simples; reduz risco de vazamento entre tenants por JOIN esquecido.

---

## 5. Páginas do site

Hoje existem **7 páginas globais que são apenas `redirect('/clients')`** (`/computers`, `/network`, `/processors`, `/servers`, `/storage`, `/reports`) e `/security` que é `notFound()`. São peso morto e devem ser removidas na consolidação.

### 5.1 `/admin/*` — Plataforma (`PLATFORM_ADMIN`)
| Rota | Função |
|---|---|
| `/admin/organizations` | Criar/listar/desativar contas (MSP ou direta) |
| `/admin/organizations/[id]` | Detalhe, plano, limites, usuários |
| `/admin/audit` | Auditoria global de todas as contas |

### 5.2 `/app/*` — Operação (`ORG_ADMIN`, `ORG_OPERATOR`)
| Rota | Função |
|---|---|
| `/app` | Dashboard da conta: total de máquinas, online/offline, alertas, saúde |
| `/app/clients` | Lista de clientes (MSP: vários; direto: 1) |
| `/app/clients/[slug]` | Visão do cliente + provisionamento (chave, instalador, agentes) |
| `/app/devices` | Inventário consolidado com filtros (disco baixo, RAM baixa, sem coleta há X dias, SO, antivírus inativo) |
| `/app/devices/[id]` | **Abas**: Visão geral · Hardware · Software · Segurança · Métricas · Periféricos · Patrimônio · Comandos |
| `/app/commands` | Fila e histórico de comandos da conta |
| `/app/reports` | Geração/exportação CSV e PDF |
| `/app/alerts` | Regras de alerta e histórico de disparos |
| `/app/settings` | Usuários, webhooks, limiares, retenção de métricas |
| `/app/audit` | Auditoria da conta |

### 5.3 `/portal/*` — Cliente final (`CLIENT_VIEWER`, somente leitura)
| Rota | Função |
|---|---|
| `/portal` | Resumo do próprio parque |
| `/portal/devices` | Lista das próprias máquinas |
| `/portal/devices/[id]` | Detalhe **sem** comandos, **sem** credenciais, **sem** auditoria |
| `/portal/reports` | Baixar relatórios do próprio parque |

> O portal é uma **superfície de ataque separada**: não deve compartilhar layout nem componentes que exponham ações administrativas. Regra: se um componente aceita `onDelete`/`onCommand`, não entra no portal.

---

## 6. O agente

### 6.1 Como funciona
1. Admin cria o `Client` → sistema gera `enrollmentKey`
2. Instalador é baixado já com `serverUrl + client + key` embutidos
3. Na instalação, o agente chama `POST /api/agent/register` e recebe uma `apiKey` **única e irrepetível**
4. `apiKey` é gravada localmente protegida por **DPAPI** (machine-local)
5. Roda como **serviço Windows** (`LocalSystem`), com três ciclos independentes

### 6.2 Ciclos
| Ciclo | Intervalo | O que faz |
|---|---|---|
| Inventário completo | 1 h | Hardware, software, rede, disco, segurança, periféricos |
| Métricas | ~10 min | Amostra leve de CPU/RAM/disco (série temporal) |
| Comandos | 90 s | Pergunta se há comando pendente, executa, reporta |

### 6.3 Canal de comandos ("tool calling")
Servidor enfileira → agente busca no próximo ciclo → executa → reporta resultado.

- Estados: `pending → running → done | failed | expired` (TTL 15 min)
- **Catálogo fechado**, sem texto livre: `collect_now`, `restart_service` (allowlist de serviços), `run_script` (allowlist de scripts)
- Allowlist validada **nos dois lados** (servidor via Zod, agente via mapa) — defesa em profundidade
- Toda emissão e todo resultado geram registro de auditoria

### 6.4 Segurança do agente
- Segredo local protegido por DPAPI
- Auto-update **só aplica binário cujo SHA-256 confere** com o informado pelo servidor
- Pendente: assinatura Authenticode (remove aviso de "fornecedor desconhecido")
- Pendente: unificar a fonte do binário (`public/` e `agent-go/dist/` divergem hoje)

### 6.5 Plataformas
- **Windows**: suportado
- **Linux/macOS**: a estrutura já suporta (`factory_windows.go` / `factory_stub.go`); falta implementar os coletores

---

## 7. Como o cliente fica vinculado

Fluxo definido: **admin cria manualmente**.

1. `ORG_ADMIN` cria o `Client` no painel → `enrollmentKey` exibida **uma única vez**
2. Baixa o instalador personalizado daquele cliente
3. Instala nas máquinas (manual, GPO, Intune ou script de bootstrap)
4. Cada máquina vira um `AgentAuth` + `Device` vinculados àquele `Client`
5. Opcional: `ORG_ADMIN` cria um usuário `CLIENT_VIEWER` para o cliente acessar o portal

**Não haverá auto-cadastro/trial nesta fase** — evita billing, verificação de e-mail e antiabuso.

---

## 8. Plano de execução

Ordenado por dependência: cada fase evita retrabalho da seguinte.

### Fase A — Fundação *(bloqueante; nada novo antes disso)*

**A1. PostgreSQL + Docker ✅ Concluído**
PostgreSQL 16 via `docker compose up -d db`; provider trocado e 829 registros
migrados do SQLite (1 organização, 1 cliente, 4 usuários, 7 agentes, 3 máquinas,
429 softwares, 352 logs de coleta, 18 de auditoria) sem órfãos. O SQLite anterior
ficou preservado em `prisma/dev.db.backup-pre-postgres`.

**A2. Hierarquia `Organization` + RBAC de 4 papéis**
Criar `Organization`, vincular `Client`, migrar papéis, desnormalizar `clientId` em `Device`.
*Por que antes de tudo*: muda o escopo de **toda** consulta do sistema. Feito depois, obriga a reescrever tudo que vier antes.

**A3. Consolidação de rotas**
Reorganizar em `/admin`, `/app`, `/portal`; apagar os 8 stubs legados.
*Por que aqui*: define onde cada feature nova será colocada.

### Fase A4 — Redesenho do frontend *(direcionado, não reconstrução)*

A base atual (Tailwind v4 + shadcn/ui + Radix) **fica** — o problema não é o design system, é a **disposição e o fluxo** de telas específicas.

**Prioridade 1 — Criação/provisionamento de agente. ✅ Implementado** (`/clients/novo`).

O problema era despejar seis caminhos de instalação simultâneos (chave, comando bootstrap, .exe, PS1, comando manual, "abrir script") sem hierarquia, sem destacar que a chave só aparece uma vez, e sem nunca confirmar se a máquina conectou.

Fluxo novo, em 3 passos com estado explícito:
1. **Dados do cliente** — nome + endereço do servidor, com explicação do que o endereço significa
2. **Instalação** — download do `.exe` como ação única em destaque (a config vai embutida, não exige digitar nada); chave em aviso âmbar de exibição única; PowerShell/manual recolhidos em "outras formas de instalar", para GPO/Intune
3. **Primeira máquina** — a tela consulta `GET /api/clients/[id]/status` a cada 5s e vira "«hostname» conectou" quando o primeiro check-in chega; fecha o ciclo que antes ficava em aberto

**Prioridade 2 — Detalhe da máquina.** Hoje é uma lista longa de cartões; com segurança, métricas, periféricos e patrimônio entrando, vira ingovernável. Precisa das abas definidas na seção 5.2.

**Prioridade 3 — Navegação e hierarquia.** A sidebar precisa refletir `Organization → Client → Device` e o papel do usuário, em vez do menu plano atual.

**Prioridade 4 — Layout do portal do cliente.** Superfície própria, mais enxuta que a de operação.

> Manter: paleta, componentes shadcn/ui, tema claro/escuro. Trocar: disposição, densidade de informação, fluxo de tarefa.

### Fase B — Coleta ampliada
Cada item = schema + coletor Go + tela. Ordem por relação valor/esforço:

- **B1. Segurança/compliance** — maior valor comercial imediato
- **B2. Métricas / série temporal** — inclui política de retenção e expurgo
- **B3. Periféricos e monitores**
- **B4. Patrimônio** — só formulário, sem agente

### Fase C — Valor operacional
- **C1. Portal do cliente** (`/portal`) — depende de A2 e A3
- **C2. Relatórios CSV/PDF** — depende de B para ter o que reportar
- **C3. Alertas por regra** — evolui os limiares fixos de hoje
- **C4. Ampliar catálogo de comandos** — depende de A2 (papel `ORG_OPERATOR`)

### Fase D — Distribuição
- Assinatura Authenticode do agente
- Unificar publish do binário
- Coletores Linux/macOS
- Deploy assistido (GPO/Intune)

---

## 9. Riscos conhecidos em aberto

| Risco | Situação |
|---|---|
| `public/inventario-agent.exe` e `agent-go/dist/inventario-agent.exe` divergem | Sem processo único de publish |
| Agente sem assinatura Authenticode | Windows alerta "fornecedor desconhecido" |
| Sem rate limiting nas rotas do agente | Um agente comprometido pode inundar a ingestão |
| Retenção de métricas | Sem expurgo, a base cresce indefinidamente |
| Fila de comandos sem uso real | Validada por HTTP, mas nenhum agente Go instalado exercitou o ciclo completo ainda |
