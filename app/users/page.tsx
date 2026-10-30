import { notFound } from 'next/navigation'
import { CheckCircle2, Shield, UserRound, Users } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import {
  getSessionPermissionUser,
  isOrgAdmin,
  isPlatformAdmin,
  type AppRole,
} from '@/lib/permissions'
import { KpiCard } from '@/components/ui/kpi-card'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel'
import { StatusPill } from '@/components/ui/status-pill'
import {
  STATIC_ROW_HOVER_CLASS,
  TABLE_CELL_CLASS,
  TABLE_HEAD_CLASS,
  TABLE_HEAD_ROW_CLASS,
} from '@/lib/table-styles'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<AppRole, string> = {
  PLATFORM_ADMIN: 'Administrador da plataforma',
  ORG_ADMIN: 'Administrador da conta',
  ORG_OPERATOR: 'Operador',
  CLIENT_VIEWER: 'Portal do cliente',
}

function monogram(name: string | null, email: string) {
  return (name?.trim() || email).charAt(0).toUpperCase()
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
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
              <p className="text-muted-foreground">
                {isPlatformAdmin(user)
                  ? 'Todos os usuários da plataforma.'
                  : 'Usuários da sua organização.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                href="/users"
                label="Total de Usuários"
                value={users.length}
                subtitle="contas no seu escopo"
                icon={<Users />}
              />
              <KpiCard
                href="/users"
                label="Usuários Ativos"
                value={users.filter((u) => u.isActive).length}
                subtitle="com acesso liberado"
                icon={<CheckCircle2 />}
                tone="success"
              />
              <KpiCard
                href="/users"
                label="Administradores"
                value={users.filter((u) => u.role === 'PLATFORM_ADMIN' || u.role === 'ORG_ADMIN').length}
                subtitle="plataforma e organizações"
                icon={<Shield />}
              />
              <KpiCard
                href="/users"
                label="Operadores & Portal"
                value={users.filter((u) => u.role === 'ORG_OPERATOR' || u.role === 'CLIENT_VIEWER').length}
                subtitle="operação e leitura"
                icon={<UserRound />}
              />
            </div>

            <Panel>
              <PanelHeader
                icon={<Users />}
                title="Contas cadastradas"
                description="Papel RBAC, escopo organizacional e estado de cada credencial."
              />
              <PanelBody flush>
                <div className="overflow-x-auto">
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
                          <td colSpan={4} className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                            Nenhum usuário encontrado.
                          </td>
                        </tr>
                      ) : (
                        users.map((row) => (
                          <tr
                            key={row.id}
                            className={cn('border-b border-surface-line last:border-0', STATIC_ROW_HOVER_CLASS)}
                          >
                            <td className={TABLE_CELL_CLASS}>
                              <div className="flex items-center gap-3">
                                <span
                                  aria-hidden
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-xs font-bold text-primary"
                                >
                                  {monogram(row.name, row.email)}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground">{row.name ?? '—'}</p>
                                  <p className="data-mono text-xs text-muted-foreground">{row.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                              {ROLE_LABELS[row.role as AppRole] ?? row.role}
                            </td>
                            <td className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                              {row.client?.name ?? row.organization?.name ?? 'Plataforma'}
                            </td>
                            <td className={TABLE_CELL_CLASS}>
                              <StatusPill
                                tone={row.isActive ? 'success' : 'neutral'}
                                label={row.isActive ? 'Ativo' : 'Inativo'}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </PanelBody>
            </Panel>

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
