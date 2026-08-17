//go:build windows

// Package dpapistore usa a API DPAPI do Windows (via github.com/billgraziano/dpapi),
// que so builda no Windows. So' importado por store_windows.go — a tag aqui
// evita que `go build ./...`/`go vet ./...` para outra plataforma tentem
// compilar este pacote so por ele existir na arvore do modulo.
package dpapistore

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/billgraziano/dpapi"
)

type Store struct{}

func New() *Store {
	return &Store{}
}

func (s *Store) Load(path string, target any) error {
	cipherTextBytes, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return err
		}
		return fmt.Errorf("leitura de config protegida: %w", err)
	}

	plainTextStr, err := dpapi.Decrypt(string(cipherTextBytes))
	if err != nil {
		return fmt.Errorf("dpapi decrypt falhou: %w", err)
	}

	if err := json.Unmarshal([]byte(plainTextStr), target); err != nil {
		return fmt.Errorf("parse de config protegida: %w", err)
	}

	return nil
}

func (s *Store) Save(path string, source any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	plainTextBytes, err := json.MarshalIndent(source, "", "  ")
	if err != nil {
		return err
	}

	cipherTextStr, err := dpapi.EncryptMachineLocal(string(plainTextBytes))
	if err != nil {
		return fmt.Errorf("dpapi encrypt falhou: %w", err)
	}

	return os.WriteFile(path, []byte(cipherTextStr), 0600)
}
