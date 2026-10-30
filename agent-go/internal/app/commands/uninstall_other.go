//go:build !windows

package commands

import (
	"os/exec"
	"syscall"
)

// detachProcess abre uma nova sessao para o filho sobreviver ao `systemctl
// disable --now`, que mata o cgroup do servico, e ao os.Exit do agente.
func detachProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}
