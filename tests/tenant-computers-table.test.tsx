// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, within, fireEvent, screen } from '@testing-library/react'
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
    detailsPath: '/app/cliente-a/assets/d1',
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

    expect(pushMock).toHaveBeenCalledWith('/app/cliente-a/assets/d1')
  })

  it('Enter com foco na linha tambem navega (acessibilidade de teclado)', () => {
    const { container } = render(<TenantComputersTable devices={devices} />)
    const table = within(container.querySelector('table') as HTMLElement)

    const row = table.getByText('10.0.0.5').closest('tr')
    fireEvent.keyDown(row as HTMLElement, { key: 'Enter' })

    expect(pushMock).toHaveBeenCalledWith('/app/cliente-a/assets/d1')
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

    expect(link?.getAttribute('href')).toBe('/app/cliente-a/assets/d1')
  })
})

/**
 * Listagem unificada `/assets` (Opcao B): mostra computadores e servidores
 * juntos, diferenciados pela coluna "Tipo" (`showTypeColumn`). O tipo e
 * derivado de `sistema` via `isServerOperatingSystem` — mesmo criterio que ja
 * separa /computers de /servers, sem exigir um campo novo na linha.
 */
describe('TenantComputersTable — coluna "Tipo" da listagem unificada (showTypeColumn)', () => {
  const mixedDevices: TenantComputerRow[] = [
    { ...devices[0], id: 'd1', hostname: 'PC-01', sistema: 'Windows 11' },
    { ...devices[0], id: 'd2', hostname: 'SRV-01', sistema: 'Windows Server 2019', detailsPath: '/app/cliente-a/assets/d2' },
  ]

  it('sem showTypeColumn, a coluna "Tipo" não aparece', () => {
    render(<TenantComputersTable devices={mixedDevices} />)
    expect(screen.queryByText('Tipo')).toBeNull()
  })

  it('com showTypeColumn, cada linha mostra o badge correto (Computador vs Servidor)', () => {
    const { container } = render(<TenantComputersTable devices={mixedDevices} showTypeColumn />)
    const table = within(container.querySelector('table') as HTMLElement)

    expect(table.getByText('Tipo')).toBeTruthy()

    const pcRow = table.getByText('PC-01').closest('tr') as HTMLElement
    const srvRow = table.getByText('SRV-01').closest('tr') as HTMLElement

    expect(within(pcRow).getByText('Computador')).toBeTruthy()
    expect(within(srvRow).getByText('Servidor')).toBeTruthy()
  })
})

/**
 * O card "Warnings Ativos" era o unico dos 5 do grid sem interacao (achado do
 * designer-ui). Agora funciona como filtro, sincronizado com a mesma `Tabs`
 * de status que ja existe na tabela — dimensao separada de `criticalFilter`,
 * que os outros 3 cards (Pouco Disco/Pouca RAM/Coleta Atrasada) continuam
 * controlando.
 */
describe('TenantComputersTable — card "Warnings Ativos" filtra por status, sincronizado com a Tabs', () => {
  const withWarning: TenantComputerRow[] = [
    { ...devices[0], id: 'd1', hostname: 'PC-ONLINE', effectiveStatus: 'online' },
    { ...devices[0], id: 'd2', hostname: 'PC-WARNING', effectiveStatus: 'warning' },
  ]

  beforeEach(() => {
    pushMock.mockClear()
  })

  it('clicar em "Warnings Ativos" filtra a tabela para status warning', () => {
    const { container } = render(<TenantComputersTable devices={withWarning} />)

    fireEvent.click(screen.getByText('Warnings Ativos'))

    const table = within(container.querySelector('table') as HTMLElement)
    expect(table.queryByText('PC-WARNING')).toBeTruthy()
    expect(table.queryByText('PC-ONLINE')).toBeNull()
  })

  it('clicar de novo em "Warnings Ativos" (já ativo) volta para "todos"', () => {
    const { container } = render(<TenantComputersTable devices={withWarning} />)

    fireEvent.click(screen.getByText('Warnings Ativos'))
    fireEvent.click(screen.getByText('Warnings Ativos'))

    const table = within(container.querySelector('table') as HTMLElement)
    expect(table.queryByText('PC-WARNING')).toBeTruthy()
    expect(table.queryByText('PC-ONLINE')).toBeTruthy()
  })
})
