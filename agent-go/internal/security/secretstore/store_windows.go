//go:build windows

package secretstore

import dpapistore "inventario-agent/internal/security/secretstore/dpapi"

// Store abstrai a persistencia local de segredos/configuracao.
type Store interface {
	Load(path string, target any) error
	Save(path string, source any) error
}

func New() Store {
	return dpapistore.New()
}
