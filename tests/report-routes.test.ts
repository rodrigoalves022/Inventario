import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint 10, item 10 (RF020): as 4 rotas HTTP de relatorio (CSV/PDF x
// tenant/portal). Cobre o guard REAL (getTenantContext/canAccessTenant para
// tenant, getPortalContext para portal — nenhum dos dois mockado) e o
// content-type/status de resposta. Nao valida o PDF byte a byte (pdfkit) —
// so confirma content-type + status 200 no caso valido e 403/404 no negado.

type FakeClient = { id: string; name: string; slug: string; organizationId: string; isActive: boolean }
type FakeDevice = {
  id: string
  clientSlug: string
  hostname: string
  status: string
  updatedAt: Date
  hardware: { sistema: string | null; processador: string | null; ramTotalGb: number | null } | null
  disks: Array<{ capacidadeGb: number | null; espacoLivreGb: number | null }>
  networks: Array<{ ip: string | null; isPrimary: boolean }>
  security: { antivirusAtivo: boolean | null; firewallAtivo: boolean | null } | null
  assetRecord: { etiqueta: string | null; localizacao: string | null; responsavel: string | null } | null
  logs: Array<{ coletadoEm: Date }>
}

const { clients, devices, sessionRef, fakePrisma } = vi.hoisted(() => {
  const clients = new Map<string, FakeClient>()
  const devices = new Map<string, FakeDevice>()
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }

  const fakePrisma = {
    client: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        const client = [...clients.values()].find((candidate) => candidate.slug === where.slug)
        if (!client) return null
        return {
          id: client.id,
          name: client.name,
          slug: client.slug,
          isActive: client.isActive,
          organizationId: client.organizationId,
          organization: { isActive: true },
        }
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
        const client = clients.get(where.id)
        if (!client || !client.isActive) return null
        return { id: client.id, name: client.name, slug: client.slug }
      }),
    },
    device: {
      findMany: vi.fn(async ({ where }: { where: { agentAuth?: { is?: { client?: { is?: { slug?: string } } } }; clientId?: string } }) => {
        const requiredSlug = where.agentAuth?.is?.client?.is?.slug
        const requiredClientId = where.clientId
        return [...devices.values()].filter((device) => {
          if (requiredSlug) return device.clientSlug === requiredSlug
          if (requiredClientId) {
            const client = [...clients.values()].find((c) => c.slug === device.clientSlug)
            return client?.id === requiredClientId
          }
          return false
        })
      }),
    },
    // Sprint 13: as rotas PDF passaram a chamar getBlacklistedSoftwareHistory
    // (lib/reports/device-report.ts), que consulta prisma.alertEvent.findMany
    // — sem historico de software proibido nestes testes, so content-type/status.
    alertEvent: {
      findMany: vi.fn(async () => []),
    },
  }

  return { clients, devices, sessionRef, fakePrisma }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsBySlug: vi.fn(async () => null),
  getTenantAlertSettingsByClientId: vi.fn(async () => null),
  getDefaultAlertSettings: vi.fn(() => ({
    alertsEnabled: true,
    alertWebhookEnabled: false,
    alertWebhookUrl: null,
    alertDiskThresholdGb: 10,
    alertRamThresholdGb: 4,
    alertOfflineHours: 24,
    metricsRetentionDays: 90,
  })),
}))

function seedClient(overrides: Partial<FakeClient> & { id: string; slug: string }) {
  const client: FakeClient = { name: 'Cliente', organizationId: 'org-a', isActive: true, ...overrides }
  clients.set(client.id, client)
  return client
}

function seedDevice(overrides: Partial<FakeDevice> & { id: string; clientSlug: string }) {
  const device: FakeDevice = {
    hostname: 'HOST-1',
    status: 'online',
    updatedAt: new Date(),
    hardware: null,
    disks: [],
    networks: [],
    security: null,
    assetRecord: null,
    logs: [],
    ...overrides,
  }
  devices.set(device.id, device)
  return device
}

beforeEach(() => {
  clients.clear()
  devices.clear()
  sessionRef.user = null
  vi.clearAllMocks()
  vi.resetModules()
})

describe('GET /api/tenant/[clientSlug]/reports/csv', () => {
  it('sessao sem acesso ao tenant recebe 403, sem CSV', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/reports/csv/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/reports/csv'),
      { params: Promise.resolve({ clientSlug: 'cliente-a' }) }
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('content-type')).not.toContain('text/csv')
  })

  it('sem sessao recebe 403', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = null

    const { GET } = await import('@/app/api/tenant/[clientSlug]/reports/csv/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/reports/csv'),
      { params: Promise.resolve({ clientSlug: 'cliente-a' }) }
    )

    expect(response.status).toBe(403)
  })

  it('ORG_ADMIN da organizacao dona do tenant recebe 200 com CSV (content-type + content-disposition corretos, BOM presente)', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'PC-01' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/reports/csv/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/reports/csv'),
      { params: Promise.resolve({ clientSlug: 'cliente-a' }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    expect(response.headers.get('content-disposition')).toContain('.csv')
    // Response.text() decodifica UTF-8 e descarta o BOM automaticamente (WHATWG
    // fetch), entao a verificacao dos 3 bytes do BOM precisa ler o buffer bruto.
    const bytes = new Uint8Array(await response.clone().arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const body = await response.text()
    expect(body).toContain('PC-01')
  })
})

describe('GET /api/tenant/[clientSlug]/reports/pdf', () => {
  it('sessao sem acesso ao tenant recebe 403, sem PDF', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-b', email: 'admin@org-b.local', role: 'ORG_ADMIN', organizationId: 'org-b' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/reports/pdf/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/reports/pdf'),
      { params: Promise.resolve({ clientSlug: 'cliente-a' }) }
    )

    expect(response.status).toBe(403)
  })

  it('ORG_ADMIN da organizacao dona do tenant recebe 200 com application/pdf', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'PC-01' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/tenant/[clientSlug]/reports/pdf/route')
    const response = await GET(
      new NextRequest('https://inventario.example.com/api/tenant/cliente-a/reports/pdf'),
      { params: Promise.resolve({ clientSlug: 'cliente-a' }) }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('.pdf')
    const buffer = Buffer.from(await response.arrayBuffer())
    // Assinatura de arquivo PDF real, sem validar byte a byte o conteudo.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})

describe('GET /api/portal/reports/csv', () => {
  it('sem sessao (getPortalContext real, sem mock) recebe 403', async () => {
    sessionRef.user = null

    const { GET } = await import('@/app/api/portal/reports/csv/route')
    const response = await GET()

    expect(response.status).toBe(403)
  })

  it('sessao de ORG_ADMIN (nao CLIENT_VIEWER) recebe 403 — portal e exclusivo de CLIENT_VIEWER', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    sessionRef.user = { id: 'user-a', email: 'admin@org-a.local', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const { GET } = await import('@/app/api/portal/reports/csv/route')
    const response = await GET()

    expect(response.status).toBe(403)
  })

  it('CLIENT_VIEWER com clientId valido recebe 200 com CSV do proprio cliente', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'PORTAL-PC' })
    sessionRef.user = { id: 'viewer-1', email: 'portal@cliente-a.local', role: 'CLIENT_VIEWER', clientId: 'client-a' }

    const { GET } = await import('@/app/api/portal/reports/csv/route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    const body = await response.text()
    expect(body).toContain('PORTAL-PC')
  })
})

describe('GET /api/portal/reports/pdf', () => {
  it('sem sessao recebe 403', async () => {
    sessionRef.user = null

    const { GET } = await import('@/app/api/portal/reports/pdf/route')
    const response = await GET()

    expect(response.status).toBe(403)
  })

  it('CLIENT_VIEWER com clientId valido recebe 200 com application/pdf', async () => {
    seedClient({ id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' })
    seedDevice({ id: 'device-1', clientSlug: 'cliente-a', hostname: 'PORTAL-PC' })
    sessionRef.user = { id: 'viewer-1', email: 'portal@cliente-a.local', role: 'CLIENT_VIEWER', clientId: 'client-a' }

    const { GET } = await import('@/app/api/portal/reports/pdf/route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
  })
})
