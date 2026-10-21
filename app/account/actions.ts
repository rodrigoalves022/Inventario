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
