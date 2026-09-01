import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'crypto'
import { createWebhookEndpointAction } from '@/app/app/[clientSlug]/settings/actions'
import { dispatchClientWebhookEndpoints } from '@/lib/webhook-endpoints'

// Sprint 11, item A. Tres criterios pedidos explicitamente:
// (a) criacao de WebhookEndpoint via Server Action, com o guard REAL
//     (canManageTenantAlerts nao e mockado — o mock de sessao/tenant e' o
//     unico jeito de o teste passar/falhar, mesmo padrao de
//     tests/rotate-enrollment-key.test.ts / tests/delete-alert-rule.test.ts);
// (b) disparo real via fetch mockado: o endpoint recebe o POST quando o
//     evento esta cadastrado e ativo, e NAO recebe quando o evento nao esta
//     em `events` ou quando isActive e' false;
// (c) validacao de assinatura: o header X-Webhook-Signature bate com o
//     HMAC-SHA256 calculado independentemente no teste usando o mesmo secret.

type FakeTenant = { id: string; name: string; slug: string; isActive: boolean; organizationId: string }
type FakeWebhookEndpoint = {
  id: string
  clientId: string
  url: string
  events: string[]
  isActive: boolean
  secret: string
}

const { tenants, endpoints, auditLogs, sessionRef, fakePrisma } = vi.hoisted(() => {
  const tenants = new Map<string, FakeTenant>()
  const endpoints = new Map<string, FakeWebhookEndpoint>()
  const auditLogs: Array<Record<string, unknown>> = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  let counter = 0

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const tenant = Array.from(tenants.values()).find((entry) => entry.slug === where.slug)
        if (!tenant) return null
        return { ...tenant, organization: { isActive: true } }
      }),
    },
    webhookEndpoint: {
      create: vi.fn(async ({ data }: { data: Omit<FakeWebhookEndpoint, 'id'> }) => {
        const endpoint: FakeWebhookEndpoint = { id: `wh-${++counter}`, ...data }
        endpoints.set(endpoint.id, endpoint)
        return endpoint
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { clientId: string; isActive: boolean; events: { has: string } }
        }) =>
          Array.from(endpoints.values()).filter(
            (endpoint) =>
              endpoint.clientId === where.clientId &&
              endpoint.isActive === where.isActive &&
              endpoint.events.includes(where.events.has)
          )
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        auditLogs.push(data)
        return data
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakePrisma)),
  }

  return { tenants, endpoints, auditLogs, sessionRef, fakePrisma }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))

function seedTenant(overrides: Partial<FakeTenant> & { id: string; slug: string }) {
  const tenant: FakeTenant = { name: 'Cliente A', isActive: true, organizationId: 'org-a', ...overrides }
  tenants.set(tenant.id, tenant)
  return tenant
}

function buildCreateFormData(tenantSlug: string, url: string, events: string[]) {
  const formData = new FormData()
  formData.set('tenantSlug', tenantSlug)
  formData.set('url', url)
  for (const event of events) formData.append('events', event)
  return formData
}

const idleState = { status: 'idle' as const, message: null, secret: null }

beforeEach(() => {
  tenants.clear()
  endpoints.clear()
  auditLogs.length = 0
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('createWebhookEndpointAction — guard real (canManageTenantAlerts)', () => {
  it('ORG_ADMIN da propria organizacao cadastra o webhook, segredo gerado no servidor, devolvido so nesta resposta', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://hooks.example.com/inventario', ['device.offline', 'device.online'])
    )

    expect(result.status).toBe('success')
    expect(result.secret).toBeTruthy()
    expect(result.secret).toMatch(/^[0-9a-f]{64}$/) // crypto.randomBytes(32).toString('hex')

    expect(endpoints.size).toBe(1)
    const created = Array.from(endpoints.values())[0]
    expect(created.clientId).toBe('client-a')
    expect(created.secret).toBe(result.secret) // persistido em texto plano (nao hash) — HMAC precisa do valor de volta
    expect(created.events).toEqual(['device.offline', 'device.online'])

    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({ action: 'webhook.create', targetType: 'webhook_endpoint', clientId: 'client-a' })
  })

  it('ORG_OPERATOR (fora do escopo de canManageTenantAlerts, que delega a canManageTenant) NAO consegue cadastrar', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-op', email: 'operador@org-a.local', role: 'ORG_OPERATOR', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-a', 'https://hooks.example.com/inventario', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(result.secret).toBeFalsy()
    expect(endpoints.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('ORG_ADMIN de OUTRA organizacao NAO consegue cadastrar webhook no tenant de outra org', async () => {
    seedTenant({ id: 'client-b', slug: 'cliente-b', organizationId: 'org-b' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(
      idleState,
      buildCreateFormData('cliente-b', 'https://hooks.example.com/inventario', ['device.offline'])
    )

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(0)
    expect(auditLogs).toHaveLength(0)
  })

  it('rejeita payload sem nenhum evento selecionado, sem tocar o banco', async () => {
    seedTenant({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const result = await createWebhookEndpointAction(idleState, buildCreateFormData('cliente-a', 'https://hooks.example.com/x', []))

    expect(result.status).toBe('error')
    expect(endpoints.size).toBe(0)
  })
})

describe('dispatchClientWebhookEndpoints — disparo real via fetch mockado', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  it('envia POST para um endpoint ATIVO cujo events inclui o evento disparado', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/on',
      events: ['device.offline', 'device.low_disk'],
      isActive: true,
      secret: 'segredo-teste',
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline', hostname: 'PC-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/on')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toMatchObject({ event: 'device.offline', hostname: 'PC-1' })
  })

  it('NAO envia quando o evento disparado nao esta na lista `events` do endpoint', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/on',
      events: ['device.low_disk'], // nao inclui device.offline
      isActive: true,
      secret: 'segredo-teste',
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('NAO envia quando o endpoint esta isActive: false, mesmo com o evento cadastrado', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/on',
      events: ['device.offline'],
      isActive: false,
      secret: 'segredo-teste',
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('isolamento multi-tenant: nao envia para endpoint de outro clientId', async () => {
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-b',
      url: 'https://hooks.example.com/outro-cliente',
      events: ['device.offline'],
      isActive: true,
      secret: 'segredo-teste',
    })

    await dispatchClientWebhookEndpoints('client-a', 'device.offline', { event: 'device.offline' })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('dispatchClientWebhookEndpoints — validacao de assinatura (X-Webhook-Signature)', () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  it('o header X-Webhook-Signature bate com o HMAC-SHA256 calculado independentemente com o mesmo secret', async () => {
    const secret = 'segredo-de-teste-para-hmac'
    endpoints.set('wh-1', {
      id: 'wh-1',
      clientId: 'client-a',
      url: 'https://hooks.example.com/assinado',
      events: ['device.warning'],
      isActive: true,
      secret,
    })

    const payload = { event: 'device.warning', device: { id: 'device-1', hostname: 'PC-1' } }
    await dispatchClientWebhookEndpoints('client-a', 'device.warning', payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }]
    const sentSignature = init.headers['X-Webhook-Signature']
    const sentBody = init.body as string

    const expectedSignature = crypto.createHmac('sha256', secret).update(sentBody).digest('hex')
    expect(sentSignature).toBe(expectedSignature)

    // Um segredo ERRADO nao pode produzir a mesma assinatura — prova que a
    // assinatura de fato depende do secret do endpoint, nao e' um valor fixo.
    const wrongSignature = crypto.createHmac('sha256', 'segredo-errado').update(sentBody).digest('hex')
    expect(sentSignature).not.toBe(wrongSignature)
  })
})
