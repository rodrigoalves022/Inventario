import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { hasValidAdminSecret } from '@/lib/auth'

export const runtime = 'nodejs'

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).optional(),
})

export async function POST(req: NextRequest) {
  if (!hasValidAdminSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = signupSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  })

  if (existingSuperAdmin) {
    return NextResponse.json({ error: 'Super admin already exists' }, { status: 409 })
  }

  const { email, password, name } = parsed.data
  const passwordHash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      passwordHash,
      role: 'SUPER_ADMIN',
      clientId: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      clientId: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ user }, { status: 201 })
}
