// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AgentInstallPackage } from '@/components/agent-install-package'
import type { ProvisioningPackage } from '@/app/admin/clients/types'

// Sprint A4, item 13 (RF032; F4 + ressalvas 1 e 8). O pacote de instalacao
// oferece Windows e Linux num seletor com semantica de tablist; cada aba mostra
// so os seus comandos; o badge do SHA-256 do binario publicado explica que o
// arquivo do botao (com a configuracao embutida) tem outro hash; sem binario
// publicado, a plataforma nao oferece download nem comando de uma linha.

const WINDOWS_HASH = 'a1'.repeat(32)
const LINUX_HASH = 'b2'.repeat(32)

function buildPkg(overrides: Partial<ProvisioningPackage> = {}): ProvisioningPackage {
  return {
    clientId: 'client-1',
    clientName: 'Teste A0 Rotação',
    clientSlug: 'teste-a0-rotacao',
    enrollmentKey: 'CHAVE-123',
    bootstrapUrl: 'https://inv.example.com/api/agent/bootstrap?client=teste-a0-rotacao&key=CHAVE-123',
    bootstrapCommand: 'powershell -c "irm bootstrap | iex"',
    installCommand: 'inventario-agent.exe install -server "https://inv.example.com"',
    linuxBootstrapUrl: 'https://inv.example.com/api/agent/bootstrap-linux?client=teste-a0-rotacao&key=CHAVE-123',
    linuxBootstrapCommand: "curl -fsSL 'https://inv.example.com/api/agent/bootstrap-linux?client=teste-a0-rotacao&key=CHAVE-123' | sudo bash",
    linuxInstallCommand: 'sudo install -m 755 ./inventario-agent-teste-a0-rotacao /usr/local/bin/inventario-agent && sudo /usr/local/bin/inventario-agent install',
    windowsSha256: WINDOWS_HASH,
    linuxSha256: LINUX_HASH,
    ...overrides,
  }
}

function openAlternatives() {
  fireEvent.click(screen.getByRole('button', { name: 'Outras formas de instalar' }))
}

describe('AgentInstallPackage — seletor de plataforma (tablist)', () => {
  it('tablist com duas abas; Windows selecionada por padrao, um so tabIndex=0', () => {
    render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh={false} />)

    const tablist = screen.getByRole('tablist')
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Windows', 'Linux'])
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[1].getAttribute('aria-selected')).toBe('false')
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
    expect(tabs[0].tabIndex).toBe(0)
    expect(tabs[1].tabIndex).toBe(-1)

    const panel = screen.getByRole('tabpanel')
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id)
    expect(tabs[0].getAttribute('aria-controls')).toBe(panel.id)
  })

  it('clique alterna para Linux', () => {
    render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))

    expect(screen.getByRole('tab', { name: 'Linux' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Windows' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByRole('link', { name: /Baixar binário para Linux \(amd64\)/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Windows/ })).toBeNull()
  })

  it('teclado: setas, Home e End movem selecao e foco', () => {
    render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh={false} />)
    const windows = screen.getByRole('tab', { name: 'Windows' })
    const linux = screen.getByRole('tab', { name: 'Linux' })

    windows.focus()
    fireEvent.keyDown(windows, { key: 'ArrowRight' })
    expect(linux.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(linux)
    expect(linux.tabIndex).toBe(0)
    expect(windows.tabIndex).toBe(-1)

    fireEvent.keyDown(linux, { key: 'ArrowRight' })
    expect(windows.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(windows)

    fireEvent.keyDown(windows, { key: 'ArrowLeft' })
    expect(linux.getAttribute('aria-selected')).toBe('true')

    fireEvent.keyDown(linux, { key: 'Home' })
    expect(windows.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(windows)

    fireEvent.keyDown(windows, { key: 'End' })
    expect(linux.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(linux)
  })
})

describe('AgentInstallPackage — cada aba mostra so os seus comandos', () => {
  it('Windows: botao (.exe), PowerShell de uma linha e instalacao manual cmd.exe', () => {
    const pkg = buildPkg()
    render(<AgentInstallPackage pkg={pkg} keyIsFresh={false} />)

    const download = screen.getByRole('link', { name: /Baixar instalador para Windows \(\.exe\)/ })
    expect(download.getAttribute('href')).toBe('/api/agent/download-exe?client=teste-a0-rotacao&key=CHAVE-123')

    openAlternatives()
    const text = document.body.textContent ?? ''
    expect(text).toContain(pkg.bootstrapCommand)
    expect(text).toContain(pkg.installCommand)
    expect(text).not.toContain(pkg.linuxBootstrapCommand)
    expect(text).not.toContain(pkg.linuxInstallCommand)
  })

  it('Linux: botao amd64, curl | sudo bash e comando manual com nota de chmod +x e sudo', () => {
    const pkg = buildPkg()
    render(<AgentInstallPackage pkg={pkg} keyIsFresh={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))

    const download = screen.getByRole('link', { name: /Baixar binário para Linux \(amd64\)/ })
    expect(download.getAttribute('href')).toBe('/api/agent/download-linux?client=teste-a0-rotacao&key=CHAVE-123')

    openAlternatives()
    const text = document.body.textContent ?? ''
    expect(text).toContain(pkg.linuxBootstrapCommand)
    expect(text).toContain(pkg.linuxInstallCommand)
    expect(text).toMatch(/chmod \+x/)
    expect(text).toMatch(/sudo/)
    expect(text).not.toContain(pkg.bootstrapCommand)
    expect(text).not.toContain(pkg.installCommand)
  })
})

describe('AgentInstallPackage — badge do SHA-256 (ressalva 1)', () => {
  it.each<[string, string, string | null]>([
    ['Windows', WINDOWS_HASH, null],
    ['Linux', LINUX_HASH, 'Linux'],
  ])('%s: rotulo, nota sobre o arquivo do botao e title com o hash inteiro', (_label, hash, tabToOpen) => {
    render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh={false} />)
    if (tabToOpen) fireEvent.click(screen.getByRole('tab', { name: tabToOpen }))

    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toContain('SHA-256 do binário publicado (sem configuração)')
    expect(panel.textContent).toMatch(/arquivo do botão inclui a configuração/i)
    expect(panel.textContent).toMatch(/script de uma linha/i)

    const value = within(panel).getByTitle(hash)
    expect(value.className).toContain('data-mono')
    expect(value.className).toContain('truncate')
  })

  it('hash null: "binário não publicado", sem botao de download e sem comando de uma linha daquela plataforma', () => {
    const pkg = buildPkg({ linuxSha256: null })
    render(<AgentInstallPackage pkg={pkg} keyIsFresh={false} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))

    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toMatch(/binário não publicado/i)
    expect(within(panel).queryByRole('link')).toBeNull()

    openAlternatives()
    expect(document.body.textContent).not.toContain(pkg.linuxBootstrapCommand)
  })

  it('hash null so numa plataforma nao afeta a outra', () => {
    const pkg = buildPkg({ windowsSha256: null })
    render(<AgentInstallPackage pkg={pkg} keyIsFresh={false} />)

    expect(screen.queryByRole('link', { name: /Windows/ })).toBeNull()
    expect(screen.getByRole('tabpanel').textContent).toMatch(/binário não publicado/i)
    openAlternatives()
    expect(document.body.textContent).not.toContain(pkg.bootstrapCommand)

    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))
    expect(screen.getByRole('link', { name: /Baixar binário para Linux \(amd64\)/ })).toBeTruthy()
    expect(document.body.textContent).toContain(pkg.linuxBootstrapCommand)
  })
})

describe('AgentInstallPackage — caixa da chave identica nas duas abas', () => {
  it('a chave aparece com o mesmo rotulo e aviso em Windows e Linux', () => {
    render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh />)
    expect(screen.getByText('Chave de instalação: trate como senha')).toBeTruthy()
    expect(screen.getByText('CHAVE-123')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))
    expect(screen.getByText('Chave de instalação: trate como senha')).toBeTruthy()
    expect(screen.getByText('CHAVE-123')).toBeTruthy()
  })
})

// Achados 1 e 3 do visual-qa na Sprint A4: dentro do DialogContent (grid) a
// raiz do componente herdava min-width:auto e as strings longas (hash, chave,
// comandos) alargavam o dialogo alem da tela em 390 px; e o botao "Outras
// formas de instalar" nao expunha o estado aberto/fechado.
describe('AgentInstallPackage — largura minima e estado do botao de alternativas', () => {
  it('a raiz tem min-w-0 para nao alargar um container grid', () => {
    const { container } = render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh />)
    expect((container.firstElementChild as HTMLElement).className).toMatch(/(^|\s)min-w-0(\s|$)/)
  })

  it('"Outras formas de instalar" expoe aria-expanded e aria-controls apontando para a secao', () => {
    render(<AgentInstallPackage pkg={buildPkg()} keyIsFresh />)
    const toggle = screen.getByRole('button', { name: 'Outras formas de instalar' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const controls = toggle.getAttribute('aria-controls')
    expect(controls).toBeTruthy()

    fireEvent.click(toggle)

    const opened = screen.getByRole('button', { name: 'Ocultar' })
    expect(opened.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(controls as string)).not.toBeNull()
  })
})
