// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionPermissionUser: vi.fn(),
  canAccessTenant: vi.fn(),
  getTenantContext: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/permissions', () => ({
  getSessionPermissionUser: mocks.getSessionPermissionUser,
  canAccessTenant: mocks.canAccessTenant,
}))
vi.mock('@/lib/tenant-context', () => ({ getTenantContext: mocks.getTenantContext }))
vi.mock('@/lib/prisma', () => ({ default: { device: { findMany: mocks.findMany } } }))

import { GET } from '@/app/api/tenant/[clientSlug]/local-accounts/csv/route'
import { TenantLocalAccountsTable, type TenantLocalAccountRow } from '@/components/tenant-local-accounts-table'

const rows: TenantLocalAccountRow[] = [
  { id: 'a1', deviceId: 'd1', hostname: 'PC-01', usuario: 'admin-local', isAdmin: true, habilitada: true, senhaNuncaExpira: true, riskLevel: 'critical' },
  { id: 'a2', deviceId: 'd2', hostname: 'PC-02', usuario: 'maria', isAdmin: false, habilitada: true, senhaNuncaExpira: true, riskLevel: 'warning' },
  { id: 'a3', deviceId: 'd2', hostname: 'PC-02', usuario: 'guest', isAdmin: false, habilitada: false, senhaNuncaExpira: false, riskLevel: 'ok' },
]

describe('TenantLocalAccountsTable', () => {
  it('searches by account and hostname', () => {
    render(<TenantLocalAccountsTable rows={rows} tenantSlug="acme" />)
    fireEvent.change(screen.getByLabelText('Buscar contas locais'), { target: { value: 'maria' } })
    expect(screen.getByText('maria')).toBeTruthy()
    expect(screen.queryByText('admin-local')).toBeNull()
    fireEvent.change(screen.getByLabelText('Buscar contas locais'), { target: { value: 'pc-01' } })
    expect(screen.getByText('admin-local')).toBeTruthy()
    expect(screen.queryByText('maria')).toBeNull()
  })

  it('filters by tabs', () => {
    render(<TenantLocalAccountsTable rows={rows} tenantSlug="acme" />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Admins ativos' }))
    expect(screen.getByText('admin-local')).toBeTruthy()
    expect(screen.queryByText('maria')).toBeNull()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Senha sem expiração' }))
    expect(screen.getByText('maria')).toBeTruthy()
    expect(screen.queryByText('guest')).toBeNull()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Risco crítico' }))
    expect(screen.getByText('admin-local')).toBeTruthy()
    expect(screen.queryByText('maria')).toBeNull()
  })

  it('links the machine to the asset page', () => {
    render(<TenantLocalAccountsTable rows={rows} tenantSlug="acme" />)
    expect(screen.getAllByRole('link', { name: 'PC-01' })[0].getAttribute('href')).toBe('/app/acme/assets/d1')
  })
})

describe('GET /api/tenant/[clientSlug]/local-accounts/csv', () => {
  const params = { params: Promise.resolve({ clientSlug: 'acme' }) }
  const req = {} as never

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: 'u1' } })
    mocks.getSessionPermissionUser.mockReturnValue({ id: 'u1' })
    mocks.getTenantContext.mockResolvedValue({ id: 'c1', slug: 'acme' })
    mocks.canAccessTenant.mockReturnValue(true)
    mocks.findMany.mockResolvedValue([])
  })

  it('returns 401 without session', async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await GET(req, params)).status).toBe(401)
  })

  it('returns 403 for cross-tenant access', async () => {
    mocks.canAccessTenant.mockReturnValue(false)
    const res = await GET(req, params)
    expect(res.status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
  })

  it('returns BOM CSV with formula injection protection', async () => {
    mocks.findMany.mockResolvedValue([
      {
        hostname: '=PC-01',
        localAccounts: [{ usuario: '+root', isAdmin: true, habilitada: true, senhaNuncaExpira: true }],
      },
    ])
    const res = await GET(req, params)
    expect(res.status).toBe(200)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('Conta Local;Privilegio;Estado;Expiracao de Senha;Risco;Maquina')
    expect(text).toContain("'+root;Administrador;Habilitada;Nunca expira;Critico;'=PC-01")
  })
})
