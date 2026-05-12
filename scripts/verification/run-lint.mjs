import { spawnSync } from 'node:child_process'

const args = ['eslint', 'scripts/verification/**/*.mjs', 'eslint.config.mjs', '--max-warnings=0']
const result = spawnSync('npm', ['exec', '--', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

console.error('[phase1b:lint] Failed to execute eslint.')
process.exit(1)
