import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  applyQueryUpdates,
  formatPaginationRange,
  getPageSlice,
  getPageWindow,
  getTotalPages,
  paginationQueryUpdates,
  parsePageNumber,
  parsePageSize,
} from '@/lib/table-pagination'

/**
 * Overhaul visual — Fase 3. Nucleo puro do rodape de paginacao das 6 listagens
 * (/computers, /servers, /storage, /processors, /network, /audit). Sem React
 * aqui de proposito: recorte, contagem e parse de URL sao regras, nao pixels.
 */

describe('parsePageSize — `?limit=` da URL e entrada nao confiavel', () => {
  it('aceita exatamente o catalogo 10/25/50/100', () => {
    for (const option of PAGE_SIZE_OPTIONS) {
      expect(parsePageSize(String(option))).toBe(option)
      expect(parsePageSize(option)).toBe(option)
    }
  })

  it('qualquer valor fora do catalogo cai no default de 25', () => {
    // Um `?limit=9999` colado na URL nao pode virar "renderize tudo": o
    // catalogo e fechado justamente para o recorte nunca ser arbitrario.
    for (const invalid of ['9999', '0', '-25', 'abc', '25.5', '', ' ', '1e2', 'null']) {
      expect(parsePageSize(invalid)).toBe(DEFAULT_PAGE_SIZE)
    }
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE)
  })

  it('parametro repetido na URL (?limit=50&limit=abc) usa o primeiro valor', () => {
    expect(parsePageSize(['50', 'abc'])).toBe(50)
    expect(parsePageSize(['abc', '50'])).toBe(DEFAULT_PAGE_SIZE)
    expect(parsePageSize([])).toBe(DEFAULT_PAGE_SIZE)
  })
})

describe('parsePageNumber — `?page=` da URL', () => {
  it('aceita inteiro positivo', () => {
    expect(parsePageNumber('1')).toBe(1)
    expect(parsePageNumber('7')).toBe(7)
    expect(parsePageNumber(42)).toBe(42)
  })

  it('zero, negativo, fracionario, texto e ausente caem na pagina 1', () => {
    for (const invalid of ['0', '-3', '2.5', 'abc', '', undefined, null]) {
      expect(parsePageNumber(invalid)).toBe(1)
    }
  })
})

describe('getPageSlice — recorte do conjunto JA FILTRADO', () => {
  const items = Array.from({ length: 142 }, (_, index) => index + 1)

  it('a primeira pagina traz os N primeiros itens, com o intervalo 1-N', () => {
    const slice = getPageSlice(items, 1, 25)

    expect(slice.items).toHaveLength(25)
    expect(slice.items[0]).toBe(1)
    expect(slice.items.at(-1)).toBe(25)
    expect(slice.from).toBe(1)
    expect(slice.to).toBe(25)
    expect(slice.total).toBe(142)
    expect(slice.totalPages).toBe(6)
  })

  it('a pagina 2 comeca exatamente onde a 1 terminou (sem buraco nem repeticao)', () => {
    const first = getPageSlice(items, 1, 25)
    const second = getPageSlice(items, 2, 25)

    expect(second.items[0]).toBe(first.items.at(-1)! + 1)
    expect(second.from).toBe(first.to + 1)
    expect(second.items).toHaveLength(25)
  })

  it('a ultima pagina traz so o resto e o intervalo termina no total', () => {
    const slice = getPageSlice(items, 6, 25)

    expect(slice.items).toHaveLength(142 - 125)
    expect(slice.from).toBe(126)
    expect(slice.to).toBe(142)
    expect(slice.items.at(-1)).toBe(142)
  })

  it('as paginas cobrem o conjunto inteiro, uma vez cada — nenhuma linha some', () => {
    const seen: number[] = []
    for (let page = 1; page <= 6; page += 1) seen.push(...getPageSlice(items, page, 25).items)

    expect(seen).toEqual(items)
  })

  it('pagina acima do total cai na ULTIMA pagina existente, nunca numa pagina vazia', () => {
    // `?page=99` numa lista de 6 paginas, ou o filtro que encolheu o conjunto
    // debaixo de quem estava na pagina 5.
    const slice = getPageSlice(items, 99, 25)

    expect(slice.page).toBe(6)
    expect(slice.items).toHaveLength(17)
  })

  it('tamanho de pagina fora do catalogo cai no default de 25 tambem aqui', () => {
    expect(getPageSlice(items, 1, 9999).items).toHaveLength(DEFAULT_PAGE_SIZE)
    expect(getPageSlice(items, 1, 9999).pageSize).toBe(DEFAULT_PAGE_SIZE)
  })

  it('conjunto vazio: uma pagina, intervalo 0-0, nada a mostrar', () => {
    const slice = getPageSlice([], 3, 25)

    expect(slice.items).toHaveLength(0)
    expect(slice.page).toBe(1)
    expect(slice.totalPages).toBe(1)
    expect(slice.from).toBe(0)
    expect(slice.to).toBe(0)
    expect(slice.total).toBe(0)
  })

  it('conta o conjunto que recebeu — filtrar ANTES de paginar muda o total', () => {
    // E' a invariante que o rodape promete: "Exibindo 1-25 de 37" com filtro
    // ligado, nao "de 142".
    const filtered = items.filter((value) => value % 4 === 0)

    expect(getPageSlice(filtered, 1, 25).total).toBe(35)
    expect(getPageSlice(items, 1, 25).total).toBe(142)
  })

  it('getTotalPages arredonda para cima e nunca devolve zero', () => {
    expect(getTotalPages(142, 25)).toBe(6)
    expect(getTotalPages(25, 25)).toBe(1)
    expect(getTotalPages(26, 25)).toBe(2)
    expect(getTotalPages(0, 25)).toBe(1)
  })
})

describe('getPageWindow — janela com elipse', () => {
  it('ate o limite de slots, mostra todas as paginas sem elipse', () => {
    expect(getPageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(getPageWindow(3, 3)).toEqual([1, 2, 3])
  })

  it('no meio de muitas paginas, mantem primeira, ultima e o bloco em volta da atual', () => {
    expect(getPageWindow(6, 42)).toEqual([1, 'ellipsis', 4, 5, 6, 7, 8, 'ellipsis', 42])
  })

  it('perto do inicio, nao abre elipse a esquerda', () => {
    expect(getPageWindow(1, 42)).toEqual([1, 2, 3, 4, 5, 6, 'ellipsis', 42])
  })

  it('perto do fim, nao abre elipse a direita', () => {
    expect(getPageWindow(42, 42)).toEqual([1, 'ellipsis', 37, 38, 39, 40, 41, 42])
  })

  it('nunca renderiza 200 botoes: a janela tem tamanho limitado por construcao', () => {
    const window = getPageWindow(100, 200)
    const numeric = window.filter((entry) => entry !== 'ellipsis')

    expect(numeric).toHaveLength(7)
    expect(window.length).toBeLessThanOrEqual(9)
    expect(numeric).toContain(1)
    expect(numeric).toContain(200)
    expect(numeric).toContain(100)
  })
})

describe('formatPaginationRange — o texto do rodape', () => {
  it('usa o formato pedido, com meia-risca entre os extremos', () => {
    expect(formatPaginationRange({ from: 1, to: 25, total: 142 }, { one: 'dispositivo', other: 'dispositivos' })).toBe(
      'Exibindo 1–25 de 142 dispositivos'
    )
  })

  it('o substantivo e parametro — /processors lista MODELOS, /audit lista REGISTROS', () => {
    expect(formatPaginationRange({ from: 1, to: 10, total: 37 }, { one: 'modelo', other: 'modelos' })).toBe(
      'Exibindo 1–10 de 37 modelos'
    )
    expect(formatPaginationRange({ from: 26, to: 50, total: 200 }, { one: 'registro', other: 'registros' })).toBe(
      'Exibindo 26–50 de 200 registros'
    )
  })

  it('singular quando ha exatamente um item', () => {
    expect(formatPaginationRange({ from: 1, to: 1, total: 1 }, { one: 'servidor', other: 'servidores' })).toBe(
      'Exibindo 1–1 de 1 servidor'
    )
  })
})

describe('applyQueryUpdates — paginar nao pode apagar filtro', () => {
  it('preserva os parametros que ja existiam na URL', () => {
    expect(applyQueryUpdates('?tipo=SSD&faixa=critical', { page: '3' })).toBe('tipo=SSD&faixa=critical&page=3')
    expect(applyQueryUpdates('?fabricante=Intel', { page: '2', limit: '50' })).toBe('fabricante=Intel&page=2&limit=50')
    expect(applyQueryUpdates('?action=device.delete&actorEmail=ana%40x.com&from=2026-01-01', { page: '4' })).toBe(
      'action=device.delete&actorEmail=ana%40x.com&from=2026-01-01&page=4'
    )
  })

  it('valor null remove o parametro sem tocar nos vizinhos', () => {
    expect(applyQueryUpdates('?tipo=SSD&page=3&limit=50', { page: null, limit: null })).toBe('tipo=SSD')
  })

  it('sobrescreve o valor anterior em vez de duplicar a chave', () => {
    expect(applyQueryUpdates('?page=2', { page: '5' })).toBe('page=5')
  })

  it('os defaults (pagina 1, 25 itens) somem da URL em vez de sujar todo link', () => {
    expect(applyQueryUpdates('?tipo=SSD', paginationQueryUpdates(1, DEFAULT_PAGE_SIZE))).toBe('tipo=SSD')
    expect(applyQueryUpdates('?tipo=SSD', paginationQueryUpdates(3, 50))).toBe('tipo=SSD&page=3&limit=50')
  })
})
