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
