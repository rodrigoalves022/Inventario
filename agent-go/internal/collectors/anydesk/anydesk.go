// Package anydesk le o ID do AnyDesk instalado na maquina a partir dos
// arquivos de configuracao (system.conf / service.conf). Nao executa nenhum
// binario externo: so le arquivos em caminhos conhecidos.
package anydesk

import (
	"bufio"
	"io"
	"os"
	"regexp"
	"strings"
)

var idPattern = regexp.MustCompile(`^\d{9,10}$`)

const confKey = "ad.anynet.id"

// ParseSystemConf procura `ad.anynet.id=<id>` e devolve o ID somente se tiver
// 9 ou 10 digitos; caso contrario, devolve "".
func ParseSystemConf(r io.Reader) string {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		key, value, ok := strings.Cut(scanner.Text(), "=")
		if !ok || strings.TrimSpace(key) != confKey {
			continue
		}
		id := strings.Join(strings.Fields(value), "")
		if idPattern.MatchString(id) {
			return id
		}
		return ""
	}
	return ""
}

func readID(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	return ParseSystemConf(f)
}

// PickBestID devolve o ID do primeiro caminho de sistema com ID valido.
func PickBestID(systemPaths, userPaths []string) string {
	for _, p := range systemPaths {
		if id := readID(p); id != "" {
			return id
		}
	}
	return PickBestConfFile(userPaths)
}

// PickBestConfFile devolve o ID valido do arquivo com maior ModTime entre os
// caminhos informados (inexistentes ou sem ID valido sao ignorados).
func PickBestConfFile(paths []string) string {
	bestID := ""
	var bestTime int64
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil || info.IsDir() {
			continue
		}
		id := readID(p)
		if id == "" {
			continue
		}
		if t := info.ModTime().UnixNano(); bestID == "" || t > bestTime {
			bestID, bestTime = id, t
		}
	}
	return bestID
}
