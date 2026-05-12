package config

import (
	"path/filepath"
	"testing"
)

func TestNormalizeServerURL(t *testing.T) {
	t.Parallel()

	got, err := NormalizeServerURL(" https://inventario.exemplo.com/ ")
	if err != nil {
		t.Fatalf("NormalizeServerURL retornou erro: %v", err)
	}

	want := "https://inventario.exemplo.com"
	if got != want {
		t.Fatalf("URL normalizada incorreta: got=%q want=%q", got, want)
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "config.json")
	input := &Config{
		ServerURL:   "http://localhost:3000/",
		APIKey:      "abc123",
		AgentName:   "WKS-001",
		InstalledAt: "2026-03-31T10:00:00Z",
	}

	if err := Save(path, input); err != nil {
		t.Fatalf("Save retornou erro: %v", err)
	}

	got, err := Load(path)
	if err != nil {
		t.Fatalf("Load retornou erro: %v", err)
	}

	if got.ServerURL != "http://localhost:3000" {
		t.Fatalf("ServerURL incorreta: %q", got.ServerURL)
	}

	if got.APIKey != input.APIKey || got.AgentName != input.AgentName || got.InstalledAt != input.InstalledAt {
		t.Fatalf("config carregada difere da salva: %+v", got)
	}
}
