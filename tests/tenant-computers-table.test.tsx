// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'
import { TenantComputersTable, type TenantComputerRow } from '@/components/tenant-computers-table'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const devices: TenantComputerRow[] = [
  {
    id: 'd1',
    hostname: 'PC-01',
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
    detailsPath: '/tenant/cliente-a/assets/d1',
  },
]

/**
 * O componente renderiza a tabela desktop (`table`, oculta via `hidden md:block`)
 * e a lista de cards mobile (`md:hidden`) ao mesmo tempo — jsdom nao aplica
 * media query, entao as duas ficam no DOM. Os testes escopam as queries a
 * `table` para nao colidir com o texto duplicado do card mobile.
 */
describe('TenantComputersTable — linha inteira clicavel, nao so o hostname (correcao de UX)', () => {
  it('clicar em qualquer celula da linha (ex: coluna Rede/IP) navega para o detalhe do computador', () => {
    const { container } = render(<TenantComputersTable devices={devices} />)
    const table = within(container.querySelector('table') as HTMLElement)

    fireEvent.click(table.getByText('10.0.0.5'))

    expect(pushMock).toHaveBeenCalledWith('/tenant/cliente-a/assets/d1')
  })

  it('Enter com foco na linha tambem navega (acessibilidade de teclado)', () => {
    const { container } = render(<TenantComputersTable devices={devices} />)
    const table = within(container.querySelector('table') as HTMLElement)

    const row = table.getByText('10.0.0.5').closest('tr')
    fireEvent.keyDown(row as HTMLElement, { key: 'Enter' })

    expect(pushMock).toHaveBeenCalledWith('/tenant/cliente-a/assets/d1')
  })

  it('a linha da tabela desktop tem role="button" e e alcancavel via tab (tabIndex 0)', () => {
    const { container } = render(<TenantComputersTable devices={devices} />)
    const table = within(container.querySelector('table') as HTMLElement)

    const row = table.getByText('10.0.0.5').closest('tr')

    expect(row?.getAttribute('role')).toBe('button')
    expect(row?.getAttribute('tabindex')).toBe('0')
  })

  it('hostname continua sendo um link direto para o detalhe', () => {
    const { container } = render(<TenantComputersTable devices={devices} />)
    const table = within(container.querySelector('table') as HTMLElement)

    const link = table.getByText('PC-01').closest('a')

    expect(link?.getAttribute('href')).toBe('/tenant/cliente-a/assets/d1')
  })
})
