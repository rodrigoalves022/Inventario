# .codex-local-skills

Este diretório guarda skills locais/específicas do projeto como **fonte auxiliar/autoral**.

Contrato atual:

- `Codex` carrega runtime deste workspace a partir de `.codex/skills/`
- `antigravity-awesome-skills/skills/` é a fonte upstream para skills comunitárias
- `.codex-local-skills/` **não** é path runtime automático do Codex
- quando uma skill local virar dependência operacional do workspace, ela deve ser promovida para `.codex/skills/`

Objetivo:

- manter rascunhos/autoria local sem confundir isso com o runtime canônico do projeto
