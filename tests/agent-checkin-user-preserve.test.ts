import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Sprint A33 — usuario no check-in: preserva humano anterior, limpa legado HOST$/SYSTEM.

const { state, upsert } = vi.hoisted(() => {
  const state: { previousUser: string | null } = { previousUser: null }
  const upsert = vi.fn(async () => {
    throw new Error('stop-after-upsert')
  })
  return { state, upsert }
})

vi.mock('@/lib/auth', () => ({
  validateAgentApiKey: vi.fn(async () => ({ ok: true, agentAuth: { id: 'agent-1', clientId: 'client-1' } })),
  authErrorResponse: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/tenant-alert-settings', () => ({ getTenantAlertSettingsByClientId: vi.fn(async () => null) }))
vi.mock('@/lib/prisma', () => ({
  default: {
    device: {
      findUnique: vi.fn(async () => ({ id: 'd1', status: 'online', usuario: state.previousUser })),
      upsert,
    },
    agentCheckLog: { create: vi.fn(async () => ({})) },
  },
}))

import { POST } from '@/app/api/agent/checkin/route'

async function checkin(usuario: string | null) {
  const req = new NextRequest('http://localhost/api/agent/checkin', {
    method: 'POST',
    body: JSON.stringify({ hostname: 'SRV-VS', usuario }),
  })
  await POST(req).catch(() => null)
  const call = upsert.mock.calls.at(-1) as unknown as [{ update: Record<string, unknown> }]
  return call[0].update
}

describe('checkin usuario', () => {
  beforeEach(() => {
    upsert.mockClear()
  })

  it('preserva usuario humano anterior quando o novo vem vazio', async () => {
    state.previousUser = 'maria'
    expect(await checkin(null)).not.toHaveProperty('usuario')
  })

  it('limpa conta de maquina legada (SRV-VS$) quando o novo vem vazio', async () => {
    state.previousUser = 'SRV-VS$'
    expect((await checkin('')).usuario).toBeNull()
  })

  it('limpa SYSTEM legado', async () => {
    state.previousUser = 'SYSTEM'
    expect((await checkin(null)).usuario).toBeNull()
  })

  it('substitui legado pelo usuario humano recebido', async () => {
    state.previousUser = 'SRV-VS$'
    expect((await checkin(' Administrador ')).usuario).toBe('Administrador')
  })
})
