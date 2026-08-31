import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteAlertRuleAction } from '@/app/app/[clientSlug]/alerts/actions'

type FakeTenant = { id: string; name: string; slug: string; isActive: boolean; organizationId: string }
type FakeRule = { id: string; clientId: string; name: string; metric: string; severity: string; enabled: boolean }

const { tenants, rules, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const tenants = new Map<string, FakeTenant>()
  const rules = new Map<string, FakeRule>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const tenant = Array.from(tenants.values()).find((entry) => entry.slug === where.slug)
        if (!tenant) return null
        return { ...tenant, organization: { isActive: true } }
      }),
    },
    alertRule: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; clientId: string } }) => {
        const rule = rules.get(where.id)
        if (!rule || rule.clientId !== where.clientId) return null
        return { id: rule.id, name: rule.name, metric: rule.metric }
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const rule = rules.get(where.id)
        rules.delete(where.id)
        return rule
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { tenants, rules, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function buildFormData(tenantSlug: string, ruleId: string) {
  const formData = new FormData()
  formData.set('tenantSlug', tenantSlug)
  formData.set('ruleId', ruleId)
  return formData
}

beforeEach(() => {
  tenants.clear()
  rules.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('deleteAlertRuleAction — cobertura de auditoria (RNF009)', () => {
  it('grava AuditLog com targetType/targetId da regra excluida e clientId do tenant', async () => {
    tenants.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', isActive: true, organizationId: 'org-a' })
    rules.set('rule-1', { id: 'rule-1', clientId: 'client-a', name: 'Antivirus desativado', metric: 'antivirus', severity: 'critical', enabled: true })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await deleteAlertRuleAction({ status: 'idle', message: null }, buildFormData('cliente-a', 'rule-1'))

    expect(result.status).toBe('success')
    expect(rules.has('rule-1')).toBe(false)

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'alert_rule.delete',
      targetType: 'alert_rule',
      targetId: 'rule-1',
      clientId: 'client-a',
    })
  })

  it('nao grava AuditLog nem exclui quando o ator nao tem acesso ao tenant', async () => {
    tenants.set('client-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', isActive: true, organizationId: 'org-a' })
    rules.set('rule-1', { id: 'rule-1', clientId: 'client-a', name: 'Antivirus desativado', metric: 'antivirus', severity: 'critical', enabled: true })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const result = await deleteAlertRuleAction({ status: 'idle', message: null }, buildFormData('cliente-a', 'rule-1'))

    expect(result.status).toBe('error')
    expect(rules.has('rule-1')).toBe(true)
    expect(auditLogs).toHaveLength(0)
  })
})
