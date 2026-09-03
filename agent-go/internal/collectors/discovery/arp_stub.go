//go:build !windows

package discovery

// readARPTable nao e' implementada fora do Windows.
//
// Devolve mapa VAZIO e erro nil de proposito (nao um erro): a ausencia de MAC
// nao invalida a descoberta — o dispositivo continua sendo catalogado por IP,
// portas e SNMP, so com `mac` nulo. Tratar isso como falha abortaria uma
// varredura perfeitamente util num agente Linux.
//
// A saida de `arp -n`/`ip neigh` no Linux tem formato diferente do de
// `arp -a`; implementar isso e' trabalho separado, nao um efeito colateral
// desta sprint.
func readARPTable() (map[string]string, error) {
	return map[string]string{}, nil
}
