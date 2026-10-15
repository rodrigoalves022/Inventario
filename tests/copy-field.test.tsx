// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { CopyField } from '@/components/copy-field'

// Sprint A2, item 9. A confirmacao de copia era so a troca de icone (nada
// para leitor de tela), e `navigator.clipboard.writeText` sem tratamento de
// falha: em HTTP fora de localhost `navigator.clipboard` e undefined e o
// clique falhava em silencio (decisao 5: a falha precisa aparecer).

function stubClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
}

afterEach(() => {
  stubClipboard(undefined)
})

async function clickCopy() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Copiar Chave de instalação/ }))
  })
}

describe('CopyField — tipografia do sistema', () => {
  it('rotulo em .section-label e valor em .data-mono, sem font-mono solto', () => {
    const { container } = render(<CopyField value="CHAVE-123" label="Chave de instalação" />)

    expect(screen.getByText('Chave de instalação').className).toMatch(/section-label/)
    const value = screen.getByText('CHAVE-123')
    expect(value.className).toMatch(/data-mono/)
    expect(container.innerHTML).not.toMatch(/font-mono/)
  })
})

describe('CopyField — copia bem-sucedida', () => {
  it('copia o valor e anuncia a copia em texto acessivel (aria-live, sem role="status")', async () => {
    const writeText = vi.fn(async () => undefined)
    stubClipboard({ writeText })
    const { container } = render(<CopyField value="CHAVE-123" label="Chave de instalação" />)

    await clickCopy()

    expect(writeText).toHaveBeenCalledWith('CHAVE-123')
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live?.textContent).toMatch(/Copiado .*: Chave de instalação/i)
    // Nao cria outra regiao role="status": o passo 3 do assistente e o painel
    // de clientes usam getByRole('status') e quebrariam com duas.
    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})

describe('CopyField — falha de copia visivel (decisao 5)', () => {
  it('sem navigator.clipboard (contexto nao seguro), mostra mensagem visivel', async () => {
    stubClipboard(undefined)
    render(<CopyField value="CHAVE-123" label="Chave de instalação" />)

    await clickCopy()

    const message = screen.getByText(/Não foi possível copiar/i)
    expect(message.className).not.toMatch(/sr-only/)
    expect(message.className).toMatch(/text-destructive/)
  })

  it('com writeText rejeitado, mostra mensagem visivel', async () => {
    stubClipboard({ writeText: vi.fn(async () => Promise.reject(new Error('denied'))) })
    render(<CopyField value="CHAVE-123" label="Chave de instalação" />)

    await clickCopy()

    const message = screen.getByText(/Não foi possível copiar/i)
    expect(message.className).not.toMatch(/sr-only/)
  })
})
