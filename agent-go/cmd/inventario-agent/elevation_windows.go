//go:build windows

package main

import (
	"fmt"
	"os"
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
	argv, _ := syscall.UTF16PtrFromString("autoinstall")
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
