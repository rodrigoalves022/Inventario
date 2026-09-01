'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantPath } from '@/lib/tenant-links'
import { ALERT_METRICS, ALERT_SEVERITIES } from '@/lib/alert-rules'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'

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

const createRuleSchema = z
  .object({
    tenantSlug: z.string().trim().min(1),
    name: z.string().trim().min(1, 'Dê um nome para a regra.').max(100),
    metric: z.enum(ALERT_METRICS),
    severity: z.enum(ALERT_SEVERITIES),
    // Sprint 12. So obrigatorio quando metric === 'software_blacklisted'
    // (checado no superRefine abaixo) — as demais 4 metricas nunca usam texto
    // livre, catalogo fechado.
    pattern: z.string().trim().max(200).optional(),
  })
  .superRefine((value, context) => {
    if (value.metric === 'software_blacklisted' && !value.pattern) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pattern'],
        message: 'Informe o nome do software a bloquear.',
      })
    }
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
    pattern: formData.get('pattern') || undefined,
  })
  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar alertas deste tenant.' }
  }

  const isSoftwareBlacklist = parsed.data.metric === 'software_blacklisted'

  const rule = await prisma.alertRule.create({
    data: {
      clientId: tenant.id,
      name: parsed.data.name,
      metric: parsed.data.metric,
      severity: parsed.data.severity,
      pattern: isSoftwareBlacklist ? (parsed.data.pattern ?? null) : null,
    },
  })

  // Auditoria restrita a 'software_blacklisted' (Sprint 12): as outras 4
  // metricas ja existiam sem AuditLog na criacao antes desta sprint, e mudar
  // esse comportamento pra elas nao fazia parte do escopo pedido.
  if (isSoftwareBlacklist) {
    const session = await auth()
    const actor = getSessionAuditActor(getSessionPermissionUser(session))
    await recordAuditLog({
      action: 'alert_rule.create',
      targetType: 'alert_rule',
      targetId: rule.id,
      clientId: tenant.id,
      actor,
      metadata: {
        name: rule.name,
        metric: rule.metric,
        pattern: rule.pattern,
        tenantSlug: parsed.data.tenantSlug,
      },
    })
  }

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'alerts'))
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

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'alerts'))
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

  const session = await auth()
  const actor = getSessionAuditActor(getSessionPermissionUser(session))

  const rule = await prisma.alertRule.findFirst({
    where: { id: parsed.data.ruleId, clientId: tenant.id },
    select: { id: true, name: true, metric: true },
  })
  if (!rule) {
    return { status: 'error', message: 'Regra não encontrada.' }
  }

  // Nao apaga o historico: AlertEvent.ruleId vira null (onDelete: SetNull no
  // schema), o disparo passado continua visivel, so perde o vinculo com a
  // regra viva.
  await prisma.$transaction(async (tx) => {
    await tx.alertRule.delete({ where: { id: rule.id } })
    await recordAuditLog(
      {
        action: 'alert_rule.delete',
        targetType: 'alert_rule',
        targetId: rule.id,
        clientId: tenant.id,
        actor,
        metadata: { name: rule.name, metric: rule.metric, tenantSlug: parsed.data.tenantSlug },
      },
      tx
    )
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'alerts'))
  return { status: 'success', message: 'Regra excluída.' }
}
