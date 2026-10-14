import { z } from 'zod'

type ProvisioningArtifacts = {
  bootstrapUrl: string
  bootstrapCommand: string
  installCommand: string
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
const SERVER_URL_FORBIDDEN = /['"`$‘’‚‛]/

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

export function buildBootstrapUrl(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  const base = `${serverUrl.replace(/\/+$/, '')}/api/agent/bootstrap`
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

  return {
    bootstrapUrl,
    bootstrapCommand: `powershell -ExecutionPolicy Bypass -NoProfile -Command "irm '${escapedBootstrapUrl}' | iex"`,
    installCommand: `inventario-agent.exe install -server "${normalizedServerUrl}" -client "${clientSlug}" -key "${enrollmentKey}" -name "%COMPUTERNAME%"`,
  }
}

export function buildBootstrapScript(serverUrl: string, clientSlug: string, enrollmentKey: string) {
  assertProvisioningInput(serverUrl, clientSlug, enrollmentKey)
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
    "$name = $env:COMPUTERNAME",
    "$downloadDir = Join-Path $env:TEMP 'InventarioAgent'",
    "$downloadPath = Join-Path $downloadDir 'inventario-agent.exe'",
    '',
    "$ErrorActionPreference = 'Continue'",
    "if (Test-Path $downloadPath) { & cmd.exe /c \"$downloadPath uninstall 2>NUL\" }",
    "Stop-Service 'InventarioAgent' -Force -ErrorAction SilentlyContinue",
    "sc.exe delete 'InventarioAgent' | Out-Null",
    "$ErrorActionPreference = 'Stop'",
    '',
    'New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null',
    "Invoke-WebRequest -UseBasicParsing -Uri ($server + '/inventario-agent.exe') -OutFile $downloadPath",
    "$ErrorActionPreference = 'Continue'",
    "& cmd.exe /c \"$downloadPath uninstall 2>NUL\"",
    "Start-Sleep -Seconds 1",
    "$ErrorActionPreference = 'Stop'",
    "& $downloadPath install -server $server -client $client -key $key -name $name",
  ].join('\r\n')
}
