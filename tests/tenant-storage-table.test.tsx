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
    disks: [{ unidade: 'C:', tipo: 'SSD', capacidadeGb: 100, usedGb: 90 }], // 90% -> critical
    types: ['SSD'],
    presence: 'offline',
    detailsPath: '/tenant/cliente-a/assets/d1',
  },
  {
    id: 'd2',
    hostname: 'PC-OK',
    usuario: 'maria',
    disks: [{ unidade: 'C:', tipo: 'HDD', capacidadeGb: 100, usedGb: 20 }], // 20% -> ok
    types: ['HDD'],
    presence: 'online',
    detailsPath: '/tenant/cliente-a/assets/d2',
  },
  {
    id: 'd3',
    hostname: 'SRV-VS',
    usuario: null,
    disks: [
      { unidade: 'C:', tipo: 'SSD', capacidadeGb: 100, usedGb: 30 }, // 30% -> ok
      { unidade: 'D:', tipo: 'HDD', capacidadeGb: 200, usedGb: 190 }, // 95% -> critical
    ],
    types: ['SSD', 'HDD'],
    presence: 'online',
    detailsPath: '/tenant/cliente-a/assets/d3',
  },
]

describe('TenantStorageTable — badge de presenca e filtros (RN010, item 7)', () => {
  it('usa getDevicePresence (nunca device.status bruto) para o badge de status', () => {
    render(<TenantStorageTable devices={devices} />)

    // As linhas devem exibir a presenca calculada, nao um status bruto
    // tipo "warning" que nunca existiria em Device.status vindo do banco.
    expect(screen.getByText('offline')).toBeTruthy()
    expect(screen.getAllByText('online').length).toBe(2)
  })

  it('filtro por tipo de disco (?tipo=) restringe a lista e reflete na URL', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('type-filter-SSD'))

    expect(screen.getByText('PC-CRITICO')).toBeTruthy()
    expect(screen.getByText('SRV-VS')).toBeTruthy()
    expect(screen.queryByText('PC-OK')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/tenant/cliente-a/storage?tipo=SSD')
  })

  it('filtro por faixa de uso "critical" mostra so devices com pelo menos um disco acima de 80%', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('usage-filter-critical'))

    expect(screen.getByText('PC-CRITICO')).toBeTruthy()
    // SRV-VS tem um disco ok (30%) e um critico (95%) — classificado pelo
    // PIOR disco, entao aparece no filtro "critical" mesmo com um disco ok.
    expect(screen.getByText('SRV-VS')).toBeTruthy()
    expect(screen.queryByText('PC-OK')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/tenant/cliente-a/storage?faixa=critical')
  })

  it('filtro por faixa de uso "ok" nao mostra devices com qualquer disco critico', () => {
    render(<TenantStorageTable devices={devices} />)

    fireEvent.click(screen.getByTestId('usage-filter-ok'))

    expect(screen.getByText('PC-OK')).toBeTruthy()
    expect(screen.queryByText('PC-CRITICO')).toBeNull()
    // SRV-VS tem um disco critico (95%) -> nao deve aparecer no filtro "ok",
    // mesmo tendo um disco ok (30%): classificacao e pelo pior disco.
    expect(screen.queryByText('SRV-VS')).toBeNull()
  })

  it('device com 1 disco mostra uma barra de uso, com os numeros do proprio disco', () => {
    render(<TenantStorageTable devices={devices} />)

    expect(screen.getByText('C:: 90 GB de 100 GB')).toBeTruthy()
  })

  it('device com 2+ discos mostra uma barra por disco, sem somar capacidade/uso entre eles', () => {
    render(<TenantStorageTable devices={devices} />)

    // SRV-VS tem 2 discos: cada um deve aparecer com seus proprios numeros,
    // nunca uma soma agregada (que seria "220 GB de 300 GB").
    expect(screen.getByText('C:: 30 GB de 100 GB')).toBeTruthy()
    expect(screen.getByText('D:: 190 GB de 200 GB')).toBeTruthy()
    expect(screen.queryByText(/220 GB de 300 GB/)).toBeNull()
  })

  it('hostname e um link clicavel para /assets/[id]', () => {
    render(<TenantStorageTable devices={devices} />)
    const link = screen.getByText('PC-CRITICO').closest('a')
    expect(link?.getAttribute('href')).toBe('/tenant/cliente-a/assets/d1')
  })
})
