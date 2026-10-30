package anydesk

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestParseSystemConf(t *testing.T) {
	cases := map[string]struct{ in, want string }{
		"9 digitos":  {"ad.anynet.alias=x\nad.anynet.id=123456789\n", "123456789"},
		"10 digitos": {"ad.anynet.id = 1234567890", "1234567890"},
		"sem chave":  {"foo=bar\n", ""},
		"invalido":   {"ad.anynet.id=abc\n", ""},
		"vazio":      {"", ""},
	}
	for name, c := range cases {
		if got := ParseSystemConf(strings.NewReader(c.in)); got != c.want {
			t.Errorf("%s: got %q want %q", name, got, c.want)
		}
	}
}

func write(t *testing.T, dir, name, content string, mod time.Time) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(p, mod, mod); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestPickBestConfFile(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	old := write(t, dir, "old.conf", "ad.anynet.id=111111111", now.Add(-time.Hour))
	recent := write(t, dir, "new.conf", "ad.anynet.id=222222222", now)
	bad := write(t, dir, "bad.conf", "ad.anynet.id=abc", now.Add(time.Hour))
	missing := filepath.Join(dir, "missing.conf")

	if got := PickBestConfFile([]string{old, recent, bad, missing}); got != "222222222" {
		t.Errorf("got %q", got)
	}
	if got := PickBestConfFile([]string{bad, missing}); got != "" {
		t.Errorf("got %q", got)
	}
	if got := PickBestID([]string{missing, old}, []string{recent}); got != "111111111" {
		t.Errorf("system priority: got %q", got)
	}
	if got := PickBestID([]string{bad}, []string{old, recent}); got != "222222222" {
		t.Errorf("user fallback: got %q", got)
	}
}
