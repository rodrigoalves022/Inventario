'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { generateEnrollmentKey, hasValidAdminSecretFromHeaders } from '@/lib/auth'
import { slugifyClientName } from '@/lib/clients'
import { buildProvisioningArtifacts } from '@/lib/provisioning'
import { type ProvisioningActionState } from './types'

const createClientSchema = z.object({
  serverUrl: z.string().trim().url(),
  name: z.string().trim().min(3, 'Informe um nome com pelo menos 3 caracteres.'),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Use apenas letras minusculas, numeros e hifens.')
    .optional(),
})

const rotateKeySchema = z.object({
  serverUrl: z.string().trim().url(),
  clientId: z.string().trim().min(1),
})

function rejectUnauthorizedAccess(): ProvisioningActionState {
  return {
    error: 'Acesso administrativo nao autorizado.',
    message: null,
    package: null,
  }
}

async function hasClientsAdminAccess() {
  return hasValidAdminSecretFromHeaders(await headers())
}

function buildState(
  message: string,
  packageData: {
    clientId: string
    clientName: string
    clientSlug: string
    enrollmentKey: string
    serverUrl: string
  }
): ProvisioningActionState {
  const artifacts = buildProvisioningArtifacts(
    packageData.serverUrl,
    packageData.clientSlug,
    packageData.enrollmentKey
  )

  return {
    error: null,
    message,
    package: {
      clientId: packageData.clientId,
      clientName: packageData.clientName,
      clientSlug: packageData.clientSlug,
      enrollmentKey: packageData.enrollmentKey,
      ...artifacts,
    },
  }
}

export async function createClientAction(
  _previousState: ProvisioningActionState,
  formData: FormData
): Promise<ProvisioningActionState> {
  try {
    if (!(await hasClientsAdminAccess())) {
      return rejectUnauthorizedAccess()
    }

    const parsed = createClientSchema.safeParse({
      serverUrl: formData.get('serverUrl'),
      name: formData.get('name'),
      slug: formData.get('slug') || undefined,
    })

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Payload invalido.',
        message: null,
        package: null,
      }
    }

    const slug = (parsed.data.slug ?? slugifyClientName(parsed.data.name)).trim().toLowerCase()
    if (!slug) {
      return {
        error: 'Nao foi possivel gerar um identificador valido para o cliente.',
        message: null,
        package: null,
      }
    }

    const existing = await prisma.client.findUnique({ where: { slug } })
    if (existing) {
      return {
        error: 'Ja existe um cliente com esse slug.',
        message: null,
        package: null,
      }
    }

    const { plaintext, hash } = await generateEnrollmentKey()
    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        slug,
        enrollmentKeyHash: hash,
      },
    })

    revalidatePath('/clients')

    return buildState('Cliente criado e pacote de instalacao emitido.', {
      clientId: client.id,
      clientName: client.name,
      clientSlug: client.slug,
      enrollmentKey: plaintext,
      serverUrl: parsed.data.serverUrl,
    })
  } catch (error) {
    console.error('[clients/create] Erro:', error)
    return {
      error: 'Erro interno ao criar cliente.',
      message: null,
      package: null,
    }
  }
}

export async function rotateEnrollmentKeyAction(
  _previousState: ProvisioningActionState,
  formData: FormData
): Promise<ProvisioningActionState> {
  try {
    if (!(await hasClientsAdminAccess())) {
      return rejectUnauthorizedAccess()
    }

    const parsed = rotateKeySchema.safeParse({
      serverUrl: formData.get('serverUrl'),
      clientId: formData.get('clientId'),
    })

    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? 'Payload invalido.',
        message: null,
        package: null,
      }
    }

    const client = await prisma.client.findUnique({
      where: { id: parsed.data.clientId },
      select: { id: true, name: true, slug: true },
    })

    if (!client) {
      return {
        error: 'Cliente nao encontrado.',
        message: null,
        package: null,
      }
    }

    const { plaintext, hash } = await generateEnrollmentKey()
    await prisma.client.update({
      where: { id: client.id },
      data: { enrollmentKeyHash: hash },
    })

    revalidatePath('/clients')

    return buildState('Enrollment key rotacionada. Revise os instaladores antigos.', {
      clientId: client.id,
      clientName: client.name,
      clientSlug: client.slug,
      enrollmentKey: plaintext,
      serverUrl: parsed.data.serverUrl,
    })
  } catch (error) {
    console.error('[clients/rotate-key] Erro:', error)
    return {
      error: 'Erro interno ao rotacionar a enrollment key.',
      message: null,
      package: null,
    }
  }
}
