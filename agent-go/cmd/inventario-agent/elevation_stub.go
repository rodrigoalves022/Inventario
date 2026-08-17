//go:build !windows

package main

import "os"

// isElevated: fora do Windows, "elevado" equivale a rodar como root — e' o
// que o systemd unit gerado pelo instalador ja garante.
func isElevated() bool {
	return os.Geteuid() == 0
}

// elevateAndExit nao tem equivalente ao UAC do Windows: nao existe um
// "runas" universal para relancar o processo elevado sem prompt interativo
// de sudo. So orienta o usuario a rodar com privilegio.
func elevateAndExit() {
	os.Stderr.WriteString("[!] Execute como root (sudo) para instalar.\n")
	os.Exit(1)
}
