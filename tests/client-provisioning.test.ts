// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { AgentInstallPackage } from '@/components/agent-install-package'
import type { ProvisioningPackage } from '@/app/admin/clients/types'
import { buildProvisioningArtifacts, buildWindowsStartupScript, ProvisioningInputError } from '@/lib/provisioning'
import {
  MALICIOUS_FRAGMENTS,
  MALICIOUS_SERVER_URLS,
  maliciousClient,
  maliciousKey,
  REAL_KEY,
  REAL_SLUG,
  SERVER_URL,
} from './provisioning-payloads'

// Sprint A63. "Outras formas de instalar" ganha, no Windows, um script de
// inicializacao (.bat/.cmd) idempotente para GPO de computador e, no Linux,
// os comandos para conferir o servico systemd e acompanhar o log.

const GPO_LABEL = 'Script de Inicialização / GPO (.bat / .cmd)'

function buildPkg(overrides: Partial<ProvisioningPackage> = {}): ProvisioningPackage {
  return {
    clientId: 'client-1',
    clientName: 'Core TI Expert',
    clientSlug: REAL_SLUG,
    enrollmentKey: REAL_KEY,
    ...buildProvisioningArtifacts(SERVER_URL, REAL_SLUG, REAL_KEY),
    windowsSha256: 'a1'.repeat(32),
    linuxSha256: 'b2'.repeat(32),
    ...overrides,
  }
}

function renderPackage(pkg: ProvisioningPackage = buildPkg()) {
  return render(createElement(AgentInstallPackage, { pkg, keyIsFresh: false }))
}

function openAlternatives() {
  fireEvent.click(screen.getByRole('button', { name: 'Outras formas de instalar' }))
}

// O valor do CopyField e' o <code> irmao do rotulo.
function copyFieldValue(label: string) {
  const field = screen.getByText(label).parentElement as HTMLElement
  return field.querySelector('code') as HTMLElement
}

function stubClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
}

afterEach(() => {
  stubClipboard(undefined)
})

describe('buildWindowsStartupScript — script de GPO idempotente', () => {
  const script = buildWindowsStartupScript(`${SERVER_URL}/`, REAL_SLUG, REAL_KEY)
  const lines = script.split('\r\n')

  it('confere o servico com sc query e sai antes de instalar se ele ja existe', () => {
    const query = lines.indexOf('sc query InventarioAgent >nul 2>&1')
    const exitIfInstalled = lines.indexOf('if %errorlevel% equ 0 exit /b 0')
    const install = lines.findIndex((line) => line.includes(' install -server '))

    expect(lines[0]).toBe('@echo off')
    expect(query).toBeGreaterThan(0)
    expect(exitIfInstalled).toBe(query + 1)
    expect(install).toBeGreaterThan(exitIfInstalled)
  })

  it('instala de Program Files com a sintaxe real do agente (install, sem -service) e a URL normalizada', () => {
    expect(script).toContain('set "AGENT_DIR=%ProgramFiles%\\InventarioAgent"')
    expect(script).toContain('copy /y "%AGENT_SRC%" "%AGENT_DIR%\\inventario-agent.exe" >nul || exit /b 1')
    expect(lines.at(-1)).toBe(
      `"%AGENT_DIR%\\inventario-agent.exe" install -server "${SERVER_URL}" -client "${REAL_SLUG}" -key "${REAL_KEY}" -name "%COMPUTERNAME%"`
    )
    expect(script).not.toContain('-service')
  })

  it('usa CRLF e so expande as variaveis previstas', () => {
    expect(script.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    const variables = new Set(script.match(/%[A-Za-z_]+%/g))
    expect([...variables].sort()).toEqual(['%AGENT_DIR%', '%AGENT_SRC%', '%COMPUTERNAME%', '%ProgramFiles%', '%errorlevel%'])
  })

  it.each(MALICIOUS_FRAGMENTS)('lanca para client com %s', (_label, fragment) => {
    expect(() => buildWindowsStartupScript(SERVER_URL, maliciousClient(fragment), REAL_KEY)).toThrow(ProvisioningInputError)
  })

  it.each(MALICIOUS_FRAGMENTS)('lanca para key com %s', (_label, fragment) => {
    expect(() => buildWindowsStartupScript(SERVER_URL, REAL_SLUG, maliciousKey(fragment))).toThrow(ProvisioningInputError)
  })

  it.each([...MALICIOUS_SERVER_URLS, ['expansao %VAR% de batch', 'https://inv.example.com/%COMSPEC%']])(
    'lanca para serverUrl %s',
    (_label, serverUrl) => {
      expect(() => buildWindowsStartupScript(serverUrl, REAL_SLUG, REAL_KEY)).toThrow(ProvisioningInputError)
    }
  )
})

describe('AgentInstallPackage — Windows: script de inicializacao / GPO', () => {
  it('aparece em "Outras formas de instalar" junto do PowerShell e da instalacao manual', () => {
    const pkg = buildPkg()
    renderPackage(pkg)
    expect(screen.queryByText(GPO_LABEL)).toBeNull()

    openAlternatives()

    expect(copyFieldValue('PowerShell (uma linha)').textContent).toBe(pkg.bootstrapCommand)
    expect(copyFieldValue('Instalação manual').textContent).toBe(pkg.installCommand)
    const value = copyFieldValue(GPO_LABEL)
    expect(value.textContent).toBe(buildWindowsStartupScript(SERVER_URL, REAL_SLUG, REAL_KEY))
    // Quebras de linha preservadas, sem rolagem horizontal.
    expect(value.className).toMatch(/whitespace-pre-wrap/)
    expect(value.className).not.toMatch(/overflow-x-auto/)
    expect(document.body.textContent).toMatch(/SYSTEM a cada\s+boot/)
    expect(document.body.textContent).toMatch(/emita um novo pacote/)
  })

  it('o botao de copiar copia o script inteiro, com CRLF', async () => {
    const writeText = vi.fn(async () => undefined)
    stubClipboard({ writeText })
    renderPackage()
    openAlternatives()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Copiar ${GPO_LABEL}` }))
    })

    expect(writeText).toHaveBeenCalledWith(buildWindowsStartupScript(SERVER_URL, REAL_SLUG, REAL_KEY))
    expect(document.body.textContent).toContain(`Copiado para a área de transferência: ${GPO_LABEL}.`)
  })

  it('sem binario publicado, o script de GPO continua disponivel (como a instalacao manual)', () => {
    renderPackage(buildPkg({ windowsSha256: null }))
    openAlternatives()

    expect(screen.queryByText('PowerShell (uma linha)')).toBeNull()
    expect(screen.getByText(GPO_LABEL)).toBeTruthy()
  })

  it('pacote fora da allowlist nao gera script (o builder lanca e a opcao some)', () => {
    renderPackage(buildPkg({ enrollmentKey: 'CHAVE-123' }))
    openAlternatives()

    expect(screen.getByText('Instalação manual')).toBeTruthy()
    expect(screen.queryByText(GPO_LABEL)).toBeNull()
  })
})

describe('AgentInstallPackage — Linux: status do servico e logs', () => {
  it('mostra systemctl status e journalctl -f, sem o script de GPO', () => {
    renderPackage()
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))
    openAlternatives()

    expect(copyFieldValue('Status do serviço (systemd)').textContent).toBe('systemctl status inventario-agent')
    expect(copyFieldValue('Logs em tempo real (journalctl)').textContent).toBe('journalctl -u inventario-agent -f')
    expect(document.body.textContent).toMatch(/active \(running\)/)
    expect(screen.queryByText(GPO_LABEL)).toBeNull()
  })

  it('o botao de copiar do journalctl copia o comando', async () => {
    const writeText = vi.fn(async () => undefined)
    stubClipboard({ writeText })
    renderPackage()
    fireEvent.click(screen.getByRole('tab', { name: 'Linux' }))
    openAlternatives()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar Logs em tempo real (journalctl)' }))
    })

    expect(writeText).toHaveBeenCalledWith('journalctl -u inventario-agent -f')
  })
})

describe('AgentInstallPackage — teclado entre abas com as alternativas abertas', () => {
  it('setas, Home e End trocam a aba e o conteudo de "Outras formas de instalar" acompanha', () => {
    renderPackage()
    openAlternatives()
    const windows = screen.getByRole('tab', { name: 'Windows' })
    expect(screen.getByText(GPO_LABEL)).toBeTruthy()

    fireEvent.keyDown(windows, { key: 'ArrowRight' })
    const linux = screen.getByRole('tab', { name: 'Linux' })
    expect(document.activeElement).toBe(linux)
    expect(screen.getByRole('button', { name: 'Ocultar' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByText(GPO_LABEL)).toBeNull()
    expect(screen.getByText('Logs em tempo real (journalctl)')).toBeTruthy()

    fireEvent.keyDown(linux, { key: 'Home' })
    expect(document.activeElement).toBe(windows)
    expect(screen.getByText(GPO_LABEL)).toBeTruthy()
    expect(screen.queryByText('Logs em tempo real (journalctl)')).toBeNull()

    fireEvent.keyDown(windows, { key: 'End' })
    expect(document.activeElement).toBe(linux)
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(linux.id)
  })
})
