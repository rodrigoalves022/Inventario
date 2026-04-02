import { cache } from 'react'
import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'

export type TenantContext = {
  id: string
  name: string
  slug: string
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
    },
  })

  if (!client || !client.isActive) {
    return null
  }

  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
  }
}

export const getTenantContext = cache(resolveTenantContext)

export async function requireTenantContext(clientSlug: string): Promise<TenantContext> {
  const tenant = await getTenantContext(clientSlug)
  if (!tenant) {
    notFound()
  }

  return tenant
}
