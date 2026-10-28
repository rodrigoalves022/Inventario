'use server'

import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { auth, unstable_update } from '@/auth'
import prisma from '@/lib/prisma'
import { getSessionAuditActor, recordAuditLog } from '@/lib/audit-log'

/**
 * Sprint V21 — gerenciamento da PROPRIA conta (menu de usuario).
 *
 * RNF004: o `user.id` vem SEMPRE de `auth()`. Nenhum schema abaixo aceita
 * `id`/`userId` no payload — um campo extra no FormData e simplesmente
 * ignorado, entao nao ha como apontar a action para outra conta.
 * RNF009: as tres operacoes gravam AuditLog com action `account.*`.
 *
 * Hash: bcryptjs com custo 10, o mesmo mecanismo que `lib/auth-credentials.ts`
 * usa no `bcrypt.compare` do login.
 */

export type AccountActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const BCRYPT_COST = 10
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72 // bcrypt ignora bytes alem de 72

const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter ao menos 2 caracteres.')
    .max(80, 'O nome pode ter no máximo 80 caracteres.')
    .regex(/^[\p{L}\p{M}0-9 .'-]+$/u, 'O nome contém caracteres inválidos.'),
})

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, 'E-mail longo demais.').email('Informe um e-mail válido.'),
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(PASSWORD_MAX),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.').max(PASSWORD_MAX),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `A nova senha precisa ter ao menos ${PASSWORD_MIN} caracteres.`)
      .max(PASSWORD_MAX, `A nova senha pode ter no máximo ${PASSWORD_MAX} caracteres.`)
      .regex(/[A-Za-z]/, 'A nova senha precisa ter ao menos uma letra.')
      .regex(/[0-9]/, 'A nova senha precisa ter ao menos um número.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'A confirmação não confere com a nova senha.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha precisa ser diferente da atual.',
  })

const UNAUTHENTICATED: AccountActionState = {
  status: 'error',
  message: 'Sessão expirada. Entre novamente.',
}
const WRONG_PASSWORD: AccountActionState = {
  status: 'error',
  message: 'Senha atual incorreta.',
}

function fail(error: z.ZodError): AccountActionState {
  return {
    status: 'error',
    message: error.issues[0]?.message ?? 'Dados inválidos.',
  }
}

/** Usuario da sessao, relido do banco (ativo). Nunca a partir do payload. */
async function loadSessionUser() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      isActive: true,
    },
  })
  if (!user || !user.isActive) return null
  return { session, user }
}

/** Reemite o JWT: o callback `jwt` (auth.ts) rele nome/e-mail do banco no `update`. */
async function refreshSession() {
  await unstable_update({}).catch((error) => console.error('[Account] Falha ao reemitir sessão:', error))
}

export async function updateProfileNameAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = nameSchema.safeParse({ name: formData.get('name') })
  if (!parsed.success) return fail(parsed.error)

  const ctx = await loadSessionUser()
  if (!ctx) return UNAUTHENTICATED
  const { session, user } = ctx

  if (parsed.data.name === user.name) return { status: 'success', message: 'Nenhuma alteração.' }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
  })
  await recordAuditLog({
    action: 'account.name_update',
    targetType: 'user',
    targetId: user.id,
    actor: getSessionAuditActor(session.user),
    metadata: { previousName: user.name, newName: parsed.data.name },
  })
  await refreshSession()
  return { status: 'success', message: 'Nome atualizado.' }
}

export async function updateEmailAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = emailSchema.safeParse({
    email: formData.get('email'),
    currentPassword: formData.get('currentPassword'),
  })
  if (!parsed.success) return fail(parsed.error)

  const ctx = await loadSessionUser()
  if (!ctx) return UNAUTHENTICATED
  const { session, user } = ctx

  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) return WRONG_PASSWORD
  if (parsed.data.email === user.email.toLowerCase()) {
    return { status: 'error', message: 'O novo e-mail é igual ao atual.' }
  }

  const taken = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  })
  if (taken) return { status: 'error', message: 'Este e-mail já está em uso.' }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: parsed.data.email },
    })
  } catch (error) {
    // Corrida com outro cadastro entre o findUnique e o update: UNIQUE do banco decide.
    if ((error as { code?: string })?.code === 'P2002') {
      return { status: 'error', message: 'Este e-mail já está em uso.' }
    }
    throw error
  }

  await recordAuditLog({
    action: 'account.email_update',
    targetType: 'user',
    targetId: user.id,
    actor: getSessionAuditActor(session.user),
    metadata: { previousEmail: user.email, newEmail: parsed.data.email },
  })
  await refreshSession()
  return {
    status: 'success',
    message: 'E-mail atualizado. Use o novo e-mail no próximo login.',
  }
}

export async function changePasswordAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  })
  if (!parsed.success) return fail(parsed.error)

  const ctx = await loadSessionUser()
  if (!ctx) return UNAUTHENTICATED
  const { session, user } = ctx

  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) return WRONG_PASSWORD

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
  await recordAuditLog({
    action: 'account.password_change',
    targetType: 'user',
    targetId: user.id,
    actor: getSessionAuditActor(session.user),
    // Nunca grava senha nem hash — so o fato.
    metadata: { email: user.email },
  })
  return { status: 'success', message: 'Senha alterada.' }
}

/*
 * Sprint V24 — metadados estendidos da conta (cargo/contato e preferencias).
 * Sem coluna nova em `User`: cada gravacao e um AuditLog e a leitura pega o
 * ultimo registro da action. O historico de alteracoes sai de graca.
 */

export type AccountProfileDetails = { jobTitle: string; department: string; phone: string }

const ACCOUNT_TIMEZONES = ['America/Sao_Paulo', 'America/Manaus', 'UTC', 'Europe/Lisbon'] as const

export type AccountPreferences = {
  timezone: (typeof ACCOUNT_TIMEZONES)[number]
  dateFormat: '24h' | '12h'
  notifyOffline: boolean
  notifyHardware: boolean
  notifySecurity: boolean
}

export type AccountRecentEvent = { id: string; action: string; targetType: string; createdAt: string }

export type AccountOverview = {
  profileDetails: AccountProfileDetails
  preferences: AccountPreferences
  recentEvents: AccountRecentEvent[]
}

const PROFILE_DETAILS_ACTION = 'account.profile_details_update'
const PREFERENCES_ACTION = 'account.preferences_update'
const RECENT_EVENTS_LIMIT = 8

const DEFAULT_PROFILE_DETAILS: AccountProfileDetails = { jobTitle: '', department: '', phone: '' }
const DEFAULT_PREFERENCES: AccountPreferences = {
  timezone: 'America/Sao_Paulo',
  dateFormat: '24h',
  notifyOffline: true,
  notifyHardware: true,
  notifySecurity: true,
}

const profileDetailsSchema = z.object({
  jobTitle: z.string().trim().max(80, 'O cargo pode ter no máximo 80 caracteres.'),
  department: z.string().trim().max(80, 'O departamento pode ter no máximo 80 caracteres.'),
  phone: z
    .string()
    .trim()
    .max(30, 'O telefone pode ter no máximo 30 caracteres.')
    .regex(/^[0-9+\-() .]*$/, 'Telefone contém caracteres inválidos.'),
})

const preferencesSchema = z.object({
  timezone: z.enum(ACCOUNT_TIMEZONES, { message: 'Fuso horário inválido.' }),
  dateFormat: z.enum(['24h', '12h'], { message: 'Formato de data inválido.' }),
  notifyOffline: z.boolean(),
  notifyHardware: z.boolean(),
  notifySecurity: z.boolean(),
})

/** Campo opcional ausente vira '' (o schema decide o resto). */
function text(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function checked(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === 'on' || value === 'true'
}

function parseMetadata(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export async function updateAccountProfileDetailsAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = profileDetailsSchema.safeParse({
    jobTitle: text(formData, 'jobTitle'),
    department: text(formData, 'department'),
    phone: text(formData, 'phone'),
  })
  if (!parsed.success) return fail(parsed.error)

  const ctx = await loadSessionUser()
  if (!ctx) return UNAUTHENTICATED
  const { session, user } = ctx

  await recordAuditLog({
    action: PROFILE_DETAILS_ACTION,
    targetType: 'user',
    targetId: user.id,
    actor: getSessionAuditActor(session.user),
    metadata: parsed.data,
  })
  return { status: 'success', message: 'Dados de contato atualizados.' }
}

export async function updateAccountPreferencesAction(
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = preferencesSchema.safeParse({
    timezone: formData.get('timezone'),
    dateFormat: formData.get('dateFormat'),
    notifyOffline: checked(formData, 'notifyOffline'),
    notifyHardware: checked(formData, 'notifyHardware'),
    notifySecurity: checked(formData, 'notifySecurity'),
  })
  if (!parsed.success) return fail(parsed.error)

  const ctx = await loadSessionUser()
  if (!ctx) return UNAUTHENTICATED
  const { session, user } = ctx

  await recordAuditLog({
    action: PREFERENCES_ACTION,
    targetType: 'user',
    targetId: user.id,
    actor: getSessionAuditActor(session.user),
    metadata: parsed.data,
  })
  return { status: 'success', message: 'Preferências salvas.' }
}

async function findLatestUserMetadata(userId: string, action: string) {
  // Defensivo: mocks de prisma antigos nao implementam findFirst.
  if (typeof prisma.auditLog.findFirst !== 'function') return null
  try {
    const row = await prisma.auditLog.findFirst({
      where: { action, targetType: 'user', targetId: userId },
      orderBy: { createdAt: 'desc' },
      select: { metadataJson: true },
    })
    return parseMetadata(row?.metadataJson)
  } catch (error) {
    console.error(`[Account] Falha ao ler ${action}:`, error)
    return null
  }
}

async function findRecentEvents(userId: string): Promise<AccountRecentEvent[]> {
  if (typeof prisma.auditLog.findMany !== 'function') return []
  try {
    const rows = await prisma.auditLog.findMany({
      where: { OR: [{ actorUserId: userId }, { targetType: 'user', targetId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: RECENT_EVENTS_LIMIT,
      select: { id: true, action: true, targetType: true, createdAt: true },
    })
    return (rows ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      createdAt: new Date(row.createdAt).toISOString(),
    }))
  } catch (error) {
    console.error('[Account] Falha ao ler atividade recente:', error)
    return []
  }
}

export async function getAccountOverviewAction(): Promise<AccountOverview | null> {
  const ctx = await loadSessionUser()
  if (!ctx) return null
  const { user } = ctx

  const [rawDetails, rawPreferences, recentEvents] = await Promise.all([
    findLatestUserMetadata(user.id, PROFILE_DETAILS_ACTION),
    findLatestUserMetadata(user.id, PREFERENCES_ACTION),
    findRecentEvents(user.id),
  ])

  // Revalida o que vem do banco: um registro antigo/corrompido cai no default.
  const details = profileDetailsSchema.safeParse({ ...DEFAULT_PROFILE_DETAILS, ...rawDetails })
  const preferences = preferencesSchema.safeParse({ ...DEFAULT_PREFERENCES, ...rawPreferences })

  return {
    profileDetails: details.success ? details.data : DEFAULT_PROFILE_DETAILS,
    preferences: preferences.success ? preferences.data : DEFAULT_PREFERENCES,
    recentEvents,
  }
}
