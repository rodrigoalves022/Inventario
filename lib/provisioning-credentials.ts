import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const ENCRYPTION_VERSION = 1
const KEY_SALT = 'inventario-active-provisioning'

type ProvisioningSecretPayload = {
  enrollmentKey: string
}

type EncryptedProvisioningPayload = {
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
      'INVENTARIO_PROVISIONING_SECRET, AUTH_SECRET ou ADMIN_SECRET é obrigatório para proteger credenciais ativas.'
    )
  }

  return secret
}

function getEncryptionKey(): Buffer {
  return scryptSync(getMasterSecret(), KEY_SALT, KEY_LENGTH)
}

export function encryptProvisioningSecret(payload: ProvisioningSecretPayload): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const plaintext = JSON.stringify(payload)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    v: ENCRYPTION_VERSION,
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  } satisfies EncryptedProvisioningPayload)
}

export function decryptProvisioningSecret(value: string): ProvisioningSecretPayload {
  let payload: EncryptedProvisioningPayload

  try {
    payload = JSON.parse(value) as EncryptedProvisioningPayload
  } catch {
    throw new Error('Payload criptografado inválido.')
  }

  if (payload.v !== ENCRYPTION_VERSION) {
    throw new Error(`Versão de payload não suportada: ${payload.v}`)
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(payload.iv, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')

  return JSON.parse(plaintext) as ProvisioningSecretPayload
}
