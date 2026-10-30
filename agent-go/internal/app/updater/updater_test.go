package updater

import (
	"strings"
	"testing"
)

func TestEscapePowerShellSingleQuoted(t *testing.T) {
	if got := escapePowerShellSingleQuoted("C:\\O'Brien\\a.exe"); got != "C:\\O''Brien\\a.exe" {
		t.Fatalf("escape incorreto: %s", got)
	}
	if got := escapePowerShellSingleQuoted("plain"); got != "plain" {
		t.Fatalf("nao deveria alterar: %s", got)
	}
}

func TestEscapePosixSingleQuoted(t *testing.T) {
	if got := escapePosixSingleQuoted("/opt/O'Brien/agent"); got != `/opt/O'\''Brien/agent` {
		t.Fatalf("escape incorreto: %s", got)
	}
	if got := escapePosixSingleQuoted("plain"); got != "plain" {
		t.Fatalf("nao deveria alterar: %s", got)
	}
}

func TestBuildLinuxUpdateScript(t *testing.T) {
	s := buildLinuxUpdateScript("/var/lib/inventario-agent/updates/o'x", "/usr/local/bin/inventario-agent")
	for _, want := range []string{
		"#!/bin/sh",
		`TEMP='/var/lib/inventario-agent/updates/o'\''x'`,
		`TARGET='/usr/local/bin/inventario-agent'`,
		`BAK="${TARGET}.bak"`,
		`systemctl stop inventario-agent`,
		`cp -f "$TARGET" "$BAK"`,
		`chmod 0755 "$TARGET"`,
		`if systemctl start inventario-agent`,
		`rm -f "$BAK"`,
		`cp -f "$BAK" "$TARGET" && chmod 0755 "$TARGET"`,
		`rm -f "$TEMP" "$0"`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("script sem trecho esperado: %s", want)
		}
	}
	if strings.Count(s, "systemctl start inventario-agent") != 2 {
		t.Errorf("esperado start na troca e novamente apos rollback")
	}
}

func TestBuildUpdateScript(t *testing.T) {
	s := buildUpdateScript(`C:\tmp\o'x.exe`, `C:\Program Files\agent.exe`)
	for _, want := range []string{
		`$temp = 'C:\tmp\o''x.exe'`,
		`$target = 'C:\Program Files\agent.exe'`,
		`$bak = $target + '.bak'`,
		`Start-Service -Name 'InventarioAgent' -ErrorAction Stop`,
		`catch {`,
		`Copy-Item -Path $bak -Destination $target -Force`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("script sem trecho esperado: %s", want)
		}
	}
}
