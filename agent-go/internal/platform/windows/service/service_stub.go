//go:build !windows

package service

import "fmt"

const ServiceName = "InventarioAgent"

func Install() error {
	return fmt.Errorf("instalacao de servico ainda nao suportada nesta plataforma")
}

func Uninstall() error {
	return fmt.Errorf("desinstalacao de servico ainda nao suportada nesta plataforma")
}

func Start() error {
	return fmt.Errorf("controle de servico ainda nao suportado nesta plataforma")
}

func Stop() error {
	return fmt.Errorf("controle de servico ainda nao suportado nesta plataforma")
}

func RunService(isDebug bool) error {
	return fmt.Errorf("modo servico ainda nao suportado nesta plataforma")
}
