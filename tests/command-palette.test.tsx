// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BarChart3, BookOpen, Monitor } from 'lucide-react'
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

function TenantHarness({ sections = SECTIONS }: { sections?: ShellNavSection[] }) {
  const { open, setOpen } = useCommandPalette()
  return <CommandPalette open={open} onOpenChange={setOpen} sections={sections} tenantSlug="acme" />
}

/** Papel que ve "Conta > Documentação" no menu (PLATFORM_ADMIN / ORG_ADMIN). */
const SECTIONS_WITH_DOCS: ShellNavSection[] = [
  ...SECTIONS,
  {
    title: 'Conta',
    items: [{ name: 'Documentação', href: '/docs', icon: BookOpen, exact: true }],
  },
]

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

describe('Paleta de comando — busca de dispositivos por usuário/etiqueta', () => {
  it('mantém visível o dispositivo que o servidor casou por usuário ou etiqueta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          devices: [
            {
              id: 'd1',
              hostname: 'PC-0042',
              ip: '10.0.0.5',
              anydeskId: null,
              isServer: false,
              usuario: 'maria.silva',
              etiqueta: 'PAT-998',
              responsavel: 'Joao',
            },
          ],
        }),
      })
    )
    render(<TenantHarness />)
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))

    fireEvent.change(screen.getByPlaceholderText(/Buscar página, hostname/), {
      target: { value: 'maria.silva' },
    })

    await waitFor(() => expect(screen.getByText('PC-0042')).toBeTruthy())
    expect(screen.getByText('PAT-998')).toBeTruthy()
    vi.unstubAllGlobals()
  })
})

/**
 * Sprint A71. Downloads nao podem passar por `router.push` (a rota de API nao
 * e' pagina do App Router): o teste trava que eles saem por um clique de
 * `<a>`, como os botoes "Baixar CSV/PDF" das telas.
 */
describe('Paleta de comando — Ações Rápidas', () => {
  let downloadedHrefs: (string | null)[]

  beforeEach(() => {
    downloadedHrefs = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedHrefs.push(this.getAttribute('href'))
    })
    // A busca de dispositivos dispara a partir de 2 caracteres; aqui ela nao
    // e' o assunto, entao responde sempre vazio.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ devices: [] }) })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  async function openPalette() {
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    await waitFor(() => expect(paletteIsOpen()).toBe(true))
  }

  it('no tenant, lista o grupo com os downloads de PDF e CSV', async () => {
    render(<TenantHarness />)
    await openPalette()

    expect(screen.getByText('Ações Rápidas')).toBeTruthy()
    expect(screen.getByText('Baixar Relatório em PDF')).toBeTruthy()
    expect(screen.getByText('Baixar Relatório em CSV')).toBeTruthy()
  })

  it('fora de um tenant não oferece download — o relatório é sempre de um cliente', async () => {
    render(<Harness />)
    await openPalette()

    expect(screen.queryByText('Baixar Relatório em PDF')).toBeNull()
    expect(screen.queryByText('Baixar Relatório em CSV')).toBeNull()
    expect(screen.queryByText('Ações Rápidas')).toBeNull()
  })

  it('clicar em "Baixar Relatório em PDF" baixa o PDF do tenant e fecha a paleta', async () => {
    render(<TenantHarness />)
    await openPalette()

    fireEvent.click(screen.getByText('Baixar Relatório em PDF'))

    await waitFor(() => expect(downloadedHrefs).toEqual(['/api/tenant/acme/reports/pdf']))
    expect(pushMock).not.toHaveBeenCalled()
    await waitFor(() => expect(paletteIsOpen()).toBe(false))
  })

  it('clicar em "Baixar Relatório em CSV" baixa o CSV do tenant', async () => {
    render(<TenantHarness />)
    await openPalette()

    fireEvent.click(screen.getByText('Baixar Relatório em CSV'))

    await waitFor(() => expect(downloadedHrefs).toEqual(['/api/tenant/acme/reports/csv']))
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('"Ver Documentação da Plataforma" navega para /docs', async () => {
    render(<TenantHarness sections={SECTIONS_WITH_DOCS} />)
    await openPalette()

    fireEvent.click(screen.getByText('Ver Documentação da Plataforma'))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/docs'))
    expect(downloadedHrefs).toEqual([])
    await waitFor(() => expect(paletteIsOpen()).toBe(false))
  })

  it('a documentação segue o menu: papel sem /docs no menu não vê o atalho', async () => {
    render(<TenantHarness />)
    await openPalette()

    expect(screen.queryByText('Ver Documentação da Plataforma')).toBeNull()
  })

  it('o atalho da documentação também existe fora de um tenant', async () => {
    function AccountHarness() {
      const { open, setOpen } = useCommandPalette()
      return <CommandPalette open={open} onOpenChange={setOpen} sections={SECTIONS_WITH_DOCS} />
    }
    render(<AccountHarness />)
    await openPalette()

    expect(screen.getByText('Ações Rápidas')).toBeTruthy()
    expect(screen.getByText('Ver Documentação da Plataforma')).toBeTruthy()
  })

  it('a busca encontra a ação por sinônimo e sem acento — "exportar" e "acoes"', async () => {
    render(<TenantHarness sections={SECTIONS_WITH_DOCS} />)
    await openPalette()
    const input = screen.getByPlaceholderText(/Buscar página, hostname/)

    fireEvent.change(input, { target: { value: 'exportar' } })
    await waitFor(() => expect(screen.queryByText('Máquinas')).toBeNull())
    expect(screen.getByText('Baixar Relatório em PDF')).toBeTruthy()
    expect(screen.getByText('Baixar Relatório em CSV')).toBeTruthy()
    expect(screen.queryByText('Ver Documentação da Plataforma')).toBeNull()

    fireEvent.change(input, { target: { value: 'acoes' } })
    await waitFor(() => expect(screen.getByText('Ver Documentação da Plataforma')).toBeTruthy())
    expect(screen.getByText('Baixar Relatório em PDF')).toBeTruthy()
  })

  it('Enter na ação filtrada dispara o download pelo teclado', async () => {
    render(<TenantHarness />)
    await openPalette()
    const input = screen.getByPlaceholderText(/Buscar página, hostname/)

    fireEvent.change(input, { target: { value: 'csv' } })
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Baixar Relatório em CSV/ }).getAttribute('aria-selected')).toBe('true')
    )

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(downloadedHrefs).toEqual(['/api/tenant/acme/reports/csv']))
    await waitFor(() => expect(paletteIsOpen()).toBe(false))
  })

  it('as setas descem das rotas para as ações sem pular nem travar', async () => {
    render(<TenantHarness />)
    await openPalette()
    const input = screen.getByPlaceholderText(/Buscar página, hostname/)

    // "relatorio" casa a rota "Relatórios" E as duas ações de download.
    fireEvent.change(input, { target: { value: 'relatorio' } })
    const route = await screen.findByRole('option', { name: /^Relatórios/ })
    await waitFor(() => expect(route.getAttribute('aria-selected')).toBe('true'))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Baixar Relatório em PDF/ }).getAttribute('aria-selected')).toBe('true')
    )

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(downloadedHrefs).toEqual(['/api/tenant/acme/reports/pdf']))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
