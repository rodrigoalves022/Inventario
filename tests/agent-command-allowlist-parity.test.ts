import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESTARTABLE_SERVICES, SCRIPT_CATALOG_IDS } from '@/lib/agent-commands'

// Sprint 08, item 3. lib/agent-commands.ts (servidor) e
// agent-go/internal/app/commands/service.go (agente) mantem duas allowlists
// espelhadas manualmente por design ("defesa em profundidade" — comentario
// em service.go:87-88). Nada ate esta sprint travava as duas de divergir
// silenciosamente.
//
// Estrategia escolhida (das duas registradas em docs/SPRINTS.md, Sprint 8,
// item 3): parsing de texto via regex sobre o .go, comparado contra as
// constantes TS reais (nao uma copia hardcoded). Preferida a alternativa de
// rodar `go run`/um binario de introspeccao porque roda no mesmo pipeline
// `npm run test` sem exigir toolchain Go no ambiente — o preco e um parser
// mais fragil a mudanca de formatacao do .go, aceito porque os literais em
// si sao strings identicas nos dois lados (sem transformacao camelCase/
// snake_case a reconciliar) e o arquivo already tem uma estrutura simples e
// estavel (dois map[string]bool e um switch).

const GO_SERVICE_PATH = path.resolve(__dirname, '../agent-go/internal/app/commands/service.go')
const goSource = readFileSync(GO_SERVICE_PATH, 'utf-8')

function extractQuotedKeysInBlock(source: string, varName: string): string[] {
  const blockMatch = source.match(new RegExp(`var ${varName} = map\\[string\\]bool\\{([\\s\\S]*?)\\}`))
  if (!blockMatch) {
    throw new Error(`Bloco "var ${varName} = map[string]bool{...}" nao encontrado em service.go — o parser de paridade precisa ser atualizado junto de qualquer mudanca estrutural nesse arquivo.`)
  }
  const keys = [...blockMatch[1].matchAll(/"([^"]+)"\s*:\s*true/g)].map((m) => m[1])
  if (keys.length === 0) {
    throw new Error(`Nenhuma chave extraida de "${varName}" — regex de parsing pode estar desalinhada com o formato real do arquivo.`)
  }
  return keys
}

function extractSwitchCaseTypes(source: string): string[] {
  // `\r?\n` e nao `\n`: o repositorio e' clonado no Windows com
  // `core.autocrlf`, entao service.go chega ao disco com CRLF. Ancorar o fim do
  // corpo em `\n}\n` fazia o parser nao encontrar NADA num checkout com CRLF —
  // e o teste falhava com "corpo nao encontrado" mesmo com o arquivo intacto,
  // acusando uma divergencia de allowlist que nao existia.
  const funcMatch = source.match(/func execute\([^)]*\) httpapi\.CommandResult \{([\s\S]*?)\r?\n\}\r?\n/)
  if (!funcMatch) {
    throw new Error('Corpo de func execute(...) nao encontrado em service.go — parser de paridade precisa ser atualizado.')
  }
  const cases = [...funcMatch[1].matchAll(/case "([^"]+)":/g)].map((m) => m[1])
  if (cases.length === 0) {
    throw new Error('Nenhum "case" extraido de func execute — regex pode estar desalinhada com o formato real do arquivo.')
  }
  return cases
}

function extractDiscriminatedUnionTypes(source: string): string[] {
  // Mesma robustez a CRLF do parser de `func execute` acima — ver o comentario
  // la. Aqui o arquivo lido e' TypeScript, que hoje esta em LF, mas ancorar em
  // `\n` sozinho e' a mesma armadilha esperando o proximo checkout.
  const unionMatch = source.match(/agentCommandInputSchema = z\.discriminatedUnion\('type',\s*\[([\s\S]*?)\r?\n\]\)/)
  if (!unionMatch) {
    throw new Error('Bloco agentCommandInputSchema nao encontrado em lib/agent-commands.ts — parser de paridade precisa ser atualizado.')
  }
  const types = [...unionMatch[1].matchAll(/type:\s*z\.literal\('([^']+)'\)/g)].map((m) => m[1])
  if (types.length === 0) {
    throw new Error('Nenhum tipo extraido de agentCommandInputSchema — regex pode estar desalinhada com o formato real do arquivo.')
  }
  return types
}

const AGENT_COMMANDS_TS_PATH = path.resolve(__dirname, '../lib/agent-commands.ts')
const tsSource = readFileSync(AGENT_COMMANDS_TS_PATH, 'utf-8')

describe('paridade de allowlist de comandos remotos — servidor (TS) vs agente (Go)', () => {
  it('RESTARTABLE_SERVICES (TS) e allowedServices (Go) tem exatamente o mesmo conjunto', () => {
    const goServices = extractQuotedKeysInBlock(goSource, 'allowedServices')
    expect(new Set(goServices)).toEqual(new Set(RESTARTABLE_SERVICES))
  })

  it('SCRIPT_CATALOG_IDS (TS) e allowedScripts (Go) tem exatamente o mesmo conjunto', () => {
    const goScripts = extractQuotedKeysInBlock(goSource, 'allowedScripts')
    expect(new Set(goScripts)).toEqual(new Set(SCRIPT_CATALOG_IDS))
  })

  it('os tipos de comando do agentCommandInputSchema (TS) e os "case" de execute() (Go) tem exatamente o mesmo conjunto', () => {
    const tsTypes = extractDiscriminatedUnionTypes(tsSource)
    const goCaseTypes = extractSwitchCaseTypes(goSource)
    expect(new Set(goCaseTypes)).toEqual(new Set(tsTypes))
  })
})
