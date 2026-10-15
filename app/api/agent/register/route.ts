import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { ensureLegacyClient, findClientByIdentifier, getLegacyEnrollmentKey } from '@/lib/clients'
import { generateApiKey, hasValidAdminSecret, hashSecret } from '@/lib/auth'
import { rateLimit, rateLimitResponse, getClientIp } from '@/lib/rate-limit'
import { recordAuditLog } from '@/lib/audit-log'

const registerSchema = z.object({
  name: z.string().trim().min(3, 'O campo "name" é obrigatório (mínimo 3 caracteres).'),
  client: z.string().trim().min(2).optional(),
  enrollmentKey: z.string().trim().min(16).optional(),
})

export async function POST(req: NextRequest) {
  const isAdmin = hasValidAdminSecret(req)

  // Sem identidade de agente ainda (e' o proprio registro) — limita por IP.
  // Generoso o bastante pra provisionar varias maquinas em sequencia, apertado
  // o bastante pra dificultar forca bruta de enrollmentKey.
  const limit = rateLimit(`register:${getClientIp(req)}`, { limit: 15, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  try {
    const parsed = registerSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' }, { status: 400 })
    }

    const { name, client: clientIdentifier, enrollmentKey } = parsed.data

    let client = null
    if (clientIdentifier) {
      client = await findClientByIdentifier(clientIdentifier)
    } else if (isAdmin) {
      client = await ensureLegacyClient(await hashSecret(getLegacyEnrollmentKey()))
    }

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado. Informe um cliente válido criado no painel.' },
        { status: 404 }
      )
    }

    if (!client.isActive) {
      return NextResponse.json({ error: 'Cliente desativado.' }, { status: 403 })
    }

    if (!isAdmin) {
      if (!enrollmentKey) {
        return NextResponse.json(
          { error: 'A chave de provisionamento do cliente é obrigatória.' },
          { status: 401 }
        )
      }

      const enrollmentKeyHash = await hashSecret(enrollmentKey)
      if (enrollmentKeyHash !== client.enrollmentKeyHash) {
        return NextResponse.json({ error: 'Chave de provisionamento inválida.' }, { status: 401 })
      }
    }

    const { plaintext, hash } = await generateApiKey()
    const registeredClientId = client.id
    // Sprint A3, item 11 (RF031). O registro grava `agent_auth.register` na
    // mesma transacao da credencial. Ator nulo: quem chama e o instalador, nao
    // um usuario. `via` diz qual porta liberou o registro. Nenhum segredo
    // (enrollmentKey, apiKey ou hash) entra no metadata.
    const agentAuth = await prisma.$transaction(async (tx: Pick<typeof prisma, 'agentAuth' | 'auditLog'>) => {
      const created = await tx.agentAuth.create({
        data: {
          name,
          apiKeyHash: hash,
          clientId: registeredClientId,
        },
      })

      await recordAuditLog(
        {
          action: 'agent_auth.register',
          targetType: 'agent_auth',
          targetId: created.id,
          clientId: registeredClientId,
          actor: null,
          metadata: { name, via: isAdmin ? 'admin_secret' : 'enrollment_key' },
        },
        tx
      )

      return created
    })

    return NextResponse.json(
      {
        id: agentAuth.id,
        name: agentAuth.name,
        client: {
          id: client.id,
          name: client.name,
          slug: client.slug,
        },
        apiKey: plaintext,
        message: 'Agente registrado. Guarde a apiKey - ela não será exibida novamente.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[agent/register] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
