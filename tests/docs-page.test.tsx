// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DocsHub } from '@/components/docs-hub'

// Sprint A9: Central de Documentacao (/docs).

afterEach(cleanup)

// Radix Tabs ativa no mouseDown (nao no click).
function openTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
}

describe('DocsHub', () => {
  it('renderiza os 4 KpiCards e a aba inicial Visão Geral & Ciclos', () => {
    render(<DocsHub />)
    for (const label of ['Versão do Agente', 'Ciclos do Agente', 'Comandos PowerUser', 'Criptografia & Update']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('v1.1.0')).toBeTruthy()
    expect(screen.getByText('DPAPI + SHA-256')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Visão Geral & Ciclos/ }).getAttribute('data-state')).toBe('active')
    expect(screen.getByText('Os 4 Ciclos Operacionais do Agente')).toBeTruthy()
  })

  it('alterna para Console PowerUser & CLI e mostra manage, unlink e purge -yes', () => {
    render(<DocsHub />)
    openTab(/Console PowerUser & CLI/)
    expect(screen.getAllByText(/inventario-agent\.exe manage/).length).toBeGreaterThan(0)
    expect(screen.getByText(/inventario-agent\.exe unlink/)).toBeTruthy()
    expect(screen.getByText(/inventario-agent\.exe purge -yes/)).toBeTruthy()
  })

  it('alterna para Auto-Update & Comandos e mostra update_agent / Atualizar agente agora', () => {
    render(<DocsHub />)
    openTab(/Auto-Update & Comandos/)
    expect(screen.getAllByText('update_agent').length).toBeGreaterThan(0)
    expect(screen.getByText('Atualizar agente agora')).toBeTruthy()
  })

  it('documenta os Diagnósticos Rápidos de 1 clique (Sprint A59)', () => {
    render(<DocsHub />)
    openTab(/Auto-Update & Comandos/)
    expect(screen.getByText('Diagnósticos Rápidos (1 clique)')).toBeTruthy()
    for (const script of ['defender_quick_scan', 'windows_update_check', 'network_diag']) {
      expect(screen.getAllByText(script).length).toBeGreaterThan(1)
    }
  })

  it('documenta o CSV de descobertos, as abas de /network e a governança dos atalhos (Sprint A59)', () => {
    render(<DocsHub />)
    openTab(/Relatórios, Exportações & Governança/)
    expect(screen.getByText('/api/tenant/[slug]/network/discovered/csv')).toBeTruthy()
    expect(screen.getByText(/Baixar CSV \(Descobertos\)/)).toBeTruthy()
    expect(screen.getByText(/gravam \?type= na URL/)).toBeTruthy()
    expect(screen.getByText('Governança dos Diagnósticos Rápidos')).toBeTruthy()
    expect(screen.getByText('command.enqueue')).toBeTruthy()
  })

  it('documenta as âncoras e os links de máquina de /alerts e os filtros de Armazenamento e Processadores (Sprint A62)', () => {
    render(<DocsHub />)
    openTab(/Relatórios, Exportações & Governança/)
    const alerts = screen.getByText(/#alert-rules/)
    expect(alerts.textContent).toContain('#alert-history')
    expect(alerts.textContent).toContain('/app/[clientSlug]/assets/[id]')
    expect(screen.getByText(/repassa o \?state= e o \?severity= ativos/)).toBeTruthy()
    const storage = screen.getByText(/gravam \?faixa=ok, warning ou critical/)
    expect(storage.textContent).toContain('?tipo=')
    expect(storage.textContent).toContain('aria-pressed')
    const processors = screen.getByText(/gravam \?fabricante= por grupo de fabricante/)
    expect(processors.textContent).toContain('/computers?search=<modelo>')
  })

  it('documenta o script de inicialização via GPO e a gestão do serviço via systemd (Sprint A65)', () => {
    render(<DocsHub />)
    openTab(/Instalação do Agente/)
    expect(screen.getByText(/Script de Inicialização via GPO/)).toBeTruthy()
    const script = screen.getByText(/sc query InventarioAgent >nul 2>&1/)
    expect(script.textContent).toContain('if %errorlevel% equ 0 exit /b 0')
    expect(script.textContent).toContain('set "AGENT_SRC=\\\\SEU-DOMINIO\\NETLOGON\\inventario-agent.exe"')
    expect(script.textContent).toContain('install -server "https://SEU-SERVIDOR" -client "SEU-CLIENTE"')
    expect(screen.getByText('Por que a guarda sc query')).toBeTruthy()
    expect(screen.getByText('5. Gestão do Serviço no Linux (systemd)')).toBeTruthy()
    expect(screen.getByText('/etc/systemd/system/inventario-agent.service')).toBeTruthy()
    expect(screen.getByText(/sudo journalctl -u inventario-agent -f/)).toBeTruthy()
  })

  it('documenta a cópia em 1 clique de IP, hostname e AnyDesk no tenant e no Portal (Sprint A65)', () => {
    render(<DocsHub />)
    openTab(/Relatórios, Exportações & Governança/)
    expect(screen.getByText('Cópia em 1 Clique: IP, Hostname e AnyDesk')).toBeTruthy()
    expect(screen.getByText(/ao lado do hostname e do IP de cada linha/).textContent).toContain('/servers')
    const portal = screen.getByText(/Na lista de \/portal, o IP e o AnyDesk/)
    expect(portal.textContent).toContain('/portal/devices/[id]')
    expect(portal.textContent).toContain('CLIENT_VIEWER')
    expect(screen.getByText(/não enfileira comando, não grava auditoria/)).toBeTruthy()
  })
})
