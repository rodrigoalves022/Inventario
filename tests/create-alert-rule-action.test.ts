import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAlertRuleAction } from '@/app/app/[clientSlug]/alerts/actions'

// Sprint 12, item 1 — Deteccao de Softwares Proibidos. Cobertura da
// criacao de AlertRule metric='software_blacklisted' (campo pattern
// obrigatorio, persistido, e AuditLog 'alert_rule.create' — que so passou a
// existir nesta sprint, restrito a esta metrica; as outras 4 continuam sem
// auditoria na criacao, mesmo padrao anterior a Sprint 12).

type FakeTenant = { id: string; name: string; slug: string; isActive: boolean; organizationId: string }
type FakeRule = { id: string; clientId: string; name: string; metric: string; severity: string; pattern: string | null }

const { tenants, rules, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const tenants = new Map<string, FakeTenant>()
  const rules: FakeRule[] = []
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  let counter = 0

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const tenant = [...tenants.values()].find((entry) => entry.slug === where.slug)
        if (!tenant) return null
        return { ...tenant, organization: { isActive: true } }
      }),
    },
    alertRule: {
      create: vi.fn(async ({ data }: { data: Omit<FakeRule, 'id'> }) => {
        const rule: FakeRule = { id: `rule-${++counter}`, ...data }
        rules.push(rule)
        return rule
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
  }

  return { tenants, rules, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function buildFormData(overrides: {
  tenantSlug?: string
  name?: string
  metric?: string
  severity?: string
  pattern?: string
}) {
  const formData = new FormData()
  formData.set('tenantSlug', overrides.tenantSlug ?? 'cliente-a')
  formData.set('name', overrides.name ?? 'Regra de teste')
  formData.set('metric', overrides.metric ?? 'antivirus_inactive')
  formData.set('severity', overrides.severity ?? 'warning')
  if (overrides.pattern !== undefined) formData.set('pattern', overrides.pattern)
  return formData
}

beforeEach(() => {
  tenants.clear()
  rules.length = 0
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('createAlertRuleAction — software_blacklisted (Sprint 12)', () => {
  it('cria regra software_blacklisted com pattern e grava AuditLog alert_rule.create', async () => {
    tenants.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', isActive: true, organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createAlertRuleAction(
      { status: 'idle', message: null },
      buildFormData({ metric: 'software_blacklisted', pattern: 'uTorrent', name: 'Bloquear uTorrent' })
    )

    expect(result.status).toBe('success')
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ metric: 'software_blacklisted', pattern: 'uTorrent' })

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'alert_rule.create',
      targetType: 'alert_rule',
      targetId: rules[0].id,
      clientId: 'client-a',
    })
    const metadata = JSON.parse(auditLogs[0].metadataJson as string) as Record<string, unknown>
    expect(metadata.pattern).toBe('uTorrent')
  })

  it('software_blacklisted SEM pattern e rejeitado pela validacao Zod, nenhuma regra criada', async () => {
    tenants.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', isActive: true, organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createAlertRuleAction(
      { status: 'idle', message: null },
      buildFormData({ metric: 'software_blacklisted' })
    )

    expect(result.status).toBe('error')
    expect(rules).toHaveLength(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('metricas pre-existentes (ex: antivirus_inactive) continuam SEM AuditLog na criacao (comportamento anterior preservado)', async () => {
    tenants.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', isActive: true, organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createAlertRuleAction(
      { status: 'idle', message: null },
      buildFormData({ metric: 'antivirus_inactive' })
    )

    expect(result.status).toBe('success')
    expect(rules).toHaveLength(1)
    expect(rules[0].pattern).toBeNull()
    expect(auditLogs).toHaveLength(0)
  })

  it('usuario sem canManageTenantAlerts e bloqueado, nenhuma regra criada', async () => {
    tenants.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', isActive: true, organizationId: 'org-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await createAlertRuleAction(
      { status: 'idle', message: null },
      buildFormData({ metric: 'software_blacklisted', pattern: 'uTorrent' })
    )

    expect(result.status).toBe('error')
    expect(rules).toHaveLength(0)
    expect(auditLogs).toHaveLength(0)
  })
})
