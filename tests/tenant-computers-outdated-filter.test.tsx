// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, within, fireEvent, screen } from '@testing-library/react'
import { TenantComputersTable, type TenantComputerRow } from '@/components/tenant-computers-table'
import { evaluateWarrantyStatus } from '@/components/asset-record-form'
import { LATEST_AGENT_VERSION } from '@/lib/agent-binary'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/app/app/[clientSlug]/computers/actions', () => ({
  bulkEnqueueDeviceCommandAction: vi.fn(),
  saveTenantAlertSettingsAction: vi.fn(),
}))

vi.mock('@/app/app/[clientSlug]/assets/[id]/actions', () => ({
  saveAssetRecordAction: vi.fn(),
}))

function row(id: string, agentVersion: string | null): TenantComputerRow {
  return {
    id,
    hostname: `PC-${id}`,
    ip: '10.0.0.5',
    sistema: 'Windows 11',
    processador: 'Intel Core i7',
    ramTotalGb: 16,
    lowestDiskFreeGb: 100,
    storageLabel: '500 GB SSD',
    updatedAt: new Date().toISOString(),
    lastCollectionAt: new Date().toISOString(),
    effectiveStatus: 'online',
    issues: [],
    detailsPath: `/app/cliente-a/assets/${id}`,
    agentVersion,
  } as TenantComputerRow
}

describe('TenantComputersTable — filtro de agentes desatualizados', () => {
  const devices = [row('a', LATEST_AGENT_VERSION), row('b', '0.9.0'), row('c', '0.8.1'), row('d', null)]

  it('filtra apenas maquinas com agentVersion diferente da mais recente', () => {
    const { container } = render(<TenantComputersTable devices={devices} />)
    const table = within(container.querySelector('table') as HTMLElement)

    expect(table.getByText('PC-a')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Agentes desatualizados (2)' }))

    expect(table.queryByText('PC-a')).toBeNull()
    expect(table.queryByText('PC-d')).toBeNull()
    expect(table.getByText('PC-b')).toBeTruthy()
    expect(table.getByText('PC-c')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Agentes desatualizados/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('oculta o botao quando nenhum agente esta desatualizado', () => {
    render(<TenantComputersTable devices={[row('a', LATEST_AGENT_VERSION)]} />)
    expect(screen.queryByRole('button', { name: /Agentes desatualizados/ })).toBeNull()
  })
})

describe('evaluateWarrantyStatus', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')

  it('none quando nao ha data', () => {
    expect(evaluateWarrantyStatus(null, now)).toEqual({
      status: 'none',
      daysRemaining: null,
      label: 'Sem data de garantia informada',
    })
  })

  it('expired quando a data ja passou', () => {
    const result = evaluateWarrantyStatus('2025-12-22T00:00:00.000Z', now)
    expect(result.status).toBe('expired')
    expect(result.label).toBe('Garantia vencida há 10 dia(s)')
  })

  it('expiring_soon ate 30 dias', () => {
    expect(evaluateWarrantyStatus('2026-01-31T00:00:00.000Z', now).status).toBe('expiring_soon')
    expect(evaluateWarrantyStatus('2026-01-11T00:00:00.000Z', now).label).toBe('Garantia vence em 10 dia(s)')
  })

  it('active acima de 30 dias', () => {
    const result = evaluateWarrantyStatus('2026-02-01T00:00:00.000Z', now)
    expect(result.status).toBe('active')
    expect(result.label).toBe('Garantia ativa (31 dia(s) restantes)')
  })
})
