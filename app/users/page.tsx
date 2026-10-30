import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Download, Shield, UserRound, Users } from 'lucide-react'
import { Sidebar, Header } from '@/components/sidebar'
import { Button } from '@/components/ui/button'
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

type UserFilter = 'all' | 'active' | 'admins' | 'operators'

const USER_FILTERS: readonly UserFilter[] = ['all', 'active', 'admins', 'operators']

function parseUserFilter(value: string | undefined): UserFilter {
  return USER_FILTERS.includes(value as UserFilter) ? (value as UserFilter) : 'all'
}

function isAdminRole(role: string) {
  return role === 'PLATFORM_ADMIN' || role === 'ORG_ADMIN'
}

function isOperatorRole(role: string) {
  return role === 'ORG_OPERATOR' || role === 'CLIENT_VIEWER'
}

function monogram(name: string | null, email: string) {
  return (name?.trim() || email).charAt(0).toUpperCase()
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ filter?: string }>
}) {
  const activeFilter = parseUserFilter((await searchParams)?.filter)
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

  const filteredUsers = users.filter((u) => {
    if (activeFilter === 'active') return u.isActive
    if (activeFilter === 'admins') return isAdminRole(u.role)
    if (activeFilter === 'operators') return isOperatorRole(u.role)
    return true
  })

  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
      <div className="min-w-0 flex-1 lg:pl-64">
        <Header user={{ name: session?.user?.name, email: session?.user?.email, role: user.role }} />
        <main className="p-4 lg:p-6">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
                <p className="text-muted-foreground">
                  {isPlatformAdmin(user)
                    ? 'Todos os usuários da plataforma.'
                    : 'Usuários da sua organização.'}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/users/csv">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar CSV
                </a>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                href="/users"
                active={activeFilter === 'all'}
                label="Total de Usuários"
                value={users.length}
                subtitle="contas no seu escopo"
                icon={<Users />}
              />
              <KpiCard
                href="/users?filter=active"
                active={activeFilter === 'active'}
                label="Usuários Ativos"
                value={users.filter((u) => u.isActive).length}
                subtitle="com acesso liberado"
                icon={<CheckCircle2 />}
                tone="success"
              />
              <KpiCard
                href="/users?filter=admins"
                active={activeFilter === 'admins'}
                label="Administradores"
                value={users.filter((u) => isAdminRole(u.role)).length}
                subtitle="plataforma e organizações"
                icon={<Shield />}
              />
              <KpiCard
                href="/users?filter=operators"
                active={activeFilter === 'operators'}
                label="Operadores & Portal"
                value={users.filter((u) => isOperatorRole(u.role)).length}
                subtitle="operação e leitura"
                icon={<UserRound />}
              />
            </div>

            <Panel>
              <PanelHeader
                icon={<Users />}
                title="Contas cadastradas"
                description="Papel RBAC, escopo organizacional e estado de cada credencial."
                action={
                  activeFilter !== 'all' && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/users">Limpar filtro</Link>
                    </Button>
                  )
                }
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
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={cn(TABLE_CELL_CLASS, 'text-muted-foreground')}>
                            Nenhum usuário encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((row) => (
                          <tr
                            key={row.id}
                            className={cn('border-b border-surface-line last:border-0', STATIC_ROW_HOVER_CLASS)}
                          >
                            <td className={TABLE_CELL_CLASS}>
                              <div className="flex items-center gap-3">
                                <span
                                  aria-hidden
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-surface-line bg-surface-raise text-xs font-bold text-foreground/85"
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
