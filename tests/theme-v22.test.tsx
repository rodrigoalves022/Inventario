// @vitest-environment jsdom
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useTheme } from 'next-themes'
import { ThemeProvider } from '@/components/theme-provider'

// Sprint V22: tema claro alternavel. Prova (1) que a escolha persiste,
// (2) que a paleta clara e' completa e passa WCAG AA, (3) que nenhum
// componente carrega cor literal fora de globals.css.

vi.mock('next/link', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }))
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

/** OKLCH -> luminancia relativa (WCAG), via OKLab -> sRGB linear. */
function luminance(value: string) {
  const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(value)
  if (!m) throw new Error(`token nao-oklch: ${value}`)
  const [L, C, H] = m.slice(1).map(Number)
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

describe('Sprint V22 — paleta clara em globals.css', () => {
  const light = tokens(block(':root'))
  const dark = tokens(block('.dark'))

  it(':root (claro) vem antes de .dark e color-scheme acompanha o tema', () => {
    expect(css.indexOf('\n:root {')).toBeLessThan(css.indexOf('\n.dark {'))
    expect(block(':root')).toMatch(/color-scheme: light;/)
    expect(block('.dark')).toMatch(/color-scheme: dark;/)
  })

  it('a paleta clara define TODOS os tokens do escuro, com valores proprios', () => {
    for (const name of Object.keys(dark)) expect(light[name], name).toBeDefined()
    expect(light['--background']).not.toBe(dark['--background'])
    expect(dark['--background']).toBe('oklch(0.14 0.004 285)') // carbono neutro desde a V23
  })

  it.each([
    ['--foreground', '--background'],
    ['--card-foreground', '--card'],
    ['--popover-foreground', '--popover'],
    ['--muted-foreground', '--card'],
    ['--muted-foreground', '--background'],
    ['--muted-foreground', '--muted'],
    ['--muted-foreground', '--accent'],
    ['--secondary-foreground', '--secondary'],
    ['--accent-foreground', '--accent'],
    ['--primary', '--card'],
    ['--primary-foreground', '--primary'],
    ['--success', '--card'],
    ['--success-foreground', '--success'],
    ['--warning', '--card'],
    ['--warning-foreground', '--warning'],
    ['--info', '--card'],
    ['--info-foreground', '--info'],
    ['--destructive', '--card'],
    ['--destructive-foreground', '--destructive-solid'],
    ['--sidebar-foreground', '--sidebar'],
    ['--muted-foreground', '--sidebar'],
    ['--sidebar-accent-foreground', '--sidebar-accent'],
  ])('tema claro: %s sobre %s >= 4.5:1', (fg, bg) => {
    expect(contrast(light[fg], light[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--input'])(
    'tema claro: %s sobre o card >= 3:1 (objeto grafico)',
    (name) => {
      expect(contrast(light[name], light['--card'])).toBeGreaterThanOrEqual(3)
    }
  )
})

describe('Sprint V22 — zero cor literal fora de globals.css', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return walk(path)
      return path.endsWith('.tsx') ? [path] : []
    })
  }

  it('nenhum hex/rgb/hsl literal em app/ e components/', () => {
    const offenders: string[] = []
    for (const file of [...walk('app'), ...walk('components')]) {
      const rel = file.replace(/\\/g, '/')
      if (rel.startsWith('app/admin/clients/') || rel === 'app/users/page.tsx') continue
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
          // seletores de atributo do recharts (`[stroke='#ccc']`) casam o default da lib, nao pintam
          const code = line.replace(/\[(stroke|fill)='#[0-9a-fA-F]+'\]/g, '')
          if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/.test(code)) offenders.push(`${rel}:${i + 1}`)
        })
    }
    expect(offenders).toEqual([])
  })
})

describe('Sprint V22 — persistencia da escolha de tema', () => {
  let api: ReturnType<typeof useTheme>

  function Probe() {
    api = useTheme()
    return null
  }

  function mount() {
    return render(
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <Probe />
      </ThemeProvider>
    )
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }))
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('sem escolha salva, o padrao e escuro', () => {
    mount()
    expect(api.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('a escolha vai para localStorage e sobrevive a uma nova montagem', () => {
    const first = mount()
    act(() => api.setTheme('light'))
    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    first.unmount()

    mount()
    expect(api.theme).toBe('light')
  })

  it('o menu oferece Claro / Escuro / Sistema', async () => {
    const { THEME_OPTIONS } = await import('@/components/sidebar')
    expect(THEME_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ['light', 'Tema claro'],
      ['dark', 'Tema escuro'],
      ['system', 'Usar do sistema'],
    ])
  })
})
