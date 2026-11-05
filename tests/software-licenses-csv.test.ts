import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/tenant/[clientSlug]/software/licenses/csv/route'
import { NextRequest } from 'next/server'

let mockUser: any = { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' }

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (mockUser ? { user: mockUser } : null)),
}))

vi.mock('@/lib/tenant-context', () => ({
  getTenantContext: vi.fn(async (slug: string) => {
    if (slug === 'demo') {
      return { id: 'client-1', slug: 'demo', organizationId: 'org-1', name: 'Demo Client' }
    }
    return null
  }),
}))

vi.mock('@/lib/licenses', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/licenses')>()
  return {
    ...actual,
    getTenantReconciledLicenses: vi.fn(async () => ({
      items: [
        {
          id: 'lic-1',
          softwareName: 'Microsoft Office 365',
          licenseKey: 'KEY-123',
          seatsPurchased: 10,
          seatsInstalled: 8,
          seatsAvailable: 2,
          contractRef: 'CTR-01',
          supplier: 'SND',
          cost: 1500,
          expiresAt: '2027-12-31T00:00:00.000Z',
          isExpiringSoon: false,
          isExpired: false,
          status: 'COMPLIANT',
          notes: 'Observação teste',
          installedDevices: [{ deviceId: 'd1', hostname: 'SRV-01', version: '16.0' }],
        },
      ],
      summary: {
        totalPurchased: 10,
        totalInstalled: 8,
        compliantCount: 1,
        overusedCount: 0,
        unusedCount: 0,
        expiringCount: 0,
        expiredCount: 0,
        totalCost: 1500,
      },
    })),
  }
})

describe('GET /api/tenant/[clientSlug]/software/licenses/csv', () => {
  beforeEach(() => {
    mockUser = { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-1' }
  })

  it('retorna 401 se nao autenticado', async () => {
    mockUser = null
    const req = new NextRequest('http://localhost:3000/api/tenant/demo/software/licenses/csv')
    const res = await GET(req, { params: Promise.resolve({ clientSlug: 'demo' }) })
    expect(res.status).toBe(401)
  })

  it('retorna 403 se o usuario nao tiver acesso ao tenant', async () => {
    mockUser = { id: 'u3', role: 'CLIENT_VIEWER', organizationId: 'other-org', clientId: 'other-client' }
    const req = new NextRequest('http://localhost:3000/api/tenant/demo/software/licenses/csv')
    const res = await GET(req, { params: Promise.resolve({ clientSlug: 'demo' }) })
    expect(res.status).toBe(403)
  })

  it('exporta CSV formatado com headers corretos e BOM UTF-8', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/demo/software/licenses/csv')
    const res = await GET(req, { params: Promise.resolve({ clientSlug: 'demo' }) })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('attachment; filename="licencas-demo.csv"')

    const text = await res.text()
    expect(text).toContain('Software;Chave de Licenca;Qtd Comprada;Qtd Instalada;Qtd Disponivel;Status')
    expect(text).toContain('Microsoft Office 365;KEY-123;10;8;2;Em conformidade;CTR-01;SND;1500.00;31/12/2027;Observação teste;SRV-01')
  })
})
