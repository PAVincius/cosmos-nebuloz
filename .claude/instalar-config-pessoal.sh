#!/usr/bin/env bash
# Configuração pessoal do Claude Code: roda uma vez no seu Mac, fora do repo.
#
#   bash .claude/instalar-config-pessoal.sh
#
# O que faz:
#   1. Em ~/.claude/settings.json, define effortLevel "high" e advisorModel "fable". O resto do arquivo fica igual,
#      e o original vai para settings.json.bak.
#   2. Em ~/.claude/CLAUDE.md, acrescenta a regra de consultar o advisor, uma vez só.
#   3. Procura o que desliga o advisor ou fixa o esforço dos subagentes, e só relata: não muda nada.
#
# Os subagentes explorer, worker e researcher (opus, esforço médio) moram no repo, em .claude/agents.
# Idempotente: rodar de novo não duplica nada.
set -euo pipefail

DIR="$HOME/.claude"
CONFIG="$DIR/settings.json"
REGRAS="$DIR/CLAUDE.md"
mkdir -p "$DIR"

# 1. settings.json
[ -f "$CONFIG" ] && cp "$CONFIG" "$CONFIG.bak"
node - "$CONFIG" <<'JS'
const fs = require("node:fs");
const arquivo = process.argv[2];
const atual = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")) : {};
const novo = { ...atual, effortLevel: "high", advisorModel: "fable" };
fs.writeFileSync(arquivo, `${JSON.stringify(novo, null, 2)}\n`);
JS
echo "+ $CONFIG: effortLevel high, advisorModel fable"

# 2. CLAUDE.md
MARCA="<!-- regra-advisor -->"
if grep -qF "$MARCA" "$REGRAS" 2>/dev/null; then
  echo "= $REGRAS: regra do advisor já estava lá"
else
  {
    [ -s "$REGRAS" ] && echo
    echo "$MARCA"
    echo "- Consulte o advisor antes de um plano grande, quando um erro se repetir e antes de dar uma tarefa longa como concluída."
  } >>"$REGRAS"
  echo "+ $REGRAS: regra do advisor acrescentada"
fi

# 3. Só relata
VARIAVEIS="CLAUDE_CODE_DISABLE_ADVISOR_TOOL DISABLE_TELEMETRY CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC CLAUDE_CODE_EFFORT_LEVEL"
achou=0
for v in $VARIAVEIS; do
  if [ -n "${!v:-}" ]; then
    echo "! $v=${!v} neste shell"
    achou=1
  fi
done
for f in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.zshenv" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile" \
  "$CONFIG" "$DIR/settings.local.json"; do
  [ -f "$f" ] || continue
  for v in $VARIAVEIS; do
    if grep -qw "$v" "$f"; then
      echo "! $v aparece em $f"
      achou=1
    fi
  done
done
if [ "$achou" = 1 ]; then
  echo "  Nada foi mudado. CLAUDE_CODE_DISABLE_ADVISOR_TOOL e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC desligam o advisor;"
  echo "  DISABLE_TELEMETRY desliga a telemetria; CLAUDE_CODE_EFFORT_LEVEL passa por cima do esforço dos subagentes."
else
  echo "= nada desligando o advisor nem fixando o esforço"
fi
echo "Abra uma sessão nova do Claude Code para valer."
