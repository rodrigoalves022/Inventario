import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "./lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
          if (!credentials?.email || !credentials?.password) {
            console.log('[Auth] Missing email or password')
            return null
          }

          console.log(`[Auth] Attempting login for: ${credentials.email}`)

          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string }
          })

          if (!user) {
            console.log(`[Auth] User not found: ${credentials.email}`)
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
            credentials.password as string,
            user.password
          )

          if (passwordsMatch) {
            console.log(`[Auth] Login successful: ${user.email}, Role: ${user.role}`)
            return { 
              id: user.id, 
              email: user.email, 
              name: user.name, 
              role: user.role,
              clientId: user.clientId,
              clientSlug: clientSlug
            }
          }

          console.log(`[Auth] Password mismatch for: ${user.email}`)
          return null
        } catch (error: any) {
          console.error('[Auth] Authorization error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string
        // @ts-ignore
        session.user.role = token.role
        // @ts-ignore
        session.user.clientId = token.clientId
        // @ts-ignore
        session.user.clientSlug = token.clientSlug
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.clientId = (user as any).clientId
        token.clientSlug = (user as any).clientSlug
      }
      return token
    }
  }
})
