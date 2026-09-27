#!/usr/bin/env bash
# Abre (ou leva de volta à página inicial) a sessão do agent-browser de uma aplicação, na porta de vídeo
# que o portal dela no canvas escuta. Sessão = "<app>-<ambiente>"; depois é só usar `--session` nela.
#   bash .maestri/portal/abrir.sh meridian            # local (padrão)
#   bash .maestri/portal/abrir.sh backoffice prod     # produção: só leitura (ver README)
set -euo pipefail
app="${1:-}"
amb="${2:-local}"
case "$app" in
  backoffice) n=1 ;; meridian) n=2 ;; cosmos) n=3 ;; scaffold) n=4 ;; signal) n=5 ;; charter) n=6 ;;
  *) echo "uso: abrir.sh backoffice|meridian|cosmos|scaffold|signal|charter [local|prod]" >&2; exit 2 ;;
esac
case "$amb" in
  local) porta=$((9300 + n)); base="http://localhost:3012"; bo="http://localhost:3013" ;;
  prod)  porta=$((9400 + n)); base="https://app.nebuloz.ai"; bo="https://backoffice.nebuloz.ai" ;;
  *) echo "ambiente: local|prod" >&2; exit 2 ;;
esac
if [ "$app" = backoffice ]; then url="$bo"; else url="$base/$app"; fi
# A porta só vale quando a sessão nasce; sessão já aberta mantém a dela (a mesma, se nasceu por aqui).
AGENT_BROWSER_STREAM_PORT="$porta" exec agent-browser --session "$app-$amb" open "$url"
