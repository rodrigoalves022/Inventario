import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "./lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { recordAuditLog } from "./lib/audit-log"
import { isAppRole } from "./lib/permissions"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
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
    })
  ],
  events: {
    async signOut(message) {
      if (!('token' in message) || !message.token) return
      const token = message.token as Record<string, unknown>
      await recordAuditLog({
        action: 'logout',
        targetType: 'user',
        targetId: typeof token.sub === 'string' ? token.sub : null,
        clientId: typeof token.clientId === 'string' ? token.clientId : null,
        actor: {
          userId: typeof token.sub === 'string' ? token.sub : null,
          email: typeof token.email === 'string' ? token.email : null,
          role: typeof token.role === 'string' ? token.role : null,
          clientId: typeof token.clientId === 'string' ? token.clientId : null,
        },
      }).catch((error) => console.error('[Auth] Falha ao registrar auditoria de logout:', error))
    },
  },
})
