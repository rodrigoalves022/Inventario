// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { FirstCheckinStatus } from '@/app/admin/clients/novo/new-client-wizard'

// Sprint A1, F6. O passo 3 do assistente "Novo cliente" consulta
// GET /api/clients/[id]/status a cada 5 s. Antes desta sprint, HTTP nao-ok
// (`if (!response.ok) return`) e falha de rede (`catch {}` vazio) eram
// engolidos, e "Aguardando a primeira máquina…" ficava na tela para sempre.
// Estes testes (fake timers) travam: erro visivel, checklist depois de 3 min,
// estado "registrado sem coleta", sucesso tardio e a regiao role="status".

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

type StatusBody = {
  agentCount: number
  device: { id: string; hostname: string; lastSeenAt: string } | null
}

const waitingBody: StatusBody = { agentCount: 0, device: null }
const connectedBody: StatusBody = {
  agentCount: 1,
  device: { id: 'device-1', hostname: 'PC-01', lastSeenAt: '2026-10-14T12:00:00.000Z' },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

let fetchMock: ReturnType<typeof vi.fn>

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function renderStep() {
  return render(<FirstCheckinStatus clientId="client-1" clientSlug="cliente-1" />)
}

function statusRegion() {
  return screen.getByRole('status')
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn(async () => jsonResponse(waitingBody))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('FirstCheckinStatus — erro visivel no polling (F6)', () => {
  it.each([
    [401, /sessão expirou/i],
    [404, /cliente não encontrado/i],
    [500, /servidor respondeu com erro/i],
  ])('HTTP %i produz mensagem visivel no passo 3', async (httpStatus, expected) => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: 'x' }, httpStatus))
    renderStep()
    await flush()

    expect(statusRegion().textContent).toMatch(expected)
  })

  it('rejeicao do fetch (falha de rede) produz mensagem visivel no passo 3', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    renderStep()
    await flush()

    expect(statusRegion().textContent).toMatch(/não foi possível falar com o servidor/i)
  })

  it('o erro some quando uma consulta seguinte volta a dar certo', async () => {
    fetchMock.mockImplementationOnce(async () => jsonResponse({ error: 'x' }, 500))
    renderStep()
    await flush()
    expect(statusRegion().textContent).toMatch(/servidor respondeu com erro/i)

    await flush(5000)

    expect(statusRegion().textContent).not.toMatch(/servidor respondeu com erro/i)
    expect(statusRegion().textContent).toMatch(/Aguardando a primeira máquina/)
  })
})

describe('FirstCheckinStatus — tempo esgotado (F6)', () => {
  it('antes de 180 s o checklist NAO aparece', async () => {
    renderStep()
    await flush()
    await flush(179_000)

    expect(statusRegion().textContent).not.toMatch(/como Administrador/i)
  })

  it('depois de 180 s sem device, exibe o checklist com os tres itens', async () => {
    renderStep()
    await flush()
    await flush(180_000)

    const text = statusRegion().textContent ?? ''
    expect(text).toMatch(/como Administrador/i)
    expect(text).toMatch(/firewall/i)
    expect(text).toMatch(/servidor (está )?alcançável pela rede do cliente/i)
    expect(text).toMatch(/endereço do servidor configurado/i)
    expect(text).toMatch(/não o digitado/i)
  })

  it('um check-in que chega depois do tempo esgotado ainda leva ao sucesso', async () => {
    renderStep()
    await flush()
    await flush(180_000)
    expect(statusRegion().textContent).toMatch(/como Administrador/i)

    fetchMock.mockImplementation(async () => jsonResponse(connectedBody))
    await flush(5000)

    expect(statusRegion().textContent).toMatch(/PC-01 conectou/)
    expect(statusRegion().textContent).not.toMatch(/como Administrador/i)
  })
})

describe('FirstCheckinStatus — estados do passo 3 (F6)', () => {
  it('agentCount > 0 com device null exibe "agente registrado, aguardando primeira coleta"', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ agentCount: 1, device: null }))
    renderStep()
    await flush()

    const text = statusRegion().textContent ?? ''
    expect(text).toMatch(/Agente registrado, aguardando a primeira coleta/i)
    expect(text).not.toMatch(/Aguardando a primeira máquina/)
  })

  it('sem agente e sem device exibe "aguardando a primeira máquina"', async () => {
    renderStep()
    await flush()

    expect(statusRegion().textContent).toMatch(/Aguardando a primeira máquina/)
  })

  it('device presente exibe o estado de sucesso dentro da regiao role="status"', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(connectedBody))
    renderStep()
    await flush()

    expect(statusRegion().textContent).toMatch(/PC-01 conectou/)
  })

  it('para de consultar depois que a primeira maquina aparece', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(connectedBody))
    renderStep()
    await flush()
    const callsAfterConnect = fetchMock.mock.calls.length

    await flush(30_000)

    expect(fetchMock.mock.calls.length).toBe(callsAfterConnect)
  })
})
