# 2026-09-27 — Memória dos agentes em `apps/memoria`

## Pedido
O CEO pediu para levar o laboratório de memória (`experiments/memoria-stec`) ao repo como serviço do monorepo, com Docker
Compose, testado, rodando, e acessível aos agentes do Maestri.

## Entregue
- `experiments/memoria-stec` → `apps/memoria` (serviço em `servico/`, compose com projeto `nebuloz-memoria`, serviço
  `memoria`, imagem `nebuloz/memoria:local`). Pacote pnpm `memoria` sem `build`/`test`/`dev`: turbo, `pnpm test` e o
  pre-push não passam a exigir Docker. Lockfile ganhou só `apps/memoria: {}`.
- MCP em `/mcp` no mesmo processo (SDK `mcp` 2.2.0, `MCPServer`, HTTP sem sessão, JSON). Mesma chave, tenant e papel da
  API; `_ExigeChave` recusa sem chave antes do protocolo; hosts restritos a 127.0.0.1/localhost/[::1]. Ferramentas:
  lembrar, buscar, listar, substituir, revogar, historico, relacionadas. Sem apagar, de propósito.
- `app/importar.py` + `cli importar`: lições do Maestri, ADRs e registro de decisões, sincronizando (igual não mexe,
  mudou vira versão, riscada vira revogada). Fontes montadas só leitura em `/fontes`.
- `scripts/iniciar.sh` (`pnpm memoria:up`): gera `.env`, sobe, cria tenant `nebuloz` e chave do Maestri em
  `~/.nebuloz/memoria/cabecalhos.json` (600), importa. `scripts/testar.sh` (`pnpm memoria:test`).
- README reescrito; registro de decisões (D-13, D-16, D-18 e ordem de execução) apontando para `apps/memoria`;
  CLAUDE.md com a linha "Agent memory".

## Verificado
- 31 testes de integração passando contra Postgres, Qdrant, Neo4j e MinIO reais (7 novos do MCP, 1 do importador).
- ruff check e format limpos.
- Subida real pelo script: 36 itens importados (1 lição, 17 ADRs, 18 decisões); segunda rodada: 36 iguais.
- Ponta a ponta com o Claude Code (`claude -p --mcp-config`, sem configuração persistente): o agente achou a D-12 e a
  lição de produção pela busca e gravou uma lição como Crivo; conferido pela API (agente, origem, `mcp:maestri`). A
  chave do Maestri leva 403 ao tentar apagar.

## Não feito, e por quê
- **Registro do MCP no Claude Code do CEO.** O script ia rodar `claude mcp add-json --scope user`; o modo automático
  bloqueou como automodificação. O comando fica no fim do script e no README, para o CEO rodar uma vez.
- **Vercel.** Não roda aqui: são quatro bancos com estado e um processo contínuo. README diz o caminho (host de contêiner).
- **Imagem neste sandbox.** `python:3.11-slim` deu 429 no Docker Hub, e o pip precisa do CA do proxy; a imagem foi
  montada numa cópia fora do repo, sobre a imagem anterior. O `Dockerfile` versionado é o padrão.
- **Stack rodando:** está no contêiner desta sessão, que é efêmero e não é alcançável do Mac. No Mac: `pnpm memoria:up`.

## 2026-09-28 — Chave por papel e o segundo pacote
- **Chave por papel:** `iniciar.sh` lê `hire`/`recruit` de `.maestri/setup-canvas.sh` e cria uma chave por papel (17 naquele dia, 24 em 2026-09-29; rótulo = agente) em
  `~/.nebuloz/memoria/chaves/<papel>.json`. `scripts/cabecalho.sh` (headersHelper) escolhe pela `role.json` da pasta.
  Verificado antes que o Claude Code roda o headersHelper na pasta do agente. `lembrar` perdeu o parâmetro `agente`.
  Bug achado no caminho: `docker compose exec` consumia o stdin do laço e só a primeira chave saía.
- **E2E:** agente numa pasta de papel QA gravou como Crivo; fora de pasta de papel, como `maestri`.
- **Segundo pacote do CEO** (`mcp_main.py`, `nebulus-stack.md`, compose e main.py repetidos): não substitui o serviço
  (dicionário em memória, tenant do corpo, chave não validada, update troca tenant, delete sem tenant). Entraram
  duplicata e conflito de fato atômico (apontado, não resolvido, D-13). 34 testes passando.
