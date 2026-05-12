import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function DashboardRedirectPage() {
  const session = await auth()

  if (!session?.user) {
    console.log('[DashboardRedirect] No session found, redirecting to /login')
    redirect('/login')
  }

  const role = session.user.role
  const clientId = session.user.clientId

  console.log(`[DashboardRedirect] User: ${session.user.email}, Role: ${role}, ClientId: ${clientId}`)

  if (role === 'SUPER_ADMIN') {
    console.log('[DashboardRedirect] Super Admin detected, redirecting to /clients')
    redirect('/clients')
  }

  if (!clientId) {
    // Se não tem clientId e não é SUPER_ADMIN, algo está errado ou é um admin tenant sem vínculo
    // Por enquanto, manda para a home ou exibe erro
    redirect('/login?error=no-tenant')
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { slug: true }
  })

  if (!client) {
    redirect('/login?error=tenant-not-found')
  }

  redirect(`/tenant/${client.slug}`)
}
