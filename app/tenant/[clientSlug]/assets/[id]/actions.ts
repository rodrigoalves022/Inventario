'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { recordAuditLog, getSessionAuditActor } from '@/lib/audit-log'
import { canOperateTenant, canDeleteTenantAsset, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantPath } from '@/lib/tenant-links'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { agentCommandInputSchema, toParamsJson, AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'

export type DeleteAssetActionState = {
  status: 'idle' | 'error'
  message: string | null
}

export const initialDeleteAssetState: DeleteAssetActionState = {
  status: 'idle',
  message: null,
}

const deleteAssetSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
})

export async function deleteTenantAssetAction(
  _previousState: DeleteAssetActionState,
  formData: FormData
): Promise<DeleteAssetActionState> {
  const session = await auth()
  const parsed = deleteAssetSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    assetId: formData.get('assetId'),
  })

  if (!session?.user || !parsed.success) {
    return { status: 'error', message: 'Requisição inválida.' }
  }

  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(parsed.data.tenantSlug)

  if (!tenant || !canDeleteTenantAsset(user, tenant)) {
    return { status: 'error', message: 'Você não pode excluir máquinas deste tenant.' }
  }

  const device = await prisma.device.findFirst({
    where: {
      id: parsed.data.assetId,
      ...getTenantDeviceWhere(parsed.data.tenantSlug),
    },
    select: {
      id: true,
      hostname: true,
      agentAuth: { select: { clientId: true } },
    },
  })

  if (!device) {
    return { status: 'error', message: 'Máquina não encontrada.' }
  }

  const actor = getSessionAuditActor(user)

  await prisma.$transaction(async (tx) => {
    await tx.device.delete({ where: { id: device.id } })
    await recordAuditLog(
      {
        action: 'device.delete',
        targetType: 'device',
        targetId: device.id,
        clientId: device.agentAuth.clientId ?? actor.clientId ?? null,
        actor,
        metadata: {
          hostname: device.hostname,
          tenantSlug: parsed.data.tenantSlug,
        },
      },
      tx
    )
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'computers'))
  revalidatePath(getTenantPath(parsed.data.tenantSlug))
  redirect(getTenantPath(parsed.data.tenantSlug, 'computers'))
}

export type EnqueueCommandActionState = {
  status: 'idle' | 'error' | 'success'
  message: string | null
}

export const initialEnqueueCommandState: EnqueueCommandActionState = {
  status: 'idle',
  message: null,
}

const enqueueCommandFormSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
  type: z.string(),
})

export async function enqueueCollectNowAction(
  _previousState: EnqueueCommandActionState,
  formData: FormData
): Promise<EnqueueCommandActionState> {
  const session = await auth()
  const parsed = enqueueCommandFormSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    assetId: formData.get('assetId'),
    type: formData.get('type'),
  })

  if (!session?.user || !parsed.success) {
    return { status: 'error', message: 'Requisição inválida.' }
  }

  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(parsed.data.tenantSlug)
  if (!tenant || !canOperateTenant(user, tenant)) {
    return { status: 'error', message: 'Você não pode enfileirar comandos neste tenant.' }
  }

  const commandInput = agentCommandInputSchema.safeParse({ type: parsed.data.type })
  if (!commandInput.success) {
    return { status: 'error', message: 'Tipo de comando inválido.' }
  }

  const device = await prisma.device.findFirst({
    where: {
      id: parsed.data.assetId,
      ...getTenantDeviceWhere(parsed.data.tenantSlug),
    },
    select: { id: true, hostname: true, agentAuthId: true, agentAuth: { select: { clientId: true } } },
  })

  if (!device || !device.agentAuth.clientId) {
    return { status: 'error', message: 'Máquina não encontrada.' }
  }

  const actor = getSessionAuditActor(user)

  const command = await prisma.agentCommand.create({
    data: {
      agentAuthId: device.agentAuthId,
      clientId: device.agentAuth.clientId,
      type: commandInput.data.type,
      paramsJson: toParamsJson(commandInput.data),
      status: 'pending',
      requestedByUserId: actor.userId ?? null,
      expiresAt: new Date(Date.now() + AGENT_COMMAND_TTL_MS),
    },
  })

  await recordAuditLog({
    action: 'command.enqueue',
    targetType: 'device',
    targetId: device.id,
    clientId: device.agentAuth.clientId,
    actor,
    metadata: {
      commandId: command.id,
      type: commandInput.data.type,
      hostname: device.hostname,
      tenantSlug: parsed.data.tenantSlug,
    },
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, `assets/${device.id}`))

  return { status: 'success', message: 'Comando enfileirado. O agente executa no próximo ciclo (até ~90s).' }
}
