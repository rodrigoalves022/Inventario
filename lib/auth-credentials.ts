import prisma from './prisma'
import bcrypt from 'bcryptjs'
import { recordAuditLog } from './audit-log'
import { isAppRole } from './permissions'

/**
 * Logica de `CredentialsProvider.authorize` (RF001), extraida para um modulo
 * proprio (sem importar 'next-auth') para ser testavel diretamente
 * (tests/auth-login.test.ts) sem precisar carregar next-auth inteiro —
 * CredentialsProvider() guarda a funcao passada em `.options.authorize`, nao
 * em `.authorize` (que fica um stub `() => null`), entao nao havia como
 * chamar o authorize real de fora sem essa extracao. Importar 'next-auth' num
 * teste tambem aciona `next-auth/lib/env.js`, que importa `next/server` sem
 * extensao (gap reconhecido pelo proprio next-auth no package.json#exports do
 * Next) — fora do runtime do Next isso quebra a resolucao ESM estrita do Node
 * quando o Vitest externaliza 'next-auth' para SSR. Manter esta funcao livre
 * de qualquer import de 'next-auth' evita o problema inteiramente, em vez de
 * tentar contorna-lo com mocks. Logica identica ao comportamento anterior, so
 * o modulo que mudou.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<'email' | 'password', unknown>> | undefined
) {
  const isDev = process.env.NODE_ENV !== 'production'
  try {
    const email = typeof credentials?.email === 'string' ? credentials.email : null
    const password = typeof credentials?.password === 'string' ? credentials.password : null

    if (!email || !password) {
      if (isDev) console.log('[Auth] Missing email or password')
      return null
    }

    if (isDev) console.log(`[Auth] Attempting login for: ${email}`)

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      if (isDev) console.log(`[Auth] User not found: ${email}`)
      return null
    }

    if (!isAppRole(user.role)) {
      if (isDev) console.error(`[Auth] Invalid role for user ${user.email}: ${user.role}`)
      return null
    }

    if (!user.isActive) {
      if (isDev) console.log(`[Auth] Inactive user: ${user.email}`)
      return null
    }

    let clientSlug = undefined
    if (user.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: user.clientId },
        select: { slug: true }
      })
      clientSlug = client?.slug
    }

    const passwordsMatch = await bcrypt.compare(
      password,
      user.passwordHash
    )

    if (passwordsMatch) {
      if (isDev) console.log(`[Auth] Login successful: ${user.email}, Role: ${user.role}`)
      // Auditoria nao pode bloquear autenticacao: falha de log e registrada, nao propagada.
      await recordAuditLog({
        action: 'login',
        targetType: 'user',
        targetId: user.id,
        clientId: user.clientId,
        actor: { userId: user.id, email: user.email, role: user.role, clientId: user.clientId },
      }).catch((error) => console.error('[Auth] Falha ao registrar auditoria de login:', error))
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        clientId: user.clientId,
        clientSlug: clientSlug ?? null
      }
    }

    if (isDev) console.log(`[Auth] Password mismatch for: ${user.email}`)
    return null
  } catch (error: unknown) {
    console.error('[Auth] Authorization error:', error)
    return null
  }
}
