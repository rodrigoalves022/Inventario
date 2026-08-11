import prisma from './prisma'
import type { PermissionUser } from './permissions'

const DEFAULT_ORGANIZATION_SLUG = 'default'
const DEFAULT_ORGANIZATION_NAME = 'Organização Padrão'

/**
 * Organizacao de acolhimento para fluxos que ainda nao escolhem uma conta
 * explicitamente (cliente legado, criacao por PLATFORM_ADMIN sem org propria).
 * Sera substituida pela selecao explicita de conta quando `/admin/organizations`
 * existir (Fase A3).
 */
export async function ensureDefaultOrganization() {
  const existing = await prisma.organization.findUnique({
    where: { slug: DEFAULT_ORGANIZATION_SLUG },
  })

  if (existing) return existing

  return prisma.organization.create({
    data: {
      name: DEFAULT_ORGANIZATION_NAME,
      slug: DEFAULT_ORGANIZATION_SLUG,
      type: 'MSP',
    },
  })
}

/**
 * Organizacao em que um novo Client deve ser criado por este ator.
 * Usuarios de organizacao criam sempre dentro da propria conta — nunca em outra.
 */
export async function resolveOrganizationIdForActor(user: PermissionUser | null | undefined) {
  if (user?.organizationId) return user.organizationId
  const fallback = await ensureDefaultOrganization()
  return fallback.id
}
