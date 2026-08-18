import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { validateAgentApiKey, authErrorResponse } from '@/lib/auth'
import { recordAuditLog } from '@/lib/audit-log'
import { agentCommandResultSchema } from '@/lib/agent-commands'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await validateAgentApiKey(req)
  if (!auth.ok) return authErrorResponse(auth)

  // Emparelhado com o polling de commands/pending — mesma ordem de grandeza.
  const limit = rateLimit(`commands-result:${auth.agentAuth.id}`, { limit: 30, windowMs: 5 * 60 * 1000 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds)

  const { id } = await params

  const command = await prisma.agentCommand.findFirst({
    where: { id, agentAuthId: auth.agentAuth.id },
  })

  if (!command) {
    return NextResponse.json({ error: 'Comando não encontrado.' }, { status: 404 })
  }

  const rawBody = await req.json().catch(() => null)
  const parsed = agentCommandResultSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload de resultado inválido.', details: parsed.error.flatten() }, { status: 400 })
  }

  await prisma.agentCommand.update({
    where: { id: command.id },
    data: {
      status: parsed.data.status,
      resultJson: JSON.stringify({ output: parsed.data.output ?? null, errorMessage: parsed.data.errorMessage ?? null }),
      completedAt: new Date(),
    },
  })

  await recordAuditLog({
    action: 'command.result',
    targetType: 'agent_command',
    targetId: command.id,
    clientId: command.clientId,
    actor: { email: `agent:${auth.agentAuth.name}` },
    metadata: {
      type: command.type,
      status: parsed.data.status,
    },
  })

  return NextResponse.json({ ok: true })
}
