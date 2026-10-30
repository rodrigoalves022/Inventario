package updater

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func escapePowerShellSingleQuoted(s string) string { return strings.ReplaceAll(s, "'", "''") }

// buildUpdateScript gera o script PowerShell de troca do binario, com backup
// e rollback automatico caso o novo servico nao suba.
func buildUpdateScript(tempExe, currentExe string) string {
	return fmt.Sprintf(`
Start-Sleep -Seconds 3
$temp = '%s'
$target = '%s'
$bak = $target + '.bak'
Stop-Service -Name 'InventarioAgent' -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
if (Test-Path $target) { Copy-Item -Path $target -Destination $bak -Force -ErrorAction SilentlyContinue }
Copy-Item -Path $temp -Destination $target -Force
try {
  Start-Service -Name 'InventarioAgent' -ErrorAction Stop
  Remove-Item -Path $bak -Force -ErrorAction SilentlyContinue
} catch {
  if (Test-Path $bak) {
    Copy-Item -Path $bak -Destination $target -Force -ErrorAction SilentlyContinue
    Start-Service -Name 'InventarioAgent' -ErrorAction SilentlyContinue
  }
}
Remove-Item -Path $temp -Force -ErrorAction SilentlyContinue
Remove-Item -Path $PSCommandPath -Force -ErrorAction SilentlyContinue
`, escapePowerShellSingleQuoted(tempExe), escapePowerShellSingleQuoted(currentExe))
}

func escapePosixSingleQuoted(s string) string { return strings.ReplaceAll(s, "'", "'\\''") }

// buildLinuxUpdateScript gera o script /bin/sh de troca do binario no Linux,
// com backup e rollback automatico caso a unidade systemd nao suba.
func buildLinuxUpdateScript(tempBin, currentBin string) string {
	return fmt.Sprintf(`#!/bin/sh
sleep 2
TEMP='%s'
TARGET='%s'
BAK="${TARGET}.bak"
systemctl stop inventario-agent 2>/dev/null || true
sleep 1
if [ -f "$TARGET" ]; then cp -f "$TARGET" "$BAK" 2>/dev/null || true; fi
cp -f "$TEMP" "$TARGET" && chmod 0755 "$TARGET"
if systemctl start inventario-agent 2>/dev/null; then
  rm -f "$BAK" 2>/dev/null || true
else
  if [ -f "$BAK" ]; then
    cp -f "$BAK" "$TARGET" && chmod 0755 "$TARGET"
    systemctl start inventario-agent 2>/dev/null || true
  fi
fi
rm -f "$TEMP" "$0" 2>/dev/null || true
`, escapePosixSingleQuoted(tempBin), escapePosixSingleQuoted(currentBin))
}

func RunAsync(downloadUrl, expectedSHA256 string) {
	log.Printf("[UPDATER] Baixando atualizacao de %s\n", downloadUrl)

	isLinux := runtime.GOOS == "linux"
	var updateDir, tempExe, scriptPath string
	if isLinux {
		updateDir = "/var/lib/inventario-agent/updates"
		if err := os.MkdirAll(updateDir, 0o755); err != nil {
			updateDir = os.TempDir()
		}
		tempExe = filepath.Join(updateDir, "inventario-agent.update")
		scriptPath = filepath.Join(updateDir, "inventario-updater.sh")
	} else {
		updateDir = filepath.Join(os.Getenv("ProgramData"), "InventarioAgent", "updates")
		if os.Getenv("ProgramData") == "" {
			updateDir = os.TempDir()
		}
		_ = os.MkdirAll(updateDir, 0o755)
		tempExe = filepath.Join(updateDir, "inventario-agent.update.exe")
		scriptPath = filepath.Join(updateDir, "inventario-updater.ps1")
	}

	resp, err := http.Get(downloadUrl)
	if err != nil {
		log.Printf("[UPDATER] Falha ao baixar nova versao: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[UPDATER] Erro %d baixando binario\n", resp.StatusCode)
		return
	}

	out, err := os.Create(tempExe)
	if err != nil {
		log.Printf("[UPDATER] Falha ao criar arquivo temp: %v\n", err)
		return
	}

	hasher := sha256.New()
	_, err = io.Copy(io.MultiWriter(out, hasher), resp.Body)
	out.Close()
	if err != nil {
		log.Printf("[UPDATER] Erro na copia de rede: %v\n", err)
		_ = os.Remove(tempExe)
		return
	}

	actualSHA256 := hex.EncodeToString(hasher.Sum(nil))
	if !strings.EqualFold(actualSHA256, expectedSHA256) {
		log.Printf("[UPDATER] ABORTADO: hash SHA-256 do binario baixado nao confere (esperado=%s obtido=%s). Possivel binario corrompido ou adulterado.\n", expectedSHA256, actualSHA256)
		_ = os.Remove(tempExe)
		return
	}
	log.Printf("[UPDATER] Integridade do binario confirmada (sha256=%s).\n", actualSHA256)

	currentExe, err := os.Executable()
	if err != nil {
		log.Printf("[UPDATER] Nao foi possivel detectar meu proprio exe atual: %v\n", err)
		return
	}

	scriptContent := buildUpdateScript(tempExe, currentExe)
	if isLinux {
		scriptContent = buildLinuxUpdateScript(tempExe, currentExe)
	}

	err = os.WriteFile(scriptPath, []byte(scriptContent), 0755)
	if err != nil {
		log.Printf("[UPDATER] Erro ao criar script droppable de substituicao: %v\n", err)
		return
	}

	log.Printf("[UPDATER] Iniciando script temporal de substituicao e paralisando agente atual...")

	var cmd *exec.Cmd
	if isLinux {
		cmd = exec.Command("/bin/sh", scriptPath)
	} else {
		cmd = exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-NoProfile", "-WindowStyle", "Hidden", "-File", scriptPath)
	}
	err = cmd.Start()
	if err != nil {
		log.Printf("[UPDATER] Erro fatal: powershell de auto-update nao spawnou! %v\n", err)
		return
	}

	os.Exit(0)
}
