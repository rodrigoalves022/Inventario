# Inventário Enterprise

Sistema de inventário de TI multi-tenant: um agente (Go) coleta hardware/software/segurança de
endpoints Windows e Linux e reporta a um painel Next.js, operado por MSPs (que atendem vários
clientes) ou por empresas que inventariam a si mesmas.

## Language

**Organization**:
A conta contratante — quem loga e opera o painel. Tipo `MSP` (atende N `Client`s) ou `DIRECT`
(atende só a si mesma, via exatamente um `Client`).
_Avoid_: Account, Tenant, Company.

**Client**:
A empresa/unidade inventariada — dona dos `Device`s, sempre presente mesmo no modo `DIRECT`
(existe uma linha redundante para não bifurcar todo o código em `if (isMsp)`).
_Avoid_: Customer, empresa-cliente (informal demais para código/schema).

**Tenant**:
Não é uma entidade do schema — é o *conceito de isolamento* aplicado a um `Client` específico
(usado em código/URLs: `tenantSlug`, `/tenant/[clientSlug]`). Ao falar do registro no banco, use
`Client`; ao falar do escopo de acesso/segregação de dados, "tenant" é aceitável.
_Avoid_: usar "tenant" quando o que se quer dizer é `Organization` (são níveis diferentes da
hierarquia).

**Device**:
Um endpoint inventariado. Identidade real é `agentAuthId` (a credencial da instalação do agente),
nunca `hostname` — hostnames colidem entre máquinas distintas (confirmado: um agente rodando
dentro de uma sessão WSL2 reporta o mesmo hostname da máquina Windows hospedeira, produzindo dois
`AgentAuth` reais com `hostname` idêntico).
_Avoid_: tratar hostname como chave, mesmo "só para exibição rápida" — já causou confusão real de
inventário nesta sessão.

**AgentAuth**:
A credencial de uma instalação de agente — 1:1 com `Device` (`onDelete: Cascade` a partir daqui,
não o contrário). É a unidade real de identidade/autenticação, `Device` é o que pendura dela.
_Avoid_: confundir com `enrollmentKey` (ver abaixo — momentos diferentes do ciclo de vida).

**Enrollment key vs API key**:
`enrollmentKey` é de uso único por `Client`, só para o primeiro contato (`/api/agent/register`).
`apiKey` (via `AgentAuth`) é a credencial permanente de cada `Device`, usada em todo check-in
depois disso. O banco nunca guarda nenhuma das duas em claro — só hash.
_Avoid_: "chave do agente" sem especificar qual das duas.

**Presença (presence) vs status**:
`Device.status` é a coluna crua no banco, escrita só a cada check-in — nunca transiciona sozinha
para `"offline"`. "Presença" é o valor calculado em runtime (`getDevicePresence`, `lib/inventory-alerts.ts`)
a partir do tempo desde a última coleta: online (minutos), ausente (até o limiar do tenant),
offline (depois disso ou nunca coletou). São dois conceitos diferentes — bug real já corrigido
nesta sessão por confundi-los (badge mostrava "online" pra máquina sem coleta há meses).
_Avoid_: ler `device.status` direto numa tela pra decidir cor de badge; sempre passar pela função
de presença.

**AlertRule vs limiares fixos**:
Dois mecanismos de alerta distintos, não um. Limiares fixos (`Client.alertDiskThresholdGb`,
`alertRamThresholdGb`, `alertOfflineHours`) alimentam o badge de status e o webhook. `AlertRule`/
`AlertEvent` é um catálogo fechado e explícito, restrito a 4 métricas de postura de segurança
(antivírus/firewall/UAC/BitLocker) — não cobre disco, RAM nem offline.
_Avoid_: tratar "alerta" como um conceito único ao descrever o sistema.

**Bucket (nunca soma)**:
Ao agregar hardware/disco de uma frota heterogênea, sempre contar **quantas máquinas** caem em
cada faixa/valor exato — nunca somar valores absolutos de máquinas diferentes num único número.
Padrão estabelecido em `lib/reports/device-report.ts`; já foi violado e corrigido mais de uma vez
no histórico do projeto.
_Avoid_: `sum(ramTotalGb)` ou equivalente em qualquer tela nova que agregue hardware por tenant.
