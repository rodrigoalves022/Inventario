import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getTenantContext: vi.fn(),
  listAuditLogs: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/audit-log', () => ({ listAuditLogs: mocks.listAuditLogs }))

import { GET as tenantGET } from '@/app/api/tenant/[clientSlug]/audit/csv/route'
import { GET as adminGET } from '@/app/api/admin/audit/csv/route'
import { formatAuditActionLabel } from '@/lib/audit-action-labels'

const tenant = { id: 'client-1', slug: 'acme', organizationId: 'org-1' }
const params = { params: Promise.resolve({ clientSlug: 'acme' }) }

function req(qs = '') {
  return { nextUrl: new URL(`http://localhost/api/audit/csv${qs}`) } as never
}

function session(role: string) {
  return { user: { id: 'u1', email: 'u@x.com', role, organizationId: 'org-1' } }
}

function log(overrides: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    actorEmail: 'admin@acme.com',
    actorRole: 'ORG_ADMIN',
    clientId: 'client-1',
    action: 'device.delete',
    targetType: 'Device',
    targetId: 'd1',
    metadata: { name: 'PC-01' },
    createdAt: '2026-01-02T03:04:05.000Z',
    ...overrides,
  }
}

describe('GET /api/tenant/[clientSlug]/audit/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue(session('ORG_ADMIN'))
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.listAuditLogs.mockResolvedValue([])
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await tenantGET(req(), params)
    expect(res.status).toBe(401)
    expect(mocks.listAuditLogs).not.toHaveBeenCalled()
  })

  it('returns 403 for ORG_OPERATOR', async () => {
    mocks.auth.mockResolvedValue(session('ORG_OPERATOR'))
    const res = await tenantGET(req(), params)
    expect(res.status).toBe(403)
    expect(mocks.listAuditLogs).not.toHaveBeenCalled()
  })

  it('returns 403 when tenant is not found', async () => {
    mocks.getTenantContext.mockResolvedValue(null)
    const res = await tenantGET(req(), params)
    expect(res.status).toBe(403)
  })

  it('exports CSV with BOM, translated labels and forwarded filters', async () => {
    mocks.listAuditLogs.mockResolvedValue([log()])
    const res = await tenantGET(req('?action=device.delete&actorEmail=admin&from=2026-01-01&to=2026-01-31'), params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="auditoria-acme-\d{4}-\d{2}-\d{2}\.csv"$/)

    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const body = await res.text()
    const [header, row] = body.split('\r\n')
    expect(header).toBe('Data/Hora;Acao;Codigo da Acao;Operador;Papel;Alvo Tipo;Alvo ID;Metadados')
    expect(row).toContain(formatAuditActionLabel('device.delete'))
    expect(row).toContain(';device.delete;')

    const args = mocks.listAuditLogs.mock.calls[0][0]
    expect(args).toMatchObject({ clientId: 'client-1', action: 'device.delete', actorEmail: 'admin', limit: 1000 })
    expect(args.from).toBeInstanceOf(Date)
    expect(args.to).toBeInstanceOf(Date)
  })

  it('ignores action=all', async () => {
    await tenantGET(req('?action=all'), params)
    expect(mocks.listAuditLogs.mock.calls[0][0].action).toBeNull()
  })

  it('protects against CSV formula injection', async () => {
    mocks.listAuditLogs.mockResolvedValue([log({ actorEmail: '=HYPERLINK("x")', targetId: '  +cmd', actorRole: '@x' })])
    const body = await (await tenantGET(req(), params)).text()
    expect(body).toContain(`"'=HYPERLINK(""x"")"`)
    expect(body).toContain(`'  +cmd`)
    expect(body).toContain(`'@x`)
  })
})

describe('GET /api/admin/audit/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue(session('PLATFORM_ADMIN'))
    mocks.listAuditLogs.mockResolvedValue([])
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await adminGET(req())
    expect(res.status).toBe(401)
    expect(mocks.listAuditLogs).not.toHaveBeenCalled()
  })

  it('returns 403 for ORG_ADMIN', async () => {
    mocks.auth.mockResolvedValue(session('ORG_ADMIN'))
    const res = await adminGET(req())
    expect(res.status).toBe(403)
    expect(mocks.listAuditLogs).not.toHaveBeenCalled()
  })

  it('exports CSV with BOM, tenant column, labels and forwarded filters', async () => {
    mocks.listAuditLogs.mockResolvedValue([log({ action: 'login' })])
    const res = await adminGET(req('?action=login&clientId=client-1&actorEmail=a&from=2026-01-01&to=2026-01-31'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="auditoria-global-\d{4}-\d{2}-\d{2}\.csv"$/)

    const bytes = new Uint8Array(await res.clone().arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const body = await res.text()
    const [header, row] = body.split('\r\n')
    expect(header).toBe('Data/Hora;Tenant ID;Acao;Codigo da Acao;Operador;Papel;Alvo Tipo;Alvo ID;Metadados')
    expect(row).toContain(`;client-1;${formatAuditActionLabel('login')};login;`)

    expect(mocks.listAuditLogs.mock.calls[0][0]).toMatchObject({
      clientId: 'client-1',
      action: 'login',
      actorEmail: 'a',
      limit: 1000,
    })
  })

  it('ignores action=all and clientId=all', async () => {
    await adminGET(req('?action=all&clientId=all'))
    expect(mocks.listAuditLogs.mock.calls[0][0]).toMatchObject({ clientId: null, action: null })
  })

  it('protects against CSV formula injection', async () => {
    mocks.listAuditLogs.mockResolvedValue([log({ actorEmail: '-1+1', targetId: '\tx' })])
    const body = await (await adminGET(req())).text()
    expect(body).toContain(`'-1+1`)
    expect(body).toContain(`'\tx`)
  })
})
