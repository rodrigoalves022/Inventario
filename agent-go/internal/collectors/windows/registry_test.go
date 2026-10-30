//go:build windows

package windowscollector

import (
	"testing"

	"inventario-agent/internal/domain/inventory"
)

func base(name string) registrySoftwareRaw {
	return registrySoftwareRaw{DisplayName: name, UninstallString: `"C:\x\unins.exe"`}
}

func TestShouldIncludeRegistrySoftware(t *testing.T) {
	sysComp := base("A")
	sysComp.SystemComponent = 1
	noDisplay := base("B")
	noDisplay.NoDisplay = 1
	parent := base("C")
	parent.ParentKeyName = "Office"
	parentDisp := base("C2")
	parentDisp.ParentDisplayName = "Office"
	hotfix := base("D")
	hotfix.ReleaseType = "Security Update"
	noUninstall := registrySoftwareRaw{DisplayName: "E"}
	quietOnly := registrySoftwareRaw{DisplayName: "F", QuietUninstallString: "msiexec /x"}

	cases := []struct {
		name string
		raw  registrySoftwareRaw
		want bool
	}{
		{"normal", base("Google Chrome"), true},
		{"quiet only", quietOnly, true},
		{"empty name", base("  "), false},
		{"system component", sysComp, false},
		{"no display", noDisplay, false},
		{"parent key", parent, false},
		{"parent display", parentDisp, false},
		{"hotfix release type", hotfix, false},
		{"no uninstall string", noUninstall, false},
		{"vs_", base("vs_FileTracker_Singleton"), false},
		{"vcpp_crt", base("vcpp_crt.redist.clickonce"), false},
		{"app verifier", base("Application Verifier x64 External Package"), false},
		{"sdk store", base("Windows SDK for Windows Store Apps Tools"), false},
		{"def update", base("Definition Update for Microsoft Defender"), false},
	}
	for _, tc := range cases {
		if got := shouldIncludeRegistrySoftware(tc.raw); got != tc.want {
			t.Errorf("%s: got %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestAddRegistrySoftwareDeduplicates(t *testing.T) {
	index := map[string]int{}
	var result []inventory.SoftwareInfo

	first := base("Google Chrome")
	second := base("  google chrome ")
	second.DisplayVersion = "120.0"
	third := base("GOOGLE CHROME")
	third.DisplayVersion = "130.0"

	addRegistrySoftware(first, index, &result)
	addRegistrySoftware(second, index, &result)
	addRegistrySoftware(third, index, &result)

	if len(result) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(result))
	}
	if result[0].Versao != "120.0" {
		t.Errorf("expected version filled from duplicate, got %q", result[0].Versao)
	}
}
