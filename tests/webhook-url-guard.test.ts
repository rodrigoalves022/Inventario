import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sprint 11, Backlog item 5 (ALTO — SSRF, corrigido nesta sessao). Isola a
// funcao de guard em si (lib/webhook-url-guard.ts), mockando node:dns/promises
// pra nao depender de resolucao de DNS real durante o teste (lento, flaky,
// dependente de rede) e pra poder simular um hostname que RESOLVE pra um IP
// privado — o caso que um IP literal na URL sozinho nao cobre.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))

vi.mock('node:dns/promises', () => ({ lookup: lookupMock }))

import { checkWebhookUrlSafety } from '@/lib/webhook-url-guard'

beforeEach(() => {
  lookupMock.mockReset()
})

describe('checkWebhookUrlSafety', () => {
  it('aceita URL https publica valida (hostname resolve pra IP publico)', async () => {
    lookupMock.mockResolvedValue([{ address: '203.0.113.10', family: 4 }])

    const result = await checkWebhookUrlSafety('https://hooks.example.com/inventario')

    expect(result.ok).toBe(true)
    expect(lookupMock).toHaveBeenCalledWith('hooks.example.com', { all: true })
  })

  it('rejeita protocolo http:// mesmo com host publico, sem consultar DNS', async () => {
    const result = await checkWebhookUrlSafety('http://hooks.example.com/inventario')

    expect(result.ok).toBe(false)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('rejeita protocolo diferente de https (ex.: ftp://)', async () => {
    const result = await checkWebhookUrlSafety('ftp://hooks.example.com/x')
    expect(result.ok).toBe(false)
  })

  it('rejeita IP literal de metadata de cloud (169.254.169.254), sem consultar DNS', async () => {
    const result = await checkWebhookUrlSafety('https://169.254.169.254/latest/meta-data')

    expect(result.ok).toBe(false)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('rejeita localhost sem consultar DNS', async () => {
    const result = await checkWebhookUrlSafety('https://localhost/webhook')

    expect(result.ok).toBe(false)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('rejeita IP literal de loopback (127.0.0.1)', async () => {
    const result = await checkWebhookUrlSafety('https://127.0.0.1/webhook')
    expect(result.ok).toBe(false)
  })

  it('rejeita IPs literais RFC1918 (10/8, 172.16/12, 192.168/16)', async () => {
    for (const ip of ['10.0.0.5', '172.16.0.5', '172.31.255.254', '192.168.1.1']) {
      const result = await checkWebhookUrlSafety(`https://${ip}/x`)
      expect(result.ok).toBe(false)
    }
  })

  it('NAO bloqueia IP publico literal fora das faixas privadas', async () => {
    const result = await checkWebhookUrlSafety('https://203.0.113.10/x')
    expect(result.ok).toBe(true)
  })

  it('rejeita hostname que RESOLVE (via DNS) para IP privado — nao so IP literal na URL', async () => {
    lookupMock.mockResolvedValue([{ address: '10.1.2.3', family: 4 }])

    const result = await checkWebhookUrlSafety('https://internal.attacker.example/x')

    expect(result.ok).toBe(false)
    expect(lookupMock).toHaveBeenCalledWith('internal.attacker.example', { all: true })
  })

  it('rejeita se QUALQUER endereco resolvido estiver bloqueado (multiplos registros A)', async () => {
    lookupMock.mockResolvedValue([
      { address: '203.0.113.10', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ])

    const result = await checkWebhookUrlSafety('https://multi-a.example/x')
    expect(result.ok).toBe(false)
  })

  it('rejeita quando a resolucao DNS falha (hostname inexistente)', async () => {
    lookupMock.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }))

    const result = await checkWebhookUrlSafety('https://nao-existe.invalid/x')
    expect(result.ok).toBe(false)
  })

  it('rejeita IPv6 loopback (::1) e faixa unique-local (fc00::/7)', async () => {
    expect((await checkWebhookUrlSafety('https://[::1]/x')).ok).toBe(false)
    expect((await checkWebhookUrlSafety('https://[fd00::1]/x')).ok).toBe(false)
  })

  it('rejeita URL sintaticamente invalida', async () => {
    const result = await checkWebhookUrlSafety('nao-e-uma-url')
    expect(result.ok).toBe(false)
  })
})
