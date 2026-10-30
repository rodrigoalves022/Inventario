package service

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const configMarker = "<<INV_CONFIG>>"

// stripConfigTrailer remove o bloco "\n<<INV_CONFIG>>...<<INV_CONFIG>>\n" do
// fim do binario. O binario instalado nao deve carregar a config de
// auto-instalacao: sem ela, abrir o .exe instalado cai no Console PowerUser.
func stripConfigTrailer(data []byte) []byte {
	marker := []byte(configMarker)
	last := bytes.LastIndex(data, marker)
	if last == -1 {
		return data
	}
	first := bytes.LastIndex(data[:last], marker)
	if first == -1 {
		return data
	}
	cut := first
	if cut > 0 && data[cut-1] == '\n' {
		cut--
	}
	return data[:cut]
}

// copyExecutableToCanonicalPath copia o executavel em execucao para
// CanonicalBinaryPath() (sem o trailer de config) e devolve o caminho final.
// Se ja estiver rodando de la, nao copia nada.
func copyExecutableToCanonicalPath() (string, error) {
	targetPath := CanonicalBinaryPath()

	exePath, err := os.Executable()
	if err != nil {
		return "", err
	}
	if strings.EqualFold(filepath.Clean(exePath), filepath.Clean(targetPath)) {
		return targetPath, nil
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return "", fmt.Errorf("criar diretorio de instalacao: %w", err)
	}

	data, err := os.ReadFile(exePath)
	if err != nil {
		return "", fmt.Errorf("ler executavel: %w", err)
	}
	if err := os.WriteFile(targetPath, stripConfigTrailer(data), 0o755); err != nil {
		return "", fmt.Errorf("gravar binario em %s: %w", targetPath, err)
	}
	return targetPath, nil
}
