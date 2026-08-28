// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TenantRecentDevicesTable, type RecentDeviceRow } from '@/components/tenant-recent-devices-table'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const devices: RecentDeviceRow[] = [
  {
    id: 'd1',
    hostname: 'PC-01',
    ip: '10.0.0.5',
    sistema: 'Windows 11',
    ramLabel: '16 GB',
    lastCollectionAbsolute: '20/08/2026 10:00:00',
    lastCollectionRelative: 'há 2h',
    presence: 'online',
    detailsPath: '/tenant/cliente-a/assets/d1',
  },
]

describe('TenantRecentDevicesTable ("Últimas atualizações" do dashboard) — linha inteira clicavel', () => {
  it('clicar em qualquer celula da linha (ex: coluna Sistema) navega para o detalhe do dispositivo', () => {
    render(<TenantRecentDevicesTable devices={devices} />)

    fireEvent.click(screen.getByText('Windows 11'))

    expect(pushMock).toHaveBeenCalledWith('/tenant/cliente-a/assets/d1')
  })

  it('Enter com foco na linha tambem navega (acessibilidade de teclado)', () => {
    render(<TenantRecentDevicesTable devices={devices} />)

    const row = screen.getByText('Windows 11').closest('tr')
    fireEvent.keyDown(row as HTMLElement, { key: 'Enter' })

    expect(pushMock).toHaveBeenCalledWith('/tenant/cliente-a/assets/d1')
  })

  it('hostname continua sendo um link direto para o detalhe', () => {
    render(<TenantRecentDevicesTable devices={devices} />)

    const link = screen.getByText('PC-01').closest('a')

    expect(link?.getAttribute('href')).toBe('/tenant/cliente-a/assets/d1')
  })

  it('lista vazia mostra o estado vazio em vez de uma tabela quebrada', () => {
    render(<TenantRecentDevicesTable devices={[]} />)

    expect(screen.getByText('Nenhum dispositivo encontrado para este tenant.')).toBeTruthy()
  })
})
