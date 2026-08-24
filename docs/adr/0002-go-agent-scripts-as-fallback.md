---
status: accepted
---

# Agente principal em Go; scripts shell/PowerShell só como bootstrap/compatibilidade

O coletor de inventário é um binário Go único (`agent-go/`), com coletores nativos por
plataforma (Windows via WMI, Linux via `/proc`/`/sys`/`/etc/os-release`) rodando como serviço
persistente (Windows Service / systemd) com três ciclos independentes (inventário, métricas,
comandos). Scripts em `scripts/agent/*.sh`/`.ps1` existem só para instalar/bootstrapar o binário
ou como caminho de compatibilidade legado — não para coleta contínua.

**Por quê**: um binário compilado dá um único artefato versionado, testável com `go vet`/build
cruzado, sem depender de runtime de shell instalado no endpoint do cliente; scripts shell puros
não escalariam para o catálogo de comandos remotos (`collect_now`, `run_script` com allowlist,
etc.) nem para o auto-update com verificação de SHA-256.

**Consequência**: uma nova plataforma (ex.: macOS) exige um coletor Go novo (`factory_<os>.go`),
não um script solto — o stub `factory_stub.go` documenta isso explicitamente ao recusar rodar em
plataforma não implementada.
