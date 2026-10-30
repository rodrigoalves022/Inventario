import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionPermissionUser: vi.fn(),
  canAccessTenant: vi.fn(),
  getTenantContext: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', () => ({
  getSessionPermissionUser: mocks.getSessionPermissionUser,
  canAccessTenant: mocks.canAccessTenant,
}))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/prisma', () => ({ default: { device: { findFirst: mocks.findFirst } } }))

import { GET } from '@/app/api/tenant/[clientSlug]/devices/[id]/export/route'

const tenant = { id: 'client-1', slug: 'acme' }
const params = { params: Promise.resolve({ clientSlug: 'acme', id: 'dev-1' }) }
const req = {} as never

const device = {
  id: 'dev-1',
  hostname: '=EVIL',
  serial: 'SN1',
  fabricante: 'Dell',
  modelo: 'Latitude',
  usuario: 'ana',
  anydeskId: '123',
  agentVersion: '1.0',
  hardware: { sistema: 'Windows 11', versaoSO: '23H2', processador: 'i5', ramTotalGb: 16, placaMae: 'X' },
  disks: [{ unidade: 'C:', tipo: 'SSD', modelo: 'M', capacidadeGb: 100, espacoLivreGb: 40, criptografia: 'on' }],
  networks: [{ ip: '10.0.0.1', mac: 'AA', gateway: '10.0.0.254', dns: '8.8.8.8', isPrimary: true }],
  security: { antivirusNome: 'Defender', antivirusAtivo: true, antivirusAtualizado: true, firewallAtivo: true, uacAtivo: true, secureBootAtivo: false, tpmPresente: true },
  localAccounts: [{ usuario: 'admin', isAdmin: true, habilitada: true, senhaNuncaExpira: true }],
  monitors: [{ fabricante: 'LG', modelo: '24', serial: 'M1', polegadas: 24 }],
  printers: [{ nome: 'HP', porta: 'IP_1', padrao: true }],
  usbDevices: [{ nome: 'Mouse', serial: 'U1', vendorId: '046d', productId: 'c077' }],
  assetRecord: { etiqueta: 'PAT-1', responsavel: '+cmd', localizacao: 'TI', centroCusto: 'CC1', valor: 5000, garantiaAte: new Date('2027-01-01') },
  software: [
    { nome: 'Chrome', versao: '100.0', editor: 'Google' },
    { nome: 'Chrome', versao: '120.0', editor: 'Google' },
    { nome: 'Windows SDK for Windows Store Apps', versao: '1', editor: 'MS' },
  ],
}

describe('GET /api/tenant/[clientSlug]/devices/[id]/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getTenantContext.mockResolvedValue(tenant)
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findFirst.mockResolvedValue(device)
  })

  it('returns 401 when unauthenticated', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(req, params)).status).toBe(401)
  })

  it('returns 403 when tenant is missing or access is denied', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    expect((await GET(req, params)).status).toBe(403)
    mocks.getTenantContext.mockResolvedValue(null)
    expect((await GET(req, params)).status).toBe(403)
  })

  it('returns 404 for unknown or other-tenant device', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const res = await GET(req, params)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Dispositivo não encontrado.' })
    expect(mocks.findFirst.mock.calls[0][0].where.id).toBe('dev-1')
  })

  it('returns BOM CSV with escaped formulas and deduplicated software', async () => {
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="ficha-_EVIL-\d{4}-\d{2}-\d{2}\.csv"$/)
    // Response.text() descarta o BOM no decode UTF-8; confere os bytes crus.
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
    expect(text.startsWith('﻿Secao;Item;Detalhe 1;Detalhe 2;Detalhe 3')).toBe(true)
    expect(text).toContain("Identificacao;Hostname;'=EVIL")
    expect(text).toContain("Patrimonio;Responsavel;'+cmd")
    expect(text).toContain('Softwares;Chrome;120.0;Google')
    expect(text).not.toContain('100.0')
    expect(text).not.toContain('Windows SDK')
    for (const section of ['Hardware', 'Seguranca', 'Discos', 'Rede', 'Contas Locais', 'Perifericos']) {
      expect(text).toContain(`\r\n${section};`)
    }
  })
})
