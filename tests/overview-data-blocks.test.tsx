// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { SecurityIndicator } from '@/components/inventory-security-hero'
import { InventorySecurityHero } from '@/components/inventory-security-hero'
import { CriticalDevicesPanel } from '@/components/critical-devices-panel'
import { RecentActivityPanel } from '@/components/recent-activity-panel'
import * as charts from '@/components/dashboard-charts'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// jsdom nao tem ResizeObserver, que o ResponsiveContainer do Recharts usa.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

/**
 * Sprint V19 — blocos de dado da Visao Geral.
 *
 * Trava as tres garantias de layout da sprint: a legenda do donut nao cresce
 * com o parque, o hero mantem os tres medidores na mesma horizontal, e os
 * paineis lado a lado saem da mesma casca, sem borda dentro de borda.
 */

function makeIndicator(overrides: Partial<SecurityIndicator>): SecurityIndicator {
  return {
    key: 'bitlocker',
    label: 'BitLocker habilitado',
    percent: 80,
    percentLabel: '80.0',
    knownCount: 4,
    totalDevices: 5,
    note: null,
    ...overrides,
  }
}

const OS_DATA = [
  { name: 'Windows 11 Pro', value: 40 },
  { name: 'Windows 10 Pro', value: 30 },
  { name: 'Ubuntu 22.04', value: 10 },
  { name: 'Windows Server 2022', value: 8 },
  { name: 'Debian 12', value: 6 },
  { name: 'Rocky Linux 9', value: 4 },
  { name: 'Windows 7', value: 2 },
]

describe('Donut de SO — legenda com altura previsivel', () => {
  it('agrupa o que passa de OS_LEGEND_MAX_ITEMS em "+ N outros", somando as maquinas', () => {
    const { visible, hiddenCount, hiddenValue } = charts.splitLegendItems(OS_DATA)

    expect(visible).toHaveLength(charts.OS_LEGEND_MAX_ITEMS)
    expect(visible.map((item) => item.name)).toEqual(OS_DATA.slice(0, charts.OS_LEGEND_MAX_ITEMS).map((i) => i.name))
    expect(hiddenCount).toBe(3)
    expect(hiddenValue).toBe(12)
  })

  it('nao troca um unico item por "+ 1 outro" — com max + 1 itens mostra todos', () => {
    const five = OS_DATA.slice(0, charts.OS_LEGEND_MAX_ITEMS + 1)
    const { visible, hiddenCount } = charts.splitLegendItems(five)

    expect(visible).toHaveLength(five.length)
    expect(hiddenCount).toBe(0)
  })

  it('renderiza no maximo OS_LEGEND_MAX_ITEMS linhas + a linha de agrupamento, nunca a lista inteira', () => {
    const { container } = render(<charts.OsDistributionChart data={OS_DATA} computersPath="/app/a/computers" />)

    expect(screen.getAllByRole('button')).toHaveLength(charts.OS_LEGEND_MAX_ITEMS)
    expect(screen.queryByText('Debian 12')).toBeNull()
    const others = container.querySelector('[data-slot="legend-others"]')
    expect(others?.textContent).toContain('+ 3 outros')
    expect(others?.textContent).toContain('12')
  })

  it('o StatusChart morto saiu do modulo', () => {
    expect('StatusChart' in charts).toBe(false)
  })
})

describe('Hero de conformidade — medidores na mesma horizontal', () => {
  const indicators = [
    makeIndicator({ key: 'bitlocker', note: 'Conta como habilitado só quando todos os discos estão criptografados' }),
    makeIndicator({ key: 'antivirus', label: 'Antivírus ativo', note: 'Atualizado em 50.0% das 2' }),
    makeIndicator({
      key: 'firewall',
      label: 'Firewall ativo',
      percent: null,
      percentLabel: null,
      knownCount: 0,
      note: null,
    }),
  ]

  it('"Sem dado" usa a mesma escala tipografica (text-4xl) de um percentual', () => {
    render(<InventorySecurityHero indicators={indicators} totalDevices={5} reportsHref="/app/a/reports" />)

    const semDado = screen.getByText('Sem dado')
    const percentual = screen.getAllByText('80.0')[0]

    expect(semDado.className).toContain('text-4xl')
    expect(semDado.className).not.toContain('text-3xl')
    expect(percentual.className).toContain('text-4xl')
  })

  it('as tres colunas reservam a mesma altura de rodape, inclusive o firewall sem nota', () => {
    const { container } = render(
      <InventorySecurityHero indicators={indicators} totalDevices={5} reportsHref="/app/a/reports" />
    )

    const footers = Array.from(container.querySelectorAll('[data-slot="indicator-footer"]'))
    expect(footers).toHaveLength(3)
    const classes = new Set(footers.map((footer) => footer.className))
    expect(classes.size).toBe(1)
    expect(footers[0].className).toMatch(/min-h-/)
  })

  it('o titulo do hero continua apontado por aria-labelledby', () => {
    render(<InventorySecurityHero indicators={indicators} totalDevices={5} reportsHref="/app/a/reports" />)
    expect(screen.getByRole('region', { name: 'Postura de segurança do parque' })).toBeTruthy()
  })
})

describe('Paineis lado a lado — mesma casca, sem borda dentro de borda', () => {
  function renderPair() {
    return render(
      <div>
        <CriticalDevicesPanel
          entries={[
            {
              hostname: 'PC-01',
              href: '/app/a/assets/1',
              reasons: [{ code: 'low_disk', label: 'Pouco disco', detail: 'C: 2 GB livres' }],
            },
          ]}
          totalCritical={1}
          alertDiskThresholdGb={10}
          alertOfflineHours={24}
          allDevicesHref="/app/a/assets"
        />
        <RecentActivityPanel
          discovery={{
            enabled: true,
            items: [{ id: 'd-1', ip: '192.168.1.10', label: null, deviceType: 'PRINTER', lastSeenLabel: 'há 2h' }],
            href: '/app/a/network',
          }}
          audit={{ items: [], href: '/app/a/audit' }}
        />
      </div>
    )
  }

  it('os titulos dos dois paineis saem do mesmo PanelHeader (mesmo recuo de cabecalho)', () => {
    renderPair()

    const critical = screen.getByRole('heading', { name: 'Dispositivos em alerta crítico' })
    const discovery = screen.getByRole('heading', { name: 'Descobertas de rede' })
    const headerOf = (heading: HTMLElement) => heading.closest('div.px-5')

    expect(headerOf(critical)?.className).toContain('pt-5 pb-4')
    expect(headerOf(discovery)?.className).toContain('pt-5 pb-4')
    expect(screen.getByRole('region', { name: 'Dispositivos em alerta crítico' })).toBeTruthy()
  })

  it('linhas das listas usam o mesmo respiro vertical e nenhuma tem borda propria', () => {
    const { container } = renderPair()

    const lists = Array.from(container.querySelectorAll('ul'))
    expect(lists.length).toBeGreaterThanOrEqual(2)
    for (const list of lists) {
      expect(list.className).toContain('divide-y')
      for (const bordered of Array.from(list.querySelectorAll('*'))) {
        expect(bordered.getAttribute('class') ?? '').not.toMatch(/(^|\s)border(\s|$)/)
      }
    }

    const criticalRow = within(lists[0]).getByRole('link')
    // Sprint A51: o respiro da linha de descoberta mora no link, como no painel critico.
    const discoveryRow = within(lists[1]).getByRole('link')
    expect(criticalRow.className).toContain('py-3')
    expect(criticalRow.className).not.toContain('py-3.5')
    expect(discoveryRow?.className).toContain('py-3')
  })

  it('o badge de contagem nao desenha uma borda dentro da borda do painel', () => {
    renderPair()
    const header = screen.getByRole('heading', { name: 'Dispositivos em alerta crítico' }).closest('div.px-5')
    const badge = within(header as HTMLElement).getByText('1')
    expect(badge.className).not.toMatch(/(^|\s)border(\s|$)/)
  })
})
