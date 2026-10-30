//go:build windows

package windowscollector

import "testing"

func TestResolveInteractiveUser(t *testing.T) {
	t.Setenv("USERNAME", "SYSTEM")
	cases := map[string]string{
		`ACME\maria`:         "maria",
		"joao":               "joao",
		`ACME\PC01$`:         "",
		"SYSTEM":             "",
		"":                   "",
		"  NETWORK SERVICE ": "",
	}
	for in, want := range cases {
		if got := resolveInteractiveUser(in); got != want {
			t.Errorf("resolveInteractiveUser(%q) = %q, want %q", in, got, want)
		}
	}

	t.Setenv("USERNAME", "ana")
	if got := resolveInteractiveUser(""); got != "ana" {
		t.Errorf("fallback env = %q, want ana", got)
	}
	t.Setenv("USERNAME", "PC01$")
	if got := resolveInteractiveUser(""); got != "" {
		t.Errorf("fallback machine account = %q, want empty", got)
	}
}
