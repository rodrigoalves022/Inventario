package filestore

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Store struct{}

func New() *Store {
	return &Store{}
}

func (s *Store) Load(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("leitura de config: %w", err)
	}

	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("parse de config: %w", err)
	}

	return nil
}

func (s *Store) Save(path string, source any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}

	data, err := json.MarshalIndent(source, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0600)
}
