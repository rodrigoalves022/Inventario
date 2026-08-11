import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('admin', 10)

  // 1. Admin da plataforma (sem organizacao — escopo global)
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@inventario.local' },
    update: { role: 'PLATFORM_ADMIN' },
    create: {
      email: 'admin@inventario.local',
      name: 'Platform Admin',
      passwordHash: password,
      role: 'PLATFORM_ADMIN'
    }
  })
  console.log('Platform Admin:', platformAdmin.email)

  // 2. Admin e operador da organizacao dona do primeiro cliente
  const client = await prisma.client.findFirst({ select: { id: true, slug: true, name: true, organizationId: true } })
  if (!client) {
    console.log('Nenhum cliente encontrado — sem usuarios de organizacao para criar.')
    return
  }

  const orgAdmin = await prisma.user.upsert({
    where: { email: `admin@${client.slug}.local` },
    update: { role: 'ORG_ADMIN', clientId: client.id, organizationId: client.organizationId },
    create: {
      email: `admin@${client.slug}.local`,
      name: `Admin ${client.name}`,
      passwordHash: password,
      role: 'ORG_ADMIN',
      clientId: client.id,
      organizationId: client.organizationId
    }
  })
  console.log('Org Admin:', orgAdmin.email)

  const orgOperator = await prisma.user.upsert({
    where: { email: `operador@${client.slug}.local` },
    update: { role: 'ORG_OPERATOR', clientId: client.id, organizationId: client.organizationId },
    create: {
      email: `operador@${client.slug}.local`,
      name: `Operador ${client.name}`,
      passwordHash: password,
      role: 'ORG_OPERATOR',
      clientId: client.id,
      organizationId: client.organizationId
    }
  })
  console.log('Org Operator:', orgOperator.email)

  const clientViewer = await prisma.user.upsert({
    where: { email: `portal@${client.slug}.local` },
    update: { role: 'CLIENT_VIEWER', clientId: client.id, organizationId: client.organizationId },
    create: {
      email: `portal@${client.slug}.local`,
      name: `Portal ${client.name}`,
      passwordHash: password,
      role: 'CLIENT_VIEWER',
      clientId: client.id,
      organizationId: client.organizationId
    }
  })
  console.log('Client Viewer:', clientViewer.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
