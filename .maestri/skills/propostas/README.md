# Propostas de skill

Skills que os próprios agentes escrevem a partir do que repetiram no trabalho. Aqui ninguém carrega nada:
a proposta só vira skill ativa depois que o CEO aprova.

Formato: `propostas/<papel>/<nome>/SKILL.md`, no padrão de qualquer skill (frontmatter com `name` e `description`).

Promover, depois do aprovado:
1. Mover para `.maestri/skills/<nome>/`.
2. Adicionar a linha na tabela de `.maestri/skills/README.md` (origem: agente, data, PR).
3. Adicionar `<nome>` ao `equip` do papel em `.maestri/setup-canvas.sh` e rodar o setup.

Melhorar uma skill que já existe segue o mesmo caminho: a proposta traz a versão nova e diz o que mudou e por quê.
