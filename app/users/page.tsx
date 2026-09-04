import { notFound } from 'next/navigation'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import {
  getSessionPermissionUser,
  isOrgAdmin,
  isPlatformAdmin,
  type AppRole,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { STATIC_ROW_HOVER_CLASS, TABLE_CELL_CLASS, TABLE_HEAD_CLASS, TABLE_HEAD_ROW_CLASS } from '@/lib/table-styles'

const ROLE_LABELS: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'Administrador da plataforma',
  ORG_ADMIN: 'Administrador da conta',
  ORG_OPERATOR: 'Operador',
  CLIENT_VIEWER: 'Portal do cliente',
}

export default async function UsersPage() {
  const session = await auth()
  const user = getSessionPermissionUser(session)

  if (!isPlatformAdmin(user) && !isOrgAdmin(user)) {
    notFound()
  }

  // PLATFORM_ADMIN ve todos; ORG_ADMIN so os da propria organizacao.
  const users = await prisma.user.findMany({
    where: isPlatformAdmin(user)
      ? undefined
      : { organizationId: user.organizationId ?? '__sem_organizacao__' },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      organization: { select: { name: true } },
      client: { select: { name: true } },
    },
  })

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="flex-1 pl-64">
        <Header />
        <main className="p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
              <p className="text-muted-foreground">
                {isPlatformAdmin(user)
                  ? 'Todos os usuários da plataforma.'
                  : 'Usuários da sua organização.'}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className={TABLE_HEAD_ROW_CLASS}>
                    <th className={TABLE_HEAD_CLASS}>Usuário</th>
                    <th className={TABLE_HEAD_CLASS}>Papel</th>
                    <th className={TABLE_HEAD_CLASS}>Escopo</th>
                    <th className={TABLE_HEAD_CLASS}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-muted-foreground">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    users.map((row) => (
                      <tr key={row.id} className={cn('border-b last:border-0', STATIC_ROW_HOVER_CLASS)}>
                        <td className={TABLE_CELL_CLASS}>
                          <p className="font-medium text-foreground">{row.name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </td>
                        <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                          {ROLE_LABELS[row.role as AppRole] ?? row.role}
                        </td>
                        <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                          {row.client?.name ?? row.organization?.name ?? 'Plataforma'}
                        </td>
                        <td className={TABLE_CELL_CLASS}>
                          <span
                            className={cn(
                              'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              row.isActive
                                ? 'border-success/30 bg-success/10 text-success'
                                : 'border-border bg-muted/40 text-muted-foreground'
                            )}
                          >
                            {row.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              A criação e o convite de usuários pelo painel ainda não estão implementados — hoje os
              usuários são criados por <code className="font-mono">scripts/seed-rbac.ts</code> ou por{' '}
              <code className="font-mono">POST /api/auth/signup</code>.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
