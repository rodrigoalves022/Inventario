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
})
