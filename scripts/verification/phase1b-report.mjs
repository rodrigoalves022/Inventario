import { execSync, spawnSync } from 'node:child_process'

function line(title) {
  console.log(`\n=== ${title} ===`)
}

function run(label, command, args) {
  line(label)
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  console.log(`[exit=${result.status ?? 'null'}]`)
}

line('versions')
console.log(`node ${execSync('node -v', { encoding: 'utf8' }).trim()}`)
console.log(`npm ${execSync('npm -v', { encoding: 'utf8' }).trim()}`)

run('test', 'npm', ['run', 'test'])
run('lint', 'npm', ['run', 'lint'])
run('typecheck', 'npm', ['run', 'typecheck'])
run('build:verify', 'npm', ['run', 'build:verify'])
