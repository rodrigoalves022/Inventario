import { spawnSync } from 'node:child_process'

const timeoutMs = 120_000
const result = spawnSync('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
  encoding: 'utf8',
  timeout: timeoutMs,
  shell: process.platform === 'win32',
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
