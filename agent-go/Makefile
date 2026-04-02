# Build cross-platform do Inventario Agent

GO      := go
APPNAME := inventario-agent
VERSION := 1.0.0

.PHONY: windows linux clean deps

## Compila o executável para Windows (x64)
windows:
	@echo [BUILD] Compilando para Windows...
	$env:GOOS="windows"; $env:GOARCH="amd64"; $(GO) build -ldflags "-s -w -X main.version=$(VERSION)" -o dist/$(APPNAME).exe ./cmd/$(APPNAME)
	@echo [OK] dist/$(APPNAME).exe pronto

## Compila o binário para Linux (x64)
linux:
	@echo [BUILD] Compilando para Linux...
	$env:GOOS="linux"; $env:GOARCH="amd64"; $(GO) build -ldflags "-s -w -X main.version=$(VERSION)" -o dist/$(APPNAME)-linux ./cmd/$(APPNAME)
	@echo [OK] dist/$(APPNAME)-linux pronto

## Ambos em sequencia
all: windows linux

## Baixar dependências
deps:
	$(GO) mod tidy

## Limpar binários
clean:
	Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
