import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { generateEnrollmentKey, hasValidAdminSecret } from '@/lib/auth'
import { slugifyClientName } from '@/lib/clients'

const createClientSchema = z.object({
  name: z.string().trim().min(3, 'O campo "name" é obrigatório (mínimo 3 caracteres).'),
  slug: z.string().trim().min(3).regex(/^[a-z0-9-]+$/).optional(),
})

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
}

export async function GET(req: NextRequest) {
  if (!hasValidAdminSecret(req)) return unauthorized()

  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          agents: true,
        },
      },
    },
  })

  return NextResponse.json(clients, { status: 200 })
}

export async function POST(req: NextRequest) {
  if (!hasValidAdminSecret(req)) return unauthorized()

  try {
    const parsed = createClientSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' }, { status: 400 })
    }

    const slug = (parsed.data.slug ?? slugifyClientName(parsed.data.name)).trim().toLowerCase()
    if (!slug) {
      return NextResponse.json({ error: 'Não foi possível gerar um slug válido para o cliente.' }, { status: 400 })
    }

    const existing = await prisma.client.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: 'Já existe um cliente com esse slug.' }, { status: 409 })
    }

    const { plaintext, hash } = await generateEnrollmentKey()
    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        slug,
        enrollmentKeyHash: hash,
      },
    })

    return NextResponse.json(
      {
        id: client.id,
        name: client.name,
        slug: client.slug,
        enrollmentKey: plaintext,
        message: 'Cliente criado. Guarde a enrollmentKey - ela não será exibida novamente.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[clients] Erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
