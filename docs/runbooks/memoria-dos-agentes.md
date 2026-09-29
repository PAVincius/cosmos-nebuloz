# Runbook: subir a memória dos agentes e ligar ao Maestri

A memória de longo prazo dos agentes (`apps/memoria`) roda nesta máquina, em Docker, com portas só em
127.0.0.1. Não é produção. Os papéis do Maestri a acessam por MCP, cada um com a própria chave. O desenho e as
ferramentas estão em [`apps/memoria/README.md`](../../apps/memoria/README.md).

Tudo abaixo roda no Ground, na raiz do repositório, pelo terminal Maestro. Quem executa é a Morgana.

## Quando rodar

- **Na primeira vez** numa máquina.
- **Depois de um `git pull`** que mexa em `apps/memoria` ou no `.maestri/setup-canvas.sh`.
- **Depois de recrutar um papel novo:** a chave dele nasce no `pnpm memoria:up`, e o setup registra o MCP.
- **Depois de reiniciar a máquina,** se a memória não subir sozinha: os contêineres têm `restart: unless-stopped`,
  mas dependem do Docker Desktop aberto.

Tudo é idempotente. Rodar de novo não duplica chave, não reimporta o que já está igual e não apaga dado.

## Briefing para a Morgana

Cole no terminal Maestro:

```text
Morgana, tarefa: subir a memória de longo prazo dos agentes (apps/memoria) nesta máquina e ligá-la aos papéis do Maestri.
Não é produção: roda só aqui, em Docker, com portas em 127.0.0.1. Guia: docs/runbooks/memoria-dos-agentes.md.

Antes de começar (se algo falhar, pare e me diga o quê):
1. Você está no Ground, na raiz do repo, na main atualizada: `git switch main && git pull --ff-only`.
   Tem alteração não commitada? Pare e me mostre o `git status`.
2. O Docker está de pé: `docker info` responde. Se não responder, peça para eu abrir o Docker Desktop.
3. As portas estão livres ou já são da memória: 5433 e 8003 (mais 6333, 7474, 7687, 9000 e 9001 se houver projeção ligada no .env)
   (`lsof -nP -iTCP:<porta> -sTCP:LISTEN`). Se alguma estiver ocupada por outro processo, me diga qual e por quem.
   Não mate processo nenhum.

Passos:
4. `pnpm memoria:up`. Na primeira vez ele baixa cerca de 2 GB de imagens e leva alguns minutos.
   Espere, nesta ordem: "chaves por papel em …: N" (um por papel do canvas: 24 em 2026-09-28, mais quando
   entra papel), uma linha "… novas, …" da importação e "Memória no ar".
5. `bash .maestri/setup-canvas.sh`. Espere a linha "+ MCP memoria registrado".
   Se aparecer "! MCP memoria pulado" ou "não registrou", pare e me mande a saída.
6. `claude mcp get memoria`. Deve mostrar http://127.0.0.1:8003/mcp com o headersHelper `sh ~/.nebuloz/memoria/cabecalho.sh`.

Conferência (só conta como pronto depois disso):
7. `curl -s http://127.0.0.1:8003/health` responde "status":"ok" e postgres "ok". Qdrant, neo4j e minio aparecem
   "desligado" no padrão, ou "ok" se ligados no `.env` (COMPOSE_PROFILES).
8. `ls ~/.nebuloz/memoria/chaves | wc -l` dá o mesmo N do passo 4.
9. Sua sessão abriu antes do registro e não vai enxergar a memória. Peça ao Crivo, numa sessão nova, que use a
   ferramenta buscar da memória para achar o que foi decidido sobre a memória ser fonte da verdade. Ele deve citar
   a D-12 e o memory_id.

Regras:
- Nunca mostre, copie ou cole uma chave. O conteúdo de ~/.nebuloz/memoria e o apps/memoria/.env não vão para
  o chat, para o git nem para a memória.
- Não rode purgar-tenant, revogar-chave nem apagamento, e não apague volumes do Docker.
- Não mexa no docker-compose.yml, no Dockerfile nem no código para "fazer funcionar". Se quebrar, pare e reporte
  o erro exato e as últimas linhas de `docker compose -f apps/memoria/docker-compose.yml logs --tail 50 memoria`.

Resposta, em até 8 linhas:
- o que passou em cada um dos passos 1 a 9;
- o que o Crivo respondeu;
- qualquer desvio do esperado, com a saída.
```

## Quando algo sai do esperado

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| "O Docker não está rodando" | Docker Desktop fechado | Abrir o Docker Desktop e rodar `pnpm memoria:up` de novo. |
| Porta ocupada no passo 3 | Outro serviço local na mesma porta | Decisão do CEO: parar o outro serviço, ou mudar a porta da API com `MEMORIA_PORTA`. As portas dos bancos são fixas no `docker-compose.yml`. O setup do canvas registra o MCP sempre em 8003: com outra porta, o registro é à mão, com a URL que o `pnpm memoria:up` imprime no fim. |
| "O serviço não respondeu" no passo 4 | Imagem ainda baixando, ou falha na subida | Ver `docker compose -f apps/memoria/docker-compose.yml ps` e os logs do serviço `memoria`. |
| `/health` com "degradado" | Uma projeção ligada (Qdrant, Neo4j ou MinIO) está fora; o Postgres está bem | A memória continua respondendo, porque o Postgres é a fonte. Depois que o serviço voltar, `pnpm memoria:up` refaz as projeções. |
| `relacionadas` responde "projeção de grafo desligada" | O perfil `grafo` está desligado (padrão) | Esperado. Para usar, ligue `grafo` no `.env` (README, "Projeções opcionais"). |
| "! MCP memoria pulado" no passo 5 | `pnpm memoria:up` não chegou ao fim | Rodar o passo 4 até "Memória no ar" e repetir o passo 5. |
| O Crivo não acha as ferramentas | A sessão dele abriu antes do registro | Abrir uma sessão nova para o Crivo. |
| O Crivo acha as ferramentas, mas recebe "chave ausente, inválida ou revogada" | A chave do papel falta em `~/.nebuloz/memoria/chaves` | Rodar `pnpm memoria:up` de novo; ele cria a chave que faltar. |
| A memória aparece com o agente `maestri` em vez do papel | A sessão não rodou na pasta do papel (`.maestri/roles/<id>`) | Esperado para o terminal Maestro e para sessões avulsas: é a chave geral. |

## O que o runbook não cobre

- **Levar a memória para fora da máquina.** Precisa de um host de contêiner com TLS, e as decisões D-10 e D-14
  vêm antes (registro de decisões).
- **Apagamento por origem e pedido de titular.** É pela API de governança, com chave admin, e o CEO decide caso a
  caso (`apps/memoria/README.md`).
