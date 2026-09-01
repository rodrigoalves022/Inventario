'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canManageTenantAlerts, getSessionPermissionUser } from '@/lib/permissions'
import { getTenantContext } from '@/lib/tenant-context'
import { getTenantPath } from '@/lib/tenant-links'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'
import { generateWebhookSecret, WEBHOOK_EVENTS } from '@/lib/webhook-endpoints'

// Mesmo guard ja usado por saveTenantAlertSettingsAction/
// tenant-alert-settings-form.tsx (app/app/[clientSlug]/computers/actions.ts)
// — reaproveitado, nao reinventado: so quem ja pode configurar alertas do
// tenant pode configurar webhooks.
async function authorize(tenantSlug: string) {
  const session = await auth()
  if (!session?.user) return null
  const tenant = await getTenantContext(tenantSlug)
  if (!tenant || !canManageTenantAlerts(getSessionPermissionUser(session), tenant)) return null
  return tenant
}

export type WebhookEndpointActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  /**
   * Preenchido APENAS na resposta imediata de uma criacao bem-sucedida —
   * nunca persistido neste shape entre requisicoes, nunca devolvido de novo
   * em nenhuma listagem/consulta subsequente (a pagina so le o valor
   * mascarado via lib/webhook-endpoints.ts#maskWebhookSecret). Mesmo padrao
   * de UX ja usado para enrollmentKey em createClientAction
   * (app/admin/clients/actions.ts): mostrado uma unica vez, o cliente deve
   * copiar na hora.
   */
  secret?: string | null
}

const createSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  url: z.string().trim().url('Informe uma URL valida (https://...).'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Selecione ao menos um evento.'),
})

export async function createWebhookEndpointAction(
  _previousState: WebhookEndpointActionState,
  formData: FormData
): Promise<WebhookEndpointActionState> {
  const parsed = createSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    url: formData.get('url'),
    events: formData.getAll('events').map(String),
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.', secret: null }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar webhooks deste tenant.', secret: null }
  }

  // Segredo SEMPRE gerado no servidor (crypto.randomBytes) — nunca aceito de
  // formulario, para nao permitir segredo fraco/reusado escolhido pelo
  // usuario. Ver nota em lib/webhook-endpoints.ts e no schema.prisma sobre
  // `secret` ser texto plano (nao hash): HMAC precisa do valor de volta a
  // cada disparo.
  const secret = generateWebhookSecret()
  const session = await auth()
  const actor = getSessionAuditActor(getSessionPermissionUser(session))

  const endpoint = await prisma.$transaction(async (tx) => {
    const created = await tx.webhookEndpoint.create({
      data: {
        clientId: tenant.id,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
      },
    })

    await recordAuditLog(
      {
        action: 'webhook.create',
        targetType: 'webhook_endpoint',
        targetId: created.id,
        clientId: tenant.id,
        actor,
        metadata: { url: parsed.data.url, events: parsed.data.events, tenantSlug: parsed.data.tenantSlug },
      },
      tx
    )

    return created
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'settings'))

  return {
    status: 'success',
    message: 'Webhook cadastrado. Copie o segredo agora — ele não será exibido novamente.',
    secret,
  }
}

const updateSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  endpointId: z.string().trim().min(1),
  url: z.string().trim().url('Informe uma URL valida (https://...).'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Selecione ao menos um evento.'),
})

export async function updateWebhookEndpointAction(
  _previousState: WebhookEndpointActionState,
  formData: FormData
): Promise<WebhookEndpointActionState> {
  const parsed = updateSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    endpointId: formData.get('endpointId'),
    url: formData.get('url'),
    events: formData.getAll('events').map(String),
  })

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Dados inválidos.', secret: null }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar webhooks deste tenant.', secret: null }
  }

  const session = await auth()
  const actor = getSessionAuditActor(getSessionPermissionUser(session))

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id: parsed.data.endpointId, clientId: tenant.id },
    select: { id: true },
  })
  if (!existing) {
    return { status: 'error', message: 'Webhook não encontrado.', secret: null }
  }

  await prisma.$transaction(async (tx) => {
    await tx.webhookEndpoint.update({
      where: { id: existing.id },
      data: { url: parsed.data.url, events: parsed.data.events },
    })

    await recordAuditLog(
      {
        action: 'webhook.update',
        targetType: 'webhook_endpoint',
        targetId: existing.id,
        clientId: tenant.id,
        actor,
        metadata: { url: parsed.data.url, events: parsed.data.events, tenantSlug: parsed.data.tenantSlug },
      },
      tx
    )
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'settings'))
  return { status: 'success', message: 'Webhook atualizado.', secret: null }
}

const toggleSchema = z.object({
  tenantSlug: z.string().trim().min(1),
  endpointId: z.string().trim().min(1),
  isActive: z.enum(['true', 'false']),
})

export async function toggleWebhookEndpointAction(
  _previousState: WebhookEndpointActionState,
  formData: FormData
): Promise<WebhookEndpointActionState> {
  const parsed = toggleSchema.safeParse({
    tenantSlug: formData.get('tenantSlug'),
    endpointId: formData.get('endpointId'),
    isActive: formData.get('isActive'),
  })

  if (!parsed.success) {
    return { status: 'error', message: 'Requisição inválida.', secret: null }
  }

  const tenant = await authorize(parsed.data.tenantSlug)
  if (!tenant) {
    return { status: 'error', message: 'Você não pode gerenciar webhooks deste tenant.', secret: null }
  }

  const session = await auth()
  const actor = getSessionAuditActor(getSessionPermissionUser(session))
  const nextIsActive = parsed.data.isActive === 'true'

  const result = await prisma.webhookEndpoint.updateMany({
    where: { id: parsed.data.endpointId, clientId: tenant.id },
    data: { isActive: nextIsActive },
  })

  if (result.count === 0) {
    return { status: 'error', message: 'Webhook não encontrado.', secret: null }
  }

  await recordAuditLog({
    action: 'webhook.toggle',
    targetType: 'webhook_endpoint',
    targetId: parsed.data.endpointId,
    clientId: tenant.id,
    actor,
    metadata: { isActive: nextIsActive, tenantSlug: parsed.data.tenantSlug },
  })

  revalidatePath(getTenantPath(parsed.data.tenantSlug, 'settings'))
  return { status: 'success', message: null, secret: null }
}
