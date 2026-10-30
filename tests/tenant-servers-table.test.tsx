// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TenantServersTable, type TenantServerRow } from '@/components/tenant-servers-table'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

// Mesmo motivo de tests/tenant-computers-table.test.tsx: components/bulk-command-bar.tsx
// (Sprint 12, importado incondicionalmente por tenant-servers-table.tsx) puxa
// app/app/[clientSlug]/computers/actions.ts -> '@/auth', que quebra fora do
// build real do Next dentro do vitest.
vi.mock('@/app/app/[clientSlug]/computers/actions', () => ({
  bulkEnqueueDeviceCommandAction: vi.fn(),
  saveTenantAlertSettingsAction: vi.fn(),
}))

const servers: TenantServerRow[] = [
  {
    id: 's1',
    hostname: 'SRV-01',
    ip: '10.0.0.1',
    sistema: 'Windows Server 2019',
    processador: 'Xeon',
    ramTotalGb: 64,
    storageLabel: '500 GB SSD',
    effectiveStatus: 'online',
    detailsPath: '/app/cliente-a/assets/s1',
  },
]

describe('TenantServersTable — linha inteira clicavel, nao so o hostname (correcao de UX)', () => {
  it('clicar em qualquer celula da linha (ex: coluna IP) navega para o detalhe do servidor', () => {
    render(<TenantServersTable servers={servers} />)

    fireEvent.click(screen.getByText('10.0.0.1'))

    expect(pushMock).toHaveBeenCalledWith('/app/cliente-a/assets/s1')
  })

  it('Enter com foco na linha tambem navega (acessibilidade de teclado)', () => {
    render(<TenantServersTable servers={servers} />)

    const row = screen.getByText('10.0.0.1').closest('tr')
    fireEvent.keyDown(row as HTMLElement, { key: 'Enter' })

    expect(pushMock).toHaveBeenCalledWith('/app/cliente-a/assets/s1')
  })

  it('a linha tem role="button" e e alcancavel via tab (tabIndex 0)', () => {
    render(<TenantServersTable servers={servers} />)

    const row = screen.getByText('10.0.0.1').closest('tr')

    expect(row?.getAttribute('role')).toBe('button')
    expect(row?.getAttribute('tabindex')).toBe('0')
  })

  it('hostname continua sendo um link direto para o detalhe (Ctrl+clique abre em nova aba)', () => {
    render(<TenantServersTable servers={servers} />)

    const link = screen.getByText('SRV-01').closest('a')

    expect(link?.getAttribute('href')).toBe('/app/cliente-a/assets/s1')
  })

  it('lista vazia mostra mensagem de "nenhum servidor" em vez de uma tabela quebrada', () => {
    render(<TenantServersTable servers={[]} />)

    expect(screen.getByText('Nenhum servidor registrado para o cliente atual.')).toBeTruthy()
  })
})

/** Sprint 12, item 2 — mesmo contrato de tenant-computers-table.tsx. */
describe('TenantServersTable — seleção múltipla e barra de comando em lote (Sprint 12)', () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it('sem tenantSlug/canOperate, nenhuma checkbox aparece (comportamento anterior preservado)', () => {
    render(<TenantServersTable servers={servers} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('com tenantSlug E canOperate=true, uma checkbox aparece por linha + uma de "selecionar todos"', () => {
    render(<TenantServersTable servers={servers} tenantSlug="cliente-a" canOperate />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(2)
  })

  it('marcar a checkbox de uma linha NÃO navega e mostra a barra flutuante com a contagem', () => {
    render(<TenantServersTable servers={servers} tenantSlug="cliente-a" canOperate />)

    fireEvent.click(screen.getByLabelText('Selecionar SRV-01'))

    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByText('1 dispositivo selecionado')).toBeTruthy()
  })
})

describe('TenantServersTable — busca (Sprint V31)', () => {
  const many: TenantServerRow[] = [
    ...servers,
    {
      id: 's2',
      hostname: 'DB-02',
      ip: '10.0.0.2',
      sistema: 'Ubuntu Server',
      processador: 'EPYC',
      ramTotalGb: 32,
      storageLabel: '1 TB SSD',
      effectiveStatus: 'online',
      detailsPath: '/app/cliente-a/assets/s2',
      anydeskId: '123 456 789',
    },
  ]

  it('digitar um hostname filtra as linhas renderizadas', () => {
    render(<TenantServersTable servers={many} />)

    fireEvent.change(screen.getByLabelText('Buscar servidores'), { target: { value: 'db-02' } })

    expect(screen.queryByText('SRV-01')).toBeNull()
    expect(screen.getByText('DB-02')).toBeTruthy()
    expect(screen.getByText('1 de 2 servidor(es)')).toBeTruthy()
  })

  it('digitar um AnyDesk ID (com espacos) filtra as linhas renderizadas', () => {
    render(<TenantServersTable servers={many} />)

    fireEvent.change(screen.getByLabelText('Buscar servidores'), { target: { value: '123 456' } })

    expect(screen.queryByText('SRV-01')).toBeNull()
    expect(screen.getByText('DB-02')).toBeTruthy()
  })
})
