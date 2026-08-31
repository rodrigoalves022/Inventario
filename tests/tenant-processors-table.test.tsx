// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TenantProcessorsTable, type TenantProcessorRow } from '@/components/tenant-processors-table'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/app/cliente-a/processors',
}))

const processors: TenantProcessorRow[] = [
  { name: 'Intel Core i7-11700', vendor: 'Intel', count: 2, devices: [{ id: 'd1', hostname: 'PC-01', usuario: 'joao' }] },
  { name: 'AMD Ryzen 5 5600G', vendor: 'AMD', count: 1, devices: [{ id: 'd2', hostname: 'PC-02', usuario: null }] },
]

describe('TenantProcessorsTable — filtro por fabricante refletido na URL', () => {
  it('navegar com initialVendor="Intel" (equivalente a ?fabricante=Intel) mostra so processadores Intel', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="Intel" computersPath="/app/cliente-a/computers" />)

    expect(screen.getByText('Intel Core i7-11700')).toBeTruthy()
    expect(screen.queryByText('AMD Ryzen 5 5600G')).toBeNull()
  })

  it('clicar em "Todos os fabricantes" limpa o filtro, mostra todos e atualiza a URL sem query', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="Intel" computersPath="/app/cliente-a/computers" />)

    fireEvent.click(screen.getByText('Todos os fabricantes'))

    expect(screen.getByText('Intel Core i7-11700')).toBeTruthy()
    expect(screen.getByText('AMD Ryzen 5 5600G')).toBeTruthy()
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/processors')
  })

  it('clicar num fabricante filtra a lista e reflete na URL (?fabricante=)', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    fireEvent.click(screen.getByTestId('vendor-filter-AMD'))

    expect(screen.queryByText('Intel Core i7-11700')).toBeNull()
    expect(screen.getByText('AMD Ryzen 5 5600G')).toBeTruthy()
    expect(replaceMock).toHaveBeenCalledWith('/app/cliente-a/processors?fabricante=AMD')
  })

  it('o processador leva para /computers?search=<nome>', () => {
    render(<TenantProcessorsTable processors={processors} initialVendor="all" computersPath="/app/cliente-a/computers" />)

    const link = screen.getByText('Intel Core i7-11700').closest('a')
    expect(link?.getAttribute('href')).toBe('/app/cliente-a/computers?search=Intel%20Core%20i7-11700')
  })
})
