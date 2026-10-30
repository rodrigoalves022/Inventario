import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindMany: vi.fn(),
  deviceFindMany: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findMany: mocks.userFindMany },
    device: { findMany: mocks.deviceFindMany },
  },
}))

import { GET as getUsersCsv } from '@/app/api/users/csv/route'
import { GET as getSecurityCsv } from '@/app/api/security/csv/route'

const req = {} as never

function sessionFor(role: string, organizationId: string | null = 'org-1', clientId: string | null = null) {
  return { user: { id: 'u1', email: 'eu@example.com', role, organizationId, clientId } }
}

async function readCsv(res: Response) {
  const bytes = new Uint8Array(await res.arrayBuffer())
  expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
  const body = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
  return body.slice(1).trim().split('\r\n')
}

describe('GET /api/users/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.userFindMany.mockResolvedValue([
      {
        id: 'u1',
        name: '=HYPERLINK("http://evil")',
        email: 'admin@acme.com',
        role: 'ORG_ADMIN',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        organization: { name: 'Acme' },
        client: null,
      },
      {
        id: 'u2',
        name: 'Maria; Silva',
        email: '@viewer@acme.com',
        role: 'CLIENT_VIEWER',
        isActive: false,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        organization: { name: 'Acme' },
        client: { name: 'Filial Sul' },
      },
    ])
  })

  it('retorna 401 sem sessao', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await getUsersCsv(req)
    expect(res.status).toBe(401)
    expect(mocks.userFindMany).not.toHaveBeenCalled()
  })

  it.each(['CLIENT_VIEWER', 'ORG_OPERATOR'])('retorna 403 para %s', async (role) => {
    mocks.auth.mockResolvedValue(sessionFor(role, 'org-1', role === 'CLIENT_VIEWER' ? 'c1' : null))
    const res = await getUsersCsv(req)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Acesso negado' })
    expect(mocks.userFindMany).not.toHaveBeenCalled()
  })

  it('PLATFORM_ADMIN exporta todos os usuarios, sem filtro de organizacao', async () => {
    mocks.auth.mockResolvedValue(sessionFor('PLATFORM_ADMIN', null))
    const res = await getUsersCsv(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="usuarios-plataforma-\d{4}-\d{2}-\d{2}\.csv"$/
    )
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined, orderBy: [{ role: 'asc' }, { email: 'asc' }] })
    )
    // Nunca seleciona o hash de senha.
    const { select } = mocks.userFindMany.mock.calls[0][0]
    expect(select).not.toHaveProperty('passwordHash')
  })

  it('ORG_ADMIN exporta so a propria organizacao, com protecao contra formula', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ORG_ADMIN', 'org-1'))
    const res = await getUsersCsv(req)
    expect(res.status).toBe(200)
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 'org-1' } }))

    const lines = await readCsv(res)
    expect(lines[0]).toBe('Nome;E-mail;Papel;Escopo;Status;CriadoEm')
    expect(lines[1]).toBe(
      `"'=HYPERLINK(""http://evil"")";admin@acme.com;Administrador da conta;Organização: Acme;Ativo;2026-01-01T00:00:00.000Z`
    )
    expect(lines[2]).toBe(
      `"Maria; Silva";'@viewer@acme.com;Portal do cliente;Cliente: Filial Sul;Inativo;2026-02-01T00:00:00.000Z`
    )
  })

  it('ORG_ADMIN sem organizacao nunca casa com usuarios sem organizacao', async () => {
    mocks.auth.mockResolvedValue(sessionFor('ORG_ADMIN', null))
    const res = await getUsersCsv(req)
    expect(res.status).toBe(200)
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: '__sem_organizacao__' } })
    )
  })
})

describe('GET /api/security/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deviceFindMany.mockResolvedValue([
      {
        id: 'd1',
        hostname: '-cmd|calc',
        status: 'warning',
        updatedAt: new Date('2026-10-01T12:00:00.000Z'),
        agentAuth: { client: { name: 'Acme', slug: 'acme' } },
        security: {
          antivirusNome: 'Windows Defender',
          antivirusAtivo: true,
          antivirusAtualizado: false,
          firewallAtivo: false,
          secureBootAtivo: true,
          uacAtivo: true,
          tpmPresente: null,
        },
        localAccounts: [{ usuario: 'Administrador' }, { usuario: '+suporte' }],
        disks: [{ criptografia: 'on' }, { criptografia: 'off' }],
      },
      {
        id: 'd2',
        hostname: 'SRV-01',
        status: 'online',
        updatedAt: new Date('2026-10-02T12:00:00.000Z'),
        agentAuth: { client: null },
        security: null,
        localAccounts: [],
        disks: [],
      },
    ])
  })

  it('retorna 401 sem sessao', async () => {
    mocks.auth.mockResolvedValue(null)
    const res = await getSecurityCsv(req)
    expect(res.status).toBe(401)
    expect(mocks.deviceFindMany).not.toHaveBeenCalled()
  })

  it.each(['ORG_ADMIN', 'ORG_OPERATOR', 'CLIENT_VIEWER'])('retorna 403 para %s', async (role) => {
    mocks.auth.mockResolvedValue(sessionFor(role))
    const res = await getSecurityCsv(req)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Acesso negado' })
    expect(mocks.deviceFindMany).not.toHaveBeenCalled()
  })

  it('PLATFORM_ADMIN exporta so agentes ativos, com colunas de postura', async () => {
    mocks.auth.mockResolvedValue(sessionFor('PLATFORM_ADMIN', null))
    const res = await getSecurityCsv(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="seguranca-parque-\d{4}-\d{2}-\d{2}\.csv"$/
    )

    const query = mocks.deviceFindMany.mock.calls[0][0]
    expect(query.where).toEqual({ agentAuth: { is: { isActive: true } } })
    expect(query.orderBy).toEqual([{ hostname: 'asc' }])
    expect(query.include.security).toBe(true)
    expect(query.include.agentAuth).toEqual({ select: { client: { select: { name: true, slug: true } } } })
    expect(query.include.localAccounts).toEqual({
      where: { isAdmin: true, habilitada: true },
      select: { usuario: true },
    })

    const lines = await readCsv(res)
    expect(lines[0]).toBe(
      'Cliente;Hostname;Status;UltimaColeta;AntivirusAtivo;AntivirusNome;AssinaturasAtualizadas;FirewallAtivo;BitLockerStatus;SecureBootAtivo;UacAtivo;TpmPresente;ContasAdminHabilitadas'
    )
    expect(lines[1]).toBe(
      "Acme;'-cmd|calc;Em alerta;2026-10-01T12:00:00.000Z;Sim;Windows Defender;Não;Não;Disco sem criptografia;Sim;Sim;Não apurado;Administrador, +suporte"
    )
    // Sem postura reportada: tudo "Não apurado", nunca "Não".
    expect(lines[2]).toBe(
      ';SRV-01;Online;2026-10-02T12:00:00.000Z;Não apurado;;Não apurado;Não apurado;Não apurado;Não apurado;Não apurado;Não apurado;'
    )
  })
})
