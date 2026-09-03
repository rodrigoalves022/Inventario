import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTenantAlertSettingsAction } from '@/app/app/[clientSlug]/computers/actions'

// Sprint 14 (RN017/RNF009). Cobertura do toggle `discoveryEnabled` em
// `saveTenantAlertSettingsAction`: persistencia, guard e AuditLog na
// TRANSICAO do flag.
//
// `canManageTenantAlerts` (lib/permissions.ts) e `getTenantContext`
// (lib/tenant-context.ts) NUNCA sao mockados — sao exatamente o que estes
// casos precisam provar. Mockado so o que e' infraestrutura: sessao, Prisma e
// revalidatePath.

type FakeTenant = { id: string; name: string; slug: string; isActive: boolean; organizationId: string }
type FakeClientSettings = {
  id: string
  alertsEnabled: boolean
  alertWebhookEnabled: boolean
  alertWebhookUrl: string | null
  alertDiskThresholdGb: number
  alertRamThresholdGb: number
  alertOfflineHours: number
  metricsRetentionDays: number
  discoveryEnabled: boolean
}

const { tenants, settingsById, auditLogs, updates, sessionRef, fakePrisma } = vi.hoisted(() => {
  const tenants = new Map<string, FakeTenant>()
  const settingsById = new Map<string, FakeClientSettings>()
  const auditLogs: Array<Record<string, unknown>> = []
  const updates: Array<unknown[]> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const tenant = [...tenants.values()].find((entry) => entry.slug === where.slug)
        if (!tenant) return null
        return { ...tenant, organization: { isActive: true } }
      }),
    },
    // getTenantAlertSettingsBySlug usa $queryRaw (tagged template): o slug e' o
    // unico valor interpolado.
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const slug = String(values[0])
      const tenant = [...tenants.values()].find((entry) => entry.slug === slug)
      if (!tenant) return []
      const settings = settingsById.get(tenant.id)
      return settings ? [settings] : []
    }),
    // updateTenantAlertSettings usa $executeRaw: guarda os valores
    // interpolados na ordem do UPDATE para o assert de persistencia.
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      updates.push(values)
      const clientId = String(values[values.length - 1])
      const settings = settingsById.get(clientId)
      if (settings) {
        settings.discoveryEnabled = Boolean(values[7])
      }
      return 1
    }),
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { tenants, settingsById, auditLogs, updates, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedTenant(slug: string, discoveryEnabled: boolean) {
  const id = `client-${slug}`
  tenants.set(id, { id, name: `Cliente ${slug}`, slug, isActive: true, organizationId: 'org-a' })
  settingsById.set(id, {
    id,
    alertsEnabled: true,
    alertWebhookEnabled: false,
    alertWebhookUrl: null,
    alertDiskThresholdGb: 10,
    alertRamThresholdGb: 4,
    alertOfflineHours: 24,
    metricsRetentionDays: 90,
    discoveryEnabled,
  })
  return id
}

function buildFormData(slug: string, discoveryEnabled: boolean) {
  const formData = new FormData()
  formData.set('tenantSlug', slug)
  formData.set('alertsEnabled', 'on')
  formData.set('alertDiskThresholdGb', '10')
  formData.set('alertRamThresholdGb', '4')
  formData.set('alertOfflineHours', '24')
  formData.set('metricsRetentionDays', '90')
  // Checkbox HTML: presente com valor 'on' quando marcado, AUSENTE quando nao.
  if (discoveryEnabled) formData.set('discoveryEnabled', 'on')
  return formData
}

beforeEach(() => {
  tenants.clear()
  settingsById.clear()
  auditLogs.length = 0
  updates.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('saveTenantAlertSettingsAction — toggle discoveryEnabled (RN017)', () => {
  it('ORG_ADMIN da mesma organizacao liga a varredura: persiste true e grava AuditLog tenant.discovery_enabled', async () => {
    const clientId = seedTenant('liga-varredura', false)
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveTenantAlertSettingsAction(
      { status: 'idle', message: null },
      buildFormData('liga-varredura', true)
    )

    expect(result.status).toBe('success')
    expect(updates).toHaveLength(1)
    expect(updates[0][7]).toBe(true)
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'tenant.discovery_enabled',
      targetType: 'client',
      targetId: clientId,
      clientId,
      actorEmail: 'admin@org-a.local',
    })
    expect(JSON.parse(String(auditLogs[0].metadataJson))).toMatchObject({ previous: false, current: true })
  })

  it('desligar a varredura grava AuditLog tenant.discovery_disabled', async () => {
    seedTenant('desliga-varredura', true)
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveTenantAlertSettingsAction(
      { status: 'idle', message: null },
      buildFormData('desliga-varredura', false)
    )

    expect(result.status).toBe('success')
    expect(updates[0][7]).toBe(false)
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'tenant.discovery_disabled' })
    expect(JSON.parse(String(auditLogs[0].metadataJson))).toMatchObject({ previous: true, current: false })
  })

  it('salvar sem mudar o flag NAO grava AuditLog (so a transicao e auditada, nao todo submit)', async () => {
    seedTenant('sem-transicao', false)
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await saveTenantAlertSettingsAction(
      { status: 'idle', message: null },
      buildFormData('sem-transicao', false)
    )

    expect(result.status).toBe('success')
    // O UPDATE roda de qualquer forma (os outros campos do formulario), mas
    // nenhuma linha de auditoria e' criada sem transicao do flag.
    expect(updates).toHaveLength(1)
    expect(auditLogs).toHaveLength(0)
  })

  it('ORG_OPERATOR nao passa por canManageTenantAlerts: nada e persistido nem auditado', async () => {
    seedTenant('operador-barrado', false)
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await saveTenantAlertSettingsAction(
      { status: 'idle', message: null },
      buildFormData('operador-barrado', true)
    )

    expect(result.status).toBe('error')
    expect(updates).toHaveLength(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('ORG_ADMIN de OUTRA organizacao nao liga a varredura de um tenant alheio (isolamento multi-tenant)', async () => {
    seedTenant('tenant-alheio', false)
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const result = await saveTenantAlertSettingsAction(
      { status: 'idle', message: null },
      buildFormData('tenant-alheio', true)
    )

    expect(result.status).toBe('error')
    expect(updates).toHaveLength(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('sessao ausente rejeita antes de qualquer leitura de tenant', async () => {
    seedTenant('sem-sessao', false)
    sessionRef.user = null

    const result = await saveTenantAlertSettingsAction(
      { status: 'idle', message: null },
      buildFormData('sem-sessao', true)
    )

    expect(result.status).toBe('error')
    expect(updates).toHaveLength(0)
    expect(auditLogs).toHaveLength(0)
  })
})
