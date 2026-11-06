// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DocsHub } from '@/components/docs-hub'

afterEach(cleanup)

function openTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
}

describe('DocsHub', () => {
  it('renderiza os 4 KpiCards e a aba inicial Visão Geral & Dashboard', () => {
    render(<DocsHub />)
    for (const label of ['Versão da Plataforma', 'Ciclos de Monitoramento', 'Módulos de Gestão', 'Governança & Segurança']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByText('v1.1.0')).toBeTruthy()
    expect(screen.getByText('Multi-Tenant')).toBeTruthy()
    expect(screen.getByRole('tab', { name: /1\. Visão Geral & Dashboard/ }).getAttribute('data-state')).toBe('active')
    expect(screen.getByText('Os 4 Ciclos Operacionais de Coleta')).toBeTruthy()
  })

  it('separa nitidamente o Manual do Usuário e o Guia do Administrador sem vazar diretórios internos', () => {
    const { container } = render(<DocsHub />)
    expect(screen.getByText('Manual do Usuário (Tenant)')).toBeTruthy()
    expect(screen.getByText('Guia do Administrador')).toBeTruthy()

    // Segurança: não deve expor caminhos internos de infraestrutura nem comandos de purge
    expect(container.textContent).not.toContain('purge -yes')
    expect(container.textContent).not.toContain('Caminhos Padrão no Sistema Operacional')
  })

  it('alterna para Ações Remotas & Diagnósticos e mostra update_agent / Atualizar agente agora', () => {
    render(<DocsHub />)
    openTab(/10\. Ações Remotas & Diagnósticos/)
    expect(screen.getAllByText('update_agent').length).toBeGreaterThan(0)
    expect(screen.getByText(/Atualizar agente agora/)).toBeTruthy()
  })

  it('documenta os Diagnósticos Rápidos de 1 clique (Sprint A59)', () => {
    render(<DocsHub />)
    openTab(/10\. Ações Remotas & Diagnósticos/)
    expect(screen.getByText('Diagnósticos Rápidos (1 clique)')).toBeTruthy()
    for (const script of ['defender_quick_scan', 'windows_update_check', 'network_diag']) {
      expect(screen.getAllByText(script).length).toBeGreaterThan(0)
    }
  })

  it('documenta o CSV de descobertos e a governança dos atalhos', () => {
    render(<DocsHub />)
    openTab(/5\. Relatórios, Exportações & Atalhos/)
    expect(screen.getByText('/api/tenant/[slug]/network/discovered/csv')).toBeTruthy()
    openTab(/10\. Ações Remotas & Diagnósticos/)
    expect(screen.getByText('command.enqueue')).toBeTruthy()
  })

  it('documenta as regras de relatórios e exportações', () => {
    render(<DocsHub />)
    openTab(/5\. Relatórios, Exportações & Atalhos/)
    expect(screen.getByText('Matriz de Exportações Analíticas do Tenant')).toBeTruthy()
    expect(screen.getAllByText('/api/tenant/[slug]/reports/csv').length).toBeGreaterThan(0)
    expect(screen.getAllByText('/api/tenant/[slug]/reports/pdf').length).toBeGreaterThan(0)
  })

  it('documenta o script de inicialização via GPO e a gestão do serviço no Linux', () => {
    render(<DocsHub />)
    openTab(/9\. Implantação de Agentes na Rede/)
    expect(screen.getAllByText(/Script de Inicialização via GPO/).length).toBeGreaterThan(0)
    const script = screen.getByText(/sc query InventarioAgent >nul 2>&1/)
    expect(script.textContent).toContain('if %errorlevel% equ 0 exit /b 0')
    expect(script.textContent).toContain('set "AGENT_SRC=\\\\SEU-DOMINIO\\NETLOGON\\inventario-agent.exe"')
    expect(script.textContent).toContain('install -server "https://SEU-SERVIDOR" -client "SEU-CLIENTE"')
    expect(screen.getByText(/Por que a guarda sc query/)).toBeTruthy()
    expect(screen.getByText('Instalação e Monitoramento no Linux')).toBeTruthy()
    expect(screen.getByText(/sudo journalctl -u inventario-agent -f/)).toBeTruthy()
  })

  it('documenta a cópia em 1 clique de IP, hostname e AnyDesk no tenant e no Portal', () => {
    render(<DocsHub />)
    openTab(/5\. Relatórios, Exportações & Atalhos/)
    expect(screen.getByText('Cópia em 1 Clique: IP, Hostname e AnyDesk')).toBeTruthy()
    expect(screen.getByText(/ao lado do hostname e do IP de cada linha/).textContent).toContain('/servers')
  })

  it('documenta o resumo do parque e a matriz de risco das contas locais no Portal do Cliente', () => {
    render(<DocsHub />)
    openTab(/6\. Portal do Cliente/)
    expect(screen.getByText('Portal do Cliente')).toBeTruthy()
    expect(screen.getByText('Memória RAM total')).toBeTruthy()
    expect(screen.getByText(/Soma de N de M máquina\(s\) com memória informada/)).toBeTruthy()
    expect(screen.getByText(/Windows, Linux, outros sistemas e sem sistema informado/)).toBeTruthy()
    expect(screen.getByText(/mudam a lista de máquinas, não o resumo/)).toBeTruthy()
    expect(screen.getByText(/Matriz das abas de risco das contas locais/)).toBeTruthy()
    for (const tab of ['all', 'admin_enabled', 'never_expires', 'critical']) {
      expect(screen.getByText(`?tab=${tab}`)).toBeTruthy()
    }
    expect(screen.getByText('Card: Risco crítico (Admin + Sem expiração).')).toBeTruthy()
    const risk = screen.getByText(/Crítico: conta habilitada, administradora/)
    expect(risk.textContent).toContain('inclusive toda conta desabilitada')
  })

  it('documenta as abas, a paginação e a URL do Catálogo de Softwares', () => {
    render(<DocsHub />)
    openTab(/3\. Softwares & Licenças \(SAM\)/)
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

  it('documenta a paleta Ctrl+K e as ações rápidas', () => {
    render(<DocsHub />)
    openTab(/5\. Relatórios, Exportações & Atalhos/)
    expect(screen.getByText('Paleta de Comandos (Ctrl+K) e Ações Rápidas')).toBeTruthy()
    expect(screen.getByText('Grupo Ações Rápidas')).toBeTruthy()
    for (const action of ['Baixar Relatório em PDF', 'Baixar Relatório em CSV', 'Ver Documentação da Plataforma']) {
      expect(screen.getByText(action)).toBeTruthy()
    }
  })

  it('documenta métricas, latência semântica e cabeçalho unificado', () => {
    render(<DocsHub />)
    openTab(/5\. Relatórios, Exportações & Atalhos/)
    expect(screen.getByText('Métricas, Latência Semântica e Cabeçalho (Sprints A73–A75)')).toBeTruthy()
    expect(screen.getByText('Filtros de período')).toBeTruthy()
    expect(screen.getByText(/24 horas, 3 dias, 7 dias e Todas/)).toBeTruthy()
    expect(screen.getByText('Cores calmas e semânticas')).toBeTruthy()
    expect(screen.getByText('Latência de check-in semântica')).toBeTruthy()
    expect(screen.getByText('Cabeçalho unificado e responsivo')).toBeTruthy()
    expect(screen.getByText(/Buscar página ou máquina\.\.\./)).toBeTruthy()
  })
})
