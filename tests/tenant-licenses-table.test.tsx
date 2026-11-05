// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TenantLicensesTable } from '@/components/tenant-licenses-table'
import type { ReconciledLicenseItem, LicenseSummary } from '@/lib/licenses'

vi.mock('@/app/app/[clientSlug]/software/licenses/actions', () => ({
  saveLicenseAction: vi.fn(async () => ({ status: 'success', message: 'Salvo' })),
  deleteLicenseAction: vi.fn(async () => ({ status: 'success', message: 'Excluído' })),
}))

const mockItems: ReconciledLicenseItem[] = [
  {
    id: 'lic-1',
    softwareName: 'Microsoft Office 365',
    licenseKey: 'MS-1234',
    seatsPurchased: 10,
    seatsInstalled: 8,
    seatsAvailable: 2,
    contractRef: 'CTR-001',
    supplier: 'SND',
    cost: 1500,
    expiresAt: '2027-12-31T00:00:00Z',
    isExpiringSoon: false,
    isExpired: false,
    status: 'COMPLIANT',
    notes: 'Pacote corporativo',
    installedDevices: [
      { deviceId: 'd1', hostname: 'PC-JOAO', version: '16.0' },
      { deviceId: 'd2', hostname: 'PC-MARIA', version: '16.0' },
    ],
  },
  {
    id: 'lic-2',
    softwareName: 'Adobe Creative Cloud',
    licenseKey: null,
    seatsPurchased: 2,
    seatsInstalled: 3,
    seatsAvailable: -1,
    contractRef: 'CTR-002',
    supplier: 'Adobe',
    cost: 800,
    expiresAt: null,
    isExpiringSoon: false,
    isExpired: false,
    status: 'OVERUSED',
    notes: null,
    installedDevices: [
      { deviceId: 'd1', hostname: 'PC-JOAO', version: '2024' },
      { deviceId: 'd2', hostname: 'PC-MARIA', version: '2024' },
      { deviceId: 'd3', hostname: 'PC-DESIGN', version: '2024' },
    ],
  },
]

const mockSummary: LicenseSummary = {
  totalPurchased: 12,
  totalInstalled: 11,
  compliantCount: 1,
  overusedCount: 1,
  unusedCount: 0,
  expiringCount: 0,
  expiredCount: 0,
  totalCost: 2300,
}

describe('TenantLicensesTable (Sprint A82)', () => {
  afterEach(() => {
    cleanup()
  })

  it('renderiza os KPIs de licencas e contagens', () => {
    render(
      <TenantLicensesTable
        tenantSlug="demo"
        reconciledData={{ items: mockItems, summary: mockSummary }}
        canManageLicenses={true}
      />
    )

    expect(screen.getByText('11 / 12')).toBeTruthy()
    expect(screen.getAllByText('Em conformidade').length).toBeGreaterThan(0)
    expect(screen.getByText('Licenças excedidas')).toBeTruthy()
  })

  it('renderiza a lista de licencas e seus status', () => {
    render(
      <TenantLicensesTable
        tenantSlug="demo"
        reconciledData={{ items: mockItems, summary: mockSummary }}
        canManageLicenses={true}
      />
    )

    expect(screen.getByText('Microsoft Office 365')).toBeTruthy()
    expect(screen.getByText('Chave: MS-1234')).toBeTruthy()
    expect(screen.getByText('Adobe Creative Cloud')).toBeTruthy()
    expect(screen.getByText('Excedida (Não conforme)')).toBeTruthy()
    expect(screen.getByText('1 excedida(s)')).toBeTruthy()
  })

  it('permite expandir linha para ver maquinas com o software instalado', () => {
    render(
      <TenantLicensesTable
        tenantSlug="demo"
        reconciledData={{ items: mockItems, summary: mockSummary }}
        canManageLicenses={true}
      />
    )

    // Botão de expandir da primeira licença
    const expandButtons = screen.getAllByRole('button', { name: /Ver máquinas/i })
    expect(expandButtons.length).toBeGreaterThan(0)

    fireEvent.click(expandButtons[0])

    expect(screen.getByText('PC-JOAO')).toBeTruthy()
    expect(screen.getByText('PC-MARIA')).toBeTruthy()
  })

  it('controla a visibilidade dos botoes de gestao via canManageLicenses', () => {
    const { rerender } = render(
      <TenantLicensesTable
        tenantSlug="demo"
        reconciledData={{ items: mockItems, summary: mockSummary }}
        canManageLicenses={false}
      />
    )

    expect(screen.queryByRole('button', { name: /Cadastrar Licença/i })).toBeNull()

    rerender(
      <TenantLicensesTable
        tenantSlug="demo"
        reconciledData={{ items: mockItems, summary: mockSummary }}
        canManageLicenses={true}
      />
    )

    expect(screen.getByRole('button', { name: /Cadastrar Licença/i })).toBeTruthy()
  })
})
