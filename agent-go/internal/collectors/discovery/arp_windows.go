//go:build windows

package discovery

import (
	"os/exec"
	"syscall"
)

// readARPTable le a tabela ARP do SO via `arp -a`.
//
// Roda DEPOIS da varredura de portas de proposito: os proprios probes TCP
// forcam a resolucao ARP de cada IP que respondeu, entao o cache ja esta
// populado quando chegamos aqui. Nao ha envio de pacote ARP proprio — so
// leitura do que o SO ja sabe.
//
// HideWindow: o agente roda como servico; sem isso um console pisca na sessao
// interativa a cada varredura.
func readARPTable() (map[string]string, error) {
	cmd := exec.Command("arp", "-a")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	return ParseARPOutput(string(output)), nil
}
