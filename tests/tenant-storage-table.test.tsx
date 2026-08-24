// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TenantStorageTable, type TenantStorageRow } from '@/components/tenant-storage-table'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/tenant/cliente-a/storage',
}))

const devices: TenantStorageRow[] = [
  {
    id: 'd1',
    hostname: 'PC-CRITICO',
    usuario: 'joao',
    capacity: 100,
    used: 90, // 90% -> critical
    free: 10,
    diskCount: 1,
    types: ['SSD'],
    presence: 'offline',
    detailsPath: '/tenant/cliente-a/assets/d1',
  },
  {
    id: 'd2',
    hostname: 'PC-OK',
    usuario: 'maria',
    capacity: 100,
    used: 20, // 20% -> ok
    free: 80,
    diskCount: 1,
    types: ['HDD'],
    presence: 'online',
    detailsPath: '/tenant/cliente-a/assets/d2',
  },
]

describe('TenantStorageTable — badge de presenca e filtros (RN010, item 7)', () => {
  it('usa getDevicePresence (nunca device.status bruto) para o badge de status', () => {
    render(<TenantStorageTable devices={devices} />)

    // As duas linhas devem exibir a presenca calculada, nao um status bruto
    // tipo "warning" que nunca existiria em Device.status vindo do banco.
    expect(screen.getByText('offline')).toBeTruthy()
    expect(screen.getByText('online')).toBeTruthy()
  })

  it('filtro por tipo de disco (?tipo=) restringe a lista e reflete na URL', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('type-filter-SSD'))

    expect(screen.getByText('PC-CRITICO')).toBeTruthy()
    expect(screen.queryByText('PC-OK')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/tenant/cliente-a/storage?tipo=SSD')
  })

  it('filtro por faixa de uso "critical" mostra so discos acima de 80%', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('usage-filter-critical'))

    expect(screen.getByText('PC-CRITICO')).toBeTruthy()
    expect(screen.queryByText('PC-OK')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/tenant/cliente-a/storage?faixa=critical')
  })

  it('hostname e um link clicavel para /assets/[id]', () => {
    render(<TenantStorageTable devices={devices} />)
    const link = screen.getByText('PC-CRITICO').closest('a')
    expect(link?.getAttribute('href')).toBe('/tenant/cliente-a/assets/d1')
  })
})
