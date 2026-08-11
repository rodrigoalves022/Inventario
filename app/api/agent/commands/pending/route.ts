import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  await prisma.agentCommand.updateMany({
    where: {
      agentAuthId: auth.agentAuth.id,
      status: 'pending',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  })

  const command = await prisma.agentCommand.findFirst({
    where: {
      agentAuthId: auth.agentAuth.id,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!command) {
    return NextResponse.json({ command: null })
  }

  const claimed = await prisma.agentCommand.updateMany({
    where: { id: command.id, status: 'pending' },
    data: { status: 'running', startedAt: new Date() },
  })

  // Corrida com outro poll simultâneo do mesmo agente: se já foi reclamado, não entrega de novo.
  if (claimed.count === 0) {
    return NextResponse.json({ command: null })
  }

  return NextResponse.json({
    command: {
      id: command.id,
      type: command.type,
      params: command.paramsJson ? JSON.parse(command.paramsJson) : null,
    },
  })
}
