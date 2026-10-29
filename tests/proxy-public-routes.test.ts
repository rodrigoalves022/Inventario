import { existsSync, readdirSync } from 'fs'
import { join, posix } from 'path'
import { describe, expect, it, vi } from 'vitest'

// proxy.ts importa next-auth; o teste so precisa da lista exportada.
vi.mock('next-auth', () => ({ default: () => ({ auth: (handler: unknown) => handler }) }))
vi.mock('@/auth.config', () => ({ authConfig: {} }))

import { publicRoutes } from '@/proxy'

function findAgentRoutes(dir: string, urlPath: string): string[] {
  const found: string[] = []
  if (existsSync(join(dir, 'route.ts'))) found.push(urlPath)
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...findAgentRoutes(join(dir, entry.name), posix.join(urlPath, entry.name)))
  }
  return found
}

describe('proxy.ts#publicRoutes', () => {
  const routes = findAgentRoutes(join(process.cwd(), 'app/api/agent'), '/api/agent')

  it('encontra as rotas do agente', () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  it.each(routes)('%s esta coberta por publicRoutes (evita 307 -> /login)', (routePath) => {
    expect(publicRoutes.some((r) => routePath === r || routePath.startsWith(r + '/'))).toBe(true)
  })
})
