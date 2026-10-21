import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Sprint V17 — padronizacao visual do tenant (docs/PROJETO-PADRONIZACAO-VISUAL.md,
// secoes 3 e 4). Teste ESTRUTURAL sobre o fonte: as regras aqui sao de classe
// utilitaria (grid, recuo, cabecalho), que nao tem efeito observavel em jsdom
// — ele nao calcula layout. Ler o arquivo e' o jeito barato e deterministico de
// impedir que uma tela volte a divergir.

const ROOT = join(__dirname, '..')
const TENANT_DIR = join(ROOT, 'app', 'app', '[clientSlug]')

function walk(dir: string, name: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full, name)
    return entry === name ? [full] : []
  })
}

const read = (file: string) => readFileSync(file, 'utf8')
const rel = (file: string) => relative(ROOT, file).replace(/\\/g, '/')

const TENANT_PAGES = walk(TENANT_DIR, 'page.tsx')
const TENANT_LOADINGS = walk(TENANT_DIR, 'loading.tsx')
const TENANT_COMPONENTS = [
  'components/tenant-computers-table.tsx',
  'components/tenant-storage-table.tsx',
  'components/tenant-processors-table.tsx',
  'components/tenant-servers-table.tsx',
].map((file) => join(ROOT, file))

const PAGE_HEADER_CLASS = 'flex flex-wrap items-start justify-between gap-4'
const KPI_GRID_4 = 'grid gap-4 md:grid-cols-2 lg:grid-cols-4'
const KPI_GRID_3 = 'grid gap-4 md:grid-cols-3'
/**
 * Sprint V18: a Visao Geral divide os 5 KPIs em 3 (faixa de acao) + 2 (faixa
 * de retrato do parque). A fileira de 2 so e' valida ali — em qualquer outra
 * tela continua valendo a regra de 3 ou 4.
 */
const KPI_GRID_2 = 'grid gap-4 md:grid-cols-2'
const KPI_GRID_2_ALLOWED = ['app/app/[clientSlug]/page.tsx']

/**
 * Fileiras de 5 KPI que ainda existem e AGUARDAM DECISAO do usuario sobre qual
 * card sai (o prompt da Sprint 17 proibe remover card sem aprovacao explicita —
 * ver a proposta registrada em docs/SPRINTS.md, Sprint V17). Quando a decisao
 * for tomada, o arquivo sai desta lista e passa a ser cobrado pela regra.
 */
const KPI_ROWS_PENDING_APPROVAL = [
  // A Visao Geral saiu da lista na Sprint V18 (duas faixas, 3 + 2).
  'components/tenant-computers-table.tsx',
  // Os esqueletos acompanham a tela real ate a decisao (entrega 5).
  'app/app/[clientSlug]/computers/loading.tsx',
  'app/app/[clientSlug]/assets/loading.tsx',
]

describe('V17 — cabecalho de pagina unico', () => {
  it.each(TENANT_PAGES.map((file) => [rel(file), file]))('%s: h1 dentro do cabecalho padrao', (_, file) => {
    const source = read(file)
    const h1s = Array.from(source.matchAll(/<h1 className="([^"]*)"/g))
    expect(h1s.length).toBeGreaterThan(0)

    for (const match of h1s) {
      expect(match[1]).toBe('text-2xl font-bold text-foreground')
      // O cabecalho envolve o h1 a poucas linhas de distancia — o detalhe do
      // ativo aninha um nivel a mais (badge de status ao lado do hostname).
      const before = source.slice(Math.max(0, (match.index ?? 0) - 320), match.index)
      expect(before).toContain(`className="${PAGE_HEADER_CLASS}"`)
    }
  })

  it.each(TENANT_PAGES.map((file) => [rel(file), file]))('%s: subtitulo herda a escala do body', (_, file) => {
    // /audit era a unica com `text-sm` no subtitulo.
    expect(read(file)).not.toMatch(/<\/h1>\s*<p className="[^"]*text-sm/)
  })
})

describe('V17 — regra unica de grid de KPI (3 ou 4, nunca 5)', () => {
  const files = [...TENANT_PAGES, ...TENANT_COMPONENTS, ...TENANT_LOADINGS]

  it.each(files.map((file) => [rel(file), file]))('%s: fileira de KPI usa uma das duas grids', (name, file) => {
    if (KPI_ROWS_PENDING_APPROVAL.includes(name)) return
    const source = read(file)
    expect(source).not.toMatch(/grid-cols-5/)

    // Toda grid cujo primeiro filho e' um KpiCard e' uma fileira de KPI.
    const rows = Array.from(source.matchAll(/<div className="(grid [^"]*)">\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?<KpiCard/g))
    for (const [, className] of rows) {
      const allowed = KPI_GRID_2_ALLOWED.includes(name) ? [KPI_GRID_4, KPI_GRID_3, KPI_GRID_2] : [KPI_GRID_4, KPI_GRID_3]
      expect(allowed).toContain(className)
    }
  })

  it('as excecoes pendentes ainda sao as unicas fileiras de 5 (a lista nao apodrece)', () => {
    const offenders = files.filter((file) => /grid-cols-5/.test(read(file))).map(rel)
    for (const offender of offenders) {
      expect(KPI_ROWS_PENDING_APPROVAL).toContain(offender)
    }
  })
})

describe('V17 — recuo horizontal unico de 20px', () => {
  it.each([...TENANT_PAGES, ...TENANT_LOADINGS].map((file) => [rel(file), file]))(
    '%s: nenhuma superficie-card com recuo de 24px',
    (_, file) => {
      const source = read(file)
      expect(source).not.toMatch(/rounded-xl border[^"]*\bp-6\b/)
      // Botao nao e' superficie-card: o `px-6` do submit de /audit e' do controle.
      const offending = source.split('\n').filter((line) => /\bpx-6\b/.test(line) && !line.includes('<Button'))
      expect(offending).toEqual([])
    }
  )
})

describe('V17 — defeitos pontuais', () => {
  it('/servers nao tem div vazio que dobra o espacamento do space-y-6', () => {
    const source = read(join(TENANT_DIR, 'servers', 'page.tsx'))
    expect(source).not.toMatch(/<div[^>]*>\s*\{\/\*[^}]*\*\/\}\s*<\/div>/)
  })

  it('/audit: cabecalho quebra linha em vez de comprimir o titulo', () => {
    const source = read(join(TENANT_DIR, 'audit', 'page.tsx'))
    expect(source).not.toContain('<div className="flex items-center justify-between">')
  })
})

describe('V17 — esqueletos com a forma real', () => {
  const loading = (route: string) => read(join(TENANT_DIR, route, 'loading.tsx'))

  it.each(['storage', 'processors'])('/%s: fileira de 4 KPI + tabela, como a pagina', (route) => {
    const source = loading(route)
    expect(source).toContain(`className="${KPI_GRID_4}"`)
    expect(source).toContain('<KpiCardSkeleton')
    expect(source).toContain('<TableSkeleton')
  })

  it('/reports: mesma grid de KPI da pagina (md:, nao sm:) e paineis com recuo de 20px', () => {
    const source = loading('reports')
    expect(source).toContain(`className="${KPI_GRID_4}"`)
    expect(source).not.toContain('sm:grid-cols-2')
    expect(source).toContain('<PanelSkeleton')
  })

  it('Visao Geral: grafico reserva 180px como o real (nao 224px)', () => {
    const source = loading('.')
    expect(source).not.toContain('h-56')
    expect(source).toContain('h-[180px]')
  })
})
