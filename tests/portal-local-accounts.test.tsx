// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

const ctx = { clientId: 'c1', clientName: 'Acme', clientSlug: 'acme', viewerName: 'Ana', viewerEmail: 'a@acme.com' }

const { findDevices } = vi.hoisted(() => ({ findDevices: vi.fn() }))

vi.mock('@/lib/portal-context', () => ({ requirePortalContext: vi.fn(async () => ctx) }))
vi.mock('@/lib/prisma', () => ({ default: { device: { findMany: findDevices } } }))

import PortalLocalAccountsPage from '@/app/portal/local-accounts/page'

// Uma conta para cada combinacao relevante da regra de risco. A tabela NAO e'
// mockada: o filtro por ?tab= e o calculo de risco sao provados pelo que de
// fato aparece na tela.
const devices = [
  {
    id: 'd1',
    hostname: 'PC-01',
    localAccounts: [
      // habilitada + admin + nunca expira -> critical
      { id: 'a1', usuario: 'admin-local', isAdmin: true, habilitada: true, senhaNuncaExpira: true },
      // habilitada + admin -> warning
      { id: 'a2', usuario: 'suporte', isAdmin: true, habilitada: true, senhaNuncaExpira: false },
      // habilitada + nunca expira -> warning
      { id: 'a3', usuario: 'maria', isAdmin: false, habilitada: true, senhaNuncaExpira: true },
    ],
  },
  {
    id: 'd2',
    hostname: 'PC-02',
    localAccounts: [
      // desabilitada: nunca e' risco, mesmo admin + nunca expira -> ok
      { id: 'a4', usuario: 'old-admin', isAdmin: true, habilitada: false, senhaNuncaExpira: true },
      { id: 'a5', usuario: 'guest', isAdmin: false, habilitada: false, senhaNuncaExpira: true },
      // habilitada, padrao, expira -> ok
      { id: 'a6', usuario: 'joao', isAdmin: false, habilitada: true, senhaNuncaExpira: false },
    ],
  },
]

const ALL_USERS = ['admin-local', 'suporte', 'maria', 'old-admin', 'guest', 'joao']

async function renderPage(searchParams: { tab?: string } = {}) {
  render(await PortalLocalAccountsPage({ searchParams: Promise.resolve(searchParams) }))
}

function kpi(label: string) {
  const card = screen.getByText(label).closest('a') as HTMLAnchorElement
  return {
    href: card.getAttribute('href'),
    value: card.querySelector('[data-kpi-value]')?.textContent,
  }
}

function accountRow(usuario: string) {
  return screen.getByText(usuario).closest('tr') as HTMLElement
}

function expectVisibleUsers(expected: string[]) {
  for (const usuario of ALL_USERS) {
    if (expected.includes(usuario)) expect(screen.getByText(usuario)).toBeTruthy()
    else expect(screen.queryByText(usuario)).toBeNull()
  }
}

beforeEach(() => {
  cleanup()
  findDevices.mockReset()
  findDevices.mockResolvedValue(devices)
})

describe('PortalLocalAccountsPage (Sprint A68)', () => {
  it('escopa a consulta ao cliente do portal e a agentes ativos', async () => {
    await renderPage()
    expect(findDevices).toHaveBeenCalledTimes(1)
    expect(findDevices.mock.calls[0][0].where).toEqual({ clientId: 'c1', agentAuth: { is: { isActive: true } } })
  })

  it('renderiza titulo, nome do cliente e os 4 KPIs com contagens e links de aba', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Contas Locais e Privilégios' })).toBeTruthy()
    expect(screen.getByText(/nas máquinas de Acme\.$/)).toBeTruthy()

    expect(kpi('Total de contas locais')).toEqual({ href: '?tab=all', value: '6' })
    // Admin desabilitado (old-admin) nao conta como admin ativo.
    expect(kpi('Admins locais ativos')).toEqual({ href: '?tab=admin_enabled', value: '2' })
    // Contas desabilitadas com senha sem expiracao (old-admin, guest) ficam fora.
    expect(kpi('Senha nunca expira (ativas)')).toEqual({ href: '?tab=never_expires', value: '2' })
    expect(kpi('Risco crítico (Admin + Sem expiração)')).toEqual({ href: '?tab=critical', value: '1' })
  })

  it('renderiza o link "Baixar CSV" para a rota do tenant', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /Baixar CSV/ }).getAttribute('href')).toBe(
      '/api/tenant/acme/local-accounts/csv'
    )
  })

  it('sem ?tab mostra todas as contas na aba "Todas"', async () => {
    await renderPage()
    expect(screen.getByRole('tab', { name: 'Todas' }).getAttribute('aria-selected')).toBe('true')
    expectVisibleUsers(ALL_USERS)
  })

  it('?tab=admin_enabled filtra apenas administradores habilitados', async () => {
    await renderPage({ tab: 'admin_enabled' })
    expect(screen.getByRole('tab', { name: 'Admins ativos' }).getAttribute('aria-selected')).toBe('true')
    expectVisibleUsers(['admin-local', 'suporte'])
  })

  it('?tab=never_expires filtra apenas contas habilitadas com senha sem expiracao', async () => {
    await renderPage({ tab: 'never_expires' })
    expect(screen.getByRole('tab', { name: 'Senha sem expiração' }).getAttribute('aria-selected')).toBe('true')
    expectVisibleUsers(['admin-local', 'maria'])
  })

  it('?tab=critical filtra apenas contas de risco critico', async () => {
    await renderPage({ tab: 'critical' })
    expect(screen.getByRole('tab', { name: 'Risco crítico' }).getAttribute('aria-selected')).toBe('true')
    expectVisibleUsers(['admin-local'])
  })

  it('?tab desconhecido cai na aba "Todas"', async () => {
    await renderPage({ tab: 'bogus' })
    expect(screen.getByRole('tab', { name: 'Todas' }).getAttribute('aria-selected')).toBe('true')
    expectVisibleUsers(ALL_USERS)
  })

  it('?tab=critical sem contas criticas mostra estado vazio do filtro', async () => {
    findDevices.mockResolvedValue([{ id: 'd2', hostname: 'PC-02', localAccounts: devices[1].localAccounts }])
    await renderPage({ tab: 'critical' })
    expect(kpi('Risco crítico (Admin + Sem expiração)').value).toBe('0')
    expect(screen.getByText('Nenhuma conta corresponde ao filtro.')).toBeTruthy()
  })

  it('calcula o risco: critical (habilitada + admin + nunca expira), warning e ok', async () => {
    await renderPage()
    const risk: Record<string, string> = {
      'admin-local': 'Crítico',
      suporte: 'Atenção',
      maria: 'Atenção',
      'old-admin': 'Conforme',
      guest: 'Conforme',
      joao: 'Conforme',
    }
    for (const [usuario, label] of Object.entries(risk)) {
      expect(within(accountRow(usuario)).getByText(label)).toBeTruthy()
    }
    expect(screen.getAllByText('Crítico')).toHaveLength(1)
    expect(screen.getAllByText('Atenção')).toHaveLength(2)
    expect(screen.getAllByText('Conforme')).toHaveLength(3)
  })

  it('liga a maquina de cada conta a pagina do dispositivo no portal', async () => {
    await renderPage()
    expect(within(accountRow('admin-local')).getByRole('link', { name: 'PC-01' }).getAttribute('href')).toBe(
      '/portal/devices/d1'
    )
    expect(within(accountRow('joao')).getByRole('link', { name: 'PC-02' }).getAttribute('href')).toBe(
      '/portal/devices/d2'
    )
  })
})
