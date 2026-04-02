<#
.SYNOPSIS
    Instalador do Agente de Inventario Enterprise
    Instala o agente, configura execucao automatica via Scheduled Task e registra no servidor.

.PARAMETER ServerUrl
    URL base do servidor de inventario. Ex: "https://inventario.empresa.com"

.PARAMETER AdminSecret
    Segredo administrativo (ADMIN_SECRET) configurado no servidor.

.PARAMETER AgentName
    Nome amigavel para identificar este agente no sistema.
    Se omitido, usa o hostname da maquina.

.PARAMETER InstallDir
    Diretorio de instalacao do agente. Padrao: C:\ProgramData\InventarioAgent

.EXAMPLE
    .\install-agent.ps1 -ServerUrl "http://10.62.102.119:3000" -AdminSecret "sua_chave_admin"

.EXAMPLE
    # Deploy silencioso via GPO (sem interacao)
    powershell.exe -ExecutionPolicy Bypass -File "\\servidor\sysvol\install-agent.ps1" `
        -ServerUrl "http://10.62.102.119:3000" -AdminSecret "segredo" -AgentName "FILIAL-SP"
#>

param (
    [Parameter(Mandatory=$true)]  [string]$ServerUrl,
    [Parameter(Mandatory=$true)]  [string]$AdminSecret,
    [Parameter(Mandatory=$false)] [string]$AgentName = $env:COMPUTERNAME,
    [Parameter(Mandatory=$false)] [string]$InstallDir = "C:\ProgramData\InventarioAgent"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$TASK_NAME    = "InventarioAgent"
$AGENT_SCRIPT = "agent.ps1"
$CONFIG_FILE  = "config.json"
$LOG_FILE     = "agent.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    if ((Test-Path $InstallDir)) {
        Add-Content -Path (Join-Path $InstallDir $LOG_FILE) -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    }
}

# ── Verificar privilegios de administrador ──────────────────────────────────────
$currentPrincipal = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Este script precisa ser executado como Administrador." -ForegroundColor Red
    exit 1
}

Write-Log "=== Instalador do Agente de Inventario Enterprise ==="
Write-Log "Servidor : $ServerUrl"
Write-Log "Maquina  : $AgentName"
Write-Log "Dir      : $InstallDir"

# ── 1. Criar diretorio de instalacao ────────────────────────────────────────────
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Log "[+] Diretorio criado: $InstallDir"
}

# ── 2. Copiar o agente para o diretorio de instalacao ───────────────────────────
$scriptSrc = Join-Path $PSScriptRoot $AGENT_SCRIPT
$scriptDst = Join-Path $InstallDir $AGENT_SCRIPT

if (-not (Test-Path $scriptSrc)) {
    Write-Log "[!] Arquivo $AGENT_SCRIPT nao encontrado ao lado do instalador." "ERROR"
    Write-Log "    Coloque install-agent.ps1 e agent.ps1 na mesma pasta." "ERROR"
    exit 1
}

Copy-Item -Path $scriptSrc -Destination $scriptDst -Force
Write-Log "[+] Agente copiado para: $scriptDst"

# ── 3. Registrar o agente no servidor e obter a API Key ─────────────────────────
Write-Log "Registrando agente no servidor..."

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$registerBody = @{ name = $AgentName } | ConvertTo-Json -Depth 5
$registerHeaders = @{
    "Content-Type"    = "application/json"
    "X-Admin-Secret"  = $AdminSecret
}

$apiKey = $null
try {
    $response = Invoke-RestMethod `
        -Uri "$ServerUrl/api/agent/register" `
        -Method POST `
        -Body $registerBody `
        -Headers $registerHeaders `
        -TimeoutSec 30

    $apiKey = $response.apiKey
    Write-Log "[+] Agente registrado com sucesso. ID: $($response.id)" "INFO"
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    if ($statusCode -eq 401) {
        Write-Log "[!] AdminSecret incorreto (HTTP 401). Verifique a variavel ADMIN_SECRET no servidor." "ERROR"
    } else {
        Write-Log "[!] Falha ao registrar: $_ " "ERROR"
    }
    exit 1
}

if (-not $apiKey) {
    Write-Log "[!] Nao foi possivel obter a API Key do servidor." "ERROR"
    exit 1
}

# ── 4. Salvar configuracao local ────────────────────────────────────────────────
$config = @{
    serverUrl  = $ServerUrl
    apiKey     = $apiKey
    agentName  = $AgentName
    installedAt = (Get-Date -Format "o")
}

$configPath = Join-Path $InstallDir $CONFIG_FILE
$config | ConvertTo-Json -Depth 5 | Out-File -FilePath $configPath -Encoding UTF8 -Force

# Restringir permissoes do arquivo de config (apenas SYSTEM e Admins podem ler)
$acl = Get-Acl $configPath
$acl.SetAccessRuleProtection($true, $false)
$adminRule   = New-Object System.Security.AccessControl.FileSystemAccessRule("Administrators","FullControl","Allow")
$systemRule  = New-Object System.Security.AccessControl.FileSystemAccessRule("SYSTEM","FullControl","Allow")
$acl.AddAccessRule($adminRule)
$acl.AddAccessRule($systemRule)
Set-Acl -Path $configPath -AclObject $acl -ErrorAction SilentlyContinue

Write-Log "[+] Configuracao salva em: $configPath (permissoes restringidas)"

# ── 5. Criar Scheduled Task ─────────────────────────────────────────────────────
Write-Log "Configurando tarefa agendada..."

# Remover tarefa antiga se existir
$existingTask = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
    Write-Log "[*] Tarefa antiga removida."
}

# Comando que a tarefa vai executar:
# Le a config.json e chama o agent.ps1 com as credenciais
$taskCommand = "powershell.exe"
$taskArgs    = "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"" +
               "try { " +
               "`$c = Get-Content '$configPath' -Raw | ConvertFrom-Json; " +
               "& '$scriptDst' -ServerUrl `$c.serverUrl -ApiKey `$c.apiKey " +
               "} catch { Add-Content '$InstallDir\agent.log' `"`$_`" }`""

$action    = New-ScheduledTaskAction -Execute $taskCommand -Argument $taskArgs
$trigger   = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Hours 1) -Once -At (Get-Date)
$settings  = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -RunOnlyIfNetworkAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName   $TASK_NAME `
    -Action     $action `
    -Trigger    $trigger `
    -Settings   $settings `
    -Principal  $principal `
    -Description "Agente de Inventario Enterprise - Coleta a cada hora e envia ao servidor $ServerUrl" `
    -Force | Out-Null

Write-Log "[+] Tarefa agendada criada: '$TASK_NAME' (execucao a cada 1 hora, conta SYSTEM)"

# ── 6. Primeira coleta imediata ─────────────────────────────────────────────────
Write-Log "Executando primeira coleta..."
try {
    & $scriptDst -ServerUrl $ServerUrl -ApiKey $apiKey
    Write-Log "[+] Primeira coleta concluida com sucesso!"
} catch {
    Write-Log "[*] Primeira coleta falhou (o agendamento tentara novamente em 1 hora): $_" "WARN"
}

# ── 7. Resumo da instalacao ─────────────────────────────────────────────────────
Write-Log ""
Write-Log "=== Instalacao Concluida ==="
Write-Log "   Agente  : $scriptDst"
Write-Log "   Config  : $configPath"
Write-Log "   Tarefa  : $TASK_NAME (cada 60 min)"
Write-Log "   Log     : $InstallDir\$LOG_FILE"
Write-Log "   Servidor: $ServerUrl"
Write-Log ""
Write-Log "[OK] Este computador ja aparece no painel de inventario."
