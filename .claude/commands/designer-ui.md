---
description: Audita coerência de tema escuro e interatividade de UI usando o agente designer-ui
---
Use o agente `designer-ui` (`.claude/agents/designer-ui.md`, via Agent tool) para auditar a tela ou
componente informado a seguir, focando em: controles nativos que escapam do tema escuro (`<select>`,
`<input type="number">`), ausência de estados de hover/focus em elementos interativos, e
interatividade incompleta em gráficos Recharts (tooltip, hover de fatia/barra, click-to-filter).

O `designer-ui` é somente leitura — ele devolve um relatório de achados, não corrige nada. Se o
usuário pedir para aplicar as correções, isso é trabalho do `implementation-agent`, depois que os
achados virarem itens de sprint aprovados (mesmo fluxo dos outros 5 auditores deste projeto).

Alvo da auditoria: $ARGUMENTS
