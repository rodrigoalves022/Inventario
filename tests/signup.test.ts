import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/signup/route'

process.env.ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'test-admin-secret'

type FakeUser = { id: string; email: string; name: string | null; role: string; clientId: string | null }

const { users, nextIdRef } = vi.hoisted(() => {
  const users: FakeUser[] = []
  const nextIdRef = { value: 1 }
  return { users, nextIdRef }
})

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findFirst: vi.fn(async ({ where }: { where: { role: string } }) => {
        return users.find((user) => user.role === where.role) ?? null
      }),
      create: vi.fn(async ({ data }: { data: Omit<FakeUser, 'id'> & { passwordHash: string } }) => {
        const user: FakeUser = {
          id: `user-${nextIdRef.value++}`,
          email: data.email,
          name: data.name ?? null,
          role: data.role,
          clientId: data.clientId ?? null,
        }
        users.push(user)
        return { ...user, createdAt: new Date() }
      }),
    },
  },
}))

function buildRequest(body: unknown) {
  return new NextRequest('https://inventario.example.com/api/auth/signup', {
    method: 'POST',
    headers: { 'x-admin-secret': 'test-admin-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  users.length = 0
  nextIdRef.value = 1
})

describe('POST /api/auth/signup — bootstrap admin usa o enum AppRole real', () => {
  it('cria o usuario com role "PLATFORM_ADMIN" (nao o "SUPER_ADMIN" fora do enum)', async () => {
    const res = await POST(buildRequest({ email: 'admin@inventario.local', password: 'senha-com-8-chars' }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.user.role).toBe('PLATFORM_ADMIN')
    expect(users[0]?.role).toBe('PLATFORM_ADMIN')
  })

  it('detecta um PLATFORM_ADMIN ja existente e responde 409 (nao cria duplicado)', async () => {
    await POST(buildRequest({ email: 'admin@inventario.local', password: 'senha-com-8-chars' }))
    expect(users).toHaveLength(1)

    const second = await POST(buildRequest({ email: 'outro@inventario.local', password: 'outra-senha-123' }))
    expect(second.status).toBe(409)
    expect(users).toHaveLength(1)
  })
})
