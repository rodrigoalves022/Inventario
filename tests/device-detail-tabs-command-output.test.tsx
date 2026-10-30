// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { CommandHistoryItem } from '@/components/device-detail-tabs'

vi.mock('@/app/app/[clientSlug]/assets/[id]/actions', () => ({
  deleteTenantAssetAction: vi.fn(),
  enqueueDeviceCommandAction: vi.fn(),
  saveAssetRecordAction: vi.fn(),
}))

const longOutput = 'linha1\nlinha2\nlinha3'

function makeCommand(output: string) {
  return {
    id: 'c1',
    type: 'run_script',
    status: 'done',
    createdAt: '2026-01-01T00:00:00Z',
    resultJson: JSON.stringify({ status: 'done', output }),
  }
}

describe('CommandHistoryItem', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('expande e recolhe a saída multilinha', () => {
    render(<CommandHistoryItem command={makeCommand(longOutput)} />)
    expect(screen.getByRole('button', { name: 'Ver saída completa' })).toBeTruthy()
    expect(screen.queryByText(/linha2/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver saída completa' }))
    expect(document.querySelector('pre')?.textContent).toBe(longOutput)
    fireEvent.click(screen.getByRole('button', { name: 'Recolher saída' }))
    expect(document.querySelector('pre')?.textContent).toBe('linha1')
  })

  it('saída curta não tem toggle', () => {
    render(<CommandHistoryItem command={makeCommand('ok')} />)
    expect(screen.queryByRole('button', { name: 'Ver saída completa' })).toBeNull()
    expect(document.querySelector('pre')?.textContent).toBe('ok')
  })

  it('copia a saída e mostra "Copiado" por 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<CommandHistoryItem command={makeCommand(longOutput)} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar saída' }))
    })
    expect(writeText).toHaveBeenCalledWith(longOutput)
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: 'Copiar saída' })).toBeTruthy()
  })
})
