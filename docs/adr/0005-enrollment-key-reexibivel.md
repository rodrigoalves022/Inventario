---
status: accepted
---

# `enrollmentKey` reexibível, cifrada e auditada (D3 = A)

**Contexto**: a `enrollmentKey` de um `Client` é a credencial que o instalador usa no primeiro
contato (`POST /api/agent/register`) para obter a `apiKey` própria de cada máquina. Ela é uma por
cliente e vale para todas as máquinas até ser rotacionada. A documentação e a interface diziam que
a chave "só aparece uma vez", mas o código já guardava uma cópia cifrada
(`Client.activeProvisioningKeyEnc`) e oferecia "Ver credenciais" em `/admin/clients`. Na Sprint A0
o gerente decidiu manter esse comportamento (decisão D3, opção A) em vez de removê-lo, porque o
administrador precisa do pacote de instalação para cada máquina nova do cliente.

**Decisão**:

- A `enrollmentKey` é conferida pelo hash (`Client.enrollmentKeyHash`) e também guardada cifrada
  com AES-256-GCM em `Client.activeProvisioningKeyEnc` (`lib/provisioning-credentials.ts`).
- Só quem tem `canManageTenant` sobre o cliente pode reexibi-la
  (`GET /api/clients/[id]/credentials`) ou rotacioná-la (`rotateEnrollmentKeyAction`, "Emitir novo
  pacote"). Ver RN015.
- Cada reexibição grava `credentials.view` e cada rotação grava `credentials.rotate` no `AuditLog`.
- A rotação pede confirmação na interface e informa quantas máquinas já registradas
  (`AgentAuth` com `isActive: true`) continuam funcionando.
- A `apiKey` dos agentes não muda: continua existindo só como hash.

**Consequências**:

- Custo aceito 1: uma sessão de `ORG_ADMIN` (ou `PLATFORM_ADMIN`) sequestrada consegue ler a chave
  de instalação dos clientes que administra. O rastro fica em `credentials.view`, mas a leitura não
  é impedida.
- Custo aceito 2: a rotação não contém um vazamento já ocorrido. Ela troca a chave de instalação,
  mas não revoga os `AgentAuth` já registrados; uma máquina registrada com a chave vazada continua
  fazendo check-in. A contenção (revogar `AgentAuth` na rotação, N4) fica para a Sprint A3.
- A documentação de produto (`docs/PRODUTO.md`, `docs/PRODUCT.md`, `docs/SPEC.md`, `CONTEXT.md`) e a
  copy da interface (`components/agent-install-package.tsx`) passam a descrever a chave como
  reutilizável até a rotação e reexibível por quem administra o cliente.

**Status**: aceito (Sprint A1, a partir da decisão D3 = A da Sprint A0).
