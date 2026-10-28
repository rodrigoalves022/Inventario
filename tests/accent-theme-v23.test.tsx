// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Monitor } from 'lucide-react'
import { ThemeProvider } from '@/components/theme-provider'
import { ACCENT_OPTIONS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT, Sidebar } from '@/components/sidebar'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'

// Sprint V23: fundo Carbon/Obsidian neutro, seletor de 6 cores de destaque
// na sidebar e alinhamento h-full de KpiCard/Panel.

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/clients', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/app/account/actions', () => ({
  updateProfileNameAction: vi.fn(),
  updateEmailAction: vi.fn(),
  changePasswordAction: vi.fn(),
  updateAccountProfileDetailsAction: vi.fn(),
  updateAccountPreferencesAction: vi.fn(),
  getAccountOverviewAction: vi.fn(async () => null),
}))

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function block(selector: string) {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, selector).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

function tokens(body: string) {
  return Object.fromEntries([...body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]))
}

function oklch(value: string) {
  const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value)
  if (!m) throw new Error(`token nao-oklch: ${value}`)
  return m.slice(1).map(Number) as [number, number, number]
}

/** OKLCH -> luminancia relativa (WCAG), via OKLab -> sRGB linear. */
function luminance(value: string) {
  const [L, C, H] = oklch(value)
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (x: number) => Math.min(1, Math.max(0, x))
  const r = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s)
  const g = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s)
  const bl = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s)
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl
}

function contrast(fg: string, bg: string) {
  const [x, y] = [luminance(fg), luminance(bg)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const ACCENTS = ['orange', 'blue', 'emerald', 'pink', 'violet', 'mono'] as const
const RECALIBRATED = ['--primary', '--ring', '--sidebar-primary', '--chart-1']

describe('Sprint V23 — fundo .dark Carbon/Obsidian neutro', () => {
  const dark = tokens(block('.dark'))

  it.each([
    '--background',
    '--card',
    '--popover',
    '--sidebar',
    '--surface-raise',
    '--secondary',
    '--muted',
    '--surface-line',
    '--border',
    '--sidebar-border',
  ])('%s tem croma <= 0.006', (name) => {
    expect(oklch(dark[name])[1], name).toBeLessThanOrEqual(0.006)
  })

  it('usa os degraus da referencia', () => {
    expect(dark['--background']).toBe('oklch(0.14 0.004 285)')
    expect(dark['--card']).toBe('oklch(0.175 0.005 285)')
    expect(dark['--sidebar']).toBe('oklch(0.175 0.005 285)')
    expect(dark['--surface-raise']).toBe('oklch(0.205 0.005 285)')
    expect(dark['--border']).toBe('oklch(0.245 0.006 285)')
    expect(dark['--surface-line-strong']).toBe('oklch(0.32 0.008 285)')
  })

  it('laranja e o padrao sem data-accent, nos dois temas', () => {
    expect(dark['--primary']).toBe('oklch(0.7 0.19 45)')
    expect(tokens(block(':root'))['--primary']).toBe('oklch(0.55 0.19 45)')
  })
})

describe('Sprint V23 — 6 variantes de cor de destaque', () => {
  const light = tokens(block(':root'))
  const dark = tokens(block('.dark'))

  it.each(ACCENTS)('%s recalibra primary/ring/sidebar-primary/chart-1 no claro e no escuro', (accent) => {
    const l = tokens(block(`:root[data-accent='${accent}']`))
    const d = tokens(block(`:root.dark[data-accent='${accent}']`))
    for (const name of RECALIBRATED) {
      expect(l[name], `${accent} claro ${name}`).toBe(l['--primary'])
      expect(d[name], `${accent} escuro ${name}`).toBe(d['--primary'])
    }
  })

  it.each(ACCENTS)('%s passa WCAG AA nos dois temas', (accent) => {
    const l = tokens(block(`:root[data-accent='${accent}']`))
    const d = tokens(block(`:root.dark[data-accent='${accent}']`))
    expect(contrast(l['--primary'], light['--card'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(l['--primary'], light['--sidebar'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(l['--primary-foreground'], l['--primary'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(d['--primary'], dark['--card'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(d['--primary-foreground'], d['--primary'])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('Sprint V23 — seletor de cor no rodape da sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.accent
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }))
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function mount() {
    return render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <Sidebar user={{ name: 'Ana', email: 'ana@x.local', role: 'ORG_ADMIN' }} />
      </ThemeProvider>
    )
  }

  it('oferece os 6 swatches com rotulo acessivel, laranja ativo por padrao', () => {
    expect(ACCENT_STORAGE_KEY).toBe('inventario-accent')
    expect(DEFAULT_ACCENT).toBe('orange')
    expect(ACCENT_OPTIONS.map((o) => o.value)).toEqual([...ACCENTS])
    mount()
    const swatches = screen.getAllByRole('radio')
    expect(swatches).toHaveLength(6)
    for (const label of ['Cor Laranja', 'Cor Azul', 'Cor Esmeralda', 'Cor Rosa', 'Cor Violeta', 'Cor Prata']) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy()
    }
    const orange = screen.getByRole('radio', { name: 'Cor Laranja' })
    expect(orange.getAttribute('aria-checked')).toBe('true')
    expect(orange.className).toContain('ring-foreground')
    expect(orange.className).toContain('rounded-full')
  })

  it('clicar num swatch aplica data-accent e persiste em localStorage', () => {
    mount()
    fireEvent.click(screen.getByRole('radio', { name: 'Cor Violeta' }))
    expect(document.documentElement.dataset.accent).toBe('violet')
    expect(localStorage.getItem('inventario-accent')).toBe('violet')
    expect(screen.getByRole('radio', { name: 'Cor Violeta' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Cor Laranja' }).getAttribute('aria-checked')).toBe('false')
  })

  it('o botao de tema alterna direto entre claro e escuro', () => {
    mount()
    const toggle = screen.getByRole('button', { name: 'Tema claro' })
    fireEvent.click(toggle)
    expect(localStorage.getItem('theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Tema escuro' })).toBeTruthy()
  })

  it('o script de boot do layout le a mesma chave e cai no laranja', () => {
    const layout = readFileSync(join(process.cwd(), 'app/layout.tsx'), 'utf8')
    expect(layout).toContain("localStorage.getItem('inventario-accent')")
    expect(layout).toMatch(/:'orange'/)
  })
})

describe('Sprint V23 — alinhamento bento em KpiCard e Panel', () => {
  afterEach(cleanup)

  it('KpiCard ocupa h-full em coluna e destaca o ativo na cor primaria', () => {
    render(<KpiCard testId="k" label="Online" value={3} subtitle="ctx" icon={<Monitor />} active />)
    const root = screen.getByTestId('k-value').closest('[data-kpi-top]')!.parentElement!
    expect(root.className).toMatch(/\bh-full\b/)
    expect(root.className).toMatch(/\bflex-col\b/)
    expect(root.className).toContain('justify-between')
    expect(root.className).toContain('border-primary')
    expect(root.className).toContain('shadow-[0_0_24px_-8px_var(--primary)]')
    expect(screen.getByTestId('k-value').className).toContain('text-2xl')
  })

  it('Panel e h-full flex-col, PanelBody e flex-1 e o icone vai em badge quadrado', () => {
    const { container } = render(
      <Panel>
        <PanelHeader title="Alertas" icon={<Monitor />} />
        <PanelBody>vazio</PanelBody>
      </Panel>
    )
    const section = container.querySelector('section')!
    expect(section.className).toMatch(/\bh-full\b/)
    expect(section.className).toMatch(/\bflex-col\b/)
    expect(screen.getByText('vazio').className).toMatch(/\bflex-1\b/)
    const badge = container.querySelector('[data-panel-icon]')!
    for (const cls of ['h-8', 'w-8', 'rounded-lg', 'bg-primary/10', 'border-primary/20', 'text-primary']) {
      expect(badge.className).toContain(cls)
    }
  })
})
