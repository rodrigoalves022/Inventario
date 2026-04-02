export type ProvisioningPackage = {
  clientId: string
  clientName: string
  clientSlug: string
  enrollmentKey: string
  bootstrapUrl: string
  bootstrapCommand: string
  installCommand: string
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
