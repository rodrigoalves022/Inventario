// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TablePagination } from '@/components/ui/table-pagination'
import { formatPaginationRange, getPageSlice } from '@/lib/table-pagination'

/**
 * Overhaul visual — Fase 3. Rodape compartilhado pelas 6 listagens. Aqui ele e'
 * exercitado isolado (sem tabela em volta): o que se testa e' o contrato de
 * apresentacao e de acessibilidade, nao o recorte — esse ja tem cobertura pura
 * em tests/table-pagination.test.ts.
 */

const DEVICES = Array.from({ length: 142 }, (_, index) => ({ id: index + 1 }))
const NOUN = { one: 'dispositivo', other: 'dispositivos' }

function renderFooter(page: number, pageSize = 25, items: unknown[] = DEVICES) {
  const onPageChange = vi.fn()
  const onPageSizeChange = vi.fn()
  const slice = getPageSlice(items, page, pageSize)

  const result = render(
    <TablePagination
      slice={slice}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      itemNoun={NOUN}
    />
  )

  return { ...result, slice, onPageChange, onPageSizeChange }
}

function summaryText() {
  return screen.getByTestId('table-pagination-summary').textContent
}

describe('TablePagination — contagem', () => {
  it('diz exatamente "Exibindo 1–25 de 142 dispositivos" na primeira pagina', () => {
    renderFooter(1)
    expect(summaryText()).toBe('Exibindo 1–25 de 142 dispositivos')
  })

  it('o intervalo acompanha a pagina', () => {
    renderFooter(3)
    expect(summaryText()).toBe('Exibindo 51–75 de 142 dispositivos')
  })

  it('o texto renderizado e o mesmo que a funcao pura produz (uma so fonte de verdade)', () => {
    const { slice } = renderFooter(6)
    expect(summaryText()).toBe(formatPaginationRange(slice, NOUN))
  })

  it('o substantivo vem por prop — uma tabela de modelos nao diz "dispositivos"', () => {
    render(
      <TablePagination
        slice={getPageSlice(DEVICES.slice(0, 37), 1, 10)}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        itemNoun={{ one: 'modelo', other: 'modelos' }}
      />
    )
    expect(summaryText()).toBe('Exibindo 1–10 de 37 modelos')
  })

  it('lista vazia nao renderiza rodape nenhum — quem fala e o estado vazio da tabela', () => {
    const { container } = renderFooter(1, 25, [])
    expect(container.innerHTML).toBe('')
  })
})

describe('TablePagination — seletor de itens por pagina', () => {
  it('tem <label> associado e oferece exatamente 10/25/50/100', () => {
    renderFooter(1)

    const select = screen.getByLabelText('Itens por página') as HTMLSelectElement

    expect(select.tagName).toBe('SELECT')
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['10', '25', '50', '100'])
    expect(select.value).toBe('25')
  })

  it('trocar o valor avisa o chamador com um NUMERO do catalogo', () => {
    const { onPageSizeChange } = renderFooter(1)

    fireEvent.change(screen.getByLabelText('Itens por página'), { target: { value: '50' } })

    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('exibe o tamanho EFETIVO: um valor fora do catalogo aparece como o default 25', () => {
    renderFooter(1, 9999)
    expect((screen.getByLabelText('Itens por página') as HTMLSelectElement).value).toBe('25')
  })
})

describe('TablePagination — navegação', () => {
  it('a `<nav>` e rotulada e a pagina atual leva aria-current="page"', () => {
    renderFooter(3)

    expect(screen.getByRole('navigation', { name: 'Paginação da listagem' })).toBeTruthy()
    expect(screen.getByLabelText('Página 3').getAttribute('aria-current')).toBe('page')
    expect(screen.getByLabelText('Página 2').getAttribute('aria-current')).toBeNull()
  })

  it('"Anterior" fica desabilitado na primeira pagina e "Próxima" na ultima', () => {
    const first = renderFooter(1)
    expect((screen.getByLabelText('Página anterior') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Próxima página') as HTMLButtonElement).disabled).toBe(false)
    first.unmount()

    renderFooter(6)
    expect((screen.getByLabelText('Página anterior') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Próxima página') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Anterior/Próxima e as pilulas avisam o chamador com o numero da pagina', () => {
    const { onPageChange } = renderFooter(3)

    fireEvent.click(screen.getByLabelText('Página anterior'))
    expect(onPageChange).toHaveBeenLastCalledWith(2)

    fireEvent.click(screen.getByLabelText('Próxima página'))
    expect(onPageChange).toHaveBeenLastCalledWith(4)

    fireEvent.click(screen.getByLabelText('Página 6'))
    expect(onPageChange).toHaveBeenLastCalledWith(6)
  })

  it('com muitas paginas nao renderiza um botao por pagina — a janela e limitada', () => {
    // 5000 itens / 25 = 200 paginas.
    renderFooter(100, 25, Array.from({ length: 5000 }, (_, index) => ({ id: index })))

    const pills = screen.getAllByRole('button').filter((button) => /^Página \d+$/.test(button.getAttribute('aria-label') ?? ''))

    expect(pills).toHaveLength(7)
    expect(screen.getByLabelText('Página 1')).toBeTruthy()
    expect(screen.getByLabelText('Página 200')).toBeTruthy()
    expect(screen.getByLabelText('Página 100').getAttribute('aria-current')).toBe('page')
  })

  it('com uma pagina so, some a navegacao (que nunca poderia agir) e ficam contagem e seletor', () => {
    renderFooter(1, 25, DEVICES.slice(0, 4))

    expect(screen.queryByRole('navigation')).toBeNull()
    expect(summaryText()).toBe('Exibindo 1–4 de 4 dispositivos')
    expect(screen.getByLabelText('Itens por página')).toBeTruthy()
  })
})
