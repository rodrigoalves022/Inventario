import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { ensureLegacyClient, findClientByIdentifier, getLegacyEnrollmentKey } from '@/lib/clients'
import { generateApiKey, hasValidAdminSecret, hashSecret } from '@/lib/auth'

const registerSchema = z.object({
  name: z.string().trim().min(3, 'O campo "name" é obrigatório (mínimo 3 caracteres).'),
  client: z.string().trim().min(2).optional(),
  enrollmentKey: z.string().trim().min(16).optional(),
})

export async function POST(req: NextRequest) {
  const isAdmin = hasValidAdminSecret(req)

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
    const agentAuth = await prisma.agentAuth.create({
      data: {
        name,
        apiKeyHash: hash,
        clientId: client.id,
      },
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
