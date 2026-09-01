'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { normalizeAlertSettings } from '@/lib/inventory-alerts'
import { canManageTenantAlerts, canOperateTenant, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantBasePath, getTenantPath } from '@/lib/tenant-links'
import { getTenantAlertSettingsBySlug, updateTenantAlertSettings } from '@/lib/tenant-alert-settings'
import { getTenantDeviceWhere } from '@/lib/tenant-scope'
import { agentCommandInputSchema, toParamsJson, AGENT_COMMAND_TTL_MS } from '@/lib/agent-commands'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'

export type AlertSettingsActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const alertSettingsSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  alertsEnabled: z.boolean().default(false),
  alertWebhookEnabled: z.boolean().default(false),
  alertWebhookUrl: z.string().trim().url().optional().or(z.literal('')),
  alertDiskThresholdGb: z.coerce.number().int().min(1).max(1024),
  alertRamThresholdGb: z.coerce.number().int().min(1).max(1024),
  alertOfflineHours: z.coerce.number().int().min(1).max(720),
  // Minimo de 7 dias: abaixo disso os graficos de tendencia perdem sentido.
  // Maximo de 730 (2 anos): a tabela mais cresce do sistema, nao ha motivo
  // para reter alem disso sem um caso de uso concreto.
  metricsRetentionDays: z.coerce.number().int().min(7).max(730),
}).superRefine((value, context) => {
  if (value.alertWebhookEnabled && !value.alertWebhookUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['alertWebhookUrl'],
      message: 'Informe uma URL quando o webhook estiver habilitado.',
    })
  }
})

export async function saveTenantAlertSettingsAction(
  _previousState: AlertSettingsActionState,
  formData: FormData
): Promise<AlertSettingsActionState> {
  const session = await auth()
  if (!session?.user) {
    return { status: 'error', message: 'Sessão inválida.' }
  }

  const parsed = alertSettingsSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    alertsEnabled: formData.get('alertsEnabled') === 'on',
    alertWebhookEnabled: formData.get('alertWebhookEnabled') === 'on',
    alertWebhookUrl: formData.get('alertWebhookUrl') ?? '',
    alertDiskThresholdGb: formData.get('alertDiskThresholdGb'),
    alertRamThresholdGb: formData.get('alertRamThresholdGb'),
    alertOfflineHours: formData.get('alertOfflineHours'),
    metricsRetentionDays: formData.get('metricsRetentionDays'),
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Configuração inválida.',
    }
  }

  const tenant = await getTenantContext(parsed.data.tenantSlug)
  if (!tenant || !canManageTenantAlerts(getSessionPermissionUser(session), tenant)) {
    return { status: 'error', message: 'Você não pode alterar alertas deste tenant.' }
  }

  const record = await getTenantAlertSettingsBySlug(parsed.data.tenantSlug)
  if (!record) {
    return { status: 'error', message: 'Tenant não encontrado.' }
  }

  const normalized = normalizeAlertSettings({
    alertsEnabled: parsed.data.alertsEnabled,
    alertWebhookEnabled: parsed.data.alertWebhookEnabled,
    alertWebhookUrl: parsed.data.alertWebhookUrl || null,
    alertDiskThresholdGb: parsed.data.alertDiskThresholdGb,
    alertRamThresholdGb: parsed.data.alertRamThresholdGb,
    alertOfflineHours: parsed.data.alertOfflineHours,
    metricsRetentionDays: parsed.data.metricsRetentionDays,
  })

  await updateTenantAlertSettings(record.clientId, normalized)
  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'computers'))
  revalidatePath(getTenantBasePath(parsed.data.tenantSlug))

  return { status: 'success', message: 'Configurações de alerta salvas.' }
}

export type BulkCommandActionState = {
  status: 'idle' | 'error' | 'success'
  message: string | null
}

/**
 * Sprint 12 — disparo de comando em lote (checkboxes em
 * components/tenant-computers-table.tsx e components/tenant-servers-table.tsx
 * + barra flutuante components/bulk-command-bar.tsx). Mesmo catalogo fechado
 * de app/app/[clientSlug]/assets/[id]/actions.ts (enqueueDeviceCommandAction,
 * um device por vez) — aqui so muda que `deviceIds` e' uma lista.
 */
const bulkCommandFormSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  deviceIds: z.array(z.string().trim().min(1)).min(1, 'Selecione ao menos um dispositivo.'),
  type: z.string(),
  serviceName: z.string().optional(),
  scriptId: z.string().optional(),
})

export async function bulkEnqueueDeviceCommandAction(
  _previousState: BulkCommandActionState,
  formData: FormData
): Promise<BulkCommandActionState> {
  const session = await auth()
  const parsed = bulkCommandFormSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    deviceIds: formData.getAll('deviceIds'),
    type: formData.get('type'),
    serviceName: formData.get('serviceName') || undefined,
    scriptId: formData.get('scriptId') || undefined,
  })

  if (!session?.user || !parsed.success) {
    return { status: 'error', message: parsed.success ? 'Requisição inválida.' : (parsed.error.issues[0]?.message ?? 'Requisição inválida.') }
  }

  const user = getSessionPermissionUser(session)
  const tenant = await getTenantContext(parsed.data.tenantSlug)
  // canOperateTenant (nao canManageTenant): mesmo guard do disparo de comando
  // individual — ORG_OPERATOR tambem pode operar em lote, so nao gerencia
  // credenciais/usuarios/alertas.
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

  // Nunca confia no array de deviceIds vindo do cliente: resolve so os que
  // realmente pertencem a este tenant (mesmo padrao de getTenantDeviceWhere
  // usado em toda consulta de Device escopada). Qualquer id que nao volte
  // aqui e' silenciosamente IGNORADO (decisao documentada na Sprint 12: nao
  // rejeita o lote inteiro por causa de um id invalido/de outro tenant no
  // meio de uma selecao legitima — so os ids fora do escopo ficam de fora).
  const devices = await prisma.device.findMany({
    where: { id: { in: parsed.data.deviceIds }, ...getTenantDeviceWhere(parsed.data.tenantSlug) },
    select: { id: true, hostname: true, agentAuthId: true, agentAuth: { select: { clientId: true } } },
  })
  const validDevices = devices.filter(
    (device): device is typeof device & { agentAuth: { clientId: string } } => device.agentAuth.clientId !== null
  )

  if (validDevices.length === 0) {
    return { status: 'error', message: 'Nenhum dispositivo válido selecionado neste tenant.' }
  }

  const actor = getSessionAuditActor(user)
  const expiresAt = new Date(Date.now() + AGENT_COMMAND_TTL_MS)

  // Atomico: todos os AgentCommand + o AuditLog agregado numa unica
  // transacao, ou nenhum (Definition of Done — "atomicamente").
  const commandIds = await prisma.$transaction(async (tx) => {
    const ids: string[] = []
    for (const device of validDevices) {
      const command = await tx.agentCommand.create({
        data: {
          agentAuthId: device.agentAuthId,
          clientId: device.agentAuth.clientId,
          type: commandInput.data.type,
          paramsJson: toParamsJson(commandInput.data),
          status: 'pending',
          requestedByUserId: actor.userId ?? null,
          expiresAt,
        },
      })
      ids.push(command.id)
    }

    // Log agregado (um AuditLog para o lote inteiro, nao um por dispositivo)
    // — decisao explicita da Sprint 12: a lista completa de deviceIds/
    // commandIds/hostnames fica em metadata, rastreavel sem inundar a tabela
    // de AuditLog com N linhas idênticas por disparo em lote.
    await recordAuditLog(
      {
        action: 'command.bulk_enqueue',
        targetType: 'device',
        targetId: null,
        clientId: tenant.id,
        actor,
        metadata: {
          type: commandInput.data.type,
          commandIds: ids,
          deviceIds: validDevices.map((device) => device.id),
          hostnames: validDevices.map((device) => device.hostname),
          requestedCount: parsed.data.deviceIds.length,
          appliedCount: validDevices.length,
          ignoredCount: parsed.data.deviceIds.length - validDevices.length,
          tenantSlug: parsed.data.tenantSlug,
        },
      },
      tx
    )

    return ids
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'computers'))
  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'servers'))
  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'assets'))

  const ignoredCount = parsed.data.deviceIds.length - validDevices.length
  const ignoredNote =
    ignoredCount > 0 ? ` (${ignoredCount} ignorado${ignoredCount !== 1 ? 's' : ''} por não pertencer a este tenant)` : ''

  return {
    status: 'success',
    message: `Comando enfileirado para ${validDevices.length} dispositivo${validDevices.length !== 1 ? 's' : ''}${ignoredNote} (${commandIds.length} comando${commandIds.length !== 1 ? 's' : ''} criado${commandIds.length !== 1 ? 's' : ''}). O agente executa no próximo ciclo (até ~90s).`,
  }
}
