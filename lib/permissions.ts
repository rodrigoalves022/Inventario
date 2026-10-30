import type { Session } from 'next-auth'

/**
 * PLATFORM_ADMIN — dono da plataforma, escopo global
 * ORG_ADMIN      — administra uma Organization (clientes, usuarios, chaves, alertas)
 * ORG_OPERATOR   — opera a Organization e dispara comandos, sem gerir credenciais/usuarios
 * CLIENT_VIEWER  — portal self-service de um unico Client, somente leitura
 */
export type AppRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORG_OPERATOR' | 'CLIENT_VIEWER'

const APP_ROLES: readonly AppRole[] = ['PLATFORM_ADMIN', 'ORG_ADMIN', 'ORG_OPERATOR', 'CLIENT_VIEWER']

/** Rotulo PT-BR de cada papel — usado no menu de usuario e no dialogo de conta. */
export const ROLE_LABELS: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'Administrador da plataforma',
  ORG_ADMIN: 'Administrador da conta',
  ORG_OPERATOR: 'Operador',
  CLIENT_VIEWER: 'Portal do cliente',
}

export type PermissionUser = {
  id: string | null
  email: string | null
  role: AppRole | null
  organizationId: string | null
  clientId: string | null
  clientSlug: string | null
}

/** Dados minimos do tenant necessarios para decidir acesso. */
export type TenantRef = {
  id: string
  slug: string
  organizationId: string
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value)
}

export function getPermissionUser(
  user:
    | {
        id?: string | null
        email?: string | null
        role?: string | null
        organizationId?: string | null
        clientId?: string | null
        clientSlug?: string | null
      }
    | null
    | undefined
): PermissionUser {
  return {
    id: user?.id ?? null,
    email: user?.email ?? null,
    role: isAppRole(user?.role) ? user.role : null,
    organizationId: user?.organizationId ?? null,
    clientId: user?.clientId ?? null,
    clientSlug: user?.clientSlug ?? null,
  }
}

export function getSessionPermissionUser(session: Session | null | undefined) {
  return getPermissionUser(session?.user)
}

export function isPlatformAdmin(user: PermissionUser | null | undefined) {
  return user?.role === 'PLATFORM_ADMIN'
}

export function isOrgAdmin(user: PermissionUser | null | undefined) {
  return user?.role === 'ORG_ADMIN'
}

export function isOrgOperator(user: PermissionUser | null | undefined) {
  return user?.role === 'ORG_OPERATOR'
}

export function isClientViewer(user: PermissionUser | null | undefined) {
  return user?.role === 'CLIENT_VIEWER'
}

/** Usuario pertence a Organization informada (ou e admin da plataforma). */
export function canAccessOrganization(
  user: PermissionUser | null | undefined,
  organizationId: string
) {
  return isPlatformAdmin(user) || (!!user?.organizationId && user.organizationId === organizationId)
}

export function canAccessGlobalAdmin(user: PermissionUser | null | undefined) {
  return isPlatformAdmin(user)
}

/**
 * Acesso a superficie de OPERACAO (/tenant/[slug]).
 * CLIENT_VIEWER nao entra aqui de proposito: o cliente final usa /portal, que
 * deriva o cliente da sessao e nao expoe acao nenhuma. Manter os dois caminhos
 * abertos para o mesmo dado significaria duas regras para manter em sincronia.
 */
export function canAccessTenant(user: PermissionUser | null | undefined, tenant: TenantRef) {
  if (isPlatformAdmin(user)) return true
  if (isOrgAdmin(user) || isOrgOperator(user)) {
    return user?.organizationId === tenant.organizationId
  }
  return false
}

/**
 * Leitura de dados/exportacoes CSV do tenant: permite tambem CLIENT_VIEWER
 * exclusivamente para o seu proprio clientId.
 */
export function canReadTenantData(user: PermissionUser | null | undefined, tenant: TenantRef) {
  if (canAccessTenant(user, tenant)) return true
  return isClientViewer(user) && !!user?.clientId && user.clientId === tenant.id
}

/** Administrar o tenant: credenciais, exclusoes, alertas, usuarios. */
export function canManageTenant(user: PermissionUser | null | undefined, tenant: TenantRef) {
  if (isPlatformAdmin(user)) return true
  return isOrgAdmin(user) && user?.organizationId === tenant.organizationId
}

/** Disparar comando remoto: admin ou operador da organizacao dona do tenant. */
export function canOperateTenant(user: PermissionUser | null | undefined, tenant: TenantRef) {
  if (canManageTenant(user, tenant)) return true
  return isOrgOperator(user) && user?.organizationId === tenant.organizationId
}

export function canViewTenantAudit(user: PermissionUser | null | undefined, tenant: TenantRef) {
  return canManageTenant(user, tenant)
}

export function canDeleteTenantAsset(user: PermissionUser | null | undefined, tenant: TenantRef) {
  return canManageTenant(user, tenant)
}

export function canManageTenantAlerts(user: PermissionUser | null | undefined, tenant: TenantRef) {
  return canManageTenant(user, tenant)
}

/** Editar patrimonio/financeiro: dado operacional, nao credencial — mesmo escopo de canOperateTenant. */
export function canManageAssetRecord(user: PermissionUser | null | undefined, tenant: TenantRef) {
  return canOperateTenant(user, tenant)
}

export function canViewTenantAdminNavigation(user: PermissionUser | null | undefined) {
  return isPlatformAdmin(user) || isOrgAdmin(user) || isOrgOperator(user)
}

/**
 * Portao GROSSEIRO para o middleware (Edge Runtime, sem acesso ao banco).
 * Nao consegue provar que a Organization do usuario e dona do slug — isso exige
 * consulta. A checagem definitiva e feita server-side em `requireTenantContext`,
 * que e o unico ponto onde o tenant e resolvido. Nunca use esta funcao como
 * autorizacao final.
 */
export function canPossiblyAccessTenantSlug(
  user: PermissionUser | null | undefined,
  _tenantSlug: string
) {
  if (isPlatformAdmin(user)) return true
  if (isOrgAdmin(user) || isOrgOperator(user)) return !!user?.organizationId
  return false
}
