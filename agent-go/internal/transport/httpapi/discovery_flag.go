package httpapi

import "sync"

// Sprint 14. Estado do flag `discoveryEnabled` recebido na resposta do
// check-in.
//
// DECISAO: vive EM MEMORIA no processo do servico, nao no config em disco.
//
// Por que nao persistir: o flag e' propriedade do TENANT, mantida no servidor;
// persistir uma copia local criaria uma segunda fonte de verdade que poderia
// ficar defasada (tenant desliga a varredura, o agente fica offline uma semana
// e volta varrendo pelo valor antigo em disco). Em memoria, o pior caso e' o
// oposto — e o oposto e' o lado seguro:
//
//   - Default `false` no start do processo: um agente recem-iniciado NAO varre
//     nada ate um check-in dizer explicitamente que pode. Reinicio de servico,
//     reboot da maquina e auto-update caem todos nesse caminho.
//   - Todo check-in (1h) reafirma o valor, entao o atraso maximo entre o
//     tenant desligar a varredura e o agente parar de varrer e' de uma hora —
//     e o gate REAL, server-side, ja rejeita o payload nesse meio tempo sem
//     gravar nada.
//
// O acesso e' concorrente (ticker de descoberta le enquanto o ciclo de
// check-in escreve), por isso o mutex.
var (
	discoveryMutex   sync.RWMutex
	discoveryEnabled bool
)

// SetDiscoveryEnabled registra o valor vindo do servidor.
func SetDiscoveryEnabled(enabled bool) {
	discoveryMutex.Lock()
	defer discoveryMutex.Unlock()
	discoveryEnabled = enabled
}

// DiscoveryEnabled informa se o ultimo check-in autorizou a varredura.
// Fail-closed: false ate que um check-in diga o contrario.
func DiscoveryEnabled() bool {
	discoveryMutex.RLock()
	defer discoveryMutex.RUnlock()
	return discoveryEnabled
}
