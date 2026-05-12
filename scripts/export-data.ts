import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

async function main() {
  const exportDir = path.join(process.cwd(), 'prisma', 'export')
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true })
  }

  const models = [
    'client',
    'agentAuth',
    'device',
    'hardware',
    'network',
    'disk',
    'software',
    'collectionLog',
    'user',
  ]

  for (const model of models) {
    console.log(`Exporting ${model}...`)
    // @ts-ignore
    const data = await prisma[model].findMany()
    fs.writeFileSync(
      path.join(exportDir, `${model}.json`),
      JSON.stringify(data, null, 2)
    )
    console.log(`Exported ${data.length} records from ${model}.`)
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
