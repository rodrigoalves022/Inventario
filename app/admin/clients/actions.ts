'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generateEnrollmentKey } from '@/lib/auth'
import { slugifyClientName } from '@/lib/clients'
import { canManageTenant, getSessionPermissionUser, isOrgAdmin, isPlatformAdmin } from '@/lib/permissions'
import { resolveOrganizationIdForActor } from '@/lib/organizations'
import { buildProvisioningArtifacts } from '@/lib/provisioning'
import { getPublishedAgentHashes } from '@/lib/agent-binary'
import { encryptProvisioningSecret } from '@/lib/provisioning-credentials'
import { AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'
import { type ProvisioningActionState, type RequestAgentUpdateState } from './types'

// Arquivo 'use server': so funcoes async em runtime. O valor inicial
// (initialRequestAgentUpdateState) mora em ./types.ts.
export type { RequestAgentUpdateState }

// Mensagens em pt-BR em todos os campos: as padrao do Zod 3 sao em ingles
// ("Invalid url", "Expected string, received null"...) e chegam ao usuario
// por `issues[0]?.message`. `formData.get` devolve null para campo ausente,
// que cai em invalid_type_error (nao em required_error).
function requiredString(message: string) {
  return z.string({ required_error: message, invalid_type_error: message })
}

const serverUrlSchema = requiredString('Informe o endereço do servidor.')
  .trim()
  .url('Informe um endereço de servidor válido, por exemplo https://inventario.suaempresa.com.')

const clientNameMessage = 'Informe um nome com pelo menos 3 caracteres.'

const createClientSchema = z.object({
  serverUrl: serverUrlSchema,
  name: requiredString(clientNameMessage).trim().min(3, clientNameMessage),
  slug: z
    .string()
    .trim()
    .max(64, 'O slug deve ter no máximo 64 caracteres.')
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hifens.')
    .optional(),
})

const rotateKeySchema = z.object({
  serverUrl: serverUrlSchema,
  clientId: requiredString('Cliente não informado.').trim().min(1, 'Cliente não informado.'),
  // Sprint A3, item 10 (RN019). Checkbox "Revogar tambem os agentes ativos":
  // o painel so envia o campo quando marcado, com o valor 'true'. Ausente =
  // comportamento anterior da rotacao, sem tocar AgentAuth.
  revokeActiveAgents: z
    .literal('true', { errorMap: () => ({ message: 'Opção de revogação dos agentes inválida.' }) })
    .optional(),
})

const revokeAgentAuthSchema = z.object({
  agentAuthId: requiredString('Credencial de agente não informada.')
    .trim()
    .min(1, 'Credencial de agente não informada.'),
})

// Um arquivo 'use server' so pode exportar funcoes async (Next.js exige isso
// em runtime) — por isso, ao contrario de ProvisioningActionState (definido em
// ./types.ts), o tipo de estado fica so como type-only export aqui: tipos sao
// apagados na compilacao e nao violam a restricao, mas uma constante de valor
// (ex.: um "initialState" default) precisaria ir para ./types.ts, nao aqui.
export type RevokeAgentAuthState = {
  error: string | null
  message: string | null
}

function rejectUnauthorizedAccess(): ProvisioningActionState {
  return {
    error: 'Acesso administrativo não autorizado.',
    message: null,
    package: null,
  }
}

// Gerir clientes e atribuicao de administrador: PLATFORM_ADMIN em qualquer conta,
// ORG_ADMIN apenas dentro da propria (o organizationId vem sempre do ator, nunca do form).
async function hasClientsAdminAccess() {
  const session = await auth()
  const user = getSessionPermissionUser(session)
  return isPlatformAdmin(user) || isOrgAdmin(user)
}

type TransactionLike = {
  client: typeof prisma.client
  agentAuth: typeof prisma.agentAuth
  agentCommand: typeof prisma.agentCommand
  alertEvent: typeof prisma.alertEvent
  auditLog: typeof prisma.auditLog
  $executeRaw: typeof prisma.$executeRaw
}

/**
 * Efeitos colaterais da revogacao de AgentAuth (Sprint A3, item 8), sempre
 * dentro da transacao de quem revoga:
 *
 * - AgentCommand `pending`/`running` vira `expired`. So o proprio agente
 *   expira comando vencido (ao consultar /api/agent/commands/pending), e um
 *   agente revogado recebe 403 antes disso: sem este passo o comando ficaria
 *   aberto para sempre.
 * - AlertEvent aberto do Device da credencial e resolvido, de qualquer
 *   metrica, SEM webhook (decisao 2 do usuario). A resolucao normal depende de
 *   check-in, que nao vai mais acontecer; e mandar `device.online` seria
 *   falso, porque a maquina nao voltou.
 *
 * Os ids ja chegam autorizados (canManageTenant sobre o cliente dono).
 */
async function applyRevocationEffects(
  db: Pick<TransactionLike, 'agentCommand' | 'alertEvent'>,
  agentAuthIds: string[],
  now: Date
) {
  if (agentAuthIds.length === 0) return

  await db.agentCommand.updateMany({
    where: { agentAuthId: { in: agentAuthIds }, status: { in: ['pending', 'running'] } },
    data: { status: 'expired' },
  })

  await db.alertEvent.updateMany({
    where: { resolvedAt: null, device: { agentAuthId: { in: agentAuthIds } } },
    data: { resolvedAt: now },
  })
}

function clientAgentsPath(clientId: string) {
  return `/admin/clients/${clientId}/agents`
}

async function persistActiveProvisioningKey(
  db: Pick<TransactionLike, '$executeRaw'>,
  clientId: string,
  enrollmentKey: string
) {
  await db.$executeRaw`
    UPDATE "clients"
    SET "activeProvisioningKeyEnc" = ${encryptProvisioningSecret({ enrollmentKey })},
        "activeProvisioningSetAt" = ${new Date()}
    WHERE "id" = ${clientId}
  `
}

async function buildState(
  message: string,
  packageData: {
    clientId: string
    clientName: string
    clientSlug: string
    enrollmentKey: string
    serverUrl: string
  }
): Promise<ProvisioningActionState> {
  const artifacts = buildProvisioningArtifacts(
    packageData.serverUrl,
    packageData.clientSlug,
    packageData.enrollmentKey
  )

  return {
    error: null,
    message,
    package: {
      clientId: packageData.clientId,
      clientName: packageData.clientName,
      clientSlug: packageData.clientSlug,
      enrollmentKey: packageData.enrollmentKey,
      ...artifacts,
      ...(await getPublishedAgentHashes()),
    },
  }
}

export async function createClientAction(
  _previousState: ProvisioningActionState,
  formData: FormData
): Promise<ProvisioningActionState> {
  try {
    if (!(await hasClientsAdminAccess())) {
      return rejectUnauthorizedAccess()
    }

    const parsed = createClientSchema.safeParse({
      serverUrl: formData.get('serverUrl'),
      name: formData.get('name'),
      slug: formData.get('slug') || undefined,
    })

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
        message: null,
        package: null,
      }
    }

    const slug = (parsed.data.slug ?? slugifyClientName(parsed.data.name)).trim().toLowerCase()
    if (!slug) {
      return {
        error: 'Não foi possível gerar um identificador válido para o cliente.',
        message: null,
        package: null,
      }
    }

    const existing = await prisma.client.findUnique({ where: { slug } })
    if (existing) {
      return {
        error: 'Já existe um cliente com esse nome ou com um nome equivalente.',
        message: null,
        package: null,
      }
    }

    const { plaintext, hash } = await generateEnrollmentKey()
    const user = getSessionPermissionUser(await auth())
    const organizationId = await resolveOrganizationIdForActor(user)
    const actor = getSessionAuditActor(user)
    const client = await prisma.$transaction(async (tx: TransactionLike) => {
      const createdClient = await tx.client.create({
        data: {
          name: parsed.data.name,
          slug,
          enrollmentKeyHash: hash,
          organizationId,
        },
      })

      await persistActiveProvisioningKey(tx, createdClient.id, plaintext)
      await recordAuditLog(
        {
          action: 'client.create',
          targetType: 'client',
          targetId: createdClient.id,
          clientId: createdClient.id,
          actor,
          metadata: { clientSlug: createdClient.slug },
        },
        tx
      )
      return createdClient
    })

    revalidatePath('/admin/clients')

    return await buildState('Cliente criado e pacote de instalação emitido.', {
      clientId: client.id,
      clientName: client.name,
      clientSlug: client.slug,
      enrollmentKey: plaintext,
      serverUrl: parsed.data.serverUrl,
    })
  } catch (error) {
    console.error('[clients/create] Erro:', error)
    return {
      error: 'Erro interno ao criar cliente.',
      message: null,
      package: null,
    }
  }
}

export async function rotateEnrollmentKeyAction(
  _previousState: ProvisioningActionState,
  formData: FormData
): Promise<ProvisioningActionState> {
  try {
    const session = await auth()
    const user = getSessionPermissionUser(session)

    const parsed = rotateKeySchema.safeParse({
      serverUrl: formData.get('serverUrl'),
      clientId: formData.get('clientId'),
      revokeActiveAgents: formData.get('revokeActiveAgents') ?? undefined,
    })

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
        message: null,
        package: null,
      }
    }

    // Rotacao de chave e emissao de credencial para um tenant JA existente
    // (nao criacao/edicao de conta), entao usa canManageTenant — mesmo guard
    // de GET /api/clients/[id]/credentials — e nao o hasClientsAdminAccess
    // mais permissivo usado em createClientAction. Ver RN015 em docs/PRODUCT.md.
    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
      select: { id: true, name: true, slug: true, organizationId: true },
    })

    if (!client) {
      return {
        error: 'Cliente não encontrado.',
        message: null,
        package: null,
      }
    }

    if (!canManageTenant(user, client)) {
      return rejectUnauthorizedAccess()
    }

    const { plaintext, hash } = await generateEnrollmentKey()
    const actor = getSessionAuditActor(user)
    const revokeActiveAgents = parsed.data.revokeActiveAgents === 'true'
    // Troca de chave e revogacao em massa (RN019) na MESMA transacao: uma
    // falha em qualquer parte nao deixa a chave trocada sem as revogacoes,
    // nem o contrario.
    const revokedCount = await prisma.$transaction(async (tx: TransactionLike) => {
      await tx.client.update({
        where: { id: client.id },
        data: { enrollmentKeyHash: hash },
      })

      await persistActiveProvisioningKey(tx, client.id, plaintext)

      let revoked: number | null = null
      if (revokeActiveAgents) {
        const now = new Date()
        const activeAgents = await tx.agentAuth.findMany({
          where: { clientId: client.id, isActive: true },
          select: { id: true, name: true },
        })
        // Revoga uma a uma, condicionado a isActive: true, e so segue com as
        // que esta transacao de fato revogou. Uma revogacao individual que
        // fizer commit entre o findMany e aqui deixa count 0 e nao ganha um
        // segundo agent_auth.revoke nem entra no revokedCount.
        const revokedAgents: typeof activeAgents = []
        for (const agent of activeAgents) {
          const { count } = await tx.agentAuth.updateMany({
            where: { id: agent.id, clientId: client.id, isActive: true },
            data: { isActive: false, revokedAt: now },
          })
          if (count > 0) revokedAgents.push(agent)
        }
        const ids = revokedAgents.map((agent) => agent.id)

        if (ids.length > 0) {
          await applyRevocationEffects(tx, ids, now)

          // Decisao 4: um agent_auth.revoke por credencial (a trilha fica por
          // maquina e a busca por agent_auth.revoke acha todas as revogacoes).
          for (const agent of revokedAgents) {
            await recordAuditLog(
              {
                action: 'agent_auth.revoke',
                targetType: 'agent_auth',
                targetId: agent.id,
                clientId: client.id,
                actor,
                metadata: { agentAuthName: agent.name, clientSlug: client.slug, via: 'rotation' },
              },
              tx
            )
          }
        }
        revoked = ids.length
      }

      await recordAuditLog(
        {
          action: 'credentials.rotate',
          targetType: 'client',
          targetId: client.id,
          clientId: client.id,
          actor,
          // Desmarcado: metadata identico ao de antes da Sprint A3.
          metadata: revoked === null ? { clientSlug: client.slug } : { clientSlug: client.slug, revokedCount: revoked },
        },
        tx
      )

      return revoked
    })

    revalidatePath('/admin/clients')
    revalidatePath(clientAgentsPath(client.id))

    const message =
      revokedCount && revokedCount > 0
        ? `Chave de instalação rotacionada e ${
            revokedCount === 1 ? '1 agente revogado' : `${revokedCount} agentes revogados`
          }. Reinstale o agente nessas máquinas com o pacote novo.`
        : 'Chave de instalação rotacionada. Revise os instaladores antigos.'

    return await buildState(message, {
      clientId: client.id,
      clientName: client.name,
      clientSlug: client.slug,
      enrollmentKey: plaintext,
      serverUrl: parsed.data.serverUrl,
    })
  } catch (error) {
    console.error('[clients/rotate-key] Erro:', error)
    return {
      error: 'Erro interno ao rotacionar a chave de instalação.',
      message: null,
      package: null,
    }
  }
}

export async function revokeAgentAuthAction(
  _previousState: RevokeAgentAuthState,
  formData: FormData
): Promise<RevokeAgentAuthState> {
  try {
    const session = await auth()
    const user = getSessionPermissionUser(session)

    const parsed = revokeAgentAuthSchema.safeParse({
      agentAuthId: formData.get('agentAuthId'),
    })

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
        message: null,
      }
    }

    // Revogar a credencial de um AgentAuth de um tenant JA existente (nao
    // criacao/edicao de conta), entao usa canManageTenant — mesmo guard de
    // rotateEnrollmentKeyAction/GET /api/clients/[id]/credentials — e nao o
    // hasClientsAdminAccess mais permissivo usado em createClientAction.
    // Ver RN015 e item 4 da Sprint 6 em docs/SPRINTS.md.
    const agentAuth = await prisma.agentAuth.findUnique({
      where: { id: parsed.data.agentAuthId },
      select: {
        id: true,
        name: true,
        client: {
          select: { id: true, slug: true, organizationId: true },
        },
      },
    })

    // Checagem unica (existencia + autorizacao) numa so condicao, com uma unica
    // mensagem de erro para ambos os casos: mesmo padrao do fix de oraculo de
    // existencia em app/api/clients/[id]/credentials/route.ts (GET) — nunca
    // revelar a um ator sem acesso que um AgentAuth/tenant de outra organizacao
    // existe. AgentAuth.clientId e opcional no schema (SetNull em cascade), entao
    // um registro orfao (sem client) tambem cai neste mesmo caminho.
    if (!agentAuth || !agentAuth.client || !canManageTenant(user, agentAuth.client)) {
      return {
        error: 'Credencial de agente não encontrada.',
        message: null,
      }
    }

    const client = agentAuth.client
    const actor = getSessionAuditActor(user)
    const revoked = await prisma.$transaction(async (tx: TransactionLike) => {
      const now = new Date()
      // Idempotencia (Sprint A3, item 8c): so revoga o que ainda esta ativo.
      // O filtro isActive: true no proprio UPDATE evita corrida entre dois
      // cliques; credencial ja revogada mantem o revokedAt original e nao
      // ganha um segundo agent_auth.revoke.
      const { count } = await tx.agentAuth.updateMany({
        where: { id: agentAuth.id, isActive: true },
        data: { isActive: false, revokedAt: now },
      })
      if (count === 0) return false

      await applyRevocationEffects(tx, [agentAuth.id], now)

      await recordAuditLog(
        {
          action: 'agent_auth.revoke',
          targetType: 'agent_auth',
          targetId: agentAuth.id,
          clientId: client.id,
          actor,
          metadata: { agentAuthName: agentAuth.name, clientSlug: client.slug },
        },
        tx
      )
      return true
    })

    revalidatePath('/admin/clients')
    revalidatePath(clientAgentsPath(client.id))

    return {
      error: null,
      message: revoked ? 'Credencial de agente revogada.' : 'Credencial de agente já estava revogada.',
    }
  } catch (error) {
    console.error('[clients/revoke-agent-auth] Erro:', error)
    return {
      error: 'Erro interno ao revogar a credencial de agente.',
      message: null,
    }
  }
}

export async function requestClientAgentUpdateAction(
  _previousState: RequestAgentUpdateState,
  formData: FormData
): Promise<RequestAgentUpdateState> {
  try {
    const session = await auth()
    const user = getSessionPermissionUser(session)

    if (!session?.user) {
      return { error: 'Sessão expirada. Faça login novamente.', message: null }
    }

    const agentAuthId = formData.get('agentAuthId')
    const clientId = formData.get('clientId')
    const actor = getSessionAuditActor(user)

    if (typeof agentAuthId === 'string' && agentAuthId) {
      const agentAuth = await prisma.agentAuth.findUnique({
        where: { id: agentAuthId },
        select: {
          id: true,
          name: true,
          isActive: true,
          device: { select: { id: true, hostname: true } },
          client: { select: { id: true, slug: true, organizationId: true } },
        },
      })

      if (!agentAuth || !agentAuth.client || !canManageTenant(user, agentAuth.client)) {
        return { error: 'Credencial de agente não encontrada.', message: null }
      }
      if (!agentAuth.isActive) {
        return { error: 'Credencial de agente revogada não pode receber atualização.', message: null }
      }
      if (!agentAuth.device) {
        return { error: 'Este agente ainda não possui máquina vinculada.', message: null }
      }

      const device = agentAuth.device
      const expiresAt = new Date(Date.now() + AGENT_COMMAND_TTL_MS)
      const client = agentAuth.client
      await prisma.$transaction(async (tx: TransactionLike) => {
        await tx.agentCommand.create({
          data: {
            agentAuthId: agentAuth.id,
            clientId: client.id,
            type: 'update_agent',
            paramsJson: null,
            status: 'pending',
            requestedByUserId: actor.userId ?? null,
            expiresAt,
          },
        })
        await recordAuditLog(
          {
            action: 'command.enqueue',
            targetType: 'device',
            targetId: device.id,
            clientId: client.id,
            actor,
            metadata: { commandType: 'update_agent', hostname: device.hostname, agentAuthId: agentAuth.id },
          },
          tx
        )
      })

      revalidatePath(clientAgentsPath(client.id))
      return { error: null, message: `Comando de atualização enviado para ${device.hostname}.` }
    }

    if (typeof clientId === 'string' && clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, slug: true, organizationId: true },
      })

      if (!client || !canManageTenant(user, client)) {
        return { error: 'Cliente não encontrado.', message: null }
      }

      const rows = await prisma.agentAuth.findMany({
        where: { clientId: client.id, isActive: true, device: { isNot: null } },
        select: { id: true, device: { select: { id: true, hostname: true } } },
      })
      const targets = rows.flatMap((row) => (row.device ? [{ agentAuthId: row.id, device: row.device }] : []))
      const devices = targets.map((target) => target.device)
      const expiresAt = new Date(Date.now() + AGENT_COMMAND_TTL_MS)

      if (devices.length === 0) {
        return { error: 'Nenhum agente ativo com máquina vinculada para atualizar.', message: null }
      }

      await prisma.$transaction(async (tx: TransactionLike) => {
        for (const target of targets) {
          await tx.agentCommand.create({
            data: {
              agentAuthId: target.agentAuthId,
              clientId: client.id,
              type: 'update_agent',
              paramsJson: null,
              status: 'pending',
              requestedByUserId: actor.userId ?? null,
              expiresAt,
            },
          })
        }
        await recordAuditLog(
          {
            action: 'command.bulk_enqueue',
            targetType: 'client',
            targetId: client.id,
            clientId: client.id,
            actor,
            metadata: { commandType: 'update_agent', count: devices.length },
          },
          tx
        )
      })

      revalidatePath(clientAgentsPath(client.id))
      return { error: null, message: `Comando de atualização enviado para ${devices.length} agente(s).` }
    }

    return { error: 'Nenhum agente ou cliente informado.', message: null }
  } catch (error) {
    console.error('[clients/request-agent-update] Erro:', error)
    return { error: 'Erro interno ao solicitar a atualização do agente.', message: null }
  }
}
