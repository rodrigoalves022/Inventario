package main

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"inventario-agent/internal/app/checkin"
	appinstall "inventario-agent/internal/app/install"
	"inventario-agent/internal/collectors/anydesk"
	"inventario-agent/internal/config"
	"inventario-agent/internal/platform/windows/service"
)

func dataDir() string {
	return filepath.Dir(config.DefaultPath())
}

func logFilePath() string {
	return filepath.Join(dataDir(), "agent.log")
}

func tailLines(path string, n int) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimRight(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n"), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return lines
}

func printStatusReport() {
	fmt.Printf("inventario-agent v%s\n", version)
	fmt.Printf("  Servico:            %s\n", service.QueryState())
	fmt.Printf("  Binario canonico:   %s\n", service.CanonicalBinaryPath())
	fmt.Printf("  Config:             %s\n", config.DefaultPath())

	if cfg, err := config.Load(config.DefaultPath()); err == nil {
		fmt.Printf("  Servidor vinculado: %s\n", cfg.ServerURL)
		fmt.Printf("  Nome do agente:     %s\n", cfg.AgentName)
	} else {
		fmt.Println("  Servidor vinculado: Desvinculado (nenhum servidor configurado)")
	}

	anydeskID := anydesk.CollectID()
	if anydeskID == "" {
		anydeskID = "Nao detectado"
	}
	fmt.Printf("  AnyDesk ID:         %s\n", anydeskID)

	fmt.Printf("\nUltimas linhas do log (%s):\n", logFilePath())
	lines := tailLines(logFilePath(), 10)
	if len(lines) == 0 {
		fmt.Println("  (sem log)")
	}
	for _, line := range lines {
		fmt.Println("  " + line)
	}
}

func requireElevation() {
	if !isElevated() {
		elevateAndExit()
	}
}

func handleStop() {
	requireElevation()
	if err := service.Stop(); err != nil {
		fmt.Printf("[!] %v\n", err)
		return
	}
	fmt.Println("[+] Servico parado.")
}

func handleStart(restart bool) {
	requireElevation()
	if restart {
		_ = service.Stop()
		time.Sleep(2 * time.Second)
	}
	if err := service.Start(); err != nil {
		fmt.Printf("[!] %v\n", err)
		return
	}
	fmt.Println("[+] Servico iniciado.")
}

func handleUnlink() {
	requireElevation()
	runUnlink()
}

func runUnlink() {
	_ = service.Stop()
	if err := os.Remove(config.DefaultPath()); err != nil && !os.IsNotExist(err) {
		fmt.Printf("[!] Falha ao remover credenciais: %v\n", err)
		return
	}
	fmt.Println("[+] Servidor desvinculado com sucesso. O servico foi parado e as credenciais locais foram removidas.")
}

func confirm(reader *bufio.Reader, prompt string) bool {
	fmt.Print(prompt)
	answer, _ := reader.ReadString('\n')
	answer = strings.ToLower(strings.TrimSpace(answer))
	return answer == "s" || answer == "sim" || answer == "y" || answer == "yes"
}

func handlePurge(args []string) {
	assumeYes := false
	for _, a := range args {
		if a == "-yes" || a == "--yes" {
			assumeYes = true
		}
	}

	requireElevation()

	if !assumeYes && !confirm(bufio.NewReader(os.Stdin), "Tem certeza que deseja parar o servico e EXCLUIR completamente o agente e suas configuracoes? [s/N]: ") {
		fmt.Println("[i] Operacao cancelada.")
		return
	}
	runPurge()
}

func runPurge() {
	_ = service.Uninstall()

	if err := os.RemoveAll(dataDir()); err != nil {
		fmt.Printf("[!] Falha ao remover %s: %v\n", dataDir(), err)
	}

	binary := service.CanonicalBinaryPath()
	installDir := filepath.Dir(binary)
	exe, _ := os.Executable()
	runningFromInstallDir := runtime.GOOS == "windows" &&
		strings.EqualFold(filepath.Clean(filepath.Dir(exe)), filepath.Clean(installDir))

	if runningFromInstallDir {
		// O .exe em execucao fica travado; um cmd destacado apaga a pasta
		// ~2s depois que este processo encerrar.
		_ = exec.Command("cmd.exe", "/C", fmt.Sprintf("ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"%s\"", installDir)).Start()
	} else {
		if err := os.Remove(binary); err != nil && !os.IsNotExist(err) {
			fmt.Printf("[!] Falha ao remover %s: %v\n", binary, err)
		}
		if runtime.GOOS == "windows" {
			_ = os.Remove(installDir)
		}
	}

	fmt.Println("[+] Agente, servico e dados locais removidos completamente.")
}

func runPowerUserMenu() {
	reader := bufio.NewReader(os.Stdin)
	prompt := func(label string) string {
		fmt.Print(label)
		text, _ := reader.ReadString('\n')
		return strings.TrimSpace(text)
	}

	for {
		fmt.Printf("\n=== Inventario Agent v%s - Console PowerUser ===\n", version)
		fmt.Printf("Servico: %s\n\n", service.QueryState())
		fmt.Println("  [1] Status detalhado e ultimos logs")
		fmt.Println("  [2] Forcar coleta e check-in agora")
		fmt.Println("  [3] Parar servico do agente")
		fmt.Println("  [4] Iniciar / Reiniciar servico do agente")
		fmt.Println("  [5] Excluir servidor vinculado (desvincular maquina)")
		fmt.Println("  [6] Vincular novo servidor manualmente")
		fmt.Println("  [7] Desinstalar e excluir aplicacao completa (Purge)")
		fmt.Println("  [0] Sair")

		switch prompt("\nEscolha: ") {
		case "1":
			printStatusReport()
		case "2":
			cfg, err := config.Load(config.DefaultPath())
			if err != nil {
				fmt.Printf("[!] Agente desvinculado: %v\n", err)
				break
			}
			payload, err := checkin.SendOnce(cfg)
			if err != nil {
				fmt.Printf("[!] Checkin falhou: %v\n", err)
				break
			}
			fmt.Printf("[+] Checkin enviado com sucesso. Hostname: %s\n", payload.Hostname)
		case "3":
			handleStop()
		case "4":
			handleStart(true)
		case "5":
			if confirm(reader, "Desvincular este servidor e parar o servico? [s/N]: ") {
				runUnlink()
			}
		case "6":
			serverURL := prompt("URL do servidor (ex.: https://inv.empresa.com): ")
			client := prompt("Slug do cliente: ")
			key := prompt("Chave de provisionamento: ")
			if serverURL == "" || client == "" || key == "" {
				fmt.Println("[!] Todos os campos sao obrigatorios.")
				break
			}
			hostname, _ := os.Hostname()
			cfg, err := appinstall.Run(appinstall.Options{
				ServerURL:     serverURL,
				Client:        client,
				EnrollmentKey: key,
				AgentName:     hostname,
			}, time.Now())
			if err != nil {
				fmt.Printf("[!] Registro falhou: %v\n", err)
				break
			}
			if err := service.Install(); err != nil {
				fmt.Printf("[!] Falha ao registrar servico: %v\n", err)
				break
			}
			if err := service.Start(); err != nil {
				fmt.Printf("[!] Servico instalado mas nao iniciou: %v\n", err)
				break
			}
			fmt.Printf("[+] Servidor vinculado e servico iniciado sob nome %s\n", cfg.AgentName)
		case "7":
			if confirm(reader, "Tem certeza que deseja parar o servico e EXCLUIR completamente o agente e suas configuracoes? [s/N]: ") {
				runPurge()
				return
			}
		case "0":
			return
		default:
			fmt.Println("[!] Opcao invalida.")
		}
	}
}
