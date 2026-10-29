import { z } from 'zod'

type ProvisioningArtifacts = {
  bootstrapUrl: string
  bootstrapCommand: string
  installCommand: string
  linuxBootstrapUrl: string
  linuxBootstrapCommand: string
  linuxInstallCommand: string
}

// Sprint A1a (achado N1 da auditoria A0): client/key/serverUrl viram codigo
// executavel na maquina do cliente (script .ps1 servido por
// GET /api/agent/bootstrap e executado via `irm | iex`, e o comando cmd.exe de
// instalacao). Por isso a validacao e' por ALLOWLIST e REJEITA a entrada fora
// do formato — nunca tenta "consertar" o valor.
export const CLIENT_SLUG_PATTERN = /^[a-z0-9-]+$/
export const CLIENT_SLUG_MIN_LENGTH = 2
export const CLIENT_SLUG_MAX_LENGTH = 64
export const ENROLLMENT_KEY_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/

/**
 * Schema unico de `client`/`key` para as rotas publicas de provisionamento
 * (GET /api/agent/bootstrap e GET /api/agent/download-exe). Nenhuma das rotas
 * deve definir a regex inline.
 */
export const provisioningParamsSchema = z.object({
  client: z
    .string()
    .trim()
    .min(CLIENT_SLUG_MIN_LENGTH)
    .max(CLIENT_SLUG_MAX_LENGTH)
    .regex(CLIENT_SLUG_PATTERN),
  key: z.string().trim().regex(ENROLLMENT_KEY_PATTERN),
})

// Sprint A4 (N6): SHA-256 do binario publicado, em hex minusculo (formato de
// createHash('sha256').digest('hex')). Entra nos scripts de bootstrap, entao
// tambem e' allowlist: fora do formato, o builder lanca.
export const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

export const PROVISIONING_PARAMS_ERROR = 'Parâmetros client e key ausentes ou fora do formato permitido.'

export class ProvisioningInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProvisioningInputError'
  }
}

// Aspas que o PowerShell trata como aspa simples: ASCII ' e U+2018–U+201B.
const POWERSHELL_SINGLE_QUOTES = /['‘’‚‛]/g
// Caracteres proibidos no serverUrl: qualquer aspa (ASCII e tipograficas
// simples), backtick (escape do PowerShell) e $ (expansao/subexpressao).
const SERVER_URL_FORBIDDEN = /['"`$%‘’‚‛]/

function hasControlCharacter(value: string) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

function assertAllowedClientSlug(clientSlug: string) {
  if (
    typeof clientSlug !== 'string' ||
    clientSlug.length < CLIENT_SLUG_MIN_LENGTH ||
    clientSlug.length > CLIENT_SLUG_MAX_LENGTH ||
    !CLIENT_SLUG_PATTERN.test(clientSlug)
  ) {
    throw new ProvisioningInputError('Identificador do cliente fora do formato permitido.')
  }
}

function assertAllowedEnrollmentKey(enrollmentKey: string) {
  if (typeof enrollmentKey !== 'string' || !ENROLLMENT_KEY_PATTERN.test(enrollmentKey)) {
    throw new ProvisioningInputError('Chave de instalação fora do formato permitido.')
  }
}

function assertAllowedServerUrl(serverUrl: string) {
  if (typeof serverUrl !== 'string' || SERVER_URL_FORBIDDEN.test(serverUrl) || hasControlCharacter(serverUrl)) {
    throw new ProvisioningInputError('URL do servidor contém caracteres não permitidos.')
  }

  let parsed: URL
  try {
    parsed = new URL(serverUrl)
  } catch {
    throw new ProvisioningInputError('URL do servidor inválida.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ProvisioningInputError('URL do servidor deve usar http ou https.')
  }
}

function assertExpectedSha256(expectedSha256: string) {
  if (typeof expectedSha256 !== 'string' || !SHA256_HEX_PATTERN.test(expectedSha256)) {
    throw new ProvisioningInputError('Hash SHA-256 do binário ausente ou fora do formato permitido.')
  }
}

function assertProvisioningInput(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  assertAllowedServerUrl(serverUrl)
  assertAllowedClientSlug(clientSlug)
  assertAllowedEnrollmentKey(enrollmentKey)
}

/**
 * Segunda camada (a primeira e' a allowlist acima): dobra toda aspa que o
 * PowerShell reconhece como aspa simples, nao so a ASCII.
 */
export function escapePowerShellSingleQuoted(value: string) {
  return value.replace(POWERSHELL_SINGLE_QUOTES, (quote) => quote + quote)
}

/**
 * Segunda camada para bash (a primeira e' a allowlist): dentro de aspas
 * simples nada expande; a unica forma de sair delas e' outra aspa simples,
 * trocada por `'\''` (fecha, aspa escapada, reabre).
 */
export function escapeBashSingleQuoted(value: string) {
  return value.replace(/'/g, "'\\''")
}

export function buildBootstrapUrl(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  const base = `${serverUrl.replace(/\/+$/, '')}/api/agent/bootstrap`
  const params = new URLSearchParams({
    client: clientSlug,
    key: enrollmentKey,
  })

  return `${base}?${params.toString()}`
}

export function buildLinuxBootstrapUrl(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  const base = `${serverUrl.replace(/\/+$/, '')}/api/agent/bootstrap-linux`
  const params = new URLSearchParams({
    client: clientSlug,
    key: enrollmentKey,
  })

  return `${base}?${params.toString()}`
}

export function buildProvisioningArtifacts(
  serverUrl: string,
  clientSlug: string,
  enrollmentKey: string
): ProvisioningArtifacts {
  assertProvisioningInput(serverUrl, clientSlug, enrollmentKey)
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '')
  const bootstrapUrl = buildBootstrapUrl(normalizedServerUrl, clientSlug, enrollmentKey)
  const escapedBootstrapUrl = escapePowerShellSingleQuoted(bootstrapUrl)
  const linuxBootstrapUrl = buildLinuxBootstrapUrl(normalizedServerUrl, clientSlug, enrollmentKey)

  return {
    bootstrapUrl,
    bootstrapCommand: `powershell -ExecutionPolicy Bypass -NoProfile -Command "irm '${escapedBootstrapUrl}' | iex"`,
    installCommand: `inventario-agent.exe install -server "${normalizedServerUrl}" -client "${clientSlug}" -key "${enrollmentKey}" -name "%COMPUTERNAME%"`,
    linuxBootstrapUrl,
    linuxBootstrapCommand: `curl -fsSL '${escapeBashSingleQuoted(linuxBootstrapUrl)}' | sudo bash`,
    // Aspas simples de bash (segunda camada, depois da allowlist): em aspas
    // duplas um bash interativo expande `!` (historico). So o $(hostname) fica
    // em aspas duplas, de proposito. Mesmo destino do bootstrap (decisao 2): o
    // servico systemd aponta para onde o binario esta no momento do `install`.
    linuxInstallCommand: `sudo install -m 755 ./inventario-agent-${clientSlug} /usr/local/bin/inventario-agent && sudo /usr/local/bin/inventario-agent install -server '${escapeBashSingleQuoted(normalizedServerUrl)}' -client '${escapeBashSingleQuoted(clientSlug)}' -key '${escapeBashSingleQuoted(enrollmentKey)}' -name "$(hostname)"`,
  }
}

export function buildBootstrapScript(
  serverUrl: string,
  clientSlug: string,
  enrollmentKey: string,
  expectedSha256: string
) {
  assertProvisioningInput(serverUrl, clientSlug, enrollmentKey)
  assertExpectedSha256(expectedSha256)
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '')
  const escapedServerUrl = escapePowerShellSingleQuoted(normalizedServerUrl)
  const escapedClientSlug = escapePowerShellSingleQuoted(clientSlug)
  const escapedEnrollmentKey = escapePowerShellSingleQuoted(enrollmentKey)

  return [
    "$ErrorActionPreference = 'Stop'",
    "$ProgressPreference = 'SilentlyContinue'",
    '',
    '$identity = [Security.Principal.WindowsIdentity]::GetCurrent()',
    '$principal = New-Object Security.Principal.WindowsPrincipal($identity)',
    'if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {',
    "  throw 'Execute este script em um PowerShell aberto como Administrador.'",
    '}',
    '',
    `$server = '${escapedServerUrl}'`,
    `$client = '${escapedClientSlug}'`,
    `$key = '${escapedEnrollmentKey}'`,
    `$expectedSha256 = '${expectedSha256}'`,
    "$name = $env:COMPUTERNAME",
    // Sob Program Files usuario comum nao escreve: um processo sem elevacao nao
    // consegue plantar nem trocar o binario entre o Get-FileHash e a execucao
    // (em %TEMP% conseguia). O servico tambem passa a rodar daqui.
    "$downloadDir = Join-Path $env:ProgramFiles 'InventarioAgent'",
    "$downloadPath = Join-Path $downloadDir 'inventario-agent.exe'",
    '',
    // Nada que ja esteja no disco e' executado antes do hash: o servico
    // anterior sai por Stop-Service + sc.exe, sem rodar binario nao conferido.
    "$ErrorActionPreference = 'Continue'",
    "Stop-Service 'InventarioAgent' -Force -ErrorAction SilentlyContinue",
    "sc.exe delete 'InventarioAgent' | Out-Null",
    "$ErrorActionPreference = 'Stop'",
    '',
    'New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null',
    "Invoke-WebRequest -UseBasicParsing -Uri ($server + '/inventario-agent.exe') -OutFile $downloadPath",
    // Sprint A4 (N6): nada do arquivo baixado e' executado antes de o hash
    // bater. `-ne` do PowerShell nao diferencia maiusculas (Get-FileHash
    // devolve maiusculas; o esperado vem em minusculas).
    '$actualSha256 = (Get-FileHash -Algorithm SHA256 -Path $downloadPath).Hash',
    'if ($actualSha256 -ne $expectedSha256) {',
    '  Remove-Item -Force -Path $downloadPath -ErrorAction SilentlyContinue',
    '  throw "Hash SHA-256 divergente do binario baixado: esperado $expectedSha256, obtido $actualSha256. Nada foi instalado."',
    '}',
    "$ErrorActionPreference = 'Continue'",
    // Operador de chamada (e nao cmd.exe /c): o caminho tem espaco.
    "& $downloadPath uninstall 2>$null",
    "Start-Sleep -Seconds 1",
    "$ErrorActionPreference = 'Stop'",
    "& $downloadPath install -server $server -client $client -key $key -name $name",
  ].join('\r\n')
}

/**
 * Script bash servido por GET /api/agent/bootstrap-linux e executado via
 * `curl -fsSL '<url>' | sudo bash` (Sprint A4, RF032). Falha fechado: sem root,
 * sem curl/wget, sem sha256sum/shasum ou com hash divergente, sai com codigo
 * diferente de zero sem instalar nada. Nada e' executado a partir do diretorio
 * temporario (`/tmp` com `noexec` e' comum): o binario conferido vai para
 * /usr/local/bin/inventario-agent e so entao roda `uninstall`/`install` de la.
 * O corpo fica dentro de `main()` para o bash ler o script inteiro antes de
 * executar a primeira linha (leitura por pipe).
 */
export function buildLinuxBootstrapScript(
  serverUrl: string,
  clientSlug: string,
  enrollmentKey: string,
  expectedSha256: string
) {
  assertProvisioningInput(serverUrl, clientSlug, enrollmentKey)
  assertExpectedSha256(expectedSha256)
  const normalizedServerUrl = serverUrl.replace(/\/+$/, '')

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'main() {',
    `  SERVER='${escapeBashSingleQuoted(normalizedServerUrl)}'`,
    `  CLIENT='${escapeBashSingleQuoted(clientSlug)}'`,
    `  KEY='${escapeBashSingleQuoted(enrollmentKey)}'`,
    `  EXPECTED_SHA256='${escapeBashSingleQuoted(expectedSha256)}'`,
    "  INSTALL_PATH='/usr/local/bin/inventario-agent'",
    "  UNIT_PATH='/etc/systemd/system/inventario-agent.service'",
    '',
    '  if [ "$(id -u)" -ne 0 ]; then',
    "    echo 'Execute este script como root: curl -fsSL <url> | sudo bash' >&2",
    '    exit 1',
    '  fi',
    '',
    '  WORK_DIR="$(mktemp -d)"',
    `  trap 'rm -rf "$WORK_DIR"' EXIT`,
    '  DOWNLOAD_PATH="$WORK_DIR/inventario-agent"',
    '',
    '  if command -v curl >/dev/null 2>&1; then',
    '    curl -fsSL "$SERVER/inventario-agent-linux" -o "$DOWNLOAD_PATH"',
    '  elif command -v wget >/dev/null 2>&1; then',
    '    wget -qO "$DOWNLOAD_PATH" "$SERVER/inventario-agent-linux"',
    '  else',
    "    echo 'Nem curl nem wget encontrados. Instale um dos dois e rode o script de novo.' >&2",
    '    exit 1',
    '  fi',
    '',
    '  if command -v sha256sum >/dev/null 2>&1; then',
    '    ACTUAL_SHA256="$(sha256sum "$DOWNLOAD_PATH")"',
    '  elif command -v shasum >/dev/null 2>&1; then',
    '    ACTUAL_SHA256="$(shasum -a 256 "$DOWNLOAD_PATH")"',
    '  else',
    "    echo 'Nem sha256sum nem shasum encontrados: sem conferir o hash, nada sera instalado.' >&2",
    '    exit 1',
    '  fi',
    '  ACTUAL_SHA256="${ACTUAL_SHA256%% *}"',
    '',
    '  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then',
    '    echo "Hash SHA-256 divergente do binario baixado: esperado $EXPECTED_SHA256, obtido $ACTUAL_SHA256. Nada foi instalado." >&2',
    '    rm -f "$DOWNLOAD_PATH"',
    '    exit 1',
    '  fi',
    '',
    '  chmod 755 "$DOWNLOAD_PATH"',
    '  mkdir -p /usr/local/bin',
    '  cp "$DOWNLOAD_PATH" "$INSTALL_PATH.new"',
    '  chmod 755 "$INSTALL_PATH.new"',
    '  mv -f "$INSTALL_PATH.new" "$INSTALL_PATH"',
    '',
    '  # Install() recusa unidade systemd existente: remove a versao anterior.',
    '  if [ -f "$UNIT_PATH" ]; then',
    '    "$INSTALL_PATH" uninstall || true',
    '  fi',
    '',
    '  "$INSTALL_PATH" install -server "$SERVER" -client "$CLIENT" -key "$KEY" -name "$(hostname)"',
    '}',
    '',
    'main "$@"',
    '',
  ].join('\n')
}
