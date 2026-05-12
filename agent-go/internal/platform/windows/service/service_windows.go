//go:build windows

package service

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"inventario-agent/internal/app/checkin"
	"inventario-agent/internal/config"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
	"golang.org/x/sys/windows/svc/eventlog"
	"golang.org/x/sys/windows/svc/mgr"
)

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
	runCollection(cfg)

	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	status <- svc.Status{State: svc.Running, Accepts: acceptedCommands}

	for {
		select {
		case <-ticker.C:
			runCollection(cfg)
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

func runCollection(cfg *config.Config) {
	log.Println("[INFO] Iniciando coleta de inventario...")

	payload, err := checkin.SendOnce(cfg)
	if err != nil {
		log.Printf("[ERROR] Checkin falhou: %v", err)
		return
	}

	log.Printf("[INFO] Coleta enviada com sucesso. Hostname: %s", payload.Hostname)
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
