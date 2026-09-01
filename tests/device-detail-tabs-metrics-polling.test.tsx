// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeviceDetailTabs, type DeviceHealth, type DeviceMetricSample } from '@/components/device-detail-tabs'

// device-command-panel.tsx e asset-record-form.tsx (montados incondicionalmente
// pelo import estatico de DeviceDetailTabs, mesmo com canRunCommands=false e
// canManageAssetRecord=false) importam server actions de
// app/app/[clientSlug]/assets/[id]/actions.ts, que por sua vez importa
// '@/auth' (next-auth) — fora do build real do Next, isso quebra a resolucao
// de 'next/server' dentro do vitest. Mockado por nao ser relevante a este
// teste (polling da aba Metricas).
vi.mock('@/app/app/[clientSlug]/assets/[id]/actions', () => ({
  deleteTenantAssetAction: vi.fn(),
  enqueueDeviceCommandAction: vi.fn(),
  saveAssetRecordAction: vi.fn(),
}))

// Sprint 9, item A.3. A aba Metricas de DeviceDetailTabs deixou de ser um
// retrato estatico do carregamento da pagina (Server Component) — agora
// existe polling client-side (~60s) que refaz a mesma consulta via
// GET /api/tenant/[clientSlug]/devices/[deviceId]/metrics, pausando quando a
// aba/pagina fica invisivel. Testado com vi.useFakeTimers(), mesmo criterio
// de aceite descrito em docs/SPRINTS.md (Sprint 9, secao A.3).

const baseHealth: DeviceHealth = {
  status: 'online',
  effectiveStatus: 'online',
  lastCollectedAt: new Date().toISOString(),
  checkinLatencyMinutes: 5,
  agentVersion: '1.0.0',
}

const baseMetrics: DeviceMetricSample[] = [
  {
    collectedAt: new Date(Date.now() - 600_000).toISOString(),
    cpuPercent: 10,
    ramUsadaGb: 2,
    ramTotalGb: 8,
    discoUsadoGb: 50,
    discoLivreGb: 50,
    uptimeSegundos: 3600,
  },
]

function baseProps() {
  return {
    deviceId: 'device-1',
    device: {
      hostname: 'PC-1',
      serial: null,
      fabricante: null,
      modelo: null,
      dominio: null,
      usuario: null,
      status: 'online',
      lastCollectedAt: null,
    },
    hardware: null,
    disks: [],
    networks: [],
    software: [],
    commands: [],
    canRunCommands: false,
    security: null,
    localAccounts: [],
    metrics: baseMetrics,
    metricsRetentionDays: 90,
    deviceHealth: baseHealth,
    monitors: [],
    printers: [],
    usbDevices: [],
    assetRecord: null,
    tenantSlug: 'cliente-a',
    canManageAssetRecord: false,
  }
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * Radix Tabs troca de aba na ativacao automatica por FOCO da trigger (roving
 * tabindex), nao so no evento `click` isolado — `fireEvent.click` sozinho no
 * jsdom nao dispara foco de verdade, entao a aba nunca muda sem este passo
 * extra (confirmado isolando o problema num Tabs minimo antes deste arquivo).
 */
function switchToMetricsTab() {
  const trigger = screen.getByRole('tab', { name: /Métricas/i })
  fireEvent.mouseDown(trigger)
  fireEvent.focus(trigger)
  fireEvent.click(trigger)
}

// Recharts (usado pelos graficos da aba Metricas) monta um ResizeObserver
// real via ResponsiveContainer — inexistente no jsdom.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.useFakeTimers()
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('DeviceMetricsSection — refetch periodico', () => {
  it('busca dados novos a cada ciclo de ~60s, sem exigir reload manual da pagina', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ device: baseHealth, metrics: baseMetrics }))
    vi.stubGlobal('fetch', fetchMock)

    render(<DeviceDetailTabs {...baseProps()} />)
    switchToMetricsTab()

    expect(screen.getByText('Atualiza automaticamente a cada 60s')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tenant/cliente-a/devices/device-1/metrics',
      expect.objectContaining({ cache: 'no-store' })
    )

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('nunca aciona o polling quando tenantSlug e null (portal, escopo fora desta sprint)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ device: baseHealth, metrics: baseMetrics }))
    vi.stubGlobal('fetch', fetchMock)

    render(<DeviceDetailTabs {...baseProps()} tenantSlug={null} />)
    switchToMetricsTab()

    await vi.advanceTimersByTimeAsync(180_000)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('DeviceMetricsSection — pausa quando a aba fica invisivel', () => {
  it('para de chamar fetch quando document.visibilityState !== "visible", e retoma (com refresh imediato) ao voltar', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ device: baseHealth, metrics: baseMetrics }))
    vi.stubGlobal('fetch', fetchMock)

    render(<DeviceDetailTabs {...baseProps()} />)
    switchToMetricsTab()

    setVisibility('hidden')
    await vi.advanceTimersByTimeAsync(180_000)
    expect(fetchMock).not.toHaveBeenCalled()

    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
