// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatsGrid } from '@/components/stat-cards'

/**
 * Correcao de UX: o card "Total de Máquinas" somava servidores + computadores
 * num unico numero mas so linkava para /computers (que exclui servidores por
 * definicao — lib/device-classification.ts). Agora mostra os dois totais
 * separados, cada um com seu proprio link.
 */
describe('StatsGrid — card "Total de Máquinas" mostra computadores e servidores separados', () => {
  it('cada metade do texto e um link para a listagem correta', () => {
    render(
      <StatsGrid
        total={12}
        computers={9}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
        computersPath="/tenant/cliente-a/computers"
        serversPath="/tenant/cliente-a/servers"
      />
    )

    const computersLink = screen.getByText('9 Computadores').closest('a')
    const serversLink = screen.getByText('3 Servidores').closest('a')

    expect(computersLink?.getAttribute('href')).toBe('/tenant/cliente-a/computers')
    expect(serversLink?.getAttribute('href')).toBe('/tenant/cliente-a/servers')
  })

  it('sem computersPath/serversPath os totais ainda aparecem, so sem virar link (nao quebra)', () => {
    render(
      <StatsGrid
        total={12}
        computers={9}
        win10={5}
        win11={4}
        server={3}
        online={10}
        offline={1}
        warning={1}
      />
    )

    expect(screen.getByText('9 Computadores')).toBeTruthy()
    expect(screen.getByText('3 Servidores')).toBeTruthy()
  })
})
