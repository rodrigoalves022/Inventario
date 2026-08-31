// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsGrid } from '@/components/stat-cards'

/**
 * Correcao de UX: o card "Total de Máquinas" mostrava dois numeros empilhados
 * ("N Computadores · M Servidores"), cada um com seu proprio link — usuario
 * rejeitou explicitamente essa versao ("nao e para manter dois nomes assim
 * ali dentro"). O card volta a ser simples: um unico numero (todos os
 * dispositivos, computadores + servidores) com um unico link, agora para a
 * rota unificada `/assets` (Opcao B escolhida pelo usuario) em vez de
 * `/computers`, que excluia servidores por definicao.
 */
describe('StatsGrid — card "Total de Máquinas" é um link único para a listagem unificada', () => {
  it('mostra o total combinado de dispositivos como um único número', () => {
    render(
      <StatsGrid
        total={12}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
        assetsPath="/app/cliente-a/assets"
        computersPath="/app/cliente-a/computers"
        serversPath="/app/cliente-a/servers"
      />
    )

    expect(screen.getByText('12')).toBeTruthy()
    // O card "Total de Máquinas" não mostra mais dois números empilhados —
    // "Servidores" ainda aparece no grid, mas só como título do card dedicado
    // (verificado abaixo, no teste "links próprios"), não dentro deste card.
    expect(screen.queryByText(/\d+ Computadores?/)).toBeNull()
    expect(screen.queryByText(/\d+ Servidores?/)).toBeNull()
  })

  it('o card inteiro é um único <a> apontando para assetsPath', () => {
    render(
      <StatsGrid
        total={12}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
        assetsPath="/app/cliente-a/assets"
        computersPath="/app/cliente-a/computers"
        serversPath="/app/cliente-a/servers"
      />
    )

    const link = screen.getByText('Total de Máquinas').closest('a')
    expect(link?.getAttribute('href')).toBe('/app/cliente-a/assets')
  })

  it('sem <a> aninhado dentro de outro <a> no DOM renderizado', () => {
    const { container } = render(
      <StatsGrid
        total={12}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
        assetsPath="/app/cliente-a/assets"
        computersPath="/app/cliente-a/computers"
        serversPath="/app/cliente-a/servers"
      />
    )

    expect(container.querySelectorAll('a a').length).toBe(0)
  })

  it('sem assetsPath, o card não vira link (não quebra)', () => {
    render(
      <StatsGrid
        total={12}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
      />
    )

    expect(screen.getByText('Total de Máquinas')).toBeTruthy()
    expect(screen.getByText('Total de Máquinas').closest('a')).toBeNull()
  })

  it('os outros cards do grid continuam com seus próprios links (computers/servers)', () => {
    render(
      <StatsGrid
        total={12}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
        assetsPath="/app/cliente-a/assets"
        computersPath="/app/cliente-a/computers"
        serversPath="/app/cliente-a/servers"
      />
    )

    const serversLink = screen.getByText('Servidores').closest('a')
    expect(serversLink?.getAttribute('href')).toBe('/app/cliente-a/servers')
  })
})
