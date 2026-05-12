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
