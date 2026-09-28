#!/bin/sh
# headersHelper do MCP "memoria": o Claude Code roda isto a cada conexão, na pasta onde o agente trabalha.
# Na pasta de um papel do Maestri (.maestri/roles/<id>/role.json), devolve a chave daquele papel; fora dela,
# a chave geral. Assim cada agente grava com o próprio nome e a auditoria mostra quem fez o quê.
# O iniciar.sh copia este arquivo para ~/.nebuloz/memoria/cabecalho.sh.
CASA="${MEMORIA_HOME:-$HOME/.nebuloz/memoria}"
arquivo="$CASA/cabecalhos.json"
if [ -f "$PWD/role.json" ]; then
  papel=$(sed -n 's/^ *"name" *: *"\([^"]*\)".*/\1/p' "$PWD/role.json" | head -n 1)
  slug=$(printf '%s' "$papel" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  [ -n "$slug" ] && [ -f "$CASA/chaves/$slug.json" ] && arquivo="$CASA/chaves/$slug.json"
fi
if [ -f "$arquivo" ]; then cat "$arquivo"; else echo '{}'; fi
