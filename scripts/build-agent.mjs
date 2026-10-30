// Publica o agente Go. Fonte unica: o build Windows vai direto para
// public/inventario-agent.exe, o mesmo arquivo servido em
// ${serverUrl}/inventario-agent.exe (auto-updater) e lido por
// /api/agent/download e /api/agent/download-exe. Antes, esses caminhos liam
// arquivos diferentes (public/ vs agent-go/dist/) que divergiam sem aviso.
//
// Existe tambem agent-go/Makefile com os mesmos alvos, para quem tem `make`
// disponivel (ex: WSL, CI Linux) — este script e' a via garantida em
// qualquer ambiente com Node, incluindo Windows sem `make` instalado.
//
// Uso: node scripts/build-agent.mjs [windows|linux|all]

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const agentDir = join(__dirname, '..', 'agent-go')
const distDir = join(agentDir, 'dist')
const publicDir = join(__dirname, '..', 'public')

const VERSION = '1.1.0'
const APP_NAME = 'inventario-agent'

function build(goos, goarch, outputName) {
  const outputPath = join(distDir, outputName)
  console.log(`[build-agent] Compilando ${goos}/${goarch} -> dist/${outputName}...`)
  execFileSync('go', ['build', '-ldflags', `-s -w -X inventario-agent/internal/version.Version=${VERSION}`, '-o', outputPath, `./cmd/${APP_NAME}`], {
    cwd: agentDir,
    env: { ...process.env, GOOS: goos, GOARCH: goarch },
    stdio: 'inherit',
  })
  return outputPath
}

function publishWindows() {
  const built = build('windows', 'amd64', `${APP_NAME}.exe`)
  const published = join(publicDir, `${APP_NAME}.exe`)
  copyFileSync(built, published)
  console.log(`[build-agent] Publicado: ${published}`)
}

function publishLinux() {
  // Sprint A4 (RF032): o agente Linux tem coletores proprios
  // (internal/collectors/factory_linux.go) e instala uma unidade systemd
  // (service_linux.go). Publicado em public/inventario-agent-linux: servido
  // estatico ao script de GET /api/agent/bootstrap-linux, que confere o
  // SHA-256, e lido por GET /api/agent/download-linux.
  const built = build('linux', 'amd64', `${APP_NAME}-linux`)
  const published = join(publicDir, `${APP_NAME}-linux`)
  copyFileSync(built, published)
  console.log(`[build-agent] Publicado: ${published}`)
}

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

const target = process.argv[2] ?? 'windows'

switch (target) {
  case 'windows':
    publishWindows()
    break
  case 'linux':
    publishLinux()
    break
  case 'all':
    publishWindows()
    publishLinux()
    break
  default:
    console.error(`[build-agent] Alvo desconhecido: ${target}. Use windows, linux ou all.`)
    process.exit(1)
}
