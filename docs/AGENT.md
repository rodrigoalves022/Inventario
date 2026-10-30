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
- **Sob demanda:** o comando remoto `update_agent` ("Atualizar agente agora") dispara o mesmo fluxo. Pode ser enfileirado na aba *Comandos* da máquina ou em lote pelas tabelas de Máquinas e Servidores; executa em até 90 s.

Catálogo fechado de comandos remotos: `collect_now`, `collect_metrics_now`, `update_agent`, `restart_service` (`Spooler`, `wuauserv`, `BITS`, `Dnscache`), `run_script` (`flush_dns`, `clear_temp_files`, `restart_explorer`, `flush_print_spooler`) e `restart_computer`.

## 6. AnyDesk ID e usuário interativo

- **AnyDesk:** leitura passiva de `ad.anynet.id` em `system.conf` e `service.conf` — Windows: `ProgramData\AnyDesk` e `Users\*\AppData\Roaming\AnyDesk`; Linux: `/etc/anydesk` e `/home/*/.anydesk`. O valor é aceito só se casar com `/^\d{9,10}$/` e é preservado entre check-ins. O painel permite buscar pelo ID e conectar via `anydesk:<id>`.
- **Usuário interativo:** como o serviço roda como SYSTEM, o usuário logado é resolvido pela sessão ativa do console, não pelo dono do processo.

## 7. Compilar e publicar binários

```bash
node scripts/build-agent.mjs all       # windows + linux
node scripts/build-agent.mjs windows   # -> public/inventario-agent.exe
node scripts/build-agent.mjs linux     # -> public/inventario-agent-linux
```

Requer Go instalado. A versão embutida vem de `VERSION` em `scripts/build-agent.mjs` (injetada em `internal/version.Version`); mantenha-a igual a `LATEST_AGENT_VERSION`, senão o auto-update não converge.

## 8. Segurança

DPAPI (`CryptProtectData`) para credenciais locais no Windows; chaves de agente guardadas como hash SHA-256; webhooks assinados com `X-Inventario-Signature-256` (HMAC-SHA256) e protegidos contra SSRF.
