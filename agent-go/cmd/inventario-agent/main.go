package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"
	"time"

	"inventario-agent/internal/app/checkin"
	appinstall "inventario-agent/internal/app/install"
	"inventario-agent/internal/config"
	"inventario-agent/internal/platform/windows/service"
	"golang.org/x/sys/windows"
)

type AutoConfig struct {
	ServerURL string `json:"serverUrl"`
	Client    string `json:"client"`
	Key       string `json:"key"`
}

func extractAutoConfig() (*AutoConfig, error) {
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}

	fileInfo, err := os.Stat(exePath)
	if err != nil {
		return nil, err
	}

	readSize := int64(8192)
	if fileInfo.Size() < readSize {
		readSize = fileInfo.Size()
	}

	f, err := os.Open(exePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	buf := make([]byte, readSize)
	_, err = f.ReadAt(buf, fileInfo.Size()-readSize)
	if err != nil {
		return nil, err
	}

	contentStr := string(buf)
	marker := "<<INV_CONFIG>>"

	firstMarker := strings.Index(contentStr, marker)
	lastMarker := strings.LastIndex(contentStr, marker)

	if firstMarker != -1 && lastMarker != -1 && firstMarker != lastMarker {
		jsonStr := contentStr[firstMarker+len(marker) : lastMarker]
		var ac AutoConfig
		if err := json.Unmarshal([]byte(jsonStr), &ac); err == nil {
			return &ac, nil
		}
	}
	return nil, nil
}

func isElevated() bool {
	var sid *windows.SID
	err := windows.AllocateAndInitializeSid(&windows.SECURITY_NT_AUTHORITY, 2, windows.SECURITY_BUILTIN_DOMAIN_RID, windows.DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &sid)
	if err != nil {
		return false
	}
	token := windows.Token(0)
	member, err := token.IsMember(sid)
	if err != nil {
		return false
	}
	return member
}

func elevateAndExit() {
	exe, _ := os.Executable()
	cwd, _ := os.Getwd()
	verb, _ := syscall.UTF16PtrFromString("runas")
	argv, _ := syscall.UTF16PtrFromString("autoinstall")
	dir, _ := syscall.UTF16PtrFromString(cwd)
	exePath, _ := syscall.UTF16PtrFromString(exe)

	err := windows.ShellExecute(0, verb, exePath, argv, dir, 1)
	if err != nil {
		fmt.Printf("[!] Falha ao solicitar elevacao: %v (Execute como Administrador manualmente)\n", err)
		time.Sleep(10 * time.Second)
		os.Exit(1)
	}
	os.Exit(0)
}

func runAutoInstall(ac *AutoConfig) {
	hostname, _ := os.Hostname()
	fmt.Printf("[...] Instalacao silenciosa Inteligente detectada (Cliente: %s)...\n", ac.Client)

	cfg, err := appinstall.Run(appinstall.Options{
		ServerURL:     ac.ServerURL,
		Client:        ac.Client,
		EnrollmentKey: ac.Key,
		AgentName:     hostname,
	}, time.Now())

	if err != nil {
		log.Printf("[!] Instalacao logica falhou: %v\n", err)
		time.Sleep(10 * time.Second)
		os.Exit(1)
	}

	fmt.Printf("[+] Configuracao gerada com sucesso!\n")

	service.Uninstall() // force clean state
	if err := service.Install(); err != nil {
		log.Printf("[!] Falha ao registrar servico: %v\n", err)
		time.Sleep(10 * time.Second)
		os.Exit(1)
	}

	if err := service.Start(); err != nil {
		fmt.Printf("[!] O Servico falhou em inicializar. Religue pelo services.msc!\n")
	} else {
		fmt.Printf("[+] Inventario instalado e operante sob nome %s\n", cfg.AgentName)
	}

	fmt.Println("\n[+] Fechando janela automaticamente...")
	time.Sleep(5 * time.Second)
	os.Exit(0)
}

var version = "1.0.0"

func main() {
	if len(os.Args) < 2 {
		ac, _ := extractAutoConfig()
		if ac != nil {
			if !isElevated() {
				elevateAndExit()
			}
			runAutoInstall(ac)
			return
		}

		printUsage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "autoinstall":
		ac, _ := extractAutoConfig()
		if ac != nil {
			runAutoInstall(ac)
		} else {
			fmt.Println("[!] Falha: Este arquivo perdeu sua assinatura digital de auto-instalacao.")
			time.Sleep(10 * time.Second)
			os.Exit(1)
		}
	case "install":
		handleInstall()
	case "uninstall":
		if err := service.Uninstall(); err != nil {
			log.Fatalf("[!] %v\n", err)
		}
	case "start":
		if err := service.Start(); err != nil {
			log.Fatalf("[!] %v\n", err)
		}
		fmt.Println("[+] Servico iniciado.")
	case "stop":
		if err := service.Stop(); err != nil {
			log.Fatalf("[!] %v\n", err)
		}
		fmt.Println("[+] Servico parado.")
	case "run":
		if err := service.RunService(false); err != nil {
			log.Fatalf("[!] Erro no servico: %v\n", err)
		}
	case "debug":
		log.Println("[DEBUG] Rodando em modo debug (pressione Ctrl+C para parar)...")
		if err := service.RunService(true); err != nil {
			log.Fatalf("[!] Erro: %v\n", err)
		}
	case "collect":
		handleCollect()
	case "checkin":
		handleCheckin()
	case "version", "--version", "-v":
		fmt.Printf("inventario-agent v%s\n", version)
	default:
		fmt.Fprintf(os.Stderr, "[!] Comando desconhecido: %s\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func handleInstall() {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	serverURL := fs.String("server", "", "URL do servidor de inventario (obrigatorio)")
	adminSecret := fs.String("secret", "", "ADMIN_SECRET do servidor (modo admin legado)")
	clientName := fs.String("client", "", "Cliente/tenant ao qual o agente sera vinculado")
	enrollmentKey := fs.String("key", "", "Chave de provisionamento do cliente")
	agentName := fs.String("name", "", "Nome do agente (padrao: hostname da maquina)")
	fs.Parse(os.Args[2:])

	if *serverURL == "" {
		fmt.Fprintln(os.Stderr, "[!] -server e obrigatorio")
		fs.Usage()
		os.Exit(1)
	}

	if *adminSecret == "" && (*clientName == "" || *enrollmentKey == "") {
		fmt.Fprintln(os.Stderr, "[!] informe -secret ou o par -client e -key")
		fs.Usage()
		os.Exit(1)
	}

	if *agentName == "" {
		hostname, _ := os.Hostname()
		*agentName = hostname
	}

	fmt.Printf("[...] Registrando agente '%s' em %s...\n", *agentName, *serverURL)

	cfg, err := appinstall.Run(appinstall.Options{
		ServerURL:     *serverURL,
		AdminSecret:   *adminSecret,
		Client:        *clientName,
		EnrollmentKey: *enrollmentKey,
		AgentName:     *agentName,
	}, time.Now())
	if err != nil {
		log.Fatalf("[!] Instalacao logica falhou: %v\n", err)
	}

	fmt.Printf("[+] Config salva em: %s\n", config.DefaultPath())

	if err := service.Install(); err != nil {
		log.Fatalf("[!] Instalacao do servico falhou: %v\n", err)
	}

	if err := service.Start(); err != nil {
		fmt.Printf("[*] Servico instalado mas nao iniciado. Execute: sc start %s\n", service.ServiceName)
	} else {
		fmt.Printf("[+] Servico '%s' iniciado. Hostname: %s\n", service.ServiceName, cfg.AgentName)
	}
}

func handleCollect() {
	payload, err := checkin.CollectOnce()
	if err != nil {
		log.Fatalf("[!] Coleta falhou: %v\n", err)
	}

	encoded, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		log.Fatalf("[!] Falha ao serializar payload: %v\n", err)
	}

	fmt.Println(string(encoded))
}

func handleCheckin() {
	fs := flag.NewFlagSet("checkin", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath(), "Caminho do arquivo de configuracao")
	fs.Parse(os.Args[2:])

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("[!] Falha ao carregar config: %v\n", err)
	}

	payload, err := checkin.SendOnce(cfg)
	if err != nil {
		log.Fatalf("[!] Checkin falhou: %v\n", err)
	}

	fmt.Printf("[+] Checkin enviado com sucesso. Hostname: %s\n", payload.Hostname)
}

func printUsage() {
	fmt.Printf(`inventario-agent v%s - Agente de Inventario Enterprise

Uso:
  inventario-agent.exe install -server URL [-secret CHAVE_ADMIN] [-client CLIENTE -key CHAVE_CLIENTE] [-name NOME]
  inventario-agent.exe uninstall
  inventario-agent.exe start
  inventario-agent.exe stop
  inventario-agent.exe debug
  inventario-agent.exe collect
  inventario-agent.exe checkin [-config CAMINHO]
  inventario-agent.exe version

Exemplos:
  inventario-agent.exe install -server http://10.62.1.1:3000 -secret minha_chave_admin
  inventario-agent.exe install -server https://inv.empresa.com -client acme-corp -key CHAVE_CLIENTE -name "Recepcao-PC01"
  inventario-agent.exe collect
  inventario-agent.exe checkin
`, version)
}
