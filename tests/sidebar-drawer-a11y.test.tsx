// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/sidebar'

// Sprint A2, item 4 (E3: a marca deixa de ser h1) e Backlog 16/17 (visual-qa
// da A1): abaixo de `lg`, com o drawer fechado, o Tab passava por "Fechar
// menu" e por todos os links da sidebar fora da tela; Esc nao fechava o
// drawer; e o nome truncado no rodape nao tinha `title`.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/clients',
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

/** Simula a largura da janela para a media query `(min-width: 1024px)` (lg). */
function mockViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query)
      const max = /max-width:\s*(\d+)px/.exec(query)
      const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true)
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    })
  )
  window.matchMedia = globalThis.matchMedia as typeof window.matchMedia
}

const longName = 'Admin Core TI Expert com Nome Comprido'
const adminUser = { name: longName, email: 'admin@core-ti-expert.local', role: 'ORG_ADMIN' as const }
const tenant = { name: 'Teste A0 Rotação', slug: 'teste-a0-rotacao' }

function aside(container: HTMLElement) {
  const element = container.querySelector('aside')
  if (!element) throw new Error('aside nao renderizado')
  return element
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sidebar — marca sem h1 (E3)', () => {
  beforeEach(() => mockViewport(1440))

  it('sem tenant: nenhum h1, e o texto "Inventário TI" continua presente', () => {
    const { container } = render(<Sidebar user={adminUser} />)

    expect(container.querySelectorAll('h1')).toHaveLength(0)
    expect(screen.getByText('Inventário TI')).toBeTruthy()
  })

  it('com tenant: nenhum h1, e o texto "Inventário TI" continua presente', () => {
    const { container } = render(<Sidebar tenant={tenant} user={adminUser} now="2026-10-15T12:00:00.000Z" />)

    expect(container.querySelectorAll('h1')).toHaveLength(0)
    expect(screen.getByText('Inventário TI')).toBeTruthy()
  })
})

describe('Sidebar — drawer abaixo de lg (Backlog 16)', () => {
  beforeEach(() => mockViewport(390))

  it('com o drawer fechado, o aside esta inert (fora do Tab e da arvore de acessibilidade)', () => {
    const { container } = render(<Sidebar user={adminUser} />)

    expect(aside(container).hasAttribute('inert')).toBe(true)
  })

  it('ao abrir, o aside deixa de ser inert e o foco entra no drawer ("Fechar menu")', async () => {
    const { container } = render(<Sidebar user={adminUser} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    })

    expect(aside(container).hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar menu' }))
  })

  it('Esc fecha o drawer aberto e devolve o foco a "Abrir menu"', async () => {
    const { container } = render(<Sidebar user={adminUser} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    })

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(aside(container).hasAttribute('inert')).toBe(true)
    const openButton = screen.getByRole('button', { name: 'Abrir menu' })
    expect(document.activeElement).toBe(openButton)
  })

  it('"Fechar menu" tambem devolve o foco a "Abrir menu"', async () => {
    render(<Sidebar user={adminUser} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))
    })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir menu' }))
  })

  it('Esc com o drawer fechado nao rouba o foco', async () => {
    render(
      <>
        <button type="button">Conteudo</button>
        <Sidebar user={adminUser} />
      </>
    )
    const content = screen.getByRole('button', { name: 'Conteudo' })
    content.focus()

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(document.activeElement).toBe(content)
  })
})

describe('Sidebar — a partir de lg (Backlog 16)', () => {
  beforeEach(() => mockViewport(1440))

  it('o aside nao e inert: os itens da sidebar continuam alcancaveis pelo Tab', () => {
    const { container } = render(<Sidebar user={adminUser} />)

    expect(aside(container).hasAttribute('inert')).toBe(false)
  })
})

describe('Sidebar — nome truncado com title (Backlog 17)', () => {
  beforeEach(() => mockViewport(1440))

  it('sem tenant: o nome do usuario no rodape tem title com o nome completo', () => {
    render(<Sidebar user={adminUser} />)

    const name = screen.getByText(longName)
    expect(name.className).toMatch(/truncate/)
    expect(name.getAttribute('title')).toBe(longName)
  })

  it('com tenant: a linha de usuario e papel do rodape tem title com o texto completo', () => {
    render(<Sidebar tenant={tenant} user={adminUser} now="2026-10-15T12:00:00.000Z" />)

    const line = screen.getByText((_, element) =>
      element?.tagName === 'P' && (element.textContent ?? '').startsWith(longName)
    )
    expect(line.className).toMatch(/truncate/)
    expect(line.getAttribute('title')).toBe(`${longName} · Administrador da conta`)
  })
})
