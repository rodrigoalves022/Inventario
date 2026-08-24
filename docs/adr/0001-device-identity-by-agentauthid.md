---
status: accepted
---

# Identidade de device por agentAuthId, nunca hostname

Hostname parece a chave óbvia para identificar uma máquina, mas colide: confirmado nesta sessão
que um agente rodando dentro de uma sessão WSL2 reporta o mesmo hostname da máquina Windows
hospedeira, produzindo duas credenciais (`AgentAuth`) reais e distintas com `hostname` idêntico no
mesmo tenant. `Device.agentAuthId` é `@unique` e é a chave real de identidade; `hostname` é só um
campo de exibição, nunca usado para lookup ou deduplicação.

**Consequência**: qualquer tela ou consulta nova que agrupe/deduplique dispositivos deve usar
`agentAuthId` (ou `deviceId`), nunca `hostname`. Duas linhas com o mesmo hostname podem ser
legitimamente duas máquinas diferentes (ou uma máquina real + uma sessão WSL/contêiner rodando o
agente por engano) — a correção correta é rotular a origem (ex.: sufixo "(WSL)"), não mesclar por
nome.
