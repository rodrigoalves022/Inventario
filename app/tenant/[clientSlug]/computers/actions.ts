'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { normalizeAlertSettings } from '@/lib/inventory-alerts'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantAlertSettingsBySlug, updateTenantAlertSettings } from '@/lib/tenant-alert-settings'

export type AlertSettingsActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const initialState: AlertSettingsActionState = {
  status: 'idle',
  message: null,
}

const alertSettingsSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  alertsEnabled: z.boolean().default(false),
  alertWebhookEnabled: z.boolean().default(false),
  alertWebhookUrl: z.string().trim().url().optional().or(z.literal('')),
  alertDiskThresholdGb: z.coerce.number().int().min(1).max(1024),
  alertRamThresholdGb: z.coerce.number().int().min(1).max(1024),
  alertOfflineHours: z.coerce.number().int().min(1).max(720),
}).superRefine((value, context) => {
  if (value.alertWebhookEnabled && !value.alertWebhookUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['alertWebhookUrl'],
      message: 'Informe uma URL quando o webhook estiver habilitado.',
    })
  }
})

export const initialAlertSettingsState = initialState

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
  })

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Configuração inválida.',
    }
  }

  if (!canManageTenantAlerts(getSessionPermissionUser(session), parsed.data.tenantSlug)) {
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
  })

  await updateTenantAlertSettings(record.clientId, normalized)
  revalidatePath(`/tenant/${parsed.data.tenantSlug}/computers`)
  revalidatePath(`/tenant/${parsed.data.tenantSlug}`)

  return { status: 'success', message: 'Configurações de alerta salvas.' }
}
