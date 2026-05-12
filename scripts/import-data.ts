import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const prisma = new PrismaClient()

async function main() {
  const exportDir = path.join(process.cwd(), 'prisma', 'export')
  
  const models = [
    'user',
    'client',
    'agentAuth',
    'device',
    'hardware',
    'network',
    'disk',
    'software',
    'collectionLog',
  ]

  for (const model of models) {
    const filePath = path.join(exportDir, `${model}.json`)
    if (!fs.existsSync(filePath)) {
      console.warn(`File ${filePath} not found, skipping...`)
      continue
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    console.log(`Importing ${data.length} records into ${model}...`)

    for (const record of data) {
      try {
        // @ts-ignore
        await prisma[model].create({ data: record })
      } catch (err) {
        console.error(`Error importing record into ${model}:`, err)
      }
    }
    console.log(`Finished ${model}.`)
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
