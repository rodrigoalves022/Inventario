import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

/**
 * Nucleo AES-256-GCM compartilhado, extraido de lib/provisioning-credentials.ts
 * (Sprint 11, item 7 do Backlog — cifrar WebhookEndpoint.secret em repouso).
 * Generalizado para aceitar qualquer payload serializavel em JSON, nao so
 * `{ enrollmentKey }`: lib/provisioning-credentials.ts e lib/webhook-endpoints.ts
 * (secret de WebhookEndpoint) reaproveitam este mesmo nucleo, cada um com seu
 * proprio `keySalt` (chaves derivadas diferentes por dominio de segredo, mesmo
 * segredo mestre — evita reuso de chave entre dominios sem exigir mais de um
 * segredo mestre configurado).
 */

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const ENCRYPTION_VERSION = 1

type EncryptedSecretPayload = {
  v: number
  iv: string
  tag: string
  ciphertext: string
}

function getMasterSecret(): string {
  const secret =
    process.env.INVENTARIO_PROVISIONING_SECRET ?? process.env.AUTH_SECRET ?? process.env.ADMIN_SECRET

  if (!secret) {
    throw new Error(
      'INVENTARIO_PROVISIONING_SECRET, AUTH_SECRET ou ADMIN_SECRET é obrigatório para proteger segredos em repouso.'
    )
  }

  return secret
}

function deriveKey(keySalt: string): Buffer {
  return scryptSync(getMasterSecret(), keySalt, KEY_LENGTH)
}

export function encryptJsonSecret<T>(payload: T, keySalt: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, deriveKey(keySalt), iv)
  const plaintext = JSON.stringify(payload)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    v: ENCRYPTION_VERSION,
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  } satisfies EncryptedSecretPayload)
}

export function decryptJsonSecret<T>(value: string, keySalt: string): T {
  let payload: EncryptedSecretPayload

  try {
    payload = JSON.parse(value) as EncryptedSecretPayload
  } catch {
    throw new Error('Payload criptografado inválido.')
  }

  if (payload.v !== ENCRYPTION_VERSION) {
    throw new Error(`Versão de payload não suportada: ${payload.v}`)
  }

  const decipher = createDecipheriv(ALGORITHM, deriveKey(keySalt), Buffer.from(payload.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')

  return JSON.parse(plaintext) as T
}
