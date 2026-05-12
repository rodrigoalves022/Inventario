package updater

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
)

func RunAsync(downloadUrl string) {
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
	
	_, err = io.Copy(out, resp.Body)
	out.Close()
	if err != nil {
		log.Printf("[UPDATER] Erro na copia de rede: %v\n", err)
		return
	}

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
