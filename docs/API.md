# API

Status: canonical
Scope: permanent
Last-reviewed: 2026-04-02

Base URL de exemplo: `http://SEU_SERVIDOR:3000`

## Níveis de autenticação

| Nível | Header / credencial | Usado em |
|---|---|---|
| Admin | `X-Admin-Secret` | criação/listagem de clientes e registro administrativo |
| Cliente | `client + enrollmentKey` | registro do agente por tenant |
| Agente | `X-API-Key` | check-in de coleta |

## Endpoints principais

### `GET /api/clients`

Lista clientes.

Headers:

```http
X-Admin-Secret: SUA_ADMIN_SECRET
```

Resposta `200`: lista de clientes com contagem de agentes.

### `POST /api/clients`

Cria um novo cliente/tenant e retorna a `enrollmentKey` uma única vez.

Headers:

```http
Content-Type: application/json
X-Admin-Secret: SUA_ADMIN_SECRET
```

Body:

```json
{ "name": "Globex Corp", "slug": "globex-corp" }
```

Resposta `201`:

```json
{
  "id": "clx-client",
  "name": "Globex Corp",
  "slug": "globex-corp",
  "enrollmentKey": "f67817...",
  "message": "Cliente criado. Guarde a enrollmentKey - ela não será exibida novamente."
}
```

Erros comuns:

- `400`: payload inválido
- `401`: não autorizado
- `409`: slug já existente

### `POST /api/agent/register`

Registra um novo agente e retorna a `apiKey` uma única vez.

#### Modo admin

Headers:

```http
Content-Type: application/json
X-Admin-Secret: SUA_ADMIN_SECRET
```

Body:

```json
{ "name": "WKS-006 - Recepcao", "client": "globex-corp" }
```

#### Modo cliente

Body:

```json
{
  "name": "WKS-006 - Recepcao",
  "client": "globex-corp",
  "enrollmentKey": "CHAVE_DO_CLIENTE"
}
```

Resposta `201`:

```json
{
  "id": "clx-agent",
  "name": "WKS-006 - Recepcao",
  "client": {
    "id": "clx-client",
    "name": "Globex Corp",
    "slug": "globex-corp"
  },
  "apiKey": "a3f9c82e...",
  "message": "Agente registrado. Guarde a apiKey - ela não será exibida novamente."
}
```

Erros comuns:

- `400`: payload inválido
- `401`: enrollment key ausente/inválida ou admin secret inválido
- `403`: cliente desativado
- `404`: cliente não encontrado

### `POST /api/agent/checkin`

Endpoint principal de ingestão de inventário.

Headers:

```http
Content-Type: application/json
X-API-Key: API_KEY_DO_AGENTE
```

Body resumido:

```json
{
  "hostname": "WKS-006",
  "serial": "3QXYZ",
  "fabricante": "Dell Inc.",
  "modelo": "OptiPlex 3080",
  "redes": [{ "ip": "10.62.1.50", "mac": "A4:C3:F0:11:22:33" }],
  "discos": [{ "unidade": "C:", "tipo": "SSD", "capacidadeGb": 476 }],
  "software": [{ "nome": "Microsoft 365", "versao": "16.0.17126" }]
}
```

Resposta `200`:

```json
{
  "ok": true,
  "deviceId": "clx-device",
  "client": {
    "id": "clx-client",
    "name": "Globex Corp",
    "slug": "globex-corp"
  }
}
```

Erros comuns:

- `400`: `hostname` ausente
- `401`: API key ausente ou inválida
- `403`: API key revogada ou cliente desativado

### `GET /api/agent/download`

Retorna o binário Windows do agente.

Resposta `200`:

- `Content-Type: application/vnd.microsoft.portable-executable`
- arquivo `inventario-agent.exe`

Erro comum:

- `503`: binário não encontrado em `agent-go/dist/inventario-agent.exe`

### `GET /api/agent/bootstrap?client=<slug>&key=<enrollmentKey>`

Gera um script PowerShell de bootstrap para instalação remota.

Parâmetros obrigatórios:

- `client`
- `key`

Resposta `200`:

- script PowerShell em texto
- `Content-Disposition` com nome `install-<client>.ps1`

Erro comum:

- `400`: parâmetros ausentes ou inválidos

## Invariantes do contrato atual

- `apiKey` e `enrollmentKey` só são retornadas em plaintext uma vez
- o servidor persiste apenas hashes
- `checkin` resolve o dispositivo por `agentAuthId`
- cliente inativo deve bloquear registro e check-in


### `GET /api/dashboard/stats?clientSlug=<slug>`

Retorna estatísticas do dashboard **somente** para o tenant informado.

Parâmetros obrigatórios:

- `clientSlug`

Resposta `200`:

```json
{
  "tenant": { "slug": "globex-corp", "name": "Globex Corp" },
  "total": 12,
  "online": 10,
  "offline": 1,
  "warning": 1
}
```

Erros comuns:

- `400`: `clientSlug` ausente
- `404`: tenant inexistente ou inativo

### `GET /api/inventory/computers?clientSlug=<slug>`

Lista apenas computadores do tenant informado.

Parâmetros obrigatórios:

- `clientSlug`

Erros comuns:

- `400`: `clientSlug` ausente
- `404`: tenant inexistente ou inativo

## Regras adicionais do painel tenant-aware

- páginas operacionais do painel usam `/tenant/[clientSlug]/*`
- rotas/API operacionais devem falhar fechadas quando `clientSlug` estiver ausente ou inválido
- `/clients` permanece como área administrativa global
