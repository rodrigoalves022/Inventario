# Bloqueio do `$team` em 2026-04-02

## O que aconteceu

O `$team` **não foi executado** porque o runtime exigido pelo skill não estava disponível nesta sessão.

## Motivo exato

O skill `team` exige, antes do launch:

1. `tmux` instalado e funcional
2. sessão atual rodando **dentro do tmux**
3. `omx` resolvido corretamente

Na verificação feita nesta sessão, o resultado foi:

- `TMUX` = `NOT_SET`
- `omx` encontrado em `C:\Users\Administrador\AppData\Roaming\npm\omx.ps1`
- `tmux` não apresentou versão utilizável no preflight

## Consequência

Sem `TMUX` ativo, eu **não posso** lançar `omx team ...` de forma correta, porque o team skill depende de panes reais do tmux para criar e coordenar os workers.

Pelo contrato do skill, eu também **não devo substituir** isso por subagentes normais quando o usuário pediu explicitamente `$team`.

## O que foi feito mesmo assim

Para não perder contexto, foi criado o snapshot exigido pelo workflow team em:

- `.omx/context/padronizacao-governanca-multi-ia-20260402T144354Z.md`

## Como executar corretamente depois

Na próxima sessão:

1. abrir uma sessão dentro de `tmux`
2. entrar em `E:\Inventario`
3. pedir novamente o launch do team

Exemplo de retomada:

- `leia CONTINUITY.md e lance o $team 4 usando o snapshot em .omx/context/`

## Resumo curto

O `$team` não rodou porque **esta sessão não está dentro de tmux** (`TMUX` não está definido), e o skill `team` exige tmux real para funcionar.
