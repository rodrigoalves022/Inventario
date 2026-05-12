# Guia do Agente

Status: canonical
Scope: permanent
Last-reviewed: 2026-04-02

Este documento descreve o estado atual do agente de coleta e do provisioning.

## Implementação canônica atual

O **agente principal** do projeto está em:

- `agent-go/`

Os arquivos em:

- `scripts/agent/`

continuam úteis para bootstrap, compatibilidade operacional e suporte, mas **não são a fonte principal do coletor**.

## Fluxo atual

```text
Painel / Provisioning
  -> POST /api/clients
  -> POST /api/agent/register
  -> GET /api/agent/bootstrap
  -> GET /api/agent/download
  -> inventario-agent.exe install ...
  -> POST /api/agent/checkin
```

## Autenticação

Há três níveis de credencial:

- `X-Admin-Secret` para operações administrativas
- `client + enrollmentKey` para provisionamento do agente
- `X-API-Key` para check-in do agente

As chaves são geradas em plaintext uma única vez e armazenadas no servidor apenas como hash SHA-256.

## Provisioning atual do Windows

O fluxo web atual é o mais importante:

1. criar ou selecionar um `Client`
2. obter `enrollmentKey`
3. gerar bootstrap via `GET /api/agent/bootstrap`
4. baixar o binário via `GET /api/agent/download`
5. executar o comando de instalação do agente

Exemplo de comando final:

```powershell
inventario-agent.exe install -server "https://servidor" -client "acme" -key "ENROLLMENT_KEY" -name "%COMPUTERNAME%"
```

O bootstrap PowerShell continua sendo útil para instalação remota rápida.

## Situação do Linux

O projeto mantém suporte conceitual a Linux, mas o caminho de distribuição web atualmente está centrado em Windows (`inventario-agent.exe`).

Qualquer expansão de provisioning Linux deve:

- manter o agente Go como base
- preservar autenticação por `client + enrollmentKey`
- alinhar-se aos contratos de `register` e `checkin`

## Estrutura geral do payload

Campos principais esperados:

- `hostname`
- `serial`
- `fabricante`
- `modelo`
- `dominio`
- `usuario`
- `sistema`
- `versaoSO`
- `processador`
- `ramTotalGb`
- `slot1..slot4`
- `placaMae`
- `tipoArmazenamento`
- `redes[]`
- `discos[]`
- `software[]`

O contrato detalhado e os endpoints estão em `docs/API.md`.

## Invariantes que não devem regredir

- o agente não deve enxergar dados de outros equipamentos
- a autenticação de coleta deve permanecer baseada em `X-API-Key`
- o servidor não deve persistir chaves em plaintext
- a identidade do dispositivo no backend deve permanecer vinculada a `agentAuthId`

## Melhorias prioritárias no agente

1. DPAPI / proteção local de segredos no Windows
2. mais validação e observabilidade operacional
3. fortalecimento do provisioning e da experiência de instalação
