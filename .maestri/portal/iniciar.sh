#!/usr/bin/env bash
# Terminal "Navegador" do Maestri: serve os portais das aplicações e o painel do agent-browser enquanto
# estiver aberto; ao fechar, derruba os dois. As sessões abrem sob demanda (cada uma é um Chrome):
#   bash .maestri/portal/abrir.sh <app> [local|prod]
set -uo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
PORTA=4849

command -v agent-browser >/dev/null || { echo "agent-browser não encontrado (ver .maestri/portal/README.md)"; exit 1; }
agent-browser dashboard start >/dev/null
python3 -m http.server "$PORTA" --bind 127.0.0.1 --directory "$AQUI" >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null; agent-browser dashboard stop >/dev/null 2>&1' EXIT INT TERM

echo "Portais: http://localhost:$PORTA/ver.html  ·  painel: http://localhost:4848"
echo "Abrir uma aplicação: bash $AQUI/abrir.sh <backoffice|meridian|cosmos|scaffold|signal|charter> [local|prod]"
wait "$SERVIDOR"
