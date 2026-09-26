# Vigilante

Terminal do Maestri que lê os registros da equipe de agentes e sugere evoluções, com um modelo local.
Roda enquanto o terminal estiver aberto; nada sai da máquina; nada é aplicado sozinho.

## O que ele lê (`coletar.mjs`)
- Vereditos da semana (`.maestri/aprendizado.jsonl`, via `registrar.mjs resumo`).
- Concessões ativas (`.maestri/concessoes.jsonl`).
- Commits das últimas 24 h no Ground e em cada andar.
- Erros de ferramenta por agente nas últimas 24 h, das sessões do Claude Code de cada pasta de papel
  (`~/.claude/projects/<pasta do papel>`): só contagem e as duas primeiras linhas de cada erro.

A cada 30 min (`VIGILANTE_INTERVALO_MIN`), e só quando o resumo mudou, pergunta ao modelo e grava em
`.maestri/sugestoes.md` e na nota "Sugestões do Vigilante". A Morgana leva à retro semanal.

## Pilha
`iniciar.sh` → `mlx_lm.server` (:8080, modelo em `VIGILANTE_MODELO_DIR`) → LiteLLM (:4000, `litellm.yaml`,
nome estável `local`) → `vigilante.mjs`. Fechar o terminal derruba os dois.

Modelo: Qwen3-4B-Instruct-2507 MLX 4 bits (~2,3 GB). Medido em 2026-09-26 num M4 Pro de 24 GB com os agentes
abertos: ~40 tok/s, ~12 s por análise. O gpt-oss-20b (11 GB) não coube: swap cheia e requisição falhando.

## Instalar numa máquina nova
```bash
# modelo (baixa ~2,3 GB)
python3 -c "from huggingface_hub import snapshot_download as s; s('mlx-community/Qwen3-4B-Instruct-2507-4bit', local_dir='$HOME/.lmstudio/models/mlx-community/Qwen3-4B-Instruct-2507-4bit')"
# LiteLLM com o modo proxy, num ambiente próprio
mkdir -p ~/.nebuloz/litellm && cd ~/.nebuloz/litellm && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python "litellm[proxy]"
# mlx_lm.server vem do Homebrew: brew install mlx-lm
```

## Testar sem o Maestri
```bash
VIGILANTE_WS=~/web-office/my/cosmos-nebuloz bash .maestri/vigilante/iniciar.sh --uma-vez
```
