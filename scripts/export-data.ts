import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

import { MIGRATION_MODELS } from './migration-models.ts'

const prisma = new PrismaClient()

async function main() {
  const exportDir = path.join(process.cwd(), 'prisma', 'export')
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }

  for (const model of MIGRATION_MODELS) {
    // @ts-ignore - acesso dinamico por nome de model
    const data = await prisma[model].findMany()
    fs.writeFileSync(path.join(exportDir, `${model}.json`), JSON.stringify(data, null, 2))
    console.log(`${model}: ${data.length} registros exportados`)
  }

  console.log(`\nExport concluido em ${exportDir}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
