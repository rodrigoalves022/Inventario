// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DeviceDetailTabs } from '@/components/device-detail-tabs'

vi.mock('@/app/app/[clientSlug]/assets/[id]/actions', () => ({
  deleteTenantAssetAction: vi.fn(),
  enqueueDeviceCommandAction: vi.fn(),
  saveAssetRecordAction: vi.fn(),
}))

const baseProps = {
  deviceId: 'd1',
  device: {
    hostname: 'DESKTOP-TEST',
    serial: 'SN123',
    fabricante: 'Dell Inc.',
    modelo: 'OptiPlex 7090',
    dominio: 'CORP',
    usuario: 'joao',
    status: 'online',
    lastCollectedAt: '2026-03-01T12:00:00Z',
  },
  hardware: {
    sistema: 'Windows 11 Pro',
    versaoSO: '23H2',
    processador: 'Intel Core i7-11700',
    ramTotalGb: 16,
    placaMae: 'Dell 0D4VYY',
    tipoArmazenamento: 'NVMe',
    slots: [
      { slot: 'Slot 1', value: '16GB DDR4' },
      { slot: 'Slot 2', value: null },
    ],
  },
  disks: [],
  networks: [],
  software: [],
  commands: [],
  canRunCommands: false,
  security: null,
  localAccounts: [],
  metrics: [],
  metricsRetentionDays: 90,
  deviceHealth: {
    status: 'online',
    effectiveStatus: 'online' as const,
    lastCollectedAt: '2026-03-01T12:00:00Z',
    checkinLatencyMinutes: 5,
    agentVersion: '1.1.0',
  },
  monitors: [],
  printers: [],
  usbDevices: [],
  assetRecord: null,
  tenantSlug: 'demo',
  canManageAssetRecord: false,
}

describe('DeviceDetailTabs — Hardware Change Timeline (Wave W21 / Sprint A79)', () => {
  afterEach(() => {
    cleanup()
  })

  it('exibe mensagem amigavel quando nao ha alteracoes de hardware', () => {
    render(<DeviceDetailTabs {...baseProps} initialTab="hardware" hardwareChanges={[]} />)

    expect(
      screen.getByText('Nenhuma alteração de hardware registrada desde o inventário inicial.')
    ).toBeTruthy()
  })

  it('renderiza os eventos de mudanca de hardware com badges e detalhes', () => {
    const changes = [
      {
        id: 'hc-1',
        component: 'RAM',
        action: 'REMOVED',
        description: 'Memória RAM reduzida de 16 GB para 8 GB (possível remoção ou falha de pente)',
        previousVal: '16 GB',
        currentVal: '8 GB',
        detectedAt: '2026-03-02T14:30:00Z',
      },
      {
        id: 'hc-2',
        component: 'DISK',
        action: 'ADDED',
        description: 'Novo disco D: adicionado (Kingston 500GB, 500 GB)',
        previousVal: null,
        currentVal: 'Kingston 500GB (500 GB)',
        detectedAt: '2026-03-01T16:00:00Z',
      },
    ]

    render(<DeviceDetailTabs {...baseProps} initialTab="hardware" hardwareChanges={changes} />)

    expect(screen.getByText(/Memória RAM reduzida de 16 GB para 8 GB/i)).toBeTruthy()
    expect(screen.getByText(/Novo disco D: adicionado/i)).toBeTruthy()
    expect(screen.getByText('Remoção')).toBeTruthy()
    expect(screen.getByText('Adição')).toBeTruthy()
  })
})
