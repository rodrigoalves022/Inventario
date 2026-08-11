import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

import { MIGRATION_MODELS } from './migration-models.ts'

const prisma = new PrismaClient()

async function main() {
  const exportDir = path.join(process.cwd(), 'prisma', 'export')

  if (!fs.existsSync(exportDir)) {
    throw new Error(`Diretorio de export nao encontrado: ${exportDir}. Rode export-data.ts primeiro.`)
  }

  let totalImported = 0
  const failures: Array<{ model: string; error: string }> = []

  for (const model of MIGRATION_MODELS) {
    const filePath = path.join(exportDir, `${model}.json`)
    if (!fs.existsSync(filePath)) {
      console.warn(`${model}: arquivo ausente, pulando`)
      continue
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Array<Record<string, unknown>>
    if (data.length === 0) {
      console.log(`${model}: 0 registros`)
      continue
    }

    // createMany evita N round-trips; skipDuplicates torna o import re-executavel.
    // @ts-ignore - acesso dinamico por nome de model
    const result = await prisma[model].createMany({ data, skipDuplicates: true }).catch((error: unknown) => {
      failures.push({ model, error: error instanceof Error ? error.message : String(error) })
      return null
    })

    if (result) {
      totalImported += result.count
      console.log(`${model}: ${result.count}/${data.length} importados`)
    }
  }

  if (failures.length > 0) {
    console.error('\nFalhas:')
    for (const failure of failures) {
      console.error(`  - ${failure.model}: ${failure.error}`)
    }
    process.exit(1)
  }

  console.log(`\nImport concluido: ${totalImported} registros`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
