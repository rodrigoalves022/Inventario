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
})
