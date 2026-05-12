import prisma from './prisma'

const LEGACY_CLIENT_NAME = 'Legacy Default'
const LEGACY_CLIENT_SLUG = 'legacy-default'
const LEGACY_ENROLLMENT_KEY = 'legacy-default-enrollment-key'

export function slugifyClientName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function findClientByIdentifier(identifier: string) {
  const normalized = identifier.trim()
  if (!normalized) return null

  return prisma.client.findFirst({
    where: {
      OR: [{ slug: normalized.toLowerCase() }, { name: normalized }],
    },
  })
}

export async function ensureLegacyClient(enrollmentKeyHash: string) {
  const existing = await prisma.client.findUnique({
    where: { slug: LEGACY_CLIENT_SLUG },
  })

  if (existing) {
    if (existing.enrollmentKeyHash !== enrollmentKeyHash) {
      return prisma.client.update({
        where: { id: existing.id },
        data: { enrollmentKeyHash },
      })
    }

    return existing
  }

  return prisma.client.create({
    data: {
      name: LEGACY_CLIENT_NAME,
      slug: LEGACY_CLIENT_SLUG,
      enrollmentKeyHash,
    },
  })
}

export function getLegacyEnrollmentKey() {
  return LEGACY_ENROLLMENT_KEY
}
