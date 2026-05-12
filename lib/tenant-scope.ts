import type { Prisma } from '@prisma/client'

function tenantRelationWhere(clientSlug: string): Prisma.AgentAuthWhereInput {
  return {
    client: {
      is: {
        slug: clientSlug,
        isActive: true,
      },
    },
    isActive: true,
  }
}

export function getTenantDeviceWhere(clientSlug: string): Prisma.DeviceWhereInput {
  return {
    agentAuth: {
      is: tenantRelationWhere(clientSlug),
    },
  }
}

export function getTenantHardwareWhere(clientSlug: string): Prisma.HardwareWhereInput {
  return {
    device: {
      is: getTenantDeviceWhere(clientSlug),
    },
  }
}

export function getTenantNetworkWhere(clientSlug: string): Prisma.NetworkWhereInput {
  return {
    device: {
      is: getTenantDeviceWhere(clientSlug),
    },
  }
}

export function getTenantDiskWhere(clientSlug: string): Prisma.DiskWhereInput {
  return {
    device: {
      is: getTenantDeviceWhere(clientSlug),
    },
  }
}

export function getTenantSoftwareWhere(clientSlug: string): Prisma.SoftwareWhereInput {
  return {
    device: {
      is: getTenantDeviceWhere(clientSlug),
    },
  }
}

export function getTenantCollectionLogWhere(clientSlug: string): Prisma.CollectionLogWhereInput {
  return {
    device: {
      is: getTenantDeviceWhere(clientSlug),
    },
  }
}
