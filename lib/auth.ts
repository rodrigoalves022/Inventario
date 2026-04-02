import { NextRequest } from 'next/server'
import prisma from './prisma'

export async function generateApiKey(): Promise<{ plaintext: string; hash: string }> {
  return generateSecret()
}

export async function generateEnrollmentKey(): Promise<{ plaintext: string; hash: string }> {
  return generateSecret()
}

async function generateSecret(): Promise<{ plaintext: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const plaintext = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const hash = await hashSecret(plaintext)
  return { plaintext, hash }
}

export async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(secret)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function hashApiKey(key: string): Promise<string> {
  return hashSecret(key)
}

export type AuthResult =
  | {
      ok: true
      agentAuth: {
        id: string
        name: string
        clientId: string | null
        clientName: string | null
        clientSlug: string | null
      }
    }
  | { ok: false; status: 401 | 403; message: string }

export async function validateAgentApiKey(req: NextRequest): Promise<AuthResult> {
  const apiKey = req.headers.get('x-api-key')

  if (!apiKey) {
    return { ok: false, status: 401, message: 'API Key ausente. Inclua o header X-API-Key.' }
  }

  const keyHash = await hashApiKey(apiKey)

  const agentAuth = await prisma.agentAuth.findUnique({
    where: { apiKeyHash: keyHash },
    select: {
      id: true,
      name: true,
      isActive: true,
      clientId: true,
      client: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
        },
      },
    },
  })

  if (!agentAuth) {
    return { ok: false, status: 401, message: 'API Key inválida.' }
  }

  if (!agentAuth.isActive) {
    return { ok: false, status: 403, message: 'API Key revogada. Contate o administrador.' }
  }

  if (agentAuth.client && !agentAuth.client.isActive) {
    return { ok: false, status: 403, message: 'Cliente desativado. Contate o administrador.' }
  }

  return {
    ok: true,
    agentAuth: {
      id: agentAuth.id,
      name: agentAuth.name,
      clientId: agentAuth.clientId,
      clientName: agentAuth.client?.name ?? null,
      clientSlug: agentAuth.client?.slug ?? null,
    },
  }
}

export function authErrorResponse(result: Extract<AuthResult, { ok: false }>) {
  return Response.json({ error: result.message }, { status: result.status })
}

export function hasValidAdminSecret(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret')
  return Boolean(adminSecret && adminSecret === process.env.ADMIN_SECRET)
}
