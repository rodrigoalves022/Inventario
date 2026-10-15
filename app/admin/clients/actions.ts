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
import { encryptProvisioningSecret } from '@/lib/provisioning-credentials'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'
import { type ProvisioningActionState } from './types'

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
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hifens.')
    .optional(),
})

const rotateKeySchema = z.object({
  serverUrl: serverUrlSchema,
  clientId: requiredString('Cliente não informado.').trim().min(1, 'Cliente não informado.'),
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
  auditLog: typeof prisma.auditLog
  $executeRaw: typeof prisma.$executeRaw
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

function buildState(
  message: string,
  packageData: {
    clientId: string
    clientName: string
    clientSlug: string
    enrollmentKey: string
    serverUrl: string
  }
): ProvisioningActionState {
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

    return buildState('Cliente criado e pacote de instalação emitido.', {
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
    await prisma.$transaction(async (tx: TransactionLike) => {
      await tx.client.update({
        where: { id: client.id },
        data: { enrollmentKeyHash: hash },
      })

      await persistActiveProvisioningKey(tx, client.id, plaintext)
      await recordAuditLog(
        {
          action: 'credentials.rotate',
          targetType: 'client',
          targetId: client.id,
          clientId: client.id,
          actor,
          metadata: { clientSlug: client.slug },
        },
        tx
      )
    })

    revalidatePath('/admin/clients')

    return buildState('Chave de instalação rotacionada. Revise os instaladores antigos.', {
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
    await prisma.$transaction(async (tx: TransactionLike) => {
      await tx.agentAuth.update({
        where: { id: agentAuth.id },
        data: { isActive: false, revokedAt: new Date() },
      })

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
    })

    revalidatePath('/admin/clients')

    return {
      error: null,
      message: 'Credencial de agente revogada.',
    }
  } catch (error) {
    console.error('[clients/revoke-agent-auth] Erro:', error)
    return {
      error: 'Erro interno ao revogar a credencial de agente.',
      message: null,
    }
  }
}
