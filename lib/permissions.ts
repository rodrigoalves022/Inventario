import type { Session } from 'next-auth'

export type AppRole = 'SUPER_ADMIN' | 'ADMIN_TENANT' | 'USER'

export type PermissionUser = {
  id: string | null
  email: string | null
  role: AppRole | null
  clientId: string | null
  clientSlug: string | null
}

export function getPermissionUser(
  user:
    | {
        id?: string | null
        email?: string | null
        role?: string | null
        clientId?: string | null
        clientSlug?: string | null
      }
    | null
    | undefined
): PermissionUser {
  const role = user?.role
  return {
    id: user?.id ?? null,
    email: user?.email ?? null,
    role: role === 'SUPER_ADMIN' || role === 'ADMIN_TENANT' || role === 'USER' ? role : null,
    clientId: user?.clientId ?? null,
    clientSlug: user?.clientSlug ?? null,
  }
}

export function getSessionPermissionUser(session: Session | null | undefined) {
  return getPermissionUser(session?.user)
}

export function isSuperAdmin(user: PermissionUser | null | undefined) {
  return user?.role === 'SUPER_ADMIN'
}

export function isTenantAdmin(user: PermissionUser | null | undefined) {
  return user?.role === 'ADMIN_TENANT'
}

export function isTenantUser(user: PermissionUser | null | undefined) {
  return user?.role === 'USER'
}

export function canAccessGlobalAdmin(user: PermissionUser | null | undefined) {
  return isSuperAdmin(user)
}

export function canAccessTenant(user: PermissionUser | null | undefined, tenantSlug: string) {
  return isSuperAdmin(user) || user?.clientSlug === tenantSlug
}

export function canManageTenant(user: PermissionUser | null | undefined, tenantSlug: string) {
  return isSuperAdmin(user) || (isTenantAdmin(user) && user?.clientSlug === tenantSlug)
}

export function canViewTenantAudit(user: PermissionUser | null | undefined, tenantSlug: string) {
  return canManageTenant(user, tenantSlug)
}

export function canDeleteTenantAsset(user: PermissionUser | null | undefined, tenantSlug: string) {
  return canManageTenant(user, tenantSlug)
}

export function canManageTenantAlerts(user: PermissionUser | null | undefined, tenantSlug: string) {
  return canManageTenant(user, tenantSlug)
}

export function canViewTenantAdminNavigation(user: PermissionUser | null | undefined) {
  return isSuperAdmin(user) || isTenantAdmin(user)
}
