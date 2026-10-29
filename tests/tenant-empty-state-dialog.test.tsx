// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TenantEmptyState } from '@/components/tenant-empty-state'

// Sprint A4, achado 2 do visual-qa (opcao a): com o seletor de plataforma e o
// hash, o dialogo de instalacao do tenant vazio ficava mais alto que a tela
// em 1024 e 390 px, centralizado por translate e sem rolagem — titulo e botao
// de fechar ficavam acima da tela, inalcancaveis. O dialogo precisa limitar a
// propria altura ao viewport e rolar por dentro.

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TenantEmptyState — dialogo de instalacao cabe na tela', () => {
  it('o DialogContent limita a altura ao viewport e rola por dentro', () => {
    // Requisicao pendente: so interessa a casca do dialogo, nao o conteudo.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<TenantEmptyState clientId="client-1" clientName="Teste A0 Rotacao" canManageCredentials />)

    fireEvent.click(screen.getByRole('button', { name: /Ver instruções de instalação/ }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]')
    expect(dialog.className).toContain('overflow-y-auto')
  })
})
