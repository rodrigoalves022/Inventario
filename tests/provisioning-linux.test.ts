import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ProvisioningInputError,
  buildBootstrapScript,
  buildLinuxBootstrapScript,
  buildProvisioningArtifacts,
  escapeBashSingleQuoted,
} from '@/lib/provisioning'
import {
  LEGIT_SERVER_URLS,
  MALICIOUS_FRAGMENTS,
  MALICIOUS_SERVER_URLS,
  REAL_KEY,
  REAL_SLUG,
  SERVER_URL,
  VALID_SHA256,
  maliciousClient,
  maliciousKey,
} from './provisioning-payloads'

// Sprint A4 (RF032; N6 + F4). Script bash de instalacao Linux servido por
// GET /api/agent/bootstrap-linux e executado via `curl ... | sudo bash`, e a
// conferencia de SHA-256 nos dois bootstraps. Mesma regra da A1a: entrada fora
// da allowlist e' RECUSADA antes de qualquer escape; o escape bash e' a
// segunda camada. Os testes de bash rodam bash DE VERDADE (Git Bash no
// Windows, /bin/bash no Linux) e FALHAM se nao houver bash — nunca pulam.

// ---------------------------------------------------------------------------
// Localiza um bash utilizavel. No Windows, `bash` no PATH pode ser o do WSL
// (System32\bash.exe), que nao enxerga caminhos do Windows; o Git Bash vem
// primeiro.
// ---------------------------------------------------------------------------
function findBash(): string | null {
  const candidates = [
    process.env.INVENTARIO_TEST_BASH,
    process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : undefined,
    process.platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin\\bash.exe' : undefined,
    'bash',
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (candidate !== 'bash' && !existsSync(candidate)) continue
    const probe = spawnSync(candidate, ['-c', 'printf ok'], { encoding: 'utf8' })
    if (probe.status === 0 && probe.stdout === 'ok') return candidate
  }
  return null
}

const BASH = findBash()

function requireBash(): string {
  // Sem bash o criterio NAO esta provado: falha alto em vez de pular.
  if (!BASH) throw new Error('bash nao encontrado: os testes de parse/escape/hash do script Linux nao podem rodar.')
  return BASH
}

function runBashStdin(input: string, env?: NodeJS.ProcessEnv) {
  return spawnSync(requireBash(), ['-s'], { input, encoding: 'utf8', env: env ?? process.env })
}

function sha256Of(content: string) {
  return createHash('sha256').update(Buffer.from(content)).digest('hex')
}

describe('ambiente — bash disponivel para os testes de script', () => {
  it('encontra um bash executavel (Git Bash no Windows)', () => {
    expect(BASH).not.toBeNull()
    const version = spawnSync(requireBash(), ['--version'], { encoding: 'utf8' })
    expect(version.status).toBe(0)
    expect(version.stdout).toMatch(/GNU bash/)
  })
})

// ---------------------------------------------------------------------------
// Item 4 — escapeBashSingleQuoted (segunda camada)
// ---------------------------------------------------------------------------
describe('escapeBashSingleQuoted', () => {
  it("troca cada ' por '\\''", () => {
    expect(escapeBashSingleQuoted("a'b")).toBe("a'\\''b")
    expect(escapeBashSingleQuoted("''")).toBe("'\\'''\\''")
    expect(escapeBashSingleQuoted('sem-aspa')).toBe('sem-aspa')
  })

  it.each<[string, string]>([
    ["aspa simples '", "it's"],
    ['subexpressao $(id)', '$(id)'],
    ['backtick', '`id`'],
    ['ponto e virgula', 'a; id'],
    ['pipe', 'a | id'],
    ['e comercial', 'a & id'],
    ['quebra de linha', 'a\nid'],
    ['tudo junto', "x'; echo PWNED; $(id) `id` | & \n'"],
  ])('bash real devolve o literal original para valor com %s', (_label, value) => {
    const result = runBashStdin(`printf %s '${escapeBashSingleQuoted(value)}'`)
    expect(result.status).toBe(0)
    expect(result.stdout).toBe(value)
  })
})

// ---------------------------------------------------------------------------
// Allowlist primeiro (RNF003): recusa antes de escapar.
// ---------------------------------------------------------------------------
describe('buildLinuxBootstrapScript / buildProvisioningArtifacts — recusam entrada fora da allowlist', () => {
  it.each(MALICIOUS_FRAGMENTS)('buildLinuxBootstrapScript lanca para client com %s', (_label, fragment) => {
    expect(() => buildLinuxBootstrapScript(SERVER_URL, maliciousClient(fragment), REAL_KEY, VALID_SHA256)).toThrow()
  })

  it.each(MALICIOUS_FRAGMENTS)('buildLinuxBootstrapScript lanca para key com %s', (_label, fragment) => {
    expect(() => buildLinuxBootstrapScript(SERVER_URL, REAL_SLUG, maliciousKey(fragment), VALID_SHA256)).toThrow()
  })

  it.each(MALICIOUS_SERVER_URLS)('buildLinuxBootstrapScript lanca para serverUrl %s', (_label, serverUrl) => {
    expect(() => buildLinuxBootstrapScript(serverUrl, REAL_SLUG, REAL_KEY, VALID_SHA256)).toThrow()
  })

  it.each(MALICIOUS_SERVER_URLS)('buildProvisioningArtifacts (linuxInstallCommand) lanca para serverUrl %s', (_label, serverUrl) => {
    expect(() => buildProvisioningArtifacts(serverUrl, REAL_SLUG, REAL_KEY)).toThrow()
  })

  it('$ e backtick no serverUrl sao recusados (o linuxInstallCommand usa aspas duplas)', () => {
    expect(() => buildProvisioningArtifacts('https://inv.example.com/$(id)', REAL_SLUG, REAL_KEY)).toThrow()
    expect(() => buildProvisioningArtifacts('https://inv.example.com/`id`', REAL_SLUG, REAL_KEY)).toThrow()
    expect(() => buildProvisioningArtifacts('https://example.com/%TEMP%', 'acme', 'key-12345678')).toThrow(ProvisioningInputError)
    expect(() => buildLinuxBootstrapScript('https://inv.example.com/$HOME', REAL_SLUG, REAL_KEY, VALID_SHA256)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Hash obrigatorio nos dois builders (ressalvas 2 e 3)
// ---------------------------------------------------------------------------
const INVALID_HASHES: Array<[string, unknown]> = [
  ['ausente (undefined)', undefined],
  ['null', null],
  ['vazio', ''],
  ['maiusculas', VALID_SHA256.toUpperCase()],
  ['63 caracteres', VALID_SHA256.slice(0, 63)],
  ['65 caracteres', `${VALID_SHA256}a`],
  ['caractere fora de [a-f0-9]', `${VALID_SHA256.slice(0, 63)}g`],
  ['aspa simples', `${VALID_SHA256.slice(0, 63)}'`],
  ['espaco no fim', `${VALID_SHA256} `],
  ['quebra de linha', `${VALID_SHA256}\n`],
]

describe('expectedSha256 obrigatorio e validado', () => {
  it.each(INVALID_HASHES)('buildLinuxBootstrapScript lanca com hash %s', (_label, hash) => {
    expect(() => buildLinuxBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, hash as string)).toThrow()
  })

  it.each(INVALID_HASHES)('buildBootstrapScript (Windows) lanca com hash %s', (_label, hash) => {
    expect(() => buildBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, hash as string)).toThrow()
  })

  it('hash valido e aceito pelos dois', () => {
    expect(() => buildLinuxBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, VALID_SHA256)).not.toThrow()
    expect(() => buildBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, VALID_SHA256)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Item 5 — conteudo do script Linux
// ---------------------------------------------------------------------------
describe('buildLinuxBootstrapScript — conteudo', () => {
  const script = buildLinuxBootstrapScript(`${SERVER_URL}/`, REAL_SLUG, REAL_KEY, VALID_SHA256)
  const lines = script.split('\n')

  it('comeca com #!/usr/bin/env bash e usa LF', () => {
    expect(script.startsWith('#!/usr/bin/env bash\n')).toBe(true)
    expect(script).not.toContain('\r')
  })

  it('set -euo pipefail, checagem de root e mktemp -d com trap de limpeza', () => {
    expect(script).toContain('set -euo pipefail')
    expect(script).toMatch(/if \[ "\$\(id -u\)" -ne 0 \]; then/)
    expect(script).toMatch(/WORK_DIR="\$\(mktemp -d\)"/)
    expect(script).toMatch(/trap 'rm -rf "\$WORK_DIR"' EXIT/)
  })

  it('valores interpolados entre aspas simples, com o hash recebido', () => {
    expect(script).toContain(`SERVER='${SERVER_URL}'`)
    expect(script).toContain(`CLIENT='${REAL_SLUG}'`)
    expect(script).toContain(`KEY='${REAL_KEY}'`)
    expect(script).toContain(`EXPECTED_SHA256='${VALID_SHA256}'`)
  })

  it('download por curl -fsSL com fallback wget; sem nenhum dos dois aborta', () => {
    expect(script).toContain('curl -fsSL "$SERVER/inventario-agent-linux" -o "$DOWNLOAD_PATH"')
    expect(script).toContain('wget -qO "$DOWNLOAD_PATH" "$SERVER/inventario-agent-linux"')
    const curlIndex = script.indexOf('curl -fsSL')
    const wgetIndex = script.indexOf('wget -qO')
    expect(curlIndex).toBeLessThan(wgetIndex)
  })

  it('hash por sha256sum com fallback shasum -a 256 e comparacao com o esperado', () => {
    expect(script).toContain('sha256sum "$DOWNLOAD_PATH"')
    expect(script).toContain('shasum -a 256 "$DOWNLOAD_PATH"')
    expect(script).toContain('if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then')
  })

  it('chmod 755, destino /usr/local/bin/inventario-agent, desinstalacao condicionada e install', () => {
    expect(script).toContain('chmod 755')
    expect(script).toContain("INSTALL_PATH='/usr/local/bin/inventario-agent'")
    expect(script).toContain("UNIT_PATH='/etc/systemd/system/inventario-agent.service'")
    expect(script).toMatch(/if \[ -f "\$UNIT_PATH" \]; then\s*\n\s*"\$INSTALL_PATH" uninstall/)
    expect(script).toContain('"$INSTALL_PATH" install -server "$SERVER" -client "$CLIENT" -key "$KEY" -name "$(hostname)"')
  })

  it('a ordem e: conferir hash → instalar em /usr/local/bin → uninstall → install', () => {
    const hashCheck = script.indexOf('if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]')
    const moveIntoPlace = script.indexOf('mv -f')
    const uninstall = script.indexOf('"$INSTALL_PATH" uninstall')
    const install = script.indexOf('"$INSTALL_PATH" install -server')
    expect(hashCheck).toBeGreaterThan(0)
    expect(moveIntoPlace).toBeGreaterThan(hashCheck)
    expect(uninstall).toBeGreaterThan(moveIntoPlace)
    expect(install).toBeGreaterThan(uninstall)
  })

  it('decisao 3: nenhuma linha executa binario a partir do diretorio temporario', () => {
    for (const line of lines) {
      const trimmed = line.trim()
      // Linha que COMECA invocando algo do tmp ("$DOWNLOAD_PATH" ... ou "$WORK_DIR/..." ...)
      expect(trimmed.startsWith('"$DOWNLOAD_PATH"')).toBe(false)
      expect(trimmed.startsWith('"$WORK_DIR')).toBe(false)
      expect(trimmed.startsWith('$DOWNLOAD_PATH')).toBe(false)
      expect(trimmed).not.toMatch(/(^|[;&|]\s*)("?\$(DOWNLOAD_PATH|WORK_DIR)"?)(\s|$)/)
    }
    // Todas as execucoes do agente partem do destino final.
    const agentInvocations = lines.filter((line) => /\b(install|uninstall)\b/.test(line) && line.includes('"$INSTALL_PATH" '))
    expect(agentInvocations.length).toBeGreaterThanOrEqual(2)
  })

  it('o corpo roda dentro de main(), para `curl | bash` ler o script inteiro antes de executar', () => {
    expect(script).toMatch(/^main\(\) \{$/m)
    expect(script.trimEnd().endsWith('main "$@"')).toBe(true)
  })
})

describe('buildLinuxBootstrapScript — bash -n (parse real)', () => {
  it.each(LEGIT_SERVER_URLS)('bash -n sai com 0 para serverUrl %s', (serverUrl) => {
    const script = buildLinuxBootstrapScript(serverUrl, REAL_SLUG, REAL_KEY, VALID_SHA256)
    const result = spawnSync(requireBash(), ['-n'], { input: script, encoding: 'utf8' })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Hash divergente na pratica: roda o script de verdade com curl/id e as
// ferramentas de instalacao substituidas por stubs. Nada e' instalado.
// ---------------------------------------------------------------------------
describe('buildLinuxBootstrapScript — conferencia de hash executada em bash real', () => {
  let stubDir = ''
  let stubDirPosix = ''
  const DOWNLOADED_CONTENT = 'binario-baixado-pelo-stub'

  function writeStub(name: string, body: string) {
    const file = path.join(stubDir, name)
    writeFileSync(file, `#!/usr/bin/env bash\n${body}\n`, { encoding: 'utf8' })
    chmodSync(file, 0o755)
  }

  beforeAll(() => {
    const bash = requireBash()
    stubDir = mkdtempSync(path.join(tmpdir(), 'inv-a4-stubs-'))
    const posix = spawnSync(bash, ['-c', 'cd "$1" && pwd', '_', stubDir], { encoding: 'utf8' })
    stubDirPosix = posix.stdout.trim()
    expect(stubDirPosix).not.toBe('')

    // Root simulado e download simulado (sem rede).
    writeStub('id', 'printf "0\\n"')
    writeStub(
      'curl',
      [
        'out=""',
        'while [ "$#" -gt 0 ]; do',
        '  if [ "$1" = "-o" ]; then out="$2"; shift; fi',
        '  shift',
        'done',
        `printf %s '${DOWNLOADED_CONTENT}' > "$out"`,
      ].join('\n')
    )
    // Qualquer passo de instalacao deixa uma marca e NAO toca o sistema.
    for (const tool of ['cp', 'mv', 'install', 'mkdir']) {
      writeStub(tool, `printf '%s\\n' "${tool} $*" >> "${stubDirPosix}/install-steps.log"`)
    }
  })

  afterAll(() => {
    if (stubDir) rmSync(stubDir, { recursive: true, force: true })
  })

  function runScript(expectedSha256: string) {
    rmSync(path.join(stubDir, 'install-steps.log'), { force: true })
    const script = buildLinuxBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, expectedSha256)
    // Prefixo so de teste: stubs na frente do PATH. O script gerado segue
    // intacto depois desta linha, lido por stdin como no `curl | sudo bash`.
    return runBashStdin(`export PATH="${stubDirPosix}:$PATH"\n${script}`)
  }

  it('hash divergente: sai != 0, informa esperado e obtido, e nenhum passo de instalacao roda', () => {
    const divergent = sha256Of('outro-conteudo')
    const result = runScript(divergent)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('divergente')
    expect(result.stderr).toContain(divergent)
    expect(result.stderr).toContain(sha256Of(DOWNLOADED_CONTENT))
    expect(existsSync(path.join(stubDir, 'install-steps.log'))).toBe(false)
  })

  it('controle positivo: com o hash certo o script passa da conferencia e chega aos passos de instalacao (stubs)', () => {
    const result = runScript(sha256Of(DOWNLOADED_CONTENT))

    // Os stubs registram a instalacao; o `install` final falha porque o
    // binario nao existe de verdade em /usr/local/bin (nada foi instalado).
    expect(result.stderr).not.toContain('divergente')
    expect(existsSync(path.join(stubDir, 'install-steps.log'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Item 6 — N6 Windows: Get-FileHash depois do download, antes de executar.
// ---------------------------------------------------------------------------
describe('buildBootstrapScript (Windows) — conferencia de SHA-256', () => {
  const script = buildBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, VALID_SHA256)
  const lines = script.split('\r\n')

  it('carrega o hash esperado em aspas simples', () => {
    expect(script).toContain(`$expectedSha256 = '${VALID_SHA256}'`)
  })

  it('Get-FileHash -Algorithm SHA256 sobre $downloadPath depois do Invoke-WebRequest e antes da primeira execucao', () => {
    const download = lines.findIndex((line) => line.startsWith('Invoke-WebRequest'))
    const hash = lines.findIndex((line) => line.includes('Get-FileHash -Algorithm SHA256 -Path $downloadPath'))
    const executions = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^\s*&\s*(cmd\.exe\s+\/c\s+"\$downloadPath|\$downloadPath)/.test(line) || line.includes('& $downloadPath'))
      .map(({ index }) => index)
    const executionsAfterDownload = executions.filter((index) => index > download)

    expect(download).toBeGreaterThan(-1)
    expect(hash).toBeGreaterThan(download)
    expect(executionsAfterDownload.length).toBeGreaterThan(0)
    expect(Math.min(...executionsAfterDownload)).toBeGreaterThan(hash)
  })

  it('divergencia: Remove-Item do arquivo e throw com esperado e obtido, sem diferenciar maiusculas', () => {
    const hash = lines.findIndex((line) => line.includes('Get-FileHash'))
    const block = lines.slice(hash, hash + 6).join('\n')
    expect(block).toMatch(/-ne \$expectedSha256/)
    expect(block).toContain('Remove-Item -Force -Path $downloadPath')
    expect(block).toMatch(/throw .*\$expectedSha256.*\$actualSha256/)
    // -ne do PowerShell nao diferencia maiusculas; o Get-FileHash devolve maiusculas.
    expect(block).not.toContain('-cne')
  })
})

// ---------------------------------------------------------------------------
// Item 8 — pacote com os campos Linux, campos Windows intactos.
// ---------------------------------------------------------------------------
describe('buildProvisioningArtifacts — campos Linux e nao-regressao do Windows', () => {
  it('Windows: mesmo texto de antes da A4', () => {
    const artifacts = buildProvisioningArtifacts(`${SERVER_URL}/`, REAL_SLUG, REAL_KEY)
    expect(artifacts.bootstrapUrl).toBe(`${SERVER_URL}/api/agent/bootstrap?client=${REAL_SLUG}&key=${REAL_KEY}`)
    expect(artifacts.bootstrapCommand).toBe(
      `powershell -ExecutionPolicy Bypass -NoProfile -Command "irm '${SERVER_URL}/api/agent/bootstrap?client=${REAL_SLUG}&key=${REAL_KEY}' | iex"`
    )
    expect(artifacts.installCommand).toBe(
      `inventario-agent.exe install -server "${SERVER_URL}" -client "${REAL_SLUG}" -key "${REAL_KEY}" -name "%COMPUTERNAME%"`
    )
  })

  it('Linux: linuxBootstrapUrl, linuxBootstrapCommand e linuxInstallCommand (decisao 2)', () => {
    const artifacts = buildProvisioningArtifacts(`${SERVER_URL}/`, REAL_SLUG, REAL_KEY)
    const url = `${SERVER_URL}/api/agent/bootstrap-linux?client=${REAL_SLUG}&key=${REAL_KEY}`
    expect(artifacts.linuxBootstrapUrl).toBe(url)
    expect(artifacts.linuxBootstrapCommand).toBe(`curl -fsSL '${url}' | sudo bash`)
    expect(artifacts.linuxInstallCommand).toBe(
      `sudo install -m 755 ./inventario-agent-${REAL_SLUG} /usr/local/bin/inventario-agent && ` +
        // Aspas simples desde o achado 3 do security-auditor (expansao de `!`).
        `sudo /usr/local/bin/inventario-agent install -server '${SERVER_URL}' -client '${REAL_SLUG}' -key '${REAL_KEY}' -name "$(hostname)"`
    )
  })

  it('linuxBootstrapCommand: bash real le a URL de volta intacta (escape de aspa simples aplicado)', () => {
    const artifacts = buildProvisioningArtifacts(SERVER_URL, REAL_SLUG, REAL_KEY)
    const quoted = artifacts.linuxBootstrapCommand.replace(/^curl -fsSL /, '').replace(/ \| sudo bash$/, '')
    const result = runBashStdin(`printf %s ${quoted}`)
    expect(result.status).toBe(0)
    expect(result.stdout).toBe(artifacts.linuxBootstrapUrl)
  })

  it.each(MALICIOUS_FRAGMENTS)('lanca para client com %s (antes de qualquer escape)', (_label, fragment) => {
    expect(() => buildProvisioningArtifacts(SERVER_URL, maliciousClient(fragment), REAL_KEY)).toThrow()
  })

  it.each(MALICIOUS_FRAGMENTS)('lanca para key com %s (antes de qualquer escape)', (_label, fragment) => {
    expect(() => buildProvisioningArtifacts(SERVER_URL, REAL_SLUG, maliciousKey(fragment))).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Achados do security-auditor na Sprint A4.
//  1 e 2: o .ps1 executava, ja elevado, um inventario-agent.exe em %TEMP%
//         (gravavel por qualquer processo do mesmo usuario) antes do download,
//         e o binario conferido continuava em %TEMP% entre o hash e a
//         execucao (TOCTOU). Correcao: diretorio sob $env:ProgramFiles, onde
//         usuario comum nao escreve, e nada do caminho baixado roda antes do
//         Get-FileHash.
//  3:     o comando manual Linux usava aspas duplas; num bash interativo `!`
//         dispara expansao de historico. Correcao: aspas simples.
// ---------------------------------------------------------------------------
describe('bootstrap Windows — diretorio protegido e nada executado antes do hash (achados 1 e 2)', () => {
  const script = buildBootstrapScript(SERVER_URL, REAL_SLUG, REAL_KEY, VALID_SHA256)
  const lines = script.split('\r\n')

  it('baixa para um diretorio sob $env:ProgramFiles, nunca sob $env:TEMP', () => {
    expect(script).not.toMatch(/\$env:TEMP/i)
    expect(script).toMatch(/\$downloadDir = Join-Path \$env:ProgramFiles 'InventarioAgent'/)
  })

  it('nenhuma linha antes do Get-FileHash executa $downloadPath', () => {
    const hashLine = lines.findIndex((line) => line.includes('Get-FileHash'))
    expect(hashLine).toBeGreaterThan(-1)
    const executesDownload = (line: string) =>
      /&\s*\$downloadPath|cmd\.exe[^\n]*\$downloadPath|Start-Process[^\n]*\$downloadPath/.test(line)
    expect(lines.slice(0, hashLine).filter(executesDownload)).toEqual([])
  })

  it('executa o binario conferido pelo operador de chamada (caminho com espaco), sem cmd.exe /c', () => {
    expect(script).not.toMatch(/cmd\.exe \/c/)
    expect(script).toMatch(/& \$downloadPath uninstall/)
    expect(script).toMatch(/& \$downloadPath install -server \$server -client \$client -key \$key -name \$name/)
  })
})

describe('linuxInstallCommand — aspas simples (achado 3)', () => {
  const { linuxInstallCommand } = buildProvisioningArtifacts(SERVER_URL, REAL_SLUG, REAL_KEY)

  it('server, client e key vao entre aspas simples; so o $(hostname) fica em aspas duplas', () => {
    expect(linuxInstallCommand).toContain(`-server '${SERVER_URL.replace(/\/+$/, '')}'`)
    expect(linuxInstallCommand).toContain(`-client '${REAL_SLUG}'`)
    expect(linuxInstallCommand).toContain(`-key '${REAL_KEY}'`)
    expect(linuxInstallCommand).toContain('-name "$(hostname)"')
  })

  it('um serverUrl com ! volta literal pelo bash (sem expansao de historico)', () => {
    const bash = requireBash()
    const url = 'https://inventario.example.com/a!b'
    const { linuxInstallCommand: command } = buildProvisioningArtifacts(url, REAL_SLUG, REAL_KEY)
    const serverArg = command.match(/-server ('[^']*(?:'\''[^']*)*')/)?.[1]
    expect(serverArg).toBeTruthy()
    const result = spawnSync(bash, ['-i', '-s'], {
      input: `set -H\nprintf '%s' ${serverArg}\n`,
      encoding: 'utf8',
    })
    expect(result.stdout).toContain(url)
  })
})
