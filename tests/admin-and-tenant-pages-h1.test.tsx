import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'

// Sprint A2, item 4 (E3/N3 do relatorio A0). A marca "Inventário TI" da
// Sidebar deixa de ser h1, entao cada pagina passa a ser dona do proprio h1:
// - /admin/clients nao tinha h1 nenhum (decisao antiga registrada num
//   comentario "Sem h1 aqui");
// - a Visao Geral do tenant SEM maquinas (`summary.totalDevices === 0`) fazia
//   early return com o TenantEmptyState e nao renderizava o h1 "Visão geral",
//   que so existia no caminho com maquinas (achado da captura de base do
//   visual-qa da A2). Sem a marca, ficaria com zero h1.
//
// Sidebar/Header e os componentes client pesados viram stubs: o que se testa
// aqui e o h1 da propria pagina, nao o chrome.

const { sessionRef, fakePrisma } = vi.hoisted(() => {
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const fakePrisma = {
    device: { findMany: vi.fn(async () => []) },
    discoveredDevice: { findMany: vi.fn(async () => []) },
  }
  return { sessionRef, fakePrisma }
})

vi.mock('@/auth', () => ({ auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)) }))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/components/sidebar', () => ({
  Sidebar: () => null,
  Header: () => null,
}))

// /admin/clients
vi.mock('@/app/admin/clients/actions', () => ({ rotateEnrollmentKeyAction: vi.fn() }))
vi.mock('@/app/admin/clients/queries', () => ({ getClients: vi.fn(async () => []) }))
vi.mock('@/app/admin/clients/clients-panel', () => ({ ClientsPanel: () => null }))
vi.mock('@/lib/server-url', () => ({ getCurrentServerUrl: vi.fn(async () => 'https://inventario.example.com') }))

// Visao Geral do tenant
const tenant = { id: 'client-a', slug: 'teste-a0-rotacao', name: 'Teste A0 Rotação', organizationId: 'org-a' }
vi.mock('@/lib/tenant-context', () => ({ requireTenantContext: vi.fn(async () => tenant) }))
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsBySlug: vi.fn(async () => null),
  getDefaultAlertSettings: () => ({ alertOfflineHours: 24, alertDiskThresholdGb: 10, discoveryEnabled: false }),
}))
vi.mock('@/lib/reports/device-report', () => ({
  getDeviceReportRows: vi.fn(async () => []),
  buildDeviceReportSummary: vi.fn(() => ({ totalDevices: 0 })),
}))
vi.mock('@/lib/audit-log', () => ({ listAuditLogs: vi.fn(async () => []) }))
vi.mock('@/components/tenant-empty-state', () => ({
  TenantEmptyState: () => <h2>Nenhuma máquina reportou ainda</h2>,
}))
vi.mock('@/components/dashboard-charts-lazy', () => ({
  OsDistributionChart: () => null,
  StatusChart: () => null,
  RamDistributionChart: () => null,
}))

function h1s(html: string) {
  return Array.from(html.matchAll(/<h1[^>]*>(.*?)<\/h1>/g)).map((match) => match[1])
}

beforeEach(() => {
  sessionRef.user = null
  vi.clearAllMocks()
})

describe('/admin/clients — h1 da pagina (E3)', () => {
  it('tem exatamente um h1, "Clientes"', async () => {
    sessionRef.user = { id: 'admin', email: 'admin@inventario.local', role: 'PLATFORM_ADMIN', organizationId: null }
    const { default: ClientsPage } = await import('@/app/admin/clients/page')

    const html = renderToStaticMarkup((await ClientsPage()) as React.ReactElement)

    expect(h1s(html)).toEqual(['Clientes'])
  })
})

describe('/app/[clientSlug] — Visao Geral de tenant sem maquinas (E3)', () => {
  it('o caminho vazio tambem renderiza exatamente um h1, "Visão geral"', async () => {
    sessionRef.user = { id: 'org-admin', email: 'admin@core-ti-expert.local', role: 'ORG_ADMIN', organizationId: 'org-a' }
    const { default: TenantDashboardPage } = await import('@/app/app/[clientSlug]/page')

    const element = await TenantDashboardPage({
      params: Promise.resolve({ clientSlug: tenant.slug }),
    } as unknown as Parameters<typeof TenantDashboardPage>[0])
    const html = renderToStaticMarkup(element as React.ReactElement)

    expect(html).toContain('Nenhuma máquina reportou ainda')
    expect(h1s(html)).toEqual(['Visão geral'])
  })
})
