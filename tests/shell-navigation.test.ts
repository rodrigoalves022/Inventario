import { describe, expect, it } from 'vitest'
import { getPermissionUser, type AppRole } from '@/lib/permissions'
import {
  buildShellNavigation,
  canAccessClientList,
  getBreadcrumbTrail,
  getShellPageTitle,
} from '@/lib/shell-navigation'

const TENANT = { name: 'Core TI Expert', slug: 'core-ti-expert' }
const BASE = '/app/core-ti-expert'

function userWithRole(role: AppRole | null) {
  return getPermissionUser({ role })
}

/**
 * Overhaul visual, Fase 2. A trilha do header (`Clientes > Cliente > Página`)
 * comeca num nivel que NAO e publico: /admin/clients e area de
 * PLATFORM_ADMIN / ORG_ADMIN. Renderizar esse nivel como link para um
 * ORG_OPERATOR seria RBAC vazando pela navegacao — o usuario clica e recebe
 * 403. Estes testes travam o comportamento por papel.
 */
describe('getBreadcrumbTrail — o nível "Clientes" respeita o papel', () => {
  it.each<[AppRole, boolean]>([
    ['PLATFORM_ADMIN', true],
    ['ORG_ADMIN', true],
    ['ORG_OPERATOR', false],
    ['CLIENT_VIEWER', false],
  ])('%s: link para /admin/clients = %s', (role, expectsLink) => {
    const trail = getBreadcrumbTrail(`${BASE}/computers`, TENANT, {
      canAccessClientList: canAccessClientList(userWithRole(role)),
    })

    expect(trail[0].label).toBe('Clientes')
    expect(trail[0].href).toBe(expectsLink ? '/admin/clients' : undefined)
  })

  it('papel desconhecido não recebe o link (fail-closed)', () => {
    const trail = getBreadcrumbTrail(`${BASE}/computers`, TENANT, {
      canAccessClientList: canAccessClientList(userWithRole(null)),
    })
    expect(trail[0].href).toBeUndefined()
  })

  it('sem a opção, o nível "Clientes" é texto — nunca link por omissão', () => {
    const trail = getBreadcrumbTrail(`${BASE}/computers`, TENANT)
    expect(trail[0].href).toBeUndefined()
  })
})

describe('getBreadcrumbTrail — trilha do tenant', () => {
  it('raiz do tenant termina em "Visão geral"', () => {
    expect(getBreadcrumbTrail(BASE, TENANT).map((crumb) => crumb.label)).toEqual([
      'Clientes',
      'Core TI Expert',
      'Visão geral',
    ])
  })

  it('o nível do cliente sempre aponta para a raiz do tenant', () => {
    const trail = getBreadcrumbTrail(`${BASE}/storage`, TENANT)
    expect(trail[1]).toEqual({ label: 'Core TI Expert', href: BASE })
  })

  it('a página atual é o último nível e não tem href', () => {
    const trail = getBreadcrumbTrail(`${BASE}/storage`, TENANT)
    const current = trail[trail.length - 1]
    expect(current.label).toBe('Armazenamento')
    expect(current.href).toBeUndefined()
  })

  it('detalhe de dispositivo ganha um quarto nível, com a listagem clicável', () => {
    const trail = getBreadcrumbTrail(`${BASE}/assets/abc123`, TENANT)
    expect(trail.map((crumb) => crumb.label)).toEqual([
      'Clientes',
      'Core TI Expert',
      'Todos os dispositivos',
      'Detalhe da máquina',
    ])
    expect(trail[2].href).toBe(`${BASE}/assets`)
  })

  it('rota desconhecida não inventa rótulo a partir do slug da URL', () => {
    const trail = getBreadcrumbTrail(`${BASE}/rota-que-nao-existe`, TENANT)
    expect(trail[trail.length - 1].label).toBe('Visão geral')
  })
})

describe('getBreadcrumbTrail — telas sem tenant', () => {
  it.each([
    ['/admin/clients', ['Clientes']],
    ['/admin/clients/novo', ['Clientes', 'Novo cliente']],
    ['/admin/clients/audit', ['Clientes', 'Auditoria global']],
    ['/users', ['Usuários']],
    ['/security', ['Segurança']],
    ['/account', ['Minha conta']],
    ['/docs', ['Documentação']],
  ])('%s -> %s', (pathname, labels) => {
    expect(getBreadcrumbTrail(pathname, undefined).map((crumb) => crumb.label)).toEqual(labels)
  })
})

/**
 * O motivo de `lib/shell-navigation.ts` existir: antes, o nome de cada rota
 * estava escrito DUAS vezes dentro de `components/sidebar.tsx` — uma no menu,
 * outra na tabela de titulos do header. Este teste falha se alguem
 * reintroduzir a divergencia.
 */
describe('menu e trilha saem do mesmo mapa de rotas', () => {
  it('o título da página bate com o nome do item de menu correspondente', () => {
    const sections = buildShellNavigation(TENANT, userWithRole('ORG_ADMIN'))
    const items = sections.flatMap((section) => section.items)
    expect(items.length).toBeGreaterThan(0)

    for (const item of items) {
      if (!item.href.startsWith(BASE)) continue
      expect(getShellPageTitle(item.href, TENANT)).toBe(item.name)
    }
  })
})

describe('buildShellNavigation — o menu é filtrado pelo papel', () => {
  function hrefsFor(role: AppRole | null) {
    return buildShellNavigation(TENANT, userWithRole(role)).flatMap((section) =>
      section.items.map((item) => item.href)
    )
  }

  it('PLATFORM_ADMIN vê gestão, auditoria do tenant e a área de conta', () => {
    const hrefs = hrefsFor('PLATFORM_ADMIN')
    expect(hrefs).toContain(`${BASE}/reports`)
    expect(hrefs).toContain(`${BASE}/audit`)
    expect(hrefs).toContain('/admin/clients')
    expect(hrefs).toContain('/users')
  })

  it('ORG_ADMIN vê a área de conta, mas não as telas exclusivas da plataforma', () => {
    const hrefs = hrefsFor('ORG_ADMIN')
    expect(hrefs).toContain('/admin/clients')
    expect(hrefs).not.toContain('/users')
    expect(hrefs).not.toContain('/security')
    expect(hrefs).not.toContain('/admin/clients/audit')
  })

  it('ORG_OPERATOR vê gestão, mas não auditoria do tenant nem área de conta', () => {
    const hrefs = hrefsFor('ORG_OPERATOR')
    expect(hrefs).toContain(`${BASE}/reports`)
    expect(hrefs).toContain(`${BASE}/settings`)
    expect(hrefs).not.toContain(`${BASE}/audit`)
    expect(hrefs).not.toContain('/admin/clients')
  })

  it('CLIENT_VIEWER só vê o inventário — nenhuma rota de gestão ou conta', () => {
    const hrefs = hrefsFor('CLIENT_VIEWER')
    expect(hrefs).toContain(`${BASE}/computers`)
    expect(hrefs).not.toContain(`${BASE}/reports`)
    expect(hrefs).not.toContain(`${BASE}/audit`)
    expect(hrefs).not.toContain('/admin/clients')
  })

  it('papel desconhecido não recebe nenhuma rota administrativa (fail-closed)', () => {
    const hrefs = hrefsFor(null)
    expect(hrefs).not.toContain('/admin/clients')
    expect(hrefs).not.toContain('/users')
    expect(hrefs).not.toContain(`${BASE}/reports`)
  })

  it('a listagem unificada /assets fica fora do menu, mesmo tendo rótulo na trilha', () => {
    expect(hrefsFor('PLATFORM_ADMIN')).not.toContain(`${BASE}/assets`)
    expect(getShellPageTitle(`${BASE}/assets`, TENANT)).toBe('Todos os dispositivos')
  })
})
