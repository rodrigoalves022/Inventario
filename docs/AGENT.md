# Inventario Agent (`v1.1.0`)

Documentação técnica do agente de inventário. A versão para operadores está na Central de Documentação do painel (`/docs`).

## 1. Visão geral e arquitetura

O `inventario-agent` é um binário Go único (Windows x64 e Linux amd64) que roda como serviço e se comunica com o servidor por HTTPS.

Hierarquia de escopo: `Organization -> Client -> AgentAuth -> Device`. Cada chave de agente (`AgentAuth`) pertence a um cliente e só grava dispositivos dele.

Ciclos operacionais, independentes entre si:

| Ciclo | Intervalo | Descrição |
| --- | --- | --- |
| Inventário | 1 hora | Hardware, software, SO e rede completos (check-in) |
| Métricas | 10 minutos | CPU, RAM, disco e uptime |
| Comandos remotos | 90 segundos | Polling da fila; TTL de 15 minutos por comando |
| Descoberta de rede | 6 horas | ARP, SNMP e TCP; opt-in |

Código-fonte em `agent-go/` (`cmd/inventario-agent`, `internal/{app,collectors,config,domain,platform,security,transport,version}`).

## 2. Caminhos canônicos

| Sistema | Item | Caminho |
| --- | --- | --- |
| Windows | Binário | `C:\Program Files\InventarioAgent\inventario-agent.exe` |
| Windows | Dados e logs | `C:\ProgramData\InventarioAgent\` |
| Windows | Staging de update | `C:\ProgramData\InventarioAgent\updates` |
| Linux | Binário | `/usr/local/bin/inventario-agent` |
| Linux | Dados | `/opt/inventario-agent/` |
| Linux | Staging de update | `/var/lib/inventario-agent/updates` |
| Linux | Unit systemd | `/etc/systemd/system/inventario-agent.service` |

## 3. Métodos de instalação

1. **Duplo-clique (`autoinstall`)** — o `.exe` baixado em *Ver credenciais -> Baixar instalador .exe* traz a configuração embutida no trailer `<<INV_CONFIG>>`. Pede elevação UAC, copia uma versão limpa (sem o trailer) para `Program Files`, registra o serviço com Auto-Recovery no SCM e o lista em *Aplicativos Instalados*.
2. **Bootstrap com SHA-256** — o script confere o hash do binário antes de instalar.
   - Windows: `powershell -ExecutionPolicy Bypass -NoProfile -Command "irm '<SERVIDOR>/api/agent/bootstrap?client=<CLIENTE>&key=<CHAVE>' | iex"`
   - Linux: `curl -fsSL '<SERVIDOR>/api/agent/bootstrap-linux?client=<CLIENTE>&key=<CHAVE>' | sudo bash`
3. **CLI (`install`)** — para GPO, Intune e RMM:
   `inventario-agent.exe install -server "<SERVIDOR>" -client "<CLIENTE>" -key "<CHAVE>" -name "%COMPUTERNAME%"`
   (Linux: `sudo ./inventario-agent install ... -name "$(hostname)"`). Flags: `-server` (obrigatório), `-client`, `-key`, `-name` (padrão: hostname) e `-secret` (modo admin legado).

## 4. Console PowerUser e subcomandos

`manage` (alias `poweruser`), ou duplo-clique no executável instalado, abre o menu interativo:

| Opção | Operação |
| --- | --- |
| 1 | Status e logs |
| 2 | Forçar check-in |
| 3 | Parar serviço |
| 4 | Iniciar/Reiniciar serviço |
| 5 | Excluir/Desvincular servidor |
| 6 | Vincular novo servidor manualmente |
| 7 | Desinstalar e excluir aplicação completa (Purge) |

Subcomandos (executar em terminal elevado):

| Comando | Efeito |
| --- | --- |
| `manage` | Console interativo |
| `status` | Estado do serviço, servidor vinculado, AnyDesk ID e últimas 10 linhas do log |
| `checkin` | Coleta completa e envio imediato |
| `collect` | Imprime o JSON coletado, sem enviar |
| `stop` | Para o serviço `InventarioAgent` |
| `start` / `restart` | Inicia ou reinicia o serviço |
| `unlink` | Para o serviço e apaga credenciais/servidor vinculado (`config.json` / DPAPI); mantém o binário |
| `purge -yes` | Remove serviço, `C:\ProgramData\InventarioAgent` e a entrada do Painel de Controle; auto-exclui `C:\Program Files\InventarioAgent` |

Também existem `install`, `uninstall`, `run`, `debug`, `metrics`, `discovery` e `version`.

## 5. Auto-update e `update_agent`

- **Automático no check-in:** o servidor compara o `agentVersion` reportado com `LATEST_AGENT_VERSION` (`lib/agent-binary.ts`). Se defasado, o agente baixa o binário para o diretório `updates`, valida estritamente o SHA-256, guarda um backup `.bak` e, se o novo serviço não iniciar, faz rollback automático.
- **Multiplataforma:** no Windows o atualizador roda via PowerShell em `C:\ProgramData\InventarioAgent\updates`; no Linux roda via `/bin/sh` + `systemctl` em `/var/lib/inventario-agent/updates` (para a unidade `inventario-agent`, troca o binário, reinicia e restaura o `.bak` se o start falhar). Ambos validam SHA-256.
- **Sob demanda:** o comando remoto `update_agent` dispara o mesmo fluxo, em até 90 s, por 4 caminhos:
  1. Cabeçalho da máquina (`/app/[clientSlug]/assets/[id]`): botão **Atualizar agente**, exibido quando a versão diverge de `LATEST_AGENT_VERSION`.
  2. `/admin/clients/[id]/agents`: por linha ou em massa pelo botão **Atualizar todos os agentes**.
  3. Aba *Comandos* da máquina: **Atualizar agente agora**.
  4. `BulkCommandBar`: seleção múltipla em Computadores, Servidores ou Todos os dispositivos.

### Catálogo fechado de comandos remotos

O servidor valida com `agentCommandInputSchema` (`lib/agent-commands.ts`) e o agente revalida com `allowedServices`/`allowedScripts` (`internal/app/commands/service.go`). Nenhum texto de script trafega pela rede: o agente só conhece estes ids. Expandir sempre os dois lados juntos (paridade em `tests/agent-command-allowlist-parity.test.ts`; os scripts de segurança também em `tests/agent-commands-schema.test.ts` e `executor_test.go`).

| Tipo | Parâmetro | Efeito |
| --- | --- | --- |
| `collect_now` | — | Ciclo completo de inventário |
| `collect_metrics_now` | — | Coleta imediata de métricas |
| `update_agent` | — | Auto-update sob demanda (seção acima) |
| `restart_service` | `serviceName` | `Spooler`, `wuauserv`, `BITS` ou `Dnscache` (só Windows) |
| `run_script` | `scriptId` | Um dos 9 scripts abaixo |
| `restart_computer` | — | Reinicia a máquina |
| `uninstall_agent` | — | Desinstala e revoga o `AgentAuth` ao receber `done` |

Scripts de `run_script` (saída limitada a 20 000 caracteres, exibida como texto na aba *Comandos*):

| `scriptId` | Windows | Linux |
| --- | --- | --- |
| `flush_dns` | `ipconfig /flushdns` | não suportado |
| `clear_temp_files` | Limpa o `%TEMP%` do serviço (LocalSystem) | não suportado |
| `restart_explorer` | `taskkill /IM explorer.exe /F` e relança | não suportado |
| `flush_print_spooler` | Para o Spooler, limpa a fila e reinicia | não suportado |
| `gpupdate_force` | `gpupdate /force` | não suportado |
| `network_diag` | `ipconfig /all`, `route print -4`, portas `LISTENING` | `ip addr`, `ip route` |
| `system_health_summary` | Top 15 processos por RAM/CPU | `uptime`, `free -m`, top processos |
| `defender_quick_scan` | `Update-MpSignature`, `Start-MpScan -ScanType QuickScan` e `Get-MpComputerStatus` (antivírus, tempo real, versão das assinaturas, fim da varredura) | Informa se há ClamAV (`clamscan --version`) |
| `windows_update_check` | COM `Microsoft.Update.Session`, busca `IsInstalled=0`: total pendente e até 15 títulos com `MsrcSeverity` | `apt list --upgradable` ou `dnf check-update` (até 25 linhas) |

## 6. AnyDesk ID e usuário interativo

- **AnyDesk:** leitura passiva de `ad.anynet.id` em `system.conf` e `service.conf` — Windows: `ProgramData\AnyDesk` e `Users\*\AppData\Roaming\AnyDesk`; Linux: `/etc/anydesk` e `/home/*/.anydesk`. O valor é aceito só se casar com `/^\d{9,10}$/` e é preservado entre check-ins. O painel permite buscar pelo ID na paleta `Ctrl+K` (busca global), nas tabelas de Computadores, Servidores e Ativos, e conectar via `anydesk:<id>`. A coluna `AnyDesk ID` também é exportada nos relatórios CSV.
- **Usuário interativo:** como o serviço roda como SYSTEM, o usuário logado é resolvido pela sessão, não pelo dono do processo (`resolveInteractiveUser`, `internal/collectors/windows/collector.go`), nesta ordem:
  1. `Win32_ComputerSystem.UserName` (sessão de console), sem o prefixo de domínio; contas de sistema são descartadas.
  2. Variável `USERNAME`, se não for conta de sistema.
  3. **Fallback RDP:** sessões RDP/Terminal Services não preenchem o WMI, então o agente executa `query user` e `parseQueryUserOutput` ignora o cabeçalho e o marcador `>`, descarta contas de sistema e prefere a sessão `Ativo`/`Active` (senão, a primeira sessão humana). A saída é parseada mesmo quando `query user` retorna código 1.
  4. Sem ninguém logado, envia vazio e o servidor preserva o último usuário conhecido.

## 6.1 Softwares no padrão do Painel de Controle (`appwiz.cpl`)

O coletor Windows (`internal/collectors/windows/registry.go`) lê as chaves `Uninstall` de `HKLM\SOFTWARE\...` e `HKLM\SOFTWARE\WOW6432Node\...`, além das mesmas chaves em cada perfil `HKU\S-1-5-21-*` (apps por usuário, como VS Code), e só reporta o que aparece em *Programas e Recursos* (`shouldIncludeRegistrySoftware`): exige `DisplayName` e `UninstallString`/`QuietUninstallString`, e descarta `SystemComponent=1`, `NoDisplay=1`, itens com `ParentKeyName`/`ParentDisplayName`, `ReleaseType` de update/hotfix/service pack e subcomponentes internos (`vs_`, `vcpp_crt.`, SDKs, `Definition Update for`).

No servidor, `lib/software-catalog.ts` (`isControlPanelSoftware`, `deduplicateDeviceSoftware`) aplica o mesmo critério aos dados de agentes antigos — inclusive runtimes .NET/VC++ e `KB` — e deduplica por nome mantendo a maior versão. As telas `/software` (tenant e Portal), o CSV `/software/csv` e o dossiê da máquina usam esse filtro.

## 7. Compilar e publicar binários

```bash
node scripts/build-agent.mjs all       # windows + linux
node scripts/build-agent.mjs windows   # -> public/inventario-agent.exe
node scripts/build-agent.mjs linux     # -> public/inventario-agent-linux
```

Requer Go instalado. A versão embutida vem de `VERSION` em `scripts/build-agent.mjs` (injetada em `internal/version.Version`); mantenha-a igual a `LATEST_AGENT_VERSION`, senão o auto-update não converge.

## 8. Segurança

DPAPI (`CryptProtectData`) para credenciais locais no Windows; chaves de agente guardadas como hash SHA-256; webhooks assinados com `X-Inventario-Signature-256` (HMAC-SHA256) e protegidos contra SSRF.
