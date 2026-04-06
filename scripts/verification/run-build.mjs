import { spawnSync } from 'node:child_process'

const timeoutMs = Number(process.env.BUILD_VERIFY_TIMEOUT_MS ?? 600_000)
const result = spawnSync('npx', ['next', 'build', '--webpack'], {
  encoding: 'utf8',
  timeout: timeoutMs,
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CI: '1',
  },
})

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.error?.code === 'ETIMEDOUT') {
  console.error(
    `[phase1b:build] Timed out after ${timeoutMs / 1000}s while running next build --webpack.`,
  )
  process.exit(124)
}

if (typeof result.status === 'number') {
  process.exit(result.status)
}

console.error('[phase1b:build] Failed to execute next build.')
process.exit(1)
