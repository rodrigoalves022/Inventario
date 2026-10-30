//go:build windows

package main

import (
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/windows"
)

func isElevated() bool {
	var sid *windows.SID
	err := windows.AllocateAndInitializeSid(&windows.SECURITY_NT_AUTHORITY, 2, windows.SECURITY_BUILTIN_DOMAIN_RID, windows.DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0, &sid)
	if err != nil {
		return false
	}
	token := windows.Token(0)
	member, err := token.IsMember(sid)
	if err != nil {
		return false
	}
	return member
}

func elevateAndExit() {
	exe, _ := os.Executable()
	cwd, _ := os.Getwd()
	verb, _ := syscall.UTF16PtrFromString("runas")
	// Repassa os argumentos originais (status, purge -yes, ...); sem argumentos
	// mantem o fluxo antigo de autoinstall do instalador baixado; se o binario
	// nao tem o trailer <<INV_CONFIG>> (ja instalado), abre o menu "manage".
	params := "autoinstall"
	if len(os.Args) <= 1 {
		if ac, _ := extractAutoConfig(); ac == nil {
			params = "manage"
		}
	} else {
		quoted := make([]string, 0, len(os.Args)-1)
		for _, a := range os.Args[1:] {
			quoted = append(quoted, syscall.EscapeArg(a))
		}
		params = strings.Join(quoted, " ")
	}
	argv, _ := syscall.UTF16PtrFromString(params)
	dir, _ := syscall.UTF16PtrFromString(cwd)
	exePath, _ := syscall.UTF16PtrFromString(exe)

	err := windows.ShellExecute(0, verb, exePath, argv, dir, 1)
	if err != nil {
		fmt.Printf("[!] Falha ao solicitar elevacao: %v (Execute como Administrador manualmente)\n", err)
		time.Sleep(10 * time.Second)
		os.Exit(1)
	}
	os.Exit(0)
}
