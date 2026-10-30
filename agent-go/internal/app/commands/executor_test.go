package commands

import "testing"

func TestAllowedScriptsIncludeSecurityDiagnostics(t *testing.T) {
	for _, id := range []string{"defender_quick_scan", "windows_update_check"} {
		if !isAllowedScript(id) {
			t.Errorf("script %s deveria estar na allowlist", id)
		}
	}
	if isAllowedScript("rm_rf") {
		t.Error("script desconhecido nao deveria ser permitido")
	}
}
