// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TenantComputersTable, type TenantComputerRow } from '@/components/tenant-computers-table'
import { TenantStorageTable, type TenantStorageRow } from '@/components/tenant-storage-table'
import { AuditLogTable } from '@/components/audit-log-table'
import type { AuditLogListItem } from '@/lib/audit-log'

/**
 * Overhaul visual — Fase 3. Paginacao das listagens do tenant, exercitada nas
 * tabelas reais (nao no rodape isolado — esse tem tests/table-pagination-footer).
 *
 * Duas tabelas de proposito, porque os DOIS mecanismos de sincronizacao de URL
 * do sistema aparecem aqui:
 *
 * - /computers nao tinha sincronizacao nenhuma; ganhou `history.replaceState`
 *   (o recorte e' client-side, um `router.replace` por clique refaria o
 *   `findMany` do tenant inteiro a toa).
 * - /storage JA sincronizava `?tipo=`/`?faixa=` via `router.replace`;
 *   `page`/`limit` entraram no `syncUrl` que ja existia la, e nao num segundo
 *   mecanismo sobrescrevendo o primeiro.
 */

const pushMock = vi.fn()
const replaceMock = vi.fn()
let currentPathname = '/app/cliente-a/computers'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => currentPathname,
}))

// Mesmo motivo documentado em tests/tenant-computers-table.test.tsx:
// components/bulk-command-bar.tsx puxa uma server action que importa '@/auth'.
vi.mock('@/app/app/[clientSlug]/computers/actions', () => ({
  bulkEnqueueDeviceCommandAction: vi.fn(),
  saveTenantAlertSettingsAction: vi.fn(),
}))

function makeComputer(index: number, effectiveStatus: TenantComputerRow['effectiveStatus'] = 'online'): TenantComputerRow {
  const suffix = String(index).padStart(2, '0')
  return {
    id: `d${suffix}`,
    hostname: `PC-${suffix}`,
    ip: `10.0.0.${index}`,
    sistema: 'Windows 11',
    processador: 'Intel Core i7',
    ramTotalGb: 16,
    lowestDiskFreeGb: 100,
    storageLabel: '500 GB SSD',
    updatedAt: '2026-09-01T10:00:00.000Z',
    lastCollectionAt: '2026-09-01T10:00:00.000Z',
    effectiveStatus,
    issues: [],
    detailsPath: `/app/cliente-a/assets/d${suffix}`,
  }
}

/** 30 computadores: 20 online e 10 em warning (indices 21..30). */
const COMPUTERS: TenantComputerRow[] = Array.from({ length: 30 }, (_, index) =>
  makeComputer(index + 1, index + 1 > 20 ? 'warning' : 'online')
)

function tableRowCount(container: HTMLElement) {
  return container.querySelectorAll('table tbody tr').length
}

function summaryText() {
  return screen.getByTestId('table-pagination-summary').textContent
}

/** SummaryCard renderiza rotulo e valor dentro do mesmo `<button>`. */
function cardText(label: string) {
  return (screen.getByText(label).closest('button') as HTMLElement).textContent
}

beforeEach(() => {
  pushMock.mockClear()
  replaceMock.mockClear()
  currentPathname = '/app/cliente-a/computers'
  window.history.replaceState(null, '', '/app/cliente-a/computers')
})

describe('Paginação — recorte da página (/computers)', () => {
  it('renderiza só os 25 primeiros de 30, e o rodapé diz o intervalo exato', () => {
    const { container } = render(<TenantComputersTable devices={COMPUTERS} />)

    expect(tableRowCount(container)).toBe(25)
    expect(within(container.querySelector('table') as HTMLElement).getByText('PC-01')).toBeTruthy()
    expect(within(container.querySelector('table') as HTMLElement).queryByText('PC-26')).toBeNull()
    expect(summaryText()).toBe('Exibindo 1–25 de 30 computadores')
  })

  it('a página 2 traz exatamente o resto, sem repetir nem pular linha', () => {
    const { container } = render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))

    const table = within(container.querySelector('table') as HTMLElement)
    expect(tableRowCount(container)).toBe(5)
    expect(table.getByText('PC-26')).toBeTruthy()
    expect(table.getByText('PC-30')).toBeTruthy()
    expect(table.queryByText('PC-25')).toBeNull()
    expect(summaryText()).toBe('Exibindo 26–30 de 30 computadores')
  })

  it('trocar itens por página recorta de novo e volta para a página 1', () => {
    const { container } = render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(summaryText()).toBe('Exibindo 26–30 de 30 computadores')

    fireEvent.change(screen.getByLabelText('Itens por página'), { target: { value: '10' } })

    expect(tableRowCount(container)).toBe(10)
    expect(summaryText()).toBe('Exibindo 1–10 de 30 computadores')
  })

  it('`limit` fora do catálogo (10/25/50/100) cai no default de 25', () => {
    // `?limit=9999` colado na URL — entrada nao confiavel mesmo sendo so UI.
    const { container } = render(<TenantComputersTable devices={COMPUTERS} initialPageSize={9999} />)

    expect(tableRowCount(container)).toBe(25)
    expect((screen.getByLabelText('Itens por página') as HTMLSelectElement).value).toBe('25')
    expect(summaryText()).toBe('Exibindo 1–25 de 30 computadores')
  })

  it('`page` acima do total cai na última página existente, nunca numa página vazia', () => {
    const { container } = render(<TenantComputersTable devices={COMPUTERS} initialPage={99} />)

    expect(tableRowCount(container)).toBe(5)
    expect(summaryText()).toBe('Exibindo 26–30 de 30 computadores')
  })
})

describe('Paginação — a contagem é do conjunto FILTRADO, os cards de KPI não', () => {
  it('filtrar por status muda o total do rodapé, e o card "Total Máquinas" continua contando tudo', () => {
    const { container } = render(<TenantComputersTable devices={COMPUTERS} />)

    expect(summaryText()).toBe('Exibindo 1–25 de 30 computadores')

    fireEvent.click(screen.getByText('Warnings Ativos'))

    // Rodape: conta os 10 que o filtro deixou.
    expect(summaryText()).toBe('Exibindo 1–10 de 10 computadores')
    expect(tableRowCount(container)).toBe(10)

    // Card de KPI: continua contando o conjunto inteiro (30), exatamente como
    // antes desta fase. A paginacao nao pode fazer um card de resumo virar
    // "quantos itens tem nesta pagina".
    expect(cardText('Total Máquinas')).toContain('30')
  })

  it('buscar restringe o total do rodapé sem tocar nos cards', () => {
    render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.change(screen.getByPlaceholderText('Buscar por hostname, IP ou sistema...'), {
      target: { value: 'PC-1' },
    })

    // PC-10..PC-19 = 10 maquinas.
    expect(summaryText()).toBe('Exibindo 1–10 de 10 computadores')
    expect(cardText('Total Máquinas')).toContain('30')
  })
})

describe('Paginação — trocar filtro ou busca volta para a página 1', () => {
  it('estando na página 2, aplicar um filtro devolve o usuário para a página 1', () => {
    render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(summaryText()).toBe('Exibindo 26–30 de 30 computadores')

    fireEvent.click(screen.getByText('Warnings Ativos'))

    // Sem o reset, a pagina 2 de um conjunto de 10 nao existe e o usuario
    // veria uma tabela vazia com o filtro recem-aplicado.
    expect(summaryText()).toBe('Exibindo 1–10 de 10 computadores')
  })

  it('a pílula ativa volta para a 1 quando o novo recorte ainda tem várias páginas', () => {
    render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(screen.getByLabelText('Página 2').getAttribute('aria-current')).toBe('page')

    // Busca que casa com as 30 maquinas: o recorte encolhe zero, mas a troca
    // de busca ainda tem que devolver o usuario para a primeira pagina.
    fireEvent.change(screen.getByPlaceholderText('Buscar por hostname, IP ou sistema...'), {
      target: { value: 'PC-' },
    })

    expect(summaryText()).toBe('Exibindo 1–25 de 30 computadores')
    expect(screen.getByLabelText('Página 1').getAttribute('aria-current')).toBe('page')
    expect(screen.getByLabelText('Página 2').getAttribute('aria-current')).toBeNull()
  })

  it('estando na página 2, digitar na busca também devolve para a página 1', () => {
    const { container } = render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    fireEvent.change(screen.getByPlaceholderText('Buscar por hostname, IP ou sistema...'), {
      target: { value: 'PC-0' },
    })

    expect(summaryText()).toBe('Exibindo 1–9 de 9 computadores')
    expect(within(container.querySelector('table') as HTMLElement).getByText('PC-01')).toBeTruthy()
  })
})

describe('Paginação — sincronização com a URL preservando os filtros (/computers)', () => {
  it('paginar escreve ?page= sem apagar um parâmetro que já estava na URL', () => {
    window.history.replaceState(null, '', '/app/cliente-a/computers?fabricante=Intel')

    render(<TenantComputersTable devices={COMPUTERS} />)
    fireEvent.click(screen.getByLabelText('Próxima página'))

    const params = new URLSearchParams(window.location.search)
    expect(params.get('fabricante')).toBe('Intel')
    expect(params.get('page')).toBe('2')
  })

  it('a página 1 e o limite 25 (os defaults) não sujam a URL', () => {
    render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2')

    fireEvent.click(screen.getByLabelText('Página anterior'))
    const params = new URLSearchParams(window.location.search)
    expect(params.get('page')).toBeNull()
    expect(params.get('limit')).toBeNull()
  })

  it('busca e status passam a ser escritos na URL (antes só eram lidos)', () => {
    render(<TenantComputersTable devices={COMPUTERS} initialSearch="" />)

    fireEvent.change(screen.getByPlaceholderText('Buscar por hostname, IP ou sistema...'), {
      target: { value: 'PC-1' },
    })
    fireEvent.click(screen.getByText('Warnings Ativos'))

    const params = new URLSearchParams(window.location.search)
    expect(params.get('search')).toBe('PC-1')
    expect(params.get('status')).toBe('warning')
  })

  it('trocar o filtro remove o ?page= da URL — recarregar cai na página 1 do novo recorte', () => {
    render(<TenantComputersTable devices={COMPUTERS} />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2')

    fireEvent.click(screen.getByText('Warnings Ativos'))
    expect(new URLSearchParams(window.location.search).get('page')).toBeNull()
  })
})

/* ============================================================================
   /storage — a tabela que JA tinha `syncUrl` via router.replace
   ============================================================================ */

const STORAGE_DEVICES: TenantStorageRow[] = Array.from({ length: 30 }, (_, index) => {
  const suffix = String(index + 1).padStart(2, '0')
  return {
    id: `s${suffix}`,
    hostname: `SRV-${suffix}`,
    usuario: null,
    disks: [{ unidade: 'C:', tipo: 'SSD', capacidadeGb: 100, usedGb: 20 }],
    types: ['SSD'],
    presence: 'online',
    detailsPath: `/app/cliente-a/assets/s${suffix}`,
  }
})

describe('Paginação — sincronização com a URL preservando os filtros (/storage)', () => {
  beforeEach(() => {
    currentPathname = '/app/cliente-a/storage'
  })

  it('paginar mantém ?tipo= na URL e acrescenta ?page= — um único mecanismo de sync', () => {
    render(<TenantStorageTable devices={STORAGE_DEVICES} initialType="SSD" />)

    fireEvent.click(screen.getByLabelText('Próxima página'))

    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/storage?tipo=SSD&page=2')
  })

  it('trocar a faixa reseta a página e a URL sai sem ?page=', () => {
    render(<TenantStorageTable devices={STORAGE_DEVICES} initialType="SSD" />)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/storage?tipo=SSD&page=2')

    fireEvent.click(screen.getByTestId('usage-card-ok'))

    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/storage?tipo=SSD&faixa=ok')
    expect(summaryText()).toBe('Exibindo 1–25 de 30 dispositivos')
  })

  it('trocar itens por página escreve ?limit= junto do filtro já existente', () => {
    render(<TenantStorageTable devices={STORAGE_DEVICES} initialType="SSD" />)

    fireEvent.change(screen.getByLabelText('Itens por página'), { target: { value: '10' } })

    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/storage?tipo=SSD&limit=10')
    expect(summaryText()).toBe('Exibindo 1–10 de 30 dispositivos')
  })
})

/* ============================================================================
   /audit — paginacao OPT-IN, sobre os ate-200 registros ja carregados
   ============================================================================ */

const AUDIT_LOGS: AuditLogListItem[] = Array.from({ length: 60 }, (_, index) => ({
  id: `log-${String(index + 1).padStart(3, '0')}`,
  actorUserId: null,
  actorEmail: `operador${index + 1}@core-ti-expert.local`,
  actorRole: 'ORG_OPERATOR',
  clientId: 'c1',
  clientName: 'Core TI Expert',
  clientSlug: 'core-ti-expert',
  action: 'credentials.view',
  targetType: 'device',
  targetId: `dev-${index + 1}`,
  metadata: null,
  createdAt: '2026-09-01T10:00:00.000Z',
}))

describe('AuditLogTable — paginação opt-in', () => {
  it('com `paginated`, recorta e conta REGISTROS (não "dispositivos")', () => {
    const { container } = render(<AuditLogTable logs={AUDIT_LOGS} emptyMessage="vazio" paginated />)

    expect(container.querySelectorAll('table tbody tr')).toHaveLength(25)
    expect(summaryText()).toBe('Exibindo 1–25 de 60 registros')
  })

  it('sem `paginated`, a listagem do /admin continua inteira e sem rodapé', () => {
    // A query de listAuditLogs (LIMIT 200) nao foi tocada; quem nao pediu
    // paginacao tem que renderizar exatamente o que recebeu.
    const { container } = render(<AuditLogTable logs={AUDIT_LOGS} emptyMessage="vazio" showTenant />)

    expect(container.querySelectorAll('table tbody tr')).toHaveLength(60)
    expect(screen.queryByTestId('table-pagination-summary')).toBeNull()
  })

  it('`?limit=` inválido cai no default também aqui', () => {
    const { container } = render(
      <AuditLogTable logs={AUDIT_LOGS} emptyMessage="vazio" paginated initialPageSize={9999} initialPage={0} />
    )

    expect(container.querySelectorAll('table tbody tr')).toHaveLength(25)
    expect(summaryText()).toBe('Exibindo 1–25 de 60 registros')
  })
})
