import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { unlinkSync } from 'node:fs'
import { join } from 'node:path'

const timeoutMs = 120_000

const tsBuildInfoFile = join(process.cwd(), 'tsconfig.tsbuildinfo')
if (existsSync(tsBuildInfoFile)) {
  unlinkSync(tsBuildInfoFile)
}

const tscBin = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
const result = spawnSync(process.execPath, [tscBin, '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  timeout: timeoutMs,
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.error?.code === 'ETIMEDOUT') {
  console.error(`[phase1b:typecheck] Timed out after ${timeoutMs / 1000}s while running tsc --noEmit.`)
  process.exit(124)
}

if (typeof result.status === 'number') {
  process.exit(result.status)
}

console.error('[phase1b:typecheck] Failed to execute TypeScript compiler.')
process.exit(1)
