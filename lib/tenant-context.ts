import { cache } from 'react'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessTenant, getSessionPermissionUser, type TenantRef } from '@/lib/permissions'

export type TenantContext = {
  id: string
  name: string
  slug: string
  organizationId: string
}

async function resolveTenantContext(clientSlug: string): Promise<TenantContext | null> {
  const normalizedSlug = clientSlug.trim().toLowerCase()
  if (!normalizedSlug) return null

  const client = await prisma.client.findUnique({
    where: { slug: normalizedSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      organizationId: true,
      organization: { select: { isActive: true } },
    },
  })

  if (!client || !client.isActive || !client.organization?.isActive) {
    return null
  }

  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    organizationId: client.organizationId,
  }
}

export const getTenantContext = cache(resolveTenantContext)

/**
 * Ponto unico de autorizacao de tenant. Resolve o tenant E verifica se a sessao
 * atual pode ve-lo — o middleware sozinho nao consegue (roda no Edge, sem banco,
 * e nao sabe qual Organization e dona do slug).
 *
 * Responde `notFound()` em vez de 403 de proposito: nao revela a existencia de um
 * tenant de outra organizacao.
 */
export async function requireTenantContext(clientSlug: string): Promise<TenantContext> {
  const tenant = await getTenantContext(clientSlug)
  if (!tenant) {
    notFound()
  }

  const session = await auth()
  if (!session?.user) {
    notFound()
  }

  if (!canAccessTenant(getSessionPermissionUser(session), tenant satisfies TenantRef)) {
    notFound()
  }

  return tenant
}
