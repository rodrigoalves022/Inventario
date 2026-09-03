// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TenantProcessorsTable, type TenantProcessorRow } from '@/components/tenant-processors-table'
import { inferVendor, getVendorGroup } from '@/lib/processor-vendor'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/app/cliente-a/processors',
}))

const processors: TenantProcessorRow[] = [
  { name: 'Intel Core i7-11700', vendor: 'Intel', count: 2, devices: [{ id: 'd1', hostname: 'PC-01', usuario: 'joao' }] },
  // Rotulo legado 'Intel Xeon' — pode chegar de dado montado antes da Sprint 15
  // ou de uma URL antiga. Tem que ser contado e filtrado como Intel.
  { name: 'Xeon E5-2680 v4', vendor: 'Intel Xeon', count: 3, devices: [{ id: 'd3', hostname: 'SRV-01', usuario: null }] },
  { name: 'AMD Ryzen 5 5600G', vendor: 'AMD', count: 1, devices: [{ id: 'd2', hostname: 'PC-02', usuario: null }] },
  { name: 'VIA Nano X2', vendor: 'Nao identificado', count: 4, devices: [{ id: 'd4', hostname: 'PC-04', usuario: null }] },
]

/** Le o numero exibido num card de KPI (o `<p>` do valor, nao o rotulo). */
function cardValue(testId: string): number {
  return Number(screen.getByTestId(`${testId}-value`).textContent)
}

/** Soma a coluna "Dispositivos" das linhas atualmente visiveis na tabela. */
function visibleDeviceCount(): number {
  const rows = Array.from(document.querySelectorAll('tbody tr'))
  return rows.reduce((sum, row) => sum + Number(row.querySelectorAll('td')[2]?.textContent ?? 0), 0)
}

describe('inferVendor — colapso do fabricante fantasma "Intel Xeon" (Sprint 15)', () => {
  it('trata "Xeon" sem "Intel" na string como Intel (era o unico caso que gerava "Intel Xeon")', () => {
    expect(inferVendor('Xeon E5-2680 v4')).toBe('Intel')
    expect(inferVendor('Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz')).toBe('Intel')
    expect(inferVendor('Intel Core i7-11700')).toBe('Intel')
  })

  it('AMD e nao identificado seguem inalterados, e nenhum nome produz um 4o rotulo', () => {
    expect(inferVendor('AMD Ryzen 5 5600G')).toBe('AMD')
    expect(inferVendor('VIA Nano X2')).toBe('Nao identificado')
    for (const name of ['Xeon E5-2680', 'Intel Xeon Gold', 'AMD EPYC 7402', 'Apple M2', '']) {
      expect(['Intel', 'AMD', 'Nao identificado']).toContain(inferVendor(name))
    }
  })

  it('getVendorGroup reagrupa rotulos legados: "Intel Xeon" cai no grupo Intel', () => {
    expect(getVendorGroup('Intel Xeon')).toBe('Intel')
    expect(getVendorGroup('Intel')).toBe('Intel')
    expect(getVendorGroup('AMD')).toBe('AMD')
    expect(getVendorGroup('Nao identificado')).toBe('Nao identificado')
    // Qualquer rotulo desconhecido cai em "outros" — nunca some da contagem.
    expect(getVendorGroup('Qualcomm Snapdragon')).toBe('Nao identificado')
  })
})

describe('TenantProcessorsTable — cards de KPI por fabricante (Sprint 15)', () => {
  it('os 4 cards contam DISPOSITIVOS e o total e exatamente Intel + AMD + outros', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    // Intel = 2 (Core i7) + 3 (Xeon, rotulo legado agrupado) = 5
    expect(cardValue('vendor-card-Intel')).toBe(5)
    expect(cardValue('vendor-card-AMD')).toBe(1)
    expect(cardValue('vendor-card-Nao identificado')).toBe(4)
    expect(cardValue('vendor-card-all')).toBe(10)

    // A invariante que um grid de 4 numeros lado a lado promete ao usuario.
    expect(cardValue('vendor-card-all')).toBe(
      cardValue('vendor-card-Intel') + cardValue('vendor-card-AMD') + cardValue('vendor-card-Nao identificado')
    )
  })

  it('o numero do card Intel e exatamente a populacao mostrada ao clicar nele', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    const intelDevices = cardValue('vendor-card-Intel')
    fireEvent.click(screen.getByTestId('vendor-card-Intel'))

    expect(visibleDeviceCount()).toBe(intelDevices)
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/processors?fabricante=Intel')
  })

  it('o card ativo fica marcado com aria-pressed (o card e o proprio controle de filtro)', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    expect(screen.getByTestId('vendor-card-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('vendor-card-AMD').getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(screen.getByTestId('vendor-card-AMD'))

    expect(screen.getByTestId('vendor-card-AMD').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('vendor-card-all').getAttribute('aria-pressed')).toBe('false')
  })

  it('nao existe mais fileira de badges de fabricante duplicando os cards', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    expect(screen.queryByText('Todos os fabricantes')).toBeNull()
    expect(screen.queryByTestId('vendor-filter-AMD')).toBeNull()
    expect(screen.queryByTestId('vendor-filter-Intel')).toBeNull()
  })
})

describe('TenantProcessorsTable — filtro por fabricante refletido na URL', () => {
  it('navegar com initialVendor="Intel" (equivalente a ?fabricante=Intel) mostra so processadores Intel', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="Intel" computersPath="/app/cliente-a/computers" />)

    expect(screen.getByText('Intel Core i7-11700')).toBeTruthy()
    // Rotulado 'Intel Xeon' na linha, mas do grupo Intel — tem que aparecer.
    expect(screen.getByText('Xeon E5-2680 v4')).toBeTruthy()
    expect(screen.queryByText('AMD Ryzen 5 5600G')).toBeNull()
    expect(screen.queryByText('VIA Nano X2')).toBeNull()
  })

  it('clicar no card "Total de Máquinas" limpa o filtro, mostra todos e atualiza a URL sem query', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="Intel" computersPath="/app/cliente-a/computers" />)

    fireEvent.click(screen.getByTestId('vendor-card-all'))

    expect(screen.getByText('Intel Core i7-11700')).toBeTruthy()
    expect(screen.getByText('AMD Ryzen 5 5600G')).toBeTruthy()
    expect(screen.getByText('VIA Nano X2')).toBeTruthy()
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/processors')
  })

  it('clicar num card de fabricante filtra a lista e reflete na URL (?fabricante=)', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    fireEvent.click(screen.getByTestId('vendor-card-AMD'))

    expect(screen.queryByText('Intel Core i7-11700')).toBeNull()
    expect(screen.getByText('AMD Ryzen 5 5600G')).toBeTruthy()
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/processors?fabricante=AMD')
  })

  it('clicar de novo no card ja ativo desliga o filtro (toggle)', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    fireEvent.click(screen.getByTestId('vendor-card-AMD'))
    fireEvent.click(screen.getByTestId('vendor-card-AMD'))

    expect(screen.getByText('Intel Core i7-11700')).toBeTruthy()
    expect(screen.getByText('AMD Ryzen 5 5600G')).toBeTruthy()
    expect(replaceMock).toHaveBeenLastCalledWith('/app/cliente-a/processors')
  })

  it('o processador leva para /computers?search=<nome>', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    const link = screen.getByText('Intel Core i7-11700').closest('a')
    expect(link?.getAttribute('href')).toBe('/app/cliente-a/computers?search=Intel%20Core%20i7-11700')
  })
})
