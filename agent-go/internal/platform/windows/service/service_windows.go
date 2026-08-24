//go:build windows

package service

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"inventario-agent/internal/app/checkin"
	"inventario-agent/internal/app/commands"
	"inventario-agent/internal/config"
	"inventario-agent/internal/transport/httpapi"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
	"golang.org/x/sys/windows/svc/eventlog"
	"golang.org/x/sys/windows/svc/mgr"
)

const commandPollInterval = 90 * time.Second
const metricsPollInterval = 10 * time.Minute

const ServiceName = "InventarioAgent"
const ServiceDisplayName = "Inventario Enterprise Agent"
const ServiceDescription = "Coleta dados de hardware e software e envia ao servidor de inventario."

type inventarioService struct{}

func (s *inventarioService) Execute(args []string, requests <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	const acceptedCommands = svc.AcceptStop | svc.AcceptShutdown
	status <- svc.Status{State: svc.StartPending}

	logPath := filepath.Join(os.Getenv("ProgramData"), "InventarioAgent", "agent.log")
	if logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666); err == nil {
		log.SetOutput(logFile)
	}
	log.Println("=== INICIANDO SERVICO INVENTARIO AGENT ===")

	cfg, err := config.Load(config.DefaultPath())
	if err != nil {
		log.Printf("[ERROR] Falha ao carregar config: %v", err)
		return false, 1
	}

	log.Printf("[INFO] Agente iniciado. Servidor: %s", cfg.ServerURL)

	commandClient, err := httpapi.NewClient(cfg.ServerURL, cfg.APIKey)
	if err != nil {
		log.Printf("[ERROR] Falha ao criar cliente de comandos: %v", err)
	}

	collectionTicker := time.NewTicker(1 * time.Hour)
	defer collectionTicker.Stop()

	commandTicker := time.NewTicker(commandPollInterval)
	defer commandTicker.Stop()

	metricsTicker := time.NewTicker(metricsPollInterval)
	defer metricsTicker.Stop()

	// Reporta Running pro SCM ANTES de qualquer coleta/rede: o SCM tem um
	// timeout curto (~30s por padrao) entre StartPending e Running, e a
	// primeira coleta (WMI + HTTP, ate 30s so no timeout do client) sozinha
	// ja podia estourar isso — servidor lento/inacessivel virava "servico
	// nao iniciou" no Windows mesmo com o processo vivo.
	//
	// A coleta continua SINCRONA aqui (nao em goroutine): a colecao WMI
	// (github.com/yusufpapurcu/wmi) e sensivel ao contexto de thread em que
	// roda, e uma goroutine solta sem recover() ja causou um crash-loop
	// silencioso em producao (processo morria sem log, Windows reiniciava o
	// servico do zero a cada tentativa). runCollection agora tem seu proprio
	// recover(), entao um panico na coleta fica contido e logado em vez de
	// derrubar o servico inteiro — mas o caminho de execucao continua o
	// mesmo de sempre (goroutine principal do Execute), por seguranca.
	status <- svc.Status{State: svc.Running, Accepts: acceptedCommands}
	runCollection(cfg)

	for {
		select {
		case <-collectionTicker.C:
			runCollection(cfg)
		case <-commandTicker.C:
			if commandClient != nil {
				pollAndExecuteCommands(commandClient, cfg)
			}
		case <-metricsTicker.C:
			runMetricsCollection(cfg)
		case change := <-requests:
			switch change.Cmd {
			case svc.Stop, svc.Shutdown:
				log.Println("[INFO] Agente recebeu sinal de parada. Encerrando graciosamente.")
				status <- svc.Status{State: svc.StopPending}
				return false, 0
			}
		}
	}
}

// recoverAndLog contem qualquer panico da coleta (WMI e sensivel a driver/
// hardware/permissao — um caso de borda inesperado nao pode derrubar o
// servico inteiro, que e' exatamente o que aconteceu quando a primeira
// coleta rodava sem essa rede de seguranca). Loga com stack trace e devolve
// o controle pro ticker seguinte, em vez de matar o processo.
func recoverAndLog(context string) {
	if r := recover(); r != nil {
		log.Printf("[ERROR] Panico recuperado em %s: %v", context, r)
	}
}

func runCollection(cfg *config.Config) {
	defer recoverAndLog("runCollection")
	log.Println("[INFO] Iniciando coleta de inventario...")

	payload, err := checkin.SendOnce(cfg)
	if err != nil {
		log.Printf("[ERROR] Checkin falhou: %v", err)
		return
	}

	log.Printf("[INFO] Coleta enviada com sucesso. Hostname: %s", payload.Hostname)
}

func runMetricsCollection(cfg *config.Config) {
	defer recoverAndLog("runMetricsCollection")

	payload, err := checkin.SendMetricsOnce(cfg)
	if err != nil {
		log.Printf("[ERROR] Envio de metricas falhou: %v", err)
		return
	}

	log.Printf("[INFO] Metricas enviadas. Hostname: %s", payload.Hostname)
}

func pollAndExecuteCommands(client *httpapi.Client, cfg *config.Config) {
	defer recoverAndLog("pollAndExecuteCommands")
	commands.PollAndExecute(client, cfg)
}

func Install() error {
	exePath, err := os.Executable()
	if err != nil {
		return err
	}

	exePath, err = filepath.Abs(exePath)
	if err != nil {
		return err
	}

	manager, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("Service Control Manager: %w", err)
	}
	defer manager.Disconnect()

	existingService, err := manager.OpenService(ServiceName)
	if err == nil {
		existingService.Close()
		return fmt.Errorf("servico '%s' ja esta instalado. Use 'uninstall' primeiro", ServiceName)
	}

	createdService, err := manager.CreateService(
		ServiceName,
		exePath,
		mgr.Config{
			DisplayName:      ServiceDisplayName,
			Description:      ServiceDescription,
			StartType:        mgr.StartAutomatic,
			ServiceStartName: "LocalSystem",
		},
		"run",
	)
	if err != nil {
		return fmt.Errorf("criacao do servico: %w", err)
	}
	defer createdService.Close()

	if err := eventlog.InstallAsEventCreate(ServiceName, eventlog.Error|eventlog.Warning|eventlog.Info); err != nil {
		log.Printf("[WARN] Event log nao configurado: %v", err)
	}

	log.Printf("[OK] Servico '%s' instalado com sucesso.", ServiceName)
	return nil
}

func Uninstall() error {
	manager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer manager.Disconnect()

	serviceHandle, err := manager.OpenService(ServiceName)
	if err != nil {
		return fmt.Errorf("servico '%s' nao encontrado", ServiceName)
	}
	defer serviceHandle.Close()

	status, err := serviceHandle.Query()
	if err == nil && status.State == svc.Running {
		_, _ = serviceHandle.Control(svc.Stop)
		time.Sleep(2 * time.Second)
	}

	if err := serviceHandle.Delete(); err != nil {
		return fmt.Errorf("remocao: %w", err)
	}

	_ = eventlog.Remove(ServiceName)
	log.Printf("[OK] Servico '%s' removido.", ServiceName)
	return nil
}

func Start() error {
	manager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer manager.Disconnect()

	serviceHandle, err := manager.OpenService(ServiceName)
	if err != nil {
		return fmt.Errorf("servico nao encontrado - use 'install' primeiro")
	}
	defer serviceHandle.Close()

	return serviceHandle.Start()
}

func Stop() error {
	manager, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer manager.Disconnect()

	serviceHandle, err := manager.OpenService(ServiceName)
	if err != nil {
		return fmt.Errorf("servico nao encontrado")
	}
	defer serviceHandle.Close()

	_, err = serviceHandle.Control(svc.Stop)
	return err
}

func RunService(isDebug bool) error {
	if isDebug {
		return debug.Run(ServiceName, &inventarioService{})
	}

	return svc.Run(ServiceName, &inventarioService{})
}
