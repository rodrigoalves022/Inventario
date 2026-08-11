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
	"strings"
)

func RunAsync(downloadUrl, expectedSHA256 string) {
	log.Printf("[UPDATER] Baixando atualizacao de %s\n", downloadUrl)

	tempExe := filepath.Join(os.TempDir(), "inventario-agent.update.exe")

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

	scriptContent := fmt.Sprintf(`
Start-Sleep -Seconds 3
Stop-Service -Name InventarioAgent -Force -ErrorAction SilentlyContinue
Copy-Item -Path "%s" -Destination "%s" -Force
Start-Service -Name InventarioAgent
Remove-Item -Path "%s" -Force -ErrorAction SilentlyContinue
Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
`, tempExe, currentExe, tempExe)

	scriptPath := filepath.Join(os.TempDir(), "inventario-updater.ps1")
	err = os.WriteFile(scriptPath, []byte(scriptContent), 0755)
	if err != nil {
		log.Printf("[UPDATER] Erro ao criar script droppable de substituicao: %v\n", err)
		return
	}

	log.Printf("[UPDATER] Iniciando script temporal de substituicao e paralisando agente atual...")

	cmd := exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-NoProfile", "-WindowStyle", "Hidden", "-File", scriptPath)
	err = cmd.Start()
	if err != nil {
		log.Printf("[UPDATER] Erro fatal: powershell de auto-update nao spawnou! %v\n", err)
		return
	}

	os.Exit(0)
}
