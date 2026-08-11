import type { DefaultSession } from 'next-auth'

type AppRole = 'PLATFORM_ADMIN' | 'ORG_ADMIN' | 'ORG_OPERATOR' | 'CLIENT_VIEWER'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: AppRole
      organizationId: string | null
      clientId: string | null
      clientSlug: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: AppRole
    organizationId: string | null
    clientId: string | null
    clientSlug: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole
    organizationId?: string | null
    clientId?: string | null
    clientSlug?: string | null
  }
}

export {}
