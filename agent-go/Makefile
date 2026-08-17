# Build cross-platform do Inventario Agent
#
# Fonte unica de publish: o build Windows vai direto para ../public/, que e'
# o arquivo efetivamente servido (auto-updater do agente busca
# ${serverUrl}/inventario-agent.exe como arquivo estatico do Next.js, e
# /api/agent/download{,-exe} leem o mesmo arquivo). Antes deste Makefile,
# ../public/inventario-agent.exe e dist/inventario-agent.exe eram copias
# manuais que divergiam sem aviso — download() servia uma versao, o
# auto-updater outra.
#
# Sintaxe de env var em prefixo (GOOS=x GOARCH=y comando), nao
# `$$env:GOOS=...` do PowerShell: roda igual em sh (Git Bash/Linux/macOS) e
# em `make` de qualquer um desses ambientes, sem depender de qual shell o
# make invoca por baixo.

GO      := go
APPNAME := inventario-agent
VERSION := 1.0.0
PUBLIC_DIR := ../public

.PHONY: windows linux all deps clean

## Compila para Windows (x64) e publica em ../public/ — fonte servida pelo app
windows:
	@echo "[BUILD] Compilando para Windows..."
	GOOS=windows GOARCH=amd64 $(GO) build -ldflags "-s -w -X main.version=$(VERSION)" -o dist/$(APPNAME).exe ./cmd/$(APPNAME)
	@cp dist/$(APPNAME).exe $(PUBLIC_DIR)/$(APPNAME).exe
	@echo "[OK] $(PUBLIC_DIR)/$(APPNAME).exe publicado (copia em dist/$(APPNAME).exe)"

## Compila para Linux (x64) — sem publish: coletores Linux ainda nao existem (factory_stub.go)
linux:
	@echo "[BUILD] Compilando para Linux..."
	GOOS=linux GOARCH=amd64 $(GO) build -ldflags "-s -w -X main.version=$(VERSION)" -o dist/$(APPNAME)-linux ./cmd/$(APPNAME)
	@echo "[OK] dist/$(APPNAME)-linux pronto"

## Ambos em sequencia
all: windows linux

## Baixar dependencias
deps:
	$(GO) mod tidy

## Limpar binarios de build (nao mexe em ../public/, que e' o publicado)
clean:
	rm -rf dist
