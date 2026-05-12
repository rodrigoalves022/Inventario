import type { DefaultSession } from 'next-auth'

type AppRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: AppRole
      clientId: string | null
      clientSlug: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: AppRole
    clientId: string | null
    clientSlug: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole
    clientId?: string | null
    clientSlug?: string | null
  }
}

export {}
