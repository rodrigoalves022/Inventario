import type { NextAuthConfig } from "next-auth"
import { isAppRole } from "@/lib/permissions"

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        const tokenAny = token as Record<string, unknown>
        session.user.id = token.sub ?? session.user.id
        // Sem papel reconhecido a sessao fica sem permissao alguma (fail-closed),
        // em vez de herdar um papel padrao que concederia acesso indevido.
        session.user.role = isAppRole(tokenAny.role) ? tokenAny.role : 'CLIENT_VIEWER'
        session.user.organizationId = readNullableString(tokenAny.organizationId)
        session.user.clientId = readNullableString(tokenAny.clientId)
        session.user.clientSlug = readNullableString(tokenAny.clientSlug)
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        const tokenAny = token as Record<string, unknown>
        tokenAny.role = user.role
        tokenAny.organizationId = user.organizationId
        tokenAny.clientId = user.clientId
        tokenAny.clientSlug = user.clientSlug
      }
      return token
    },
  },
} satisfies NextAuthConfig
