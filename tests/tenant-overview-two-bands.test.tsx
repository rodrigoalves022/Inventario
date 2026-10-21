import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import * as React from 'react'

// Sprint V18 — Visao Geral em duas faixas. O que se trava aqui e' a ESTRUTURA
// da pagina com maquinas: a faixa de acao (3 KPIs + painel critico em largura
// total) antes do separador "Retrato do parque", e o retrato (hero, 2 KPIs,
// graficos sem o donut de Status, atividade + ultimas coletas) depois dele.
// Paineis e graficos pesados viram marcadores: o conteudo deles ja tem teste
// proprio; aqui so importa onde cada um aparece.

const { fakePrisma } = vi.hoisted(() => ({
  fakePrisma: {
    device: { findMany: vi.fn(async () => []) },
    discoveredDevice: { findMany: vi.fn(async () => []) },
  },
}))

const tenant = { id: 'client-a', slug: 'acme', name: 'Acme', organizationId: 'org-a' }

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { id: 'u', email: 'a@acme.local', role: 'ORG_ADMIN', organizationId: 'org-a' } })),
}))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/tenant-context', () => ({ requireTenantContext: vi.fn(async () => tenant) }))
vi.mock('@/lib/tenant-alert-settings', () => ({
  getTenantAlertSettingsBySlug: vi.fn(async () => null),
  getDefaultAlertSettings: () => ({ alertOfflineHours: 24, alertDiskThresholdGb: 10, discoveryEnabled: false }),
}))
vi.mock('@/lib/reports/device-report', () => ({
  getDeviceReportRows: vi.fn(async () => []),
  buildDeviceReportSummary: vi.fn(() => ({
    totalDevices: 7,
    computadores: 5,
    servidores: 2,
    online: 4,
    offline: 2,
    warning: 1,
    availabilityPercent: 57,
    osDistribution: [],
    ramDistribution: [],
    diskUsageDistribution: [],
  })),
}))
vi.mock('@/lib/audit-log', () => ({ listAuditLogs: vi.fn(async () => []) }))
vi.mock('@/components/dashboard-charts-lazy', () => ({
  OsDistributionChart: () => <div data-marker="chart-os" />,
  RamDistributionChart: ({ title }: { title?: string }) => <div data-marker={title ? 'chart-disk' : 'chart-ram'} />,
}))
vi.mock('@/components/inventory-security-hero', () => ({
  InventorySecurityHero: () => <div data-marker="security-hero" />,
  buildSecurityIndicators: () => [],
}))
vi.mock('@/components/critical-devices-panel', () => ({
  CriticalDevicesPanel: () => <div data-marker="critical-panel" />,
  buildCriticalDeviceEntries: () => ({ entries: [], totalCritical: 0 }),
}))
vi.mock('@/components/recent-activity-panel', () => ({
  RecentActivityPanel: () => <div data-marker="recent-activity" />,
  formatAuditActionLabel: (action: string) => action,
  toDiscoveredDeviceType: (type: string) => type,
}))
vi.mock('@/components/tenant-recent-devices-table', () => ({
  TenantRecentDevicesTable: () => <div data-marker="recent-devices-table" />,
}))

async function renderOverview() {
  const { default: TenantDashboardPage } = await import('@/app/app/[clientSlug]/page')
  const element = await TenantDashboardPage({
    params: Promise.resolve({ clientSlug: tenant.slug }),
  } as unknown as Parameters<typeof TenantDashboardPage>[0])
  return renderToStaticMarkup(element as React.ReactElement)
}

function positionsOf(html: string, needles: string[]) {
  return needles.map((needle) => {
    const index = html.indexOf(needle)
    expect(index, `"${needle}" ausente da Visao Geral`).toBeGreaterThanOrEqual(0)
    return index
  })
}

describe('Visao Geral — duas faixas (Sprint V18)', () => {
  it('faixa de acao, separador "Retrato do parque" e faixa de retrato, nesta ordem', async () => {
    const html = await renderOverview()

    const positions = positionsOf(html, [
      '<h1',
      'Em atenção',
      'Sem coleta recente',
      'Disco crítico',
      'data-marker="critical-panel"',
      'Retrato do parque',
      'data-marker="security-hero"',
      'Máquinas monitoradas',
      'Online agora',
      'data-marker="chart-os"',
      'data-marker="chart-ram"',
      'data-marker="chart-disk"',
      'data-marker="recent-activity"',
      'Últimas coletas',
      'data-marker="recent-devices-table"',
    ])
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('3 KPIs de acao em grid de 3 colunas e 2 KPIs de retrato em grid de 2 — sem card orfao', async () => {
    const html = await renderOverview()

    const actionGrid = html.match(/<div class="grid gap-4 md:grid-cols-3">([\s\S]*?)<div data-marker="critical-panel"/)
    expect(actionGrid).not.toBeNull()
    const actionKpis = actionGrid![1].match(/data-kpi-header/g) ?? []
    expect(actionKpis).toHaveLength(3)

    const portraitGrid = html.match(/<div class="grid gap-4 md:grid-cols-2">([\s\S]*?)data-marker="chart-os"/)
    expect(portraitGrid).not.toBeNull()
    expect(portraitGrid![1].match(/data-kpi-header/g) ?? []).toHaveLength(2)

    expect(html).not.toContain('lg:grid-cols-4')
    expect(html).not.toContain('xl:grid-cols-5')
  })

  it('o separador do retrato e\' um h2 .section-label sobre uma borda superior de superficie', async () => {
    const html = await renderOverview()

    expect(html).toMatch(/<section[^>]*class="[^"]*border-t border-surface-line[^"]*"[^>]*><h2[^>]*class="section-label"[^>]*>Retrato do parque<\/h2>/)
  })

  it('todo KPI continua navegando para a listagem que ele conta', async () => {
    const html = await renderOverview()

    for (const href of [
      '/app/acme/assets?status=warning',
      '/app/acme/assets?status=offline',
      '/app/acme/storage?faixa=critical',
      '/app/acme/assets"',
      '/app/acme/assets?status=online',
    ]) {
      expect(html).toContain(`href="${href}`)
    }
  })

  it('nenhum pico tipografico fora do hero e nenhum resto do vocabulario "frota"', async () => {
    const html = await renderOverview()

    // O hero esta mockado: qualquer text-4xl restante seria um segundo pico.
    expect(html).not.toContain('text-4xl')
    expect(html.toLowerCase()).not.toContain('frota')
  })
})
