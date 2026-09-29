# 2026-09-29 — Subagentes explorer, worker e researcher, e advisor no Claude Code

## Pedido
O CEO pediu o Claude Code organizado em árvore:
- sessão principal em esforço alto;
- três subagentes (explorer lê o código, worker edita e testa, researcher busca a documentação) em opus com esforço médio;
- advisor em fable;
- relatório do que desliga o advisor;
- regra de consultar o advisor no CLAUDE.md pessoal.

## Entregue
- **Onde fica cada parte:** o CEO escolheu o escopo misto.
  - Os agentes vão para o repo, para o time.
  - A configuração pessoal vai num script para o Mac, porque o `~/.claude` desta sessão fica num contêiner que some quando ela acaba.
- **Agentes em `.claude/agents`:** `explorer.md`, `worker.md` e `researcher.md`, todos com `model: opus` e `effort: medium`.
  - explorer: só leitura, com Read, Grep, Glob e Bash.
  - worker: todas as ferramentas, e nunca faz commit, push ou escrita em produção.
  - researcher: leitura, web e Context7.
- **Agentes que já existiam:** os 11 `nextjs-*` não fixam modelo e não cobrem esses papéis, então ficaram como estavam. Não há nada em `~/.claude/agents`.
- **`.claude/instalar-config-pessoal.sh`:**
  - acrescenta `effortLevel: "high"` e `advisorModel: "fable"` ao `~/.claude/settings.json`, com backup em `.bak`;
  - acrescenta a regra do advisor ao `~/.claude/CLAUDE.md` uma vez só, com uma marca para não repetir;
  - procura quatro variáveis no shell, nos arquivos rc e nos settings, e só relata o que achar: `CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, `DISABLE_TELEMETRY`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` e `CLAUDE_CODE_EFFORT_LEVEL`.
- **Nota de 2026-09-27:** a contagem de chaves foi corrigida, de 17 para "uma por papel (24 hoje)".

## Verificado
- **Docs (via claude-code-guide):**
  - `effort` é chave válida no frontmatter de subagente;
  - `effortLevel` e `advisorModel` são chaves válidas do settings;
  - `CLAUDE_CODE_EFFORT_LEVEL` passa por cima de todo esforço;
  - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` desliga a busca de feature flags e, com ela, o advisor.
- **Script, em HOMEs falsos:**
  - HOME vazio: cria os dois arquivos.
  - HOME com settings já existente: preserva as chaves que estavam lá.
  - Segunda rodada: não duplica a regra.
  - Variáveis no `.zshrc`, no settings e no shell são relatadas.
  - `bash -n` passa.
- **Sessão nova (`claude -p`):** enxerga os três agentes, cada um com as ferramentas certas. A listagem não mostra modelo nem esforço.

## Não feito, e por quê
- **Settings e CLAUDE.md pessoais deste contêiner:** não são o Mac do CEO e seriam perdidos. O caminho é rodar o script no Mac.
- **`CLAUDE_EFFORT=high` no ambiente do contêiner:** não é variável documentada. Não foi mexida.
