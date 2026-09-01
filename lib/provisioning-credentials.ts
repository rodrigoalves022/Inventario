import { decryptJsonSecret, encryptJsonSecret } from '@/lib/encrypted-secret'

// Nucleo de cifra (AES-256-GCM, derivacao de chave via scrypt) extraido para
// lib/encrypted-secret.ts (Sprint 11, item 7 do Backlog) para ser reaproveitado
// tambem por lib/webhook-endpoints.ts. `KEY_SALT` e o formato do payload
// (`{ enrollmentKey }`) permanecem EXATAMENTE os mesmos de antes da extracao —
// nenhuma migracao de dado necessaria para os segredos de provisionamento ja
// gravados.
const KEY_SALT = 'inventario-active-provisioning'

type ProvisioningSecretPayload = {
  enrollmentKey: string
}

export function encryptProvisioningSecret(payload: ProvisioningSecretPayload): string {
  return encryptJsonSecret(payload, KEY_SALT)
}

export function decryptProvisioningSecret(value: string): ProvisioningSecretPayload {
  return decryptJsonSecret<ProvisioningSecretPayload>(value, KEY_SALT)
}
