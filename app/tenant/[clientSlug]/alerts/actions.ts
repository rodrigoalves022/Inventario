'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { ALERT_METRICS, ALERT_SEVERITIES } from '@/lib/alert-rules'

export type AlertRuleActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

async function authorize(tenantSlug: string) {
  const session = await auth()
  if (!session?.user) return null
  const tenant = await getTenantContext(tenantSlug)
  if (!tenant || !canManageTenantAlerts(getSessionPermissionUser(session), tenant)) return null
  return tenant
}

const createRuleSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Dê um nome para a regra.').max(100),
  metric: z.enum(ALERT_METRICS),
  severity: z.enum(ALERT_SEVERITIES),
})

export async function createAlertRuleAction(
  _previousState: AlertRuleActionState,
  formData: FormData
): Promise<AlertRuleActionState> {
  const parsed = createRuleSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    name: formData.get('name'),
    metric: formData.get('metric'),
    severity: formData.get('severity'),
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar alertas deste tenant.' }
  }

  await prisma.alertRule.create({
    data: {
      clientId: tenant.id,
      name: parsed.data.name,
      metric: parsed.data.metric,
      severity: parsed.data.severity,
    },
  })

  revalidatePath(`/tenant/${parsed.data.tenantSlug}/alerts`)
  return { status: 'success', message: 'Regra criada.' }
}

const toggleRuleSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  ruleId: z.string().trim().min(1),
  enabled: z.enum(['true', 'false']),
})

export async function toggleAlertRuleAction(
  _previousState: AlertRuleActionState,
  formData: FormData
): Promise<AlertRuleActionState> {
  const parsed = toggleRuleSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    ruleId: formData.get('ruleId'),
    enabled: formData.get('enabled'),
  })
  if (!parsed.success) {
    return { status: 'error', message: 'Requisição inválida.' }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar alertas deste tenant.' }
  }

  await prisma.alertRule.updateMany({
    where: { id: parsed.data.ruleId, clientId: tenant.id },
    data: { enabled: parsed.data.enabled === 'true' },
  })

  revalidatePath(`/tenant/${parsed.data.tenantSlug}/alerts`)
  return { status: 'success', message: null }
}

const deleteRuleSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  ruleId: z.string().trim().min(1),
})

export async function deleteAlertRuleAction(
  _previousState: AlertRuleActionState,
  formData: FormData
): Promise<AlertRuleActionState> {
  const parsed = deleteRuleSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    ruleId: formData.get('ruleId'),
  })
  if (!parsed.success) {
    return { status: 'error', message: 'Requisição inválida.' }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar alertas deste tenant.' }
  }

  // Nao apaga o historico: AlertEvent.ruleId vira null (onDelete: SetNull no
  // schema), o disparo passado continua visivel, so perde o vinculo com a
  // regra viva.
  await prisma.alertRule.deleteMany({ where: { id: parsed.data.ruleId, clientId: tenant.id } })

  revalidatePath(`/tenant/${parsed.data.tenantSlug}/alerts`)
  return { status: 'success', message: 'Regra excluída.' }
}
