'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canManageTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'
import { buildProvisioningArtifacts } from '@/lib/provisioning'
import { getPublishedAgentHashes } from '@/lib/agent-binary'
import { decryptProvisioningSecret } from '@/lib/provisioning-credentials'
import { type ClientMutationState, type ProvisioningActionState } from './types'

// Acoes da central de gerenciamento (/admin/clients/[id]): usuarios vinculados
// ao tenant e recalculo do pacote para um endereco de servidor. Arquivo
// 'use server': so funcoes async exportadas.

function requiredString(message: string) {
  return z.string({ required_error: message, invalid_type_error: message })
}

const addClientUserSchema = z.object({
  clientId: requiredString('Cliente não informado.').trim().min(1, 'Cliente não informado.'),
  name: requiredString('Informe o nome do usuário.').trim().min(2, 'Informe o nome do usuário.').max(120),
  email: requiredString('Informe o e-mail.').trim().toLowerCase().email('Informe um e-mail válido.'),
  password: requiredString('Informe a senha inicial.')
    .min(8, 'A senha inicial deve ter no mínimo 8 caracteres.')
    .max(200, 'A senha inicial é longa demais.'),
})

const clientUserRefSchema = z.object({
  clientId: requiredString('Cliente não informado.').trim().min(1, 'Cliente não informado.'),
  userId: requiredString('Usuário não informado.').trim().min(1, 'Usuário não informado.'),
})

async function loadManagedClient(clientId: string) {
  const user = getSessionPermissionUser(await auth())
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true, organizationId: true },
  })
  // Existencia + autorizacao numa so mensagem: nao revela tenants alheios.
  if (!client || !canManageTenant(user, client)) return { user, client: null }
  return { user, client }
}

export async function addClientUserAction(formData: FormData): Promise<ClientMutationState> {
  try {
    const parsed = addClientUserSchema.safeParse({
      clientId: formData.get('clientId'),
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
    })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.', message: null }
    }

    const { user, client } = await loadManagedClient(parsed.data.clientId)
    if (!client) return { error: 'Cliente não encontrado.', message: null }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } })
    if (existing) return { error: 'Já existe um usuário com esse e-mail.', message: null }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10)
    const actor = getSessionAuditActor(user)
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          role: 'CLIENT_VIEWER',
          organizationId: client.organizationId,
          clientId: client.id,
          isActive: true,
        },
        select: { id: true },
      })
      await recordAuditLog(
        {
          action: 'user.create',
          targetType: 'user',
          targetId: created.id,
          clientId: client.id,
          actor,
          metadata: { email: parsed.data.email, role: 'CLIENT_VIEWER', clientSlug: client.slug },
        },
        tx
      )
    })

    revalidatePath(`/admin/clients/${client.id}`)
    return { error: null, message: 'Usuário vinculado ao cliente.' }
  } catch (error) {
    console.error('[clients/add-user] Erro:', error)
    return { error: 'Erro interno ao vincular o usuário.', message: null }
  }
}

/** Carrega o usuario garantindo que e um CLIENT_VIEWER DESTE cliente. */
async function loadClientUser(formData: FormData) {
  const parsed = clientUserRefSchema.safeParse({
    clientId: formData.get('clientId'),
    userId: formData.get('userId'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' } as const
  }
  const { user, client } = await loadManagedClient(parsed.data.clientId)
  if (!client) return { error: 'Cliente não encontrado.' } as const
  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, role: true, clientId: true, isActive: true },
  })
  if (!target || target.clientId !== client.id || target.role !== 'CLIENT_VIEWER') {
    return { error: 'Usuário não encontrado neste cliente.' } as const
  }
  return { error: null, user, client, target } as const
}

export async function toggleClientUserAction(formData: FormData): Promise<ClientMutationState> {
  try {
    const loaded = await loadClientUser(formData)
    if (loaded.error !== null) return { error: loaded.error, message: null }
    const { user, client, target } = loaded

    const isActive = !target.isActive
    const actor = getSessionAuditActor(user)
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { isActive } })
      await recordAuditLog(
        {
          action: 'user.update',
          targetType: 'user',
          targetId: target.id,
          clientId: client.id,
          actor,
          metadata: { email: target.email, isActive, clientSlug: client.slug },
        },
        tx
      )
    })

    revalidatePath(`/admin/clients/${client.id}`)
    return { error: null, message: isActive ? 'Usuário ativado.' : 'Usuário desativado.' }
  } catch (error) {
    console.error('[clients/toggle-user] Erro:', error)
    return { error: 'Erro interno ao alterar o usuário.', message: null }
  }
}

export async function removeClientUserAction(formData: FormData): Promise<ClientMutationState> {
  try {
    const loaded = await loadClientUser(formData)
    if (loaded.error !== null) return { error: loaded.error, message: null }
    const { user, client, target } = loaded

    const actor = getSessionAuditActor(user)
    await prisma.$transaction(async (tx) => {
      await recordAuditLog(
        {
          action: 'user.delete',
          targetType: 'user',
          targetId: target.id,
          clientId: client.id,
          actor,
          metadata: { email: target.email, clientSlug: client.slug },
        },
        tx
      )
      await tx.user.delete({ where: { id: target.id } })
    })

    revalidatePath(`/admin/clients/${client.id}`)
    return { error: null, message: 'Usuário removido do cliente.' }
  } catch (error) {
    console.error('[clients/remove-user] Erro:', error)
    return { error: 'Erro interno ao remover o usuário.', message: null }
  }
}

/**
 * Recalcula comandos e links do pacote ATIVO (sem rotacionar a chave) para o
 * endereco digitado em "Pacote & Servidor". Mesmo guard e mesma auditoria
 * (credentials.view) de GET /api/clients/[id]/credentials.
 */
export async function getClientPackageAction(formData: FormData): Promise<ProvisioningActionState> {
  const fail = (error: string): ProvisioningActionState => ({ error, message: null, package: null })
  try {
    const parsed = z
      .object({
        clientId: requiredString('Cliente não informado.').trim().min(1, 'Cliente não informado.'),
        serverUrl: requiredString('Informe o endereço do servidor.')
          .trim()
          .url('Informe um endereço de servidor válido, por exemplo https://inventario.suaempresa.com.'),
      })
      .safeParse({ clientId: formData.get('clientId'), serverUrl: formData.get('serverUrl') })
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Dados inválidos.')

    const user = getSessionPermissionUser(await auth())
    const rows = await prisma.$queryRaw<
      Array<{ id: string; name: string; slug: string; organizationId: string; activeProvisioningKeyEnc: string | null }>
    >`
      SELECT "id", "name", "slug", "organizationId", "activeProvisioningKeyEnc"
      FROM "clients" WHERE "id" = ${parsed.data.clientId} LIMIT 1
    `
    const client = rows[0]
    if (!client || !canManageTenant(user, client)) return fail('Cliente não encontrado.')
    if (!client.activeProvisioningKeyEnc) {
      return fail('Pacote ativo indisponível para este cliente legado. Emita um novo pacote.')
    }

    const { enrollmentKey } = decryptProvisioningSecret(client.activeProvisioningKeyEnc)
    await recordAuditLog({
      action: 'credentials.view',
      targetType: 'client',
      targetId: client.id,
      clientId: client.id,
      actor: getSessionAuditActor(user),
      metadata: { clientSlug: client.slug, status: 'available', via: 'server_url_update' },
    })

    return {
      error: null,
      message: 'Pacote recalculado para o endereço do servidor informado.',
      package: {
        clientId: client.id,
        clientName: client.name,
        clientSlug: client.slug,
        enrollmentKey,
        ...buildProvisioningArtifacts(parsed.data.serverUrl, client.slug, enrollmentKey),
        ...(await getPublishedAgentHashes()),
      },
    }
  } catch (error) {
    console.error('[clients/get-package] Erro:', error)
    return fail('Erro interno ao recalcular o pacote.')
  }
}
