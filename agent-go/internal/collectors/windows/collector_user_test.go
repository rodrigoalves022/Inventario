//go:build windows

package windowscollector

import "testing"

func TestResolveInteractiveUser(t *testing.T) {
	orig := queryUserCommand
	queryUserCommand = func() []byte { return nil }
	defer func() { queryUserCommand = orig }()
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

func TestParseQueryUserOutput(t *testing.T) {
	pt := " USUÁRIO   SESSÃO   ID  ESTADO   TEMPO OCIOSO  HORA LOGON\r\n" +
		" desconectado   rdp-tcp#1   2  Disc   3  10/10/2026 08:00\r\n" +
		">administrador   rdp-tcp#0   1  Ativo   .  10/10/2026 09:00\r\n"
	en := " USERNAME   SESSIONNAME   ID  STATE   IDLE TIME  LOGON TIME\r\n" +
		" bob   rdp-tcp#1   2  Disc   3  10/10/2026 8:00 AM\r\n" +
		" alice   rdp-tcp#0   1  Active   .  10/10/2026 9:00 AM\r\n"
	cases := []struct{ name, in, want string }{
		{"pt ativo com >", pt, "administrador"},
		{"en active sem >", en, "alice"},
		{"so cabecalho", " USERNAME SESSIONNAME\r\n", ""},
		{"vazio", "", ""},
		{"conta sistema", "H\r\n SYSTEM console 1 Active\r\n", ""},
	}
	for _, c := range cases {
		if got := parseQueryUserOutput(c.in); got != c.want {
			t.Errorf("%s: got %q, want %q", c.name, got, c.want)
		}
	}
}
