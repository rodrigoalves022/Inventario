// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShellBreadcrumbs } from '@/components/shell-breadcrumbs'

/**
 * Complemento de tests/shell-navigation.test.ts: la se prova que
 * `getBreadcrumbTrail` OMITE o href de "Clientes" para papeis sem acesso;
 * aqui se prova que um nivel sem href de fato nao vira um `<a>` clicavel na
 * tela. As duas metades juntas fecham o vazamento de RBAC pela navegacao.
 */
describe('ShellBreadcrumbs', () => {
  it('nível sem href é texto, nunca link', () => {
    render(
      <ShellBreadcrumbs
        trail={[{ label: 'Clientes' }, { label: 'Core TI Expert', href: '/app/core' }, { label: 'Máquinas' }]}
      />
    )

    expect(screen.getByText('Clientes').closest('a')).toBeNull()
  })

  it('nível com href vira link para a rota informada', () => {
    render(
      <ShellBreadcrumbs
        trail={[
          { label: 'Clientes', href: '/admin/clients' },
          { label: 'Core TI Expert', href: '/app/core' },
          { label: 'Máquinas' },
        ]}
      />
    )

    expect(screen.getByText('Clientes').closest('a')?.getAttribute('href')).toBe('/admin/clients')
    expect(screen.getByText('Core TI Expert').closest('a')?.getAttribute('href')).toBe('/app/core')
  })

  it('a página atual é marcada com aria-current e não é link', () => {
    render(
      <ShellBreadcrumbs
        trail={[{ label: 'Clientes', href: '/admin/clients' }, { label: 'Máquinas' }]}
      />
    )

    const current = screen.getByText('Máquinas')
    expect(current.getAttribute('aria-current')).toBe('page')
    expect(current.closest('a')).toBeNull()
  })

  it('não renderiza <li> dentro de <li> (HTML válido para navegação)', () => {
    const { container } = render(
      <ShellBreadcrumbs
        trail={[
          { label: 'Clientes', href: '/admin/clients' },
          { label: 'Core TI Expert', href: '/app/core' },
          { label: 'Todos os dispositivos', href: '/app/core/assets' },
          { label: 'Detalhe da máquina' },
        ]}
      />
    )

    expect(container.querySelector('li li')).toBeNull()
  })
})
