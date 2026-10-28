// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import {
  getAccountOverviewAction,
  updateAccountPreferencesAction,
  updateAccountProfileDetailsAction,
} from '@/app/account/actions'
import {
  getTenantCompanyProfile,
  updateTenantCompanyProfileAction,
  type CompanyProfileData,
} from '@/app/app/[clientSlug]/settings/actions'
import { AccountDialog, type AccountDialogTab } from '@/components/account-dialog'
import { TenantCompanyProfileForm } from '@/components/tenant-company-profile-form'

// Sprint V24 — cargo/contato, preferencias e atividade da conta, e dados da
// empresa/NOC do tenant. Tudo persistido em AuditLog (sem coluna nova no
// schema): grava com recordAuditLog, le o ultimo registro da action.

type FakeUser = { id: string; name: string | null; email: string; passwordHash: string; isActive: boolean }
type AuditRow = {
  id: string
  actorUserId: string | null
  clientId: string | null
  action: string
  targetType: string
  targetId: string | null
  metadataJson: string | null
  createdAt: Date
}
type Where = {
  action?: string
  targetType?: string
  targetId?: string
  clientId?: string
  OR?: Array<Partial<AuditRow>>
}

const { users, auditLogs, sessionRef, tenants, fakePrisma } = vi.hoisted(() => {
  const users = new Map<string, FakeUser>()
  const auditLogs: AuditRow[] = []
  const sessionRef: { user: Record<string, unknown> | null } = { user: null }
  const tenants = new Map<string, { id: string; name: string; slug: string; organizationId: string }>()
  let counter = 0

  const matches = (row: AuditRow, where: Where): boolean => {
    if (where.OR) return where.OR.some((clause) => matches(row, clause as Where))
    return Object.entries(where).every(([key, value]) => row[key as keyof AuditRow] === value)
  }
  const sorted = (where: Where) =>
    auditLogs.filter((row) => matches(row, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  const fakePrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        users.has(where.id) ? { ...users.get(where.id)! } : null
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Omit<AuditRow, 'id' | 'createdAt'> }) => {
        const row: AuditRow = { ...data, id: `log-${++counter}`, createdAt: new Date(Date.UTC(2026, 9, 1, 12, counter)) }
        auditLogs.push(row)
        return row
      }),
      findFirst: vi.fn(async ({ where }: { where: Where }) => sorted(where)[0] ?? null),
      findMany: vi.fn(async ({ where, take }: { where: Where; take: number }) => sorted(where).slice(0, take)),
    },
  }

  return { users, auditLogs, sessionRef, tenants, fakePrisma }
})

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => (sessionRef.user ? { user: sessionRef.user } : null)),
  unstable_update: vi.fn(async () => null),
}))
vi.mock('@/lib/prisma', () => ({ default: fakePrisma }))
vi.mock('@/lib/tenant-context', () => ({
  getTenantContext: vi.fn(async (slug: string) => tenants.get(slug) ?? null),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))

const IDLE = { status: 'idle' as const, message: null }

function form(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.set(key, value)
  return formData
}

const metadataOf = (row: AuditRow) => JSON.parse(row.metadataJson ?? 'null')

beforeEach(() => {
  users.clear()
  auditLogs.length = 0
  tenants.clear()
  users.set('u1', { id: 'u1', name: 'Ana', email: 'ana@a.com', passwordHash: 'x', isActive: true })
  users.set('u2', { id: 'u2', name: 'Bia', email: 'bia@a.com', passwordHash: 'x', isActive: true })
  tenants.set('cliente-a', { id: 'client-a', name: 'Cliente A', slug: 'cliente-a', organizationId: 'org-a' })
  sessionRef.user = { id: 'u1', email: 'ana@a.com', role: 'ORG_ADMIN', organizationId: 'org-a', clientId: null }
})

describe('updateAccountProfileDetailsAction', () => {
  it('grava cargo/contato no AuditLog da propria conta', async () => {
    const result = await updateAccountProfileDetailsAction(
      IDLE,
      form({ jobTitle: ' Analista NOC ', department: 'Operações de TI', phone: '+55 11 99999-0000' })
    )
    expect(result).toEqual({ status: 'success', message: 'Dados de contato atualizados.' })
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      action: 'account.profile_details_update',
      targetType: 'user',
      targetId: 'u1',
      actorUserId: 'u1',
    })
    expect(metadataOf(auditLogs[0])).toEqual({
      jobTitle: 'Analista NOC',
      department: 'Operações de TI',
      phone: '+55 11 99999-0000',
    })
  })

  it('aceita campos vazios e ignora id/userId do payload (RNF004)', async () => {
    const result = await updateAccountProfileDetailsAction(IDLE, form({ id: 'u2', userId: 'u2' }))
    expect(result.status).toBe('success')
    expect(auditLogs[0].targetId).toBe('u1')
    expect(metadataOf(auditLogs[0])).toEqual({ jobTitle: '', department: '', phone: '' })
  })

  it('rejeita telefone invalido, texto longo e sessao ausente', async () => {
    expect(await updateAccountProfileDetailsAction(IDLE, form({ phone: '11 9999<script>' }))).toEqual({
      status: 'error',
      message: 'Telefone contém caracteres inválidos.',
    })
    expect((await updateAccountProfileDetailsAction(IDLE, form({ jobTitle: 'x'.repeat(81) }))).status).toBe('error')
    sessionRef.user = null
    expect((await updateAccountProfileDetailsAction(IDLE, form({ jobTitle: 'NOC' }))).message).toMatch(/Sessão expirada/)
    expect(auditLogs).toHaveLength(0)
  })
})

describe('updateAccountPreferencesAction', () => {
  it('grava fuso, formato e flags (checkbox ausente = false)', async () => {
    const result = await updateAccountPreferencesAction(
      IDLE,
      form({ timezone: 'Europe/Lisbon', dateFormat: '12h', notifyOffline: 'on', notifySecurity: 'true' })
    )
    expect(result).toEqual({ status: 'success', message: 'Preferências salvas.' })
    expect(auditLogs[0]).toMatchObject({ action: 'account.preferences_update', targetType: 'user', targetId: 'u1' })
    expect(metadataOf(auditLogs[0])).toEqual({
      timezone: 'Europe/Lisbon',
      dateFormat: '12h',
      notifyOffline: true,
      notifyHardware: false,
      notifySecurity: true,
    })
  })

  it('rejeita fuso e formato fora da lista', async () => {
    expect((await updateAccountPreferencesAction(IDLE, form({ timezone: 'Mars/Base', dateFormat: '24h' }))).status).toBe(
      'error'
    )
    expect(
      (await updateAccountPreferencesAction(IDLE, form({ timezone: 'UTC', dateFormat: 'iso' }))).status
    ).toBe('error')
    expect(auditLogs).toHaveLength(0)
  })
})

describe('getAccountOverviewAction', () => {
  it('sem sessao devolve null', async () => {
    sessionRef.user = null
    expect(await getAccountOverviewAction()).toBeNull()
  })

  it('sem registros devolve os defaults', async () => {
    expect(await getAccountOverviewAction()).toEqual({
      profileDetails: { jobTitle: '', department: '', phone: '' },
      preferences: {
        timezone: 'America/Sao_Paulo',
        dateFormat: '24h',
        notifyOffline: true,
        notifyHardware: true,
        notifySecurity: true,
      },
      recentEvents: [],
    })
  })

  it('hidrata do ultimo registro e lista so eventos da propria conta', async () => {
    await updateAccountProfileDetailsAction(IDLE, form({ jobTitle: 'Antigo' }))
    await updateAccountProfileDetailsAction(IDLE, form({ jobTitle: 'Gerente de TI', phone: '1199' }))
    await updateAccountPreferencesAction(IDLE, form({ timezone: 'UTC', dateFormat: '12h' }))
    sessionRef.user = { id: 'u2', email: 'bia@a.com', role: 'ORG_ADMIN', organizationId: 'org-a' }
    await updateAccountProfileDetailsAction(IDLE, form({ jobTitle: 'Outra conta' }))
    sessionRef.user = { id: 'u1', email: 'ana@a.com', role: 'ORG_ADMIN', organizationId: 'org-a' }

    const overview = await getAccountOverviewAction()
    expect(overview?.profileDetails).toEqual({ jobTitle: 'Gerente de TI', department: '', phone: '1199' })
    expect(overview?.preferences).toMatchObject({ timezone: 'UTC', dateFormat: '12h', notifyOffline: false })
    expect(overview?.recentEvents.map((event) => event.action)).toEqual([
      'account.preferences_update',
      'account.profile_details_update',
      'account.profile_details_update',
    ])
    expect(overview?.recentEvents[0].createdAt).toMatch(/^2026-10-01T/)
  })
})

describe('updateTenantCompanyProfileAction', () => {
  const valid = {
    tenantSlug: 'cliente-a',
    legalName: 'Cliente A Ltda',
    taxId: '12.345.678/0001-90',
    sector: 'Saúde',
    nocContactName: 'Carlos',
    nocContactEmail: 'noc@cliente-a.com',
    nocContactPhone: '+55 11 4000-0000',
    maintenanceWindow: 'Domingos 02:00 às 06:00',
  }

  it('ORG_ADMIN da organizacao grava no AuditLog do tenant', async () => {
    const result = await updateTenantCompanyProfileAction(IDLE, form(valid))
    expect(result).toEqual({ status: 'success', message: 'Dados da empresa e contatos de emergência atualizados.' })
    expect(auditLogs[0]).toMatchObject({
      action: 'tenant.company_profile_update',
      targetType: 'client',
      targetId: 'client-a',
      clientId: 'client-a',
      actorUserId: 'u1',
    })
    const { tenantSlug: _slug, ...metadata } = valid
    expect(metadataOf(auditLogs[0])).toEqual(metadata)

    const profile = await getTenantCompanyProfile('client-a', 'Cliente A')
    expect(profile).toMatchObject(metadata)
    expect(profile.updatedAt).toMatch(/^2026-10-01T/)
  })

  it('valida razao social, CNPJ e e-mail de escalonamento', async () => {
    expect((await updateTenantCompanyProfileAction(IDLE, form({ ...valid, legalName: 'A' }))).message).toBe(
      'Informe a razão social ou nome da empresa.'
    )
    expect((await updateTenantCompanyProfileAction(IDLE, form({ ...valid, taxId: '9'.repeat(33) }))).message).toBe(
      'CNPJ/identificador longo demais.'
    )
    expect(
      (await updateTenantCompanyProfileAction(IDLE, form({ ...valid, nocContactEmail: 'nao-e-email' }))).message
    ).toBe('Informe um e-mail de escalonamento válido.')
    expect((await updateTenantCompanyProfileAction(IDLE, form({ ...valid, nocContactEmail: '' }))).status).toBe(
      'success'
    )
  })

  it('bloqueia quem nao pode gerenciar alertas do tenant', async () => {
    for (const user of [
      { id: 'u1', role: 'ORG_OPERATOR', organizationId: 'org-a' },
      { id: 'u1', role: 'CLIENT_VIEWER', organizationId: 'org-a', clientId: 'client-a' },
      { id: 'u1', role: 'ORG_ADMIN', organizationId: 'org-b' },
    ]) {
      sessionRef.user = user
      expect(await updateTenantCompanyProfileAction(IDLE, form(valid))).toEqual({
        status: 'error',
        message: 'Você não tem permissão para alterar os dados desta empresa.',
      })
    }
    expect(auditLogs).toHaveLength(0)
  })

  it('sem registro usa o nome do tenant como razao social', async () => {
    expect(await getTenantCompanyProfile('client-a', 'Cliente A')).toEqual({
      legalName: 'Cliente A',
      taxId: '',
      sector: '',
      nocContactName: '',
      nocContactEmail: '',
      nocContactPhone: '',
      maintenanceWindow: '',
      updatedAt: null,
    })
  })
})

describe('AccountDialog — 4 abas', () => {
  function renderDialog(tab: AccountDialogTab) {
    return render(
      <AccountDialog
        open
        onOpenChange={vi.fn()}
        tab={tab}
        onTabChange={vi.fn()}
        user={{ name: 'Ana', email: 'ana@a.com', role: 'ORG_ADMIN' }}
      />
    )
  }

  it('lista as 4 abas e o perfil com nome, contato e e-mail', async () => {
    renderDialog('profile')
    for (const label of ['Perfil', 'Preferências', 'Segurança', 'Acessos']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Salvar nome' })).toBeTruthy()
    expect(screen.getByLabelText('Cargo / Função')).toBeTruthy()
    expect(screen.getByLabelText('Telefone / WhatsApp de plantão')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alterar e-mail' })).toBeTruthy()
    await waitFor(() => expect(fakePrisma.auditLog.findMany).toHaveBeenCalled())
  })

  it('preferencias: selects de fuso/formato e 3 checkboxes', () => {
    renderDialog('preferences')
    expect((screen.getByLabelText('Fuso horário') as HTMLSelectElement).value).toBe('America/Sao_Paulo')
    expect(screen.getByRole('option', { name: 'Lisboa (GMT+0/+1)' })).toBeTruthy()
    expect(screen.getByLabelText('Formato de data e hora')).toBeTruthy()
    expect((screen.getByLabelText('Alertas críticos de disco e S.M.A.R.T.') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Salvar preferências' })).toBeTruthy()
  })

  it('seguranca: papel RBAC e formulario de senha', () => {
    renderDialog('security')
    expect(screen.getByText('Administrador da conta')).toBeTruthy()
    expect(screen.getByLabelText('Confirmar nova senha')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeTruthy()
  })

  it('acessos: sessao atual e atividade recente traduzida', async () => {
    renderDialog('sessions')
    expect(screen.getByText('Ativa neste dispositivo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Encerrar sessão' })).toBeTruthy()
    expect(screen.getByText('Nenhum evento recente registrado para esta conta.')).toBeTruthy()
  })

  it('acessos: rotula eventos do AuditLog em PT-BR', async () => {
    await updateAccountPreferencesAction(IDLE, form({ timezone: 'UTC', dateFormat: '24h' }))
    renderDialog('sessions')
    expect(await screen.findByText('Preferências salvas')).toBeTruthy()
  })
})

describe('TenantCompanyProfileForm', () => {
  const data: CompanyProfileData = {
    legalName: 'Cliente A Ltda',
    taxId: '12.345.678/0001-90',
    sector: 'Saúde',
    nocContactName: 'Carlos',
    nocContactEmail: 'noc@cliente-a.com',
    nocContactPhone: '',
    maintenanceWindow: '',
    updatedAt: null,
  }

  it('modo edicao: campos preenchidos e botao de salvar', () => {
    render(<TenantCompanyProfileForm tenantSlug="cliente-a" initialData={data} canManage />)
    expect((screen.getByLabelText('Razão Social / Nome Corporativo') as HTMLInputElement).value).toBe('Cliente A Ltda')
    expect(screen.getByLabelText('CNPJ / Identificação Fiscal').getAttribute('placeholder')).toBe('00.000.000/0001-00')
    expect(screen.getByLabelText('E-mail de Escalonamento Crítico')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar dados da empresa' })).toBeTruthy()
    expect(screen.queryByText('Somente leitura')).toBeNull()
  })

  it('modo somente leitura: sem inputs, com badge', () => {
    const { container } = render(
      <TenantCompanyProfileForm tenantSlug="cliente-a" initialData={data} canManage={false} />
    )
    expect(screen.getByText('Somente leitura')).toBeTruthy()
    expect(screen.getByText('noc@cliente-a.com')).toBeTruthy()
    expect(container.querySelector('input')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar dados da empresa' })).toBeNull()
  })
})
