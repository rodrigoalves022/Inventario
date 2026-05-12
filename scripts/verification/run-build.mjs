import { spawn } from 'node:child_process'
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'node:timers'
import { join } from 'node:path'

const BUILD_COMMAND = join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'next.cmd' : 'next',
)
const BUILD_ARGS = ['build', '--webpack']
const timeoutMs = Number(process.env.BUILD_VERIFY_TIMEOUT_MS ?? 600_000)
const heartbeatMs = Number(process.env.BUILD_VERIFY_HEARTBEAT_MS ?? 15_000)
const recentLineLimit = Number(process.env.BUILD_VERIFY_RECENT_LINE_LIMIT ?? 10)

const startedAt = Date.now()
let lastOutputAt = startedAt
let timedOut = false
let settled = false
let recentLines = []
let bufferedStdout = ''
let bufferedStderr = ''
let heartbeat = null
let timeout = null

function appendRecentLine(line) {
  if (!line.trim()) return
  recentLines.push(line)
  if (recentLines.length > recentLineLimit) {
    recentLines = recentLines.slice(-recentLineLimit)
  }
}

function flushBufferedLines(buffer, pushLine) {
  const normalized = buffer.replace(/\r/g, '\n')
  const parts = normalized.split('\n')
  const remainder = parts.pop() ?? ''

  for (const line of parts) {
    pushLine(line)
  }

  return remainder
}

function writeChunk(stream, chunk, isStdout) {
  const text = chunk.toString()
  stream.write(text)
  lastOutputAt = Date.now()

  if (isStdout) {
    bufferedStdout += text
    bufferedStdout = flushBufferedLines(bufferedStdout, appendRecentLine)
  } else {
    bufferedStderr += text
    bufferedStderr = flushBufferedLines(bufferedStderr, appendRecentLine)
  }
}

function finalizeBufferedLines() {
  appendRecentLine(bufferedStdout)
  appendRecentLine(bufferedStderr)
}

function clearBuildTimers() {
  if (heartbeat) {
    clearInterval(heartbeat)
  }

  if (timeout) {
    clearTimeout(timeout)
  }
}

function formatSeconds(valueMs) {
  return (valueMs / 1000).toFixed(1)
}

console.error(
  `[phase1b:build] Starting ${BUILD_COMMAND} ${BUILD_ARGS.join(' ')} (timeout=${formatSeconds(
    timeoutMs,
  )}s, heartbeat=${formatSeconds(heartbeatMs)}s).`,
)

const child = spawn(BUILD_COMMAND, BUILD_ARGS, {
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    CI: '1',
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

child.stdout?.on('data', (chunk) => writeChunk(process.stdout, chunk, true))
child.stderr?.on('data', (chunk) => writeChunk(process.stderr, chunk, false))

child.on('error', (error) => {
  if (settled) return
  settled = true
  clearBuildTimers()
  console.error(`[phase1b:build] Failed to execute build command: ${error.message}`)
  process.exit(1)
})

heartbeat = setInterval(() => {
  const now = Date.now()
  const elapsedMs = now - startedAt
  const idleMs = now - lastOutputAt
  const recentSummary =
    recentLines.length > 0 ? ` last-line="${recentLines[recentLines.length - 1]}"` : ' no-output-yet'

  console.error(
    `[phase1b:build] Still running after ${formatSeconds(elapsedMs)}s (idle ${formatSeconds(
      idleMs,
    )}s).${recentSummary}`,
  )
}, heartbeatMs)

timeout = setTimeout(() => {
  if (settled) return
  timedOut = true
  console.error(
    `[phase1b:build] Timeout reached after ${formatSeconds(
      timeoutMs,
    )}s. Sending SIGTERM to build process...`,
  )
  child.kill('SIGTERM')

  setTimeout(() => {
    if (settled) return
    console.error('[phase1b:build] Build process did not exit after SIGTERM; sending SIGKILL.')
    child.kill('SIGKILL')
  }, 5_000).unref()
}, timeoutMs)

child.on('close', (code, signal) => {
  if (settled) return
  settled = true
  clearBuildTimers()
  finalizeBufferedLines()

  if (timedOut) {
    if (recentLines.length > 0) {
      console.error('[phase1b:build] Recent output before timeout:')
      for (const line of recentLines) {
        console.error(`[phase1b:build]   ${line}`)
      }
    }

    console.error(
      `[phase1b:build] Timed out after ${formatSeconds(
        timeoutMs,
      )}s while running ${BUILD_COMMAND} ${BUILD_ARGS.join(' ')}. Exit signal=${signal ?? 'none'}.`,
    )
    process.exit(124)
  }

  if (typeof code === 'number') {
    process.exit(code)
  }

  console.error(
    `[phase1b:build] Build exited without status code.${signal ? ` Signal=${signal}.` : ''}`,
  )
  process.exit(1)
})
