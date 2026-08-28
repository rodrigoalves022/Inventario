import { describe, expect, it } from 'vitest'
import {
  canAccessTenant,
  canManageTenant,
  canOperateTenant,
  getPermissionUser,
  isAppRole,
  isClientViewer,
  isOrgAdmin,
  isOrgOperator,
  isPlatformAdmin,
  type TenantRef,
} from '@/lib/permissions'

// Sprint 08, item 1. `getPermissionUser`/`isAppRole` (lib/permissions.ts) sao o
// unico ponto onde um `role` de sessao (String livre no banco) vira um
// `AppRole` valido — todo guard de RBAC do sistema (isPlatformAdmin,
// canAccessTenant, canManageTenant, etc.) parte do resultado desta funcao.
// Ate esta sprint, isso so era exercitado indiretamente por testes de
// actions especificas, sempre com roles ja validos — o caminho "role
// invalido" (o que causou o bug real da Sprint 4, corrigido em
// app/api/auth/signup/route.ts, que gravava 'SUPER_ADMIN') nunca era
// testado diretamente.

describe('isAppRole — fail-closed', () => {
  it('rejeita o valor legado real que causou o bug da Sprint 4', () => {
    expect(isAppRole('SUPER_ADMIN')).toBe(false)
  })

  it('rejeita string arbitraria sem relacao com o enum', () => {
    expect(isAppRole('HACKER')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(isAppRole('')).toBe(false)
  })

  it('rejeita variacoes proximas de um valor valido (case, espaco)', () => {
    expect(isAppRole('platform_admin')).toBe(false)
    expect(isAppRole('PLATFORM_ADMIN ')).toBe(false)
    expect(isAppRole(' PLATFORM_ADMIN')).toBe(false)
  })

  it('rejeita valores nao-string', () => {
    expect(isAppRole(undefined)).toBe(false)
    expect(isAppRole(null)).toBe(false)
    expect(isAppRole(123)).toBe(false)
    expect(isAppRole({})).toBe(false)
  })

  it('aceita os 4 valores validos do enum, e somente eles', () => {
    expect(isAppRole('PLATFORM_ADMIN')).toBe(true)
    expect(isAppRole('ORG_ADMIN')).toBe(true)
    expect(isAppRole('ORG_OPERATOR')).toBe(true)
    expect(isAppRole('CLIENT_VIEWER')).toBe(true)
  })
})

describe('getPermissionUser — normalizacao fail-closed de role', () => {
  it('normaliza o valor legado SUPER_ADMIN para null (nunca um fallback permissivo)', () => {
    const result = getPermissionUser({
      id: 'user-1',
      email: 'admin@inventario.local',
      role: 'SUPER_ADMIN',
      organizationId: null,
      clientId: null,
      clientSlug: null,
    })
    expect(result.role).toBeNull()
  })

  it('normaliza string arbitraria para null', () => {
    const result = getPermissionUser({ role: 'HACKER' })
    expect(result.role).toBeNull()
  })

  it('normaliza string vazia para null', () => {
    const result = getPermissionUser({ role: '' })
    expect(result.role).toBeNull()
  })

  it('normaliza role ausente/undefined para null', () => {
    expect(getPermissionUser({}).role).toBeNull()
    expect(getPermissionUser(null).role).toBeNull()
    expect(getPermissionUser(undefined).role).toBeNull()
  })

  it('caminho positivo: os 4 valores validos passam intactos', () => {
    for (const role of ['PLATFORM_ADMIN', 'ORG_ADMIN', 'ORG_OPERATOR', 'CLIENT_VIEWER'] as const) {
      expect(getPermissionUser({ role }).role).toBe(role)
    }
  })

  it('caminho positivo: os demais campos passam intactos junto com um role valido', () => {
    const result = getPermissionUser({
      id: 'user-1',
      email: 'admin@org-a.local',
      role: 'ORG_ADMIN',
      organizationId: 'org-a',
      clientId: null,
      clientSlug: null,
    })
    expect(result).toEqual({
      id: 'user-1',
      email: 'admin@org-a.local',
      role: 'ORG_ADMIN',
      organizationId: 'org-a',
      clientId: null,
      clientSlug: null,
    })
  })
})

describe('role invalido (null) falha em TODOS os guards derivados — fail-closed de ponta a ponta', () => {
  const tenant: TenantRef = { id: 'client-a', slug: 'cliente-a', organizationId: 'org-a' }

  it('um PermissionUser produzido a partir de um role invalido nao passa em nenhum guard', () => {
    const user = getPermissionUser({
      id: 'user-1',
      email: 'invasor@example.com',
      role: 'SUPER_ADMIN',
      organizationId: 'org-a', // mesma org do tenant — mesmo assim, sem privilegio
      clientId: null,
      clientSlug: null,
    })

    expect(user.role).toBeNull()
    expect(isPlatformAdmin(user)).toBe(false)
    expect(isOrgAdmin(user)).toBe(false)
    expect(isOrgOperator(user)).toBe(false)
    expect(isClientViewer(user)).toBe(false)
    expect(canAccessTenant(user, tenant)).toBe(false)
    expect(canManageTenant(user, tenant)).toBe(false)
    expect(canOperateTenant(user, tenant)).toBe(false)
  })
})
