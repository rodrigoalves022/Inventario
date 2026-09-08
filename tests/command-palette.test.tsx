// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BarChart3, Monitor } from 'lucide-react'
import type { ShellNavSection } from '@/lib/shell-navigation'
import {
  CommandPalette,
  CommandPaletteTrigger,
  useCommandPalette,
} from '@/components/command-palette'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

/**
 * jsdom nao implementa ResizeObserver nem scrollIntoView; a lista virtual do
 * cmdk usa os dois. Stubs LOCAIS deste arquivo (nao em tests/setup.ts) para
 * nao alterar o ambiente dos outros 57 arquivos de teste por causa de um.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

const SECTIONS: ShellNavSection[] = [
  {
    title: 'Inventário',
    items: [{ name: 'Máquinas', href: '/app/acme/computers', icon: Monitor }],
  },
  {
    title: 'Gestão',
    items: [{ name: 'Relatórios', href: '/app/acme/reports', icon: BarChart3 }],
  },
]

/**
 * O atalho e o campo de busca vivem em componentes diferentes (header e
 * paleta) mas compartilham o estado de `useCommandPalette` — este harness
 * reproduz exatamente o arranjo do `Header`, mais um input qualquer da
 * pagina para o teste de sequestro de teclado.
 */
function Harness() {
  const { open, setOpen } = useCommandPalette()
  return (
    <>
      <input aria-label="Filtrar tabela" />
      <CommandPaletteTrigger onOpen={() => setOpen(true)} />
      <CommandPalette open={open} onOpenChange={setOpen} sections={SECTIONS} />
    </>
  )
}

function paletteIsOpen() {
  return screen.queryByRole('dialog') !== null
}

beforeEach(() => {
  pushMock.mockReset()
})

/**
 * Overhaul visual, Fase 2. O pedido original falava em "atalho VISUAL"
 * (`Ctrl+K` desenhado ao lado do campo). Um enfeite que anuncia um atalho
 * inexistente e pior que nao ter enfeite: promete e nao cumpre. Estes testes
 * travam o comportamento real do atalho.
 */
describe('Paleta de comando — atalho Ctrl+K / Cmd+K', () => {
  it('não está aberta antes de qualquer interação', () => {
    render(<Harness />)
    expect(paletteIsOpen()).toBe(false)
  })

  it('Ctrl+K abre a paleta', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))
  })

  it('Cmd+K (metaKey) abre a paleta', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))
  })

  it('"k" sem modificador não abre nada', () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k' })
    expect(paletteIsOpen()).toBe(false)
  })

  /**
   * O ponto sensivel: um listener global de Ctrl+K sequestraria o atalho de
   * quem esta digitando num filtro de tabela ou num formulario. O guard tem
   * que valer para input, textarea e contenteditable.
   */
  it('não sequestra Ctrl+K de quem está digitando num campo de texto', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Filtrar tabela')
    input.focus()
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true })
    expect(paletteIsOpen()).toBe(false)
  })

  /**
   * jsdom nao implementa `HTMLElement.isContentEditable` (fica sempre false),
   * entao este caso so passa porque o guard tambem consulta o ATRIBUTO
   * `contenteditable`. As duas checagens sao complementares de proposito —
   * ver `isTypingTarget` em components/command-palette.tsx.
   */
  it('não sequestra Ctrl+K dentro de um contenteditable', () => {
    render(<Harness />)
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    const child = document.createElement('span')
    editable.appendChild(child)
    document.body.appendChild(editable)

    fireEvent.keyDown(editable, { key: 'k', ctrlKey: true })
    expect(paletteIsOpen()).toBe(false)

    // O alvo real de um evento de digitacao costuma ser um filho do container.
    fireEvent.keyDown(child, { key: 'k', ctrlKey: true })
    expect(paletteIsOpen()).toBe(false)

    editable.remove()
  })

  it('o botão de busca do header abre a mesma paleta', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Buscar página' }))
    await waitFor(() => expect(paletteIsOpen()).toBe(true))
  })

  it('Esc fecha a paleta', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))
    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' })
    await waitFor(() => expect(paletteIsOpen()).toBe(false))
  })
})

describe('Paleta de comando — o que ela busca', () => {
  it('lista as rotas recebidas, agrupadas pela seção do menu', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))

    expect(screen.getByText('Máquinas')).toBeTruthy()
    expect(screen.getByText('Relatórios')).toBeTruthy()
    expect(screen.getByText('Inventário')).toBeTruthy()
    expect(screen.getByText('Gestão')).toBeTruthy()
  })

  it('filtra sem exigir acento — "relatorios" encontra "Relatórios"', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))

    fireEvent.change(screen.getByPlaceholderText('Buscar página...'), {
      target: { value: 'relatorios' },
    })

    await waitFor(() => expect(screen.queryByText('Máquinas')).toBeNull())
    expect(screen.getByText('Relatórios')).toBeTruthy()
  })

  it('sem resultado, ensina o que procurar em vez de só dizer "vazio"', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))

    fireEvent.change(screen.getByPlaceholderText('Buscar página...'), {
      target: { value: 'zzzzz' },
    })

    await waitFor(() => expect(screen.getByText(/Nenhuma página com esse nome/)).toBeTruthy())
  })

  it('selecionar um item navega para a rota e fecha a paleta', async () => {
    render(<Harness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))

    fireEvent.click(screen.getByText('Relatórios'))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app/acme/reports'))
    await waitFor(() => expect(paletteIsOpen()).toBe(false))
  })
})
