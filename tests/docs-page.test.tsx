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

  it('documenta o resumo do parque e a matriz de risco das contas locais no Portal do Cliente (Sprint A69)', () => {
    render(<DocsHub />)
    openTab(/Relatórios, Exportações & Governança/)
    expect(screen.getByText('Portal do Cliente')).toBeTruthy()
    expect(screen.getByText('Memória RAM total')).toBeTruthy()
    expect(screen.getByText(/Soma de N de M máquina\(s\) com memória informada/)).toBeTruthy()
    expect(screen.getByText(/Windows, Linux, outros sistemas e sem sistema informado/)).toBeTruthy()
    expect(screen.getByText(/mudam a lista de máquinas, não o resumo/)).toBeTruthy()
    expect(screen.getByText('Matriz das abas de risco')).toBeTruthy()
    for (const tab of ['all', 'admin_enabled', 'never_expires', 'critical']) {
      expect(screen.getByText(`?tab=${tab}`)).toBeTruthy()
    }
    expect(screen.getByText('Card: Risco crítico (Admin + Sem expiração).')).toBeTruthy()
    const risk = screen.getByText(/Crítico: conta habilitada, administradora/)
    expect(risk.textContent).toContain('inclusive toda conta desabilitada')
  })

  it('documenta as abas, a paginação e a URL do Catálogo de Softwares (Sprint A72)', () => {
    render(<DocsHub />)
    openTab(/Relatórios, Exportações & Governança/)
    expect(screen.getByText('Catálogo de Softwares: Abas, Paginação e URL')).toBeTruthy()
    expect(screen.getByText(/\/portal\/software/)).toBeTruthy()
    const tab = screen.getByText(/Trocar de aba direto na tabela grava \?tab=blacklisted ou \?tab=widespread/)
    expect(tab.textContent).toContain('preservando os demais parâmetros')
    expect(tab.textContent).toContain('Todos remove o ?tab=')
    expect(screen.getByText(/"Itens por página" oferece 10, 25, 50 ou 100/)).toBeTruthy()
    expect(screen.getByText('?page= e ?limit=')).toBeTruthy()
    expect(screen.getByText(/Não entram na URL do catálogo/).textContent).toContain('página 1 com 25 itens')
    expect(screen.getByText(/digitar na busca ou mudar os itens por página volta para a página 1/)).toBeTruthy()
    expect(screen.getByText(/sem o recorte da aba, da busca nem da página/)).toBeTruthy()
    for (const value of ['all', 'blacklisted', 'widespread']) {
      expect(screen.getByText(`/software?tab=${value}`)).toBeTruthy()
    }
    expect(screen.getByText('Cards: Softwares restritos.')).toBeTruthy()
  })

  it('documenta a paleta Ctrl+K e as ações rápidas (Sprint A72)', () => {
    render(<DocsHub />)
    openTab(/Relatórios, Exportações & Governança/)
    expect(screen.getByText('Paleta de Comandos (Ctrl+K) e Ações Rápidas')).toBeTruthy()
    expect(screen.getByText('Ctrl+K')).toBeTruthy()
    expect(screen.getByText(/o atalho não dispara com o foco num campo de digitação/)).toBeTruthy()
    expect(screen.getByText('Grupo Ações Rápidas')).toBeTruthy()
    for (const action of ['Baixar Relatório em PDF', 'Baixar Relatório em CSV', 'Ver Documentação da Plataforma']) {
      expect(screen.getByText(action)).toBeTruthy()
    }
    // As rotas de relatório também estão na Matriz de Exportações do Tenant.
    expect(screen.getAllByText('/api/tenant/[slug]/reports/pdf')).toHaveLength(2)
    expect(screen.getAllByText('/api/tenant/[slug]/reports/csv')).toHaveLength(2)
    expect(screen.getAllByText(/Só aparece dentro de um cliente\.$/)).toHaveLength(2)
    expect(screen.getByText(/casa por sinônimo/).textContent).toContain('"exportar"')
    const governance = screen.getByText(/não enfileiram comando, não gravam auditoria e não dão acesso novo/)
    expect(governance.textContent).toContain('canAccessTenant')
  })
})
