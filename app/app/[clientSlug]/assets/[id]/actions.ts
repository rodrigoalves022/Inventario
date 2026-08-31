'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { recordAuditLog, getSessionAuditActor } from '@/lib/audit-log'
import { canOperateTenant, canDeleteTenantAsset, canManageAssetRecord, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantPath } from '@/lib/tenant-links'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { agentCommandInputSchema, toParamsJson, AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'
import { assetRecordSchema } from '@/lib/schemas/asset-record'

export type DeleteAssetActionState = {
  status: 'idle' | 'error'
  message: string | null
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

const enqueueCommandFormSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  assetId: z.string().trim().min(1),
  type: z.string(),
  serviceName: z.string().optional(),
  scriptId: z.string().optional(),
})

/** Generico: cobre todo o catalogo (lib/agent-commands.ts), nao so collect_now.
 * `serviceName`/`scriptId` so importam quando o `type` os exige — a validacao
 * real de qual combinacao e' permitida acontece em agentCommandInputSchema. */
export async function enqueueDeviceCommandAction(
  _previousState: EnqueueCommandActionState,
  formData: FormData
): Promise<EnqueueCommandActionState> {
  const session = await auth()
  const parsed = enqueueCommandFormSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    assetId: formData.get('assetId'),
    type: formData.get('type'),
    serviceName: formData.get('serviceName') || undefined,
    scriptId: formData.get('scriptId') || undefined,
  })

  if (!session?.user || !parsed.success) {
    return { status: 'error', message: 'Requisição inválida.' }
  }

  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(parsed.data.tenantSlug)
  if (!tenant || !canOperateTenant(user, tenant)) {
    return { status: 'error', message: 'Você não pode enfileirar comandos neste tenant.' }
  }

  const commandInput = agentCommandInputSchema.safeParse({
    type: parsed.data.type,
    serviceName: parsed.data.serviceName,
    scriptId: parsed.data.scriptId,
  })
  if (!commandInput.success) {
    return { status: 'error', message: 'Comando inválido.' }
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

export type AssetRecordActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export async function saveAssetRecordAction(
  _previousState: AssetRecordActionState,
  formData: FormData
): Promise<AssetRecordActionState> {
  const session = await auth()
  if (!session?.user) {
    return { status: 'error', message: 'Sessão inválida.' }
  }

  const tenantSlug = String(formData.get('tenantSlug') ?? '')
  const deviceId = String(formData.get('deviceId') ?? '')

  const tenant = await getTenantContext(tenantSlug)
  if (!tenant || !canManageAssetRecord(getSessionPermissionUser(session), tenant)) {
    return { status: 'error', message: 'Você não pode editar o patrimônio desta máquina.' }
  }

  // Reconfirma que o dispositivo pertence a este tenant antes de gravar —
  // nunca confia so no deviceId vindo do formulario.
  const device = await prisma.device.findFirst({
    where: { id: deviceId, ...getTenantDeviceWhere(tenantSlug) },
    select: { id: true },
  })
  if (!device) {
    return { status: 'error', message: 'Máquina não encontrada neste tenant.' }
  }

  const parsed = assetRecordSchema.safeParse({
    etiqueta: formData.get('etiqueta'),
    dataCompra: formData.get('dataCompra'),
    notaFiscal: formData.get('notaFiscal'),
    fornecedor: formData.get('fornecedor'),
    valor: formData.get('valor'),
    garantiaAte: formData.get('garantiaAte'),
    centroCusto: formData.get('centroCusto'),
    localizacao: formData.get('localizacao'),
    responsavel: formData.get('responsavel'),
    observacoes: formData.get('observacoes'),
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const data = {
    ...parsed.data,
    updatedByUserId: session.user.id ?? null,
  }

  await prisma.assetRecord.upsert({
    where: { deviceId: device.id },
    create: { deviceId: device.id, ...data },
    update: data,
  })

  revalidatePath(getTenantPath(tenantSlug, `assets/${deviceId}`))

  return { status: 'success', message: 'Patrimônio salvo.' }
}
