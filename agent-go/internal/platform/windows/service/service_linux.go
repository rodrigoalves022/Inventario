//go:build linux

// Servico Linux via systemd (Type=simple, processo persistente com os
// mesmos tres ciclos do Windows) — nao o modelo antigo de
// scripts/agent/install-linux-agent.sh, que so faz checkin horario via
// timer+oneshot e nunca teve metricas nem fila de comandos quase em tempo
// real. Um daemon persistente e' o que os ciclos de 90s/10min exigem.
package service

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"inventario-agent/internal/app/checkin"
	"inventario-agent/internal/app/commands"
	"inventario-agent/internal/config"
	"inventario-agent/internal/transport/httpapi"
)

const ServiceName = "inventario-agent"

const unitPath = "/etc/systemd/system/" + ServiceName + ".service"
const commandPollInterval = 90 * time.Second
const metricsPollInterval = 10 * time.Minute

func RunService(isDebug bool) error {
	log.Println("=== INICIANDO AGENTE INVENTARIO (Linux) ===")

	cfg, err := config.Load(config.DefaultPath())
	if err != nil {
		return fmt.Errorf("falha ao carregar config: %w", err)
	}

	log.Printf("[INFO] Agente iniciado. Servidor: %s", cfg.ServerURL)
	runCollection(cfg)

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

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	for {
		select {
		case <-collectionTicker.C:
			runCollection(cfg)
		case <-commandTicker.C:
			if commandClient != nil {
				commands.PollAndExecute(commandClient, cfg)
			}
		case <-metricsTicker.C:
			runMetricsCollection(cfg)
		case sig := <-sigCh:
			log.Printf("[INFO] Recebido sinal %v. Encerrando graciosamente.", sig)
			return nil
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

func runMetricsCollection(cfg *config.Config) {
	payload, err := checkin.SendMetricsOnce(cfg)
	if err != nil {
		log.Printf("[ERROR] Envio de metricas falhou: %v", err)
		return
	}
	log.Printf("[INFO] Metricas enviadas. Hostname: %s", payload.Hostname)
}

const unitTemplate = `[Unit]
Description=Inventario Enterprise Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=%s run
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
`

func CanonicalBinaryPath() string {
	return "/usr/local/bin/inventario-agent"
}

func QueryState() string {
	out, _ := exec.Command("systemctl", "is-active", ServiceName).Output()
	if strings.TrimSpace(string(out)) == "active" {
		return "Em execucao (active)"
	}
	if _, err := os.Stat(unitPath); err == nil {
		return "Parado (inactive)"
	}
	return "Nao instalado"
}

func Install() error {
	_ = Uninstall()

	exePath, err := copyExecutableToCanonicalPath()
	if err != nil {
		return err
	}

	unitContent := fmt.Sprintf(unitTemplate, exePath)
	if err := os.WriteFile(unitPath, []byte(unitContent), 0o644); err != nil {
		return fmt.Errorf("escrever unit systemd (precisa de root): %w", err)
	}

	if err := runSystemctl("daemon-reload"); err != nil {
		return err
	}
	if err := runSystemctl("enable", ServiceName); err != nil {
		return err
	}

	log.Printf("[OK] Servico '%s' instalado com sucesso.", ServiceName)
	return nil
}

func Uninstall() error {
	_ = runSystemctl("stop", ServiceName)
	_ = runSystemctl("disable", ServiceName)

	if err := os.Remove(unitPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remocao: %w", err)
	}
	_ = runSystemctl("daemon-reload")

	log.Printf("[OK] Servico '%s' removido.", ServiceName)
	return nil
}

func Start() error {
	return runSystemctl("start", ServiceName)
}

func Stop() error {
	return runSystemctl("stop", ServiceName)
}

func runSystemctl(args ...string) error {
	cmd := exec.Command("systemctl", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("systemctl %s: %w (%s)", strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return nil
}
