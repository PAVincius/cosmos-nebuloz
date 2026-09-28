#!/usr/bin/env bash
# Terminal Vigilante no Maestri: sobe o modelo local e o LiteLLM enquanto este terminal viver.
# Fechou o terminal (ou o Maestri), os dois caem junto — a memória só fica ocupada com ele aberto.
# Modelo padrão: Qwen3-4B-Instruct MLX 4 bits (~2,3 GB, ~40 tok/s no M4 Pro). O gpt-oss-20b não cabe
# com 24 GB e os agentes abertos (medido em 2026-09-26: swap cheia, requisição falhando).
set -uo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
MODELO_DIR="${VIGILANTE_MODELO_DIR:-$HOME/.lmstudio/models/mlx-community/Qwen3-4B-Instruct-2507-4bit}"
LITELLM="$HOME/.nebuloz/litellm/.venv/bin/litellm"
LOGS="$HOME/.nebuloz/vigilante"
mkdir -p "$LOGS"

[ -d "$MODELO_DIR" ] || { echo "modelo não encontrado: $MODELO_DIR"; exit 1; }
[ -x "$LITELLM" ] || { echo "LiteLLM não encontrado: $LITELLM (ver .maestri/vigilante/README.md)"; exit 1; }

pids=()
parar() { kill "${pids[@]}" 2>/dev/null; wait 2>/dev/null; }
trap parar EXIT INT TERM HUP

# Desktop da Nebuloz no ar? Usa ele e deixa a memória do Mac livre. Senão, sobe o modelo MLX aqui.
if [ -n "${LLM_LOCAL_BASE:-}" ] && curl -sf -m 3 "${LLM_LOCAL_BASE%/v1}/health" >/dev/null; then
  export VIGILANTE_MODELO="${VIGILANTE_MODELO:-desktop}"
  echo "Vigilante: modelo do desktop (${LLM_LOCAL_BASE})."
else
  mlx_lm.server --model "$MODELO_DIR" --host 127.0.0.1 --port 8080 >"$LOGS/modelo.log" 2>&1 &
  pids+=($!)
fi
"$LITELLM" --config "$AQUI/litellm.yaml" --host 127.0.0.1 --port 4000 >"$LOGS/litellm.log" 2>&1 &
pids+=($!)

echo "Vigilante: LiteLLM em :4000 (modelo ${VIGILANTE_MODELO:-local}). Logs em $LOGS."
node "$AQUI/vigilante.mjs" "$@"
