import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import prisma from "./lib/prisma"
import bcrypt from "bcryptjs"
import type { AppRole } from "@/lib/permissions"

function readAppRole(value: unknown): AppRole | null {
  return value === 'SUPER_ADMIN' || value === 'CLIENT_ADMIN' ? value : null
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const email = typeof credentials?.email === 'string' ? credentials.email : null
          const password = typeof credentials?.password === 'string' ? credentials.password : null

          if (!email || !password) {
            console.log('[Auth] Missing email or password')
            return null
          }

          console.log(`[Auth] Attempting login for: ${email}`)

          const user = await prisma.user.findUnique({
            where: { email }
          })

          if (!user) {
            console.log(`[Auth] User not found: ${email}`)
            return null
          }

          if (user.role !== 'SUPER_ADMIN' && user.role !== 'CLIENT_ADMIN') {
            console.error(`[Auth] Invalid role for user ${user.email}: ${user.role}`)
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
            console.log(`[Auth] Login successful: ${user.email}, Role: ${user.role}`)
            return { 
              id: user.id, 
              email: user.email, 
              name: user.name, 
              role: user.role,
              clientId: user.clientId,
              clientSlug: clientSlug ?? null
            }
          }

          console.log(`[Auth] Password mismatch for: ${user.email}`)
          return null
        } catch (error: unknown) {
          console.error('[Auth] Authorization error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        const tokenAny = token as Record<string, unknown>
        session.user.id = token.sub ?? session.user.id
        session.user.role = readAppRole(tokenAny.role) ?? 'CLIENT_ADMIN'
        session.user.clientId = readNullableString(tokenAny.clientId) ?? null
        session.user.clientSlug = readNullableString(tokenAny.clientSlug) ?? null
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        const tokenAny = token as Record<string, unknown>
        tokenAny.role = user.role
        tokenAny.clientId = user.clientId
        tokenAny.clientSlug = user.clientSlug
      }
      return token
    }
  }
})
