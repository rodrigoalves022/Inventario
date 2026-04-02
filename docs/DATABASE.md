# Banco de Dados

Status: canonical
Scope: permanent
Last-reviewed: 2026-04-02

Schema Prisma v5 com:

- **SQLite** no estado atual de desenvolvimento
- **PostgreSQL** como alvo de produção

> Observação: o `schema.prisma` atual ainda declara `provider = "sqlite"`. A diretriz de produção continua sendo PostgreSQL.

## Relacionamentos principais

```text
Client (1) -> AgentAuth (N)
AgentAuth (1) -> Device (1)
Device (1) -> Hardware (1)
Device (1) -> Network (N)
Device (1) -> Disk (N)
Device (1) -> Software (N)
Device (1) -> CollectionLog (N)
```

## Entidades

### `clients`

Tenants proprietários dos agentes e dos dados de inventário.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `String` | PK |
| `name` | `String` | Nome do cliente |
| `slug` | `String` | Identificador estável único |
| `enrollmentKeyHash` | `String` | Hash da chave de provisionamento |
| `isActive` | `Boolean` | Cliente ativo/inativo |
| `createdAt` | `DateTime` | Criação |
| `updatedAt` | `DateTime` | Atualização |

### `agent_auths`

Credenciais dos agentes.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `String` | PK |
| `clientId` | `String?` | FK para `clients.id` |
| `name` | `String` | Nome amigável do agente |
| `apiKeyHash` | `String` | Hash da API key |
| `isActive` | `Boolean` | Ativa/revogada |
| `createdAt` | `DateTime` | Criação |
| `revokedAt` | `DateTime?` | Revogação |

### `devices`

Representa o endpoint inventariado.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `String` | PK |
| `agentAuthId` | `String` | FK única para `agent_auths.id` |
| `hostname` | `String` | Nome do host |
| `serial` | `String?` | Serial do equipamento |
| `fabricante` | `String?` | Fabricante |
| `modelo` | `String?` | Modelo |
| `dominio` | `String?` | Domínio |
| `usuario` | `String?` | Usuário atual/último |
| `status` | `String` | Estado operacional |
| `createdAt` | `DateTime` | Criação |
| `updatedAt` | `DateTime` | Atualização |

### Entidades filhas

- `hardware`
- `networks`
- `disks`
- `software`
- `collection_logs`

Todas são vinculadas por `deviceId`.

## Invariantes de modelagem

- um `Client` possui vários `AgentAuth`
- um `AgentAuth` possui no máximo um `Device`
- a identidade persistente do dispositivo no backend é `agentAuthId`
- entidades filhas devem ser sempre reconciliadas a partir do `deviceId`

## Decisão estrutural importante

O `checkin` faz upsert por `agentAuthId` em vez de `hostname`.

Isso evita:

- colisão entre clientes com nomes de host iguais
- ambiguidades de reidentificação
- acoplamento incorreto entre identidade lógica do agente e nome da máquina

## Direção futura do banco

Próximas evoluções prováveis:

1. migração explícita para PostgreSQL em produção
2. reforço de índices para consultas multi-tenant
3. trilhas de auditoria mais completas
4. base para RBAC e escopo administrativo
