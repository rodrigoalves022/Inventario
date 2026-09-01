import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rateLimit } from '@/lib/rate-limit'

// Sprint 10, item 16 (RNF010/RNF001): lib/rate-limit.ts (Map em memoria de
// processo). Usa vi.useFakeTimers() pra controlar Date.now() sem depender de
// tempo real de execucao do teste (mesmo padrao ja usado em
// tests/device-detail-tabs-metrics-polling.test.tsx).

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('rateLimit — janela fixa por chave', () => {
  it('as primeiras N requisicoes na janela passam; a N+1 e bloqueada', () => {
    const key = 'checkin:agent-1'
    const options = { limit: 3, windowMs: 60_000 }

    expect(rateLimit(key, options)).toEqual({ allowed: true })
    expect(rateLimit(key, options)).toEqual({ allowed: true })
    expect(rateLimit(key, options)).toEqual({ allowed: true })

    const fourth = rateLimit(key, options)
    expect(fourth.allowed).toBe(false)
    if (!fourth.allowed) {
      expect(fourth.retryAfterSeconds).toBeGreaterThan(0)
      expect(fourth.retryAfterSeconds).toBeLessThanOrEqual(60)
    }
  })

  it('a janela expira e libera de novo (nova janela reseta a contagem)', () => {
    const key = 'checkin:agent-2'
    const options = { limit: 2, windowMs: 60_000 }

    expect(rateLimit(key, options)).toEqual({ allowed: true })
    expect(rateLimit(key, options)).toEqual({ allowed: true })
    expect(rateLimit(key, options).allowed).toBe(false) // 3a requisicao, ainda na mesma janela

    vi.advanceTimersByTime(60_001) // ultrapassa a janela de 60s

    expect(rateLimit(key, options)).toEqual({ allowed: true }) // nova janela, contagem do zero
    expect(rateLimit(key, options)).toEqual({ allowed: true })
    expect(rateLimit(key, options).allowed).toBe(false) // 3a requisicao da NOVA janela, bloqueada de novo
  })

  it('isolamento por chave: duas chaves diferentes nao compartilham o mesmo contador', () => {
    const options = { limit: 1, windowMs: 60_000 }

    expect(rateLimit('checkin:agent-a', options)).toEqual({ allowed: true })
    expect(rateLimit('checkin:agent-a', options).allowed).toBe(false) // agent-a ja esgotou o limite

    // agent-b, chave diferente, comeca com contador zerado mesmo na mesma janela de tempo.
    expect(rateLimit('checkin:agent-b', options)).toEqual({ allowed: true })
    expect(rateLimit('checkin:agent-b', options).allowed).toBe(false)
  })

  it('retryAfterSeconds diminui a medida que o tempo avanca dentro da janela bloqueada', () => {
    const key = 'checkin:agent-3'
    const options = { limit: 1, windowMs: 60_000 }

    rateLimit(key, options) // consome a unica requisicao permitida

    const blockedEarly = rateLimit(key, options)
    vi.advanceTimersByTime(50_000)
    const blockedLate = rateLimit(key, options)

    expect(blockedEarly.allowed).toBe(false)
    expect(blockedLate.allowed).toBe(false)
    if (!blockedEarly.allowed && !blockedLate.allowed) {
      expect(blockedLate.retryAfterSeconds).toBeLessThan(blockedEarly.retryAfterSeconds)
    }
  })

})

// Limite conhecido e aceito (nao um bug, ja documentado no proprio
// lib/rate-limit.ts): `buckets` e' um Map em memoria de UM processo Node.
// Duas instancias/replicas do servidor rodando ao mesmo tempo NAO
// compartilham contador — cada uma aplicaria o limite de forma
// independente, permitindo ate limit*N-replicas requisicoes na pratica.
// Sem asercao sobre multiplas replicas aqui (nao ha como simular dois
// processos dentro de um teste Vitest) — este comentario e' o registro do
// limite, pra nao ser silenciosamente esquecido se o projeto crescer pra
// multiplos processos.
