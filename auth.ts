import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { recordAuditLog } from "./lib/audit-log"
import { authorizeCredentials } from "./lib/auth-credentials"

// A logica de authorize() vive em lib/auth-credentials.ts (sem import de
// 'next-auth'), reexportada aqui so por compatibilidade — ver o comentario
// la para o motivo (testabilidade em tests/auth-login.test.ts sem acionar a
// resolucao de 'next/server' que next-auth/lib/env.js dispara ao ser
// importado).
export { authorizeCredentials }

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: authorizeCredentials
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
