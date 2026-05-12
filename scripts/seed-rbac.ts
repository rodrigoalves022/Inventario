import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('admin', 10)

  // 1. Ensure a Super Admin exists
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@inventario.local' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      email: 'admin@inventario.local',
      name: 'Super Admin',
      passwordHash: password,
      role: 'SUPER_ADMIN'
    }
  })
  console.log('Super Admin ensured:', superAdmin.email)

  // 2. Find a client to link to a Tenant Admin
  const client = await prisma.client.findFirst()
  if (client) {
    const tenantAdmin = await prisma.user.upsert({
      where: { email: `admin@${client.slug}.local` },
      update: { role: 'CLIENT_ADMIN', clientId: client.id },
      create: {
        email: `admin@${client.slug}.local`,
        name: `Admin ${client.name}`,
        passwordHash: password,
        role: 'CLIENT_ADMIN',
        clientId: client.id
      }
    })
    console.log(`Tenant Admin ensured for ${client.name}:`, tenantAdmin.email)
  } else {
    console.log('No clients found to create a Tenant Admin.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
