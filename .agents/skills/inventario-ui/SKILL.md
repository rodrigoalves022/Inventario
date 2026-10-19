---
name: inventario-ui
description: Regras de interface do Inventário Enterprise para criar, revisar ou auditar qualquer tela. Une o DESIGN.md, o processo do impeccable e o subconjunto aprovado de regras de terceiros (frontend-design da Anthropic, react-best-practices da Vercel) numa ordem de precedência fixa. Use antes de tocar em qualquer arquivo de app/ ou components/, e sempre que uma tela começar a parecer genérica, "feita por IA".
---

# inventario-ui

## Precedência — leia antes de qualquer outra seção

```
1. DESIGN.md                      vence sempre; é o que está no código
2. CONTEXT.md / docs/adr/         vocabulário e decisões de domínio
3. impeccable                     processo: shape, critique, audit, polish
4. Regras mescladas de terceiros  só complementam; nunca derrogam 1 a 3
```

Conflito entre duas fontes: vence o número menor. Sem exceção, sem "neste caso faz sentido".

Esta skill não define estética. Ela **aponta** para o `DESIGN.md` e acrescenta só o que ele não
cobre. Se uma regra daqui parecer pedir outra paleta, outra fonte ou outro tema, a regra está
errada — releia a precedência.

---

## (a) Checklist duro — `DESIGN.md` §10

Rode antes de dar qualquer trabalho de tela por terminado. Cada item é verificável no diff.

- [ ] Nenhum hex, `rgb()` ou `oklch()` literal fora de `app/globals.css`. Cor entra por token.
- [ ] Nenhuma animação contínua (`animate-ping` ou similar) em linha de listagem.
- [ ] `backdrop-blur` só em superfície flutuante (header fixo, overlay, popover).
- [ ] Nenhuma borda colorida de mais de 1px num lado só de card, item de lista ou alerta.
      Exceção única: o indicador de rota ativa da sidebar, feito como `<span>`, não `border-l`.
- [ ] Nenhuma borda de 1px sob sombra larga. Elevação declarada uma vez.
- [ ] Nenhum `hover:scale()` em card com texto. Use `translateY`.
- [ ] Monoespaçado só para dado técnico (`.data-mono`), nunca como fantasia de "técnico" em
      rótulo, título ou mensagem.
- [ ] Nenhum texto em gradiente. Ênfase vem de peso ou tamanho.
- [ ] Nenhum emoji ou glifo Unicode no lugar de ícone. Ícone vem de `lucide-react`.
- [ ] Nenhuma variante `dark:` nova.
- [ ] Cores de série (`--chart-*`) não pintam chrome de UI, e vice-versa.
- [ ] Modal não foi o primeiro pensamento — inline e progressivo foram esgotados antes.

E a família fechada de superfícies (Sprint 16), que o §10 ainda não lista:

- [ ] Card de KPI é `KpiCard` (`components/ui/kpi-card.tsx`). Bloco com cabeçalho é `Panel`
      (`components/ui/panel.tsx`). Nenhuma `div` com borda e fundo virando card na mão.
- [ ] Nenhum card dentro de painel. Lista dentro de painel usa linhas com `divide-y`.
- [ ] Card que reage ao hover tem para onde levar (`href` ou `onClick`). Sem destino, sem hover.

---

## (b) Qual comando do impeccable, por tipo de tela

| Tipo de tela | Comando | Quando |
|---|---|---|
| Listagem com tabela (computers, servers, storage...) | `/layout`, depois `/polish` | Alinhamento de coluna, densidade, rodapé de paginação |
| Visão geral / dashboard | `/critique`, depois `/distill` | Quando há blocos demais competindo por atenção |
| Detalhe de ativo | `/clarify` | Rótulo e mensagem; é tela de leitura de dado técnico |
| Formulário e configuração | `/harden` | Estado de erro, vazio, carregando, permissão negada |
| Estado vazio, primeira execução | `/onboard` | Tenant sem máquina, varredura desligada |
| Tela "alta demais" | `/quieter` | Cor e peso usados como decoração |
| Revisão final de qualquer tela | `/audit` | Acessibilidade, responsivo, contraste |

**Atenção ao `shape`, `init` e `new-work`.** O impeccable procura `PRODUCT.md` **na raiz** do
repositório; este projeto o tem em `docs/PRODUCT.md`, e o carregador de contexto reporta
`productPath: null`. Esses três comandos vão exigir a criação de um `PRODUCT.md` antes de
seguir. Os comandos de refinamento da tabela acima funcionam sem ele.

---

## (c) React e Next — só o que o projeto ainda não pratica

O projeto **já** pratica, e por isso essas regras não estão aqui: `Promise.all` em operações
independentes, dynamic import de componente pesado, `cache()` para dedupe por requisição,
estado derivado durante o render e lógica de interação no handler (os dois últimos impostos
pelo lint `react-hooks/set-state-in-effect`), e `useSyncExternalStore` contra mismatch de
hidratação.

O que falta:

- **`after()` para efeito colateral depois da resposta.** Rotas de API do agente disparam log e
  webhook com `void promessa` — funciona, mas não dá garantia de execução depois que a resposta
  sai. Em código novo de rota, prefira `after()` de `next/server`. Não reescreva as rotas
  existentes por iniciativa própria: o check-in é caminho crítico e mudar o modelo de execução
  dele é decisão de sprint.
- **Condicional explícita quando o lado esquerdo é número.** `{count && <Badge />}` imprime `0`
  na tela quando `count` vale zero. Use `{count > 0 ? <Badge /> : null}`. Não há ocorrência hoje;
  a regra é preventiva.
- **Barrel de ícones: medir antes de mexer.** 55 arquivos importam de `lucide-react` e
  `optimizePackageImports` não está no `next.config`. O Next já otimiza `lucide-react` por
  padrão, então provavelmente não há ganho. Só configure algo com medição de bundle antes e
  depois em mãos.

---

## (d) Sinais de interface "feita por IA" — e como evitar sem trocar a paleta

O risco real deste projeto não é estar feio. É ficar **genérico**: o tipo de painel que
qualquer gerador produz. Os sinais abaixo vêm do `frontend-design` da Anthropic e do histórico
deste próprio repositório, filtrados para não brigar com o `DESIGN.md`.

**Número sem lastro**
- Nenhum sparkline, micro-tendência ou "+12% vs mês anterior" sem série temporal real por trás.
  Não existe série agregada de frota nesta base (`MetricSample` é por dispositivo). Gráfico com
  dado sintético num painel de operação é informação fabricada.
- "Sem dado" nunca vira `0%`. Percentual sem denominador visível ("42 de 51 máquinas com dado
  apurado") é número que o operador não consegue auditar.

**Cor como enfeite**
- O ciano é acento, não ambiente. Fica em estado interativo, rota ativa e foco — não em halo
  decorativo, orbe desfocado ou brilho de fundo permanente. É isso que separa "fundo escuro com
  acento" de "fundo escuro com neon", sem mexer em token nenhum. O único caso existente hoje
  são os dois orbes `blur-[128px]` de `app/login/page.tsx`.
- Número só ganha cor quando a cor **é** a informação (`emphasizeValue` do `KpiCard`). Um total
  colorido não diz nada; um zero em âmbar diz algo falso.
- Nenhuma palavra de título destacada com cor. Ênfase vem de peso.

**Estrutura de template**
- Numeração só quando há sequência real.
- Nenhum ícone decorativo ao lado de rótulo que já se explica sozinho. Ícone que não
  diferencia nada é ruído.
- Movimento comunica estado e responde a ação do usuário. Nenhuma sequência de entrada de
  página, nem "um momento orquestrado" — o `DESIGN.md` §6 é mais estrito que o `frontend-design`
  e vence.
- Ao terminar uma tela, remova um elemento. Se ninguém sente falta, ele não devia estar lá.

**Texto de template**
- Nada de "Bem-vindo de volta!", "insights poderosos", "experiência fluida". É uma ferramenta de
  operação; o texto diz o que está acontecendo e o que fazer.
- Estado vazio explica **por que** está vazio e **onde** resolver. "Varredura desligada —
  nada foi procurado" é diferente de "Nenhum dispositivo", e as duas frases não são
  intercambiáveis.
- Voz ativa, perspectiva de quem usa.

---

## O que esta skill deliberadamente não contém

Regras dos terceiros que foram lidas e **descartadas**, para ninguém reintroduzi-las achando
que foram esquecidas:

- Plano de design com 4 a 6 cores em hex — o projeto não admite cor literal fora do
  `globals.css`, e a paleta já está decidida.
- Uma ou duas famílias tipográficas "com personalidade", título como elemento expressivo — o
  `DESIGN.md` §3 fixa Inter e JetBrains Mono, e diz por que par display/corpo não serve a painel.
- Evitar rótulo em caixa alta e "eyebrow label" — o `.section-label` (11px / 700 / 0.1em, caixa
  alta) é regra do sistema para título de seção, cabeçalho de coluna e rótulo de KPI.
- Trocar o fundo quase-preto com acento ciano por ser "default de IA" — mudaria a paleta. O
  risco é tratado na seção (d) pelo **uso** da cor, não pela cor.
- Cards variados em vez de idênticos — a Sprint 16 padronizou de propósito, e foi o pedido do
  usuário.
- SWR — seria dependência nova para resolver um polling que funciona. Decisão de sprint, não
  regra de skill.

## Origem

- `DESIGN.md`, `CONTEXT.md`, `docs/adr/` — deste repositório.
- `anthropics/skills`, `skills/frontend-design/SKILL.md` — lido, mesclado em parte, não
  instalado. Licença Apache 2.0.
- `vercel-labs/agent-skills`, `skills/react-best-practices/AGENTS.md` — 8 categorias, 70 regras;
  lido, mesclado em parte, não instalado.
