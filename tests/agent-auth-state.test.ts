import { describe, expect, it } from 'vitest'
import { getAgentAuthState } from '@/app/admin/clients/agent-state'

// Sprint A3, item 3 (RN018). Estado derivado de cada AgentAuth, sem coluna
// nova: funcao pura, testada nos quatro casos. A precedencia importa:
// revogado vence cliente bloqueado, que vence "sem coleta".

describe('getAgentAuthState — RN018', () => {
  it('isActive=false: "Revogado", mesmo com Device e cliente ativo', () => {
    const state = getAgentAuthState({ isActive: false, hasDevice: true, clientIsActive: true })
    expect(state.key).toBe('revoked')
    expect(state.label).toBe('Revogado')
  })

  it('revogado tem precedencia sobre cliente desativado', () => {
    const state = getAgentAuthState({ isActive: false, hasDevice: false, clientIsActive: false })
    expect(state.label).toBe('Revogado')
  })

  it('ativo com Client.isActive=false: "Bloqueado pelo cliente"', () => {
    const state = getAgentAuthState({ isActive: true, hasDevice: true, clientIsActive: false })
    expect(state.key).toBe('client_blocked')
    expect(state.label).toBe('Bloqueado pelo cliente')
  })

  it('ativo, cliente ativo, sem Device: "Registrado, sem coleta", com as duas causas no texto', () => {
    const state = getAgentAuthState({ isActive: true, hasDevice: false, clientIsActive: true })
    expect(state.key).toBe('registered_no_collection')
    expect(state.label).toBe('Registrado, sem coleta')
    // Duas causas possiveis: ainda nao fez o primeiro check-in, ou o Device
    // foi excluido e o proximo check-in o recria.
    expect(state.detail).toMatch(/primeiro check-in/i)
    expect(state.detail).toMatch(/exclu[ií]d/i)
  })

  it('ativo, cliente ativo, com Device: "Ativo"', () => {
    const state = getAgentAuthState({ isActive: true, hasDevice: true, clientIsActive: true })
    expect(state.key).toBe('active')
    expect(state.label).toBe('Ativo')
  })

  it('cada estado tem um tom de StatusPill valido e distinto do de "Ativo"', () => {
    const tones = new Set(['success', 'warning', 'destructive', 'neutral'])
    const active = getAgentAuthState({ isActive: true, hasDevice: true, clientIsActive: true })
    const others = [
      getAgentAuthState({ isActive: false, hasDevice: true, clientIsActive: true }),
      getAgentAuthState({ isActive: true, hasDevice: true, clientIsActive: false }),
      getAgentAuthState({ isActive: true, hasDevice: false, clientIsActive: true }),
    ]
    expect(active.tone).toBe('success')
    for (const state of others) {
      expect(tones.has(state.tone)).toBe(true)
      expect(state.tone).not.toBe('success')
    }
  })
})
