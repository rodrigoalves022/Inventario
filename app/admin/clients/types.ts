export type ProvisioningPackage = {
  clientId: string
  clientName: string
  clientSlug: string
  enrollmentKey: string
  bootstrapUrl: string
  bootstrapCommand: string
  installCommand: string
  // Sprint A4 (RF032): instalacao Linux e SHA-256 dos binarios publicados
  // (`null` = binario daquela plataforma nao publicado neste servidor).
  linuxBootstrapUrl: string
  linuxBootstrapCommand: string
  linuxInstallCommand: string
  windowsSha256: string | null
  linuxSha256: string | null
}

export type ProvisioningActionState = {
  error: string | null
  message: string | null
  package: ProvisioningPackage | null
}

export const initialProvisioningState: ProvisioningActionState = {
  error: null,
  message: null,
  package: null,
}

export type RequestAgentUpdateState = {
  error: string | null
  message: string | null
}

export const initialRequestAgentUpdateState: RequestAgentUpdateState = {
  error: null,
  message: null,
}

export type ProvisioningCredentialsResponse =
  | {
      status: 'available'
      package: ProvisioningPackage
      generatedAt: string | null
    }
  | {
      status: 'unavailable'
      reason: 'legacy'
      message: string
    }
