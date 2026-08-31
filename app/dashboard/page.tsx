import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { getTenantBasePath } from '@/lib/tenant-links'

/**
 * Ponto de entrada pos-login: encaminha cada papel para a sua superficie.
 * PLATFORM_ADMIN -> administracao global
 * ORG_ADMIN / ORG_OPERATOR -> primeiro cliente da propria organizacao
 * CLIENT_VIEWER -> apenas o proprio cliente
 */
export default async function DashboardRedirectPage() {
  const session = await auth()
  const isDev = process.env.NODE_ENV !== 'production'

  if (!session?.user) {
    redirect('/login')
  }

  const { role, organizationId, clientId } = session.user

  if (isDev) console.log(`[DashboardRedirect] Role: ${role}, Org: ${organizationId}, Client: ${clientId}`)

  if (role === 'PLATFORM_ADMIN') {
    redirect('/admin/clients')
  }

  // O portal deriva o cliente da sessao, entao nao precisa de slug na URL.
  if (role === 'CLIENT_VIEWER') {
    if (!clientId) redirect('/login?error=no-tenant')
    redirect('/portal')
  }

  // ORG_ADMIN / ORG_OPERATOR: entram pelo cliente vinculado; se a conta tiver
  // varios clientes e nenhum vinculo direto, cai no primeiro da organizacao.
  if (!organizationId && !clientId) {
    redirect('/login?error=no-tenant')
  }

  const client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId }, select: { slug: true } })
    : await prisma.client.findFirst({
        where: { organizationId: organizationId as string, isActive: true },
        orderBy: { name: 'asc' },
        select: { slug: true },
      })

  if (!client) {
    redirect('/login?error=tenant-not-found')
  }

  redirect(getTenantBasePath(client.slug))
}
