# Laboratório de memória de longo prazo (STEC)

**Não é produção.** Nada aqui atende cliente, e nada no app ou no back-office
chama este serviço. É onde se mede a memória empresarial antes de decidir o que
vai para a suíte. A ordem de execução e as regras estão no
[registro de decisões](../../docs/produto/registro-de-decisoes.md), D-12 a D-18.

Veio de um pacote externo: um `docker-compose` e o esqueleto de um Memory
Control Plane em FastAPI. No esqueleto, todo endpoint devolvia resposta fixa, o
`/health` dizia "connected" sem checar nada, qualquer chave de API passava e o
tenant vinha do corpo da requisição. Aqui ele funciona e tem testes.

## O que tem

```
Postgres + pgvector  ← sistema de registro (fonte da verdade)
   │  RLS forçada por tenant · papel da API sem superuser
   │  memória bitemporal, imutável, com auditoria só de INSERT
   ├──► Qdrant  (vetor, uma coleção por tenant, só a versão vigente)
   ├──► Neo4j   (entidades e relações, chave inclui o tenant)
   └──► MinIO   (um JSON por versão: a camada fria)
```

- **O Postgres é a fonte.** As três projeções se refazem dele
  (`POST /api/v1/maintenance/rebuild`). Toda resposta relê o Postgres, então
  projeção atrasada nunca devolve memória apagada ou substituída (D-12).
- **Dois tempos por fato.** `valid_from`/`valid_to` dizem quando o fato valeu
  no mundo. `tx_from`/`tx_to` dizem quando o sistema acreditou nele. Isso
  responde duas perguntas: "o que valia em março?" (`valid_at`) e "o que
  sabíamos em março?" (`known_at`).
- **Memória não se edita.** Uma versão nova fecha a anterior. A trigger bloqueia
  UPDATE e DELETE fora de três casos: fechar a versão, apagar o conteúdo e
  trocar o vetor. A regra vale até para o superusuário.
- **Decisão revogada continua consultável.** `invalidate` fecha a validade sem
  apagar. A contradição fica viva e datada (D-13).
- **Apagamento de verdade.** O apagamento zera texto, entidades, relações,
  marcadores e vetor em todas as versões, e sai do Qdrant, do Neo4j e do MinIO.
  `POST /api/v1/governance/erasure` apaga tudo que veio de uma origem: é o
  caminho para revogar consentimento de reunião e para o pedido de titular da
  LGPD (D-14, D-15). A auditoria registra o pedido sem o texto e sem o
  identificador da origem em claro.
- **Confiança na escala da suíte:** medido, estimado ou declarado. Uma nota
  decimal é recusada (mapa de fronteiras, entidade 5).
- **O tenant vem da chave.** A chave de API é emitida pela CLI e guardada só
  como hash. Os papéis são leitura, escrita e admin. Um `tenant_id` no corpo que
  diverge da chave é recusado.

## O que ficou de fora do pacote original, e por quê

| Cortado | Motivo |
|---|---|
| Mem0 e Cognee | Seriam três camadas de memória para o mesmo trabalho. O Memory Control Plane é a camada. |
| LangGraph | O pacote trazia só um `requirements.txt`. E a D-07 começa por um agente com ferramentas; multiagente só depois de uma avaliação que prove a necessidade. |
| Consolidação e deduplicação por LLM | Um resumo que reescreve a memória perde a origem (D-16). O que entra depois é resumo por período, com link a cada fonte. |
| Context Layer (Snowflake, SAP, Salesforce…) | Conector de sistema do cliente é outro projeto. |
| Redis, UIs, "MCP" do Mem0 | Nenhum tem uso aqui. E a sigla "MCP" já significa Model Context Protocol na suíte. |
| Nota de confiança 0–1 | O mapa de fronteiras proíbe uma segunda escala. |
| Senhas padrão no compose | Toda senha é obrigatória no `.env`, e as portas só escutam em 127.0.0.1. |

## Subir

```bash
cp .env.example .env          # troque todas as senhas
docker compose up -d --build
docker compose exec memory-control-plane python -m app.cli criar-tenant nebuloz "Nebuloz"
docker compose exec memory-control-plane python -m app.cli criar-chave nebuloz agente-pesquisa escrita
# a chave aparece uma vez; o banco guarda só o hash
curl -s http://127.0.0.1:8003/health
```

A documentação da API fica em `http://127.0.0.1:8003/docs`. Embeddings
semânticos locais saem do perfil `ollama` (instruções no `docker-compose.yml`).
Sem ele, o serviço usa um embedder por hash de termos: é determinístico e roda
sem modelo, mas não entende sinônimo.

Onde a imagem oficial do MinIO (`quay.io`) não baixar, use
`MINIO_IMAGE=chainguard/minio:latest` no `.env`.

## Testar

Os testes são de integração: rodam contra os serviços de verdade.

```bash
docker compose up -d postgres qdrant neo4j minio
set -a; . ./.env; set +a
cd memory-control-plane
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
export STEC_ADMIN_DATABASE_URL=postgresql://stec_admin:$POSTGRES_PASSWORD@127.0.0.1:5433/memoria \
       STEC_DATABASE_URL=postgresql://stec_app:$STEC_APP_DB_PASSWORD@127.0.0.1:5433/memoria \
       STEC_APP_DB_PASSWORD=$STEC_APP_DB_PASSWORD \
       STEC_QDRANT_URL=http://127.0.0.1:6333 \
       STEC_NEO4J_URL=bolt://127.0.0.1:7687 STEC_NEO4J_PASSWORD=$NEO4J_PASSWORD \
       STEC_MINIO_ENDPOINT=127.0.0.1:9000 STEC_MINIO_ACCESS_KEY=$MINIO_ROOT_USER STEC_MINIO_SECRET_KEY=$MINIO_ROOT_PASSWORD
.venv/bin/pytest
```

São 23 testes em três grupos.

**Segurança:**
- chave ausente ou inválida;
- papel de leitura tentando escrever;
- tenant do corpo diferente do tenant da chave;
- escala de confiança;
- tenant B sem enxergar nada de A (listagem, busca, histórico, nova versão);
- papel da API sem tenant sem enxergar linha nenhuma;
- papel da API sem conseguir gravar em outro tenant nem ler as chaves;
- imutabilidade valendo até para o superusuário.

**Memória:**
- o que se sabia antes de uma substituição;
- decisão revogada ainda consultável na data em que valia;
- busca híbrida;
- apagamento por origem sem deixar rastro de texto na auditoria;
- retenção;
- memória apagada sem receber versão nova.

**Projeções:**
- nenhuma falha silenciosa;
- Qdrant por tenant;
- grafo por tenant;
- MinIO com todas as versões;
- `rebuild` refazendo o que sumiu.

## Limites conhecidos

- **Sem índice vetorial.** A coluna `vector` não tem dimensão fixa, para
  aceitar a troca de modelo, então a busca no Postgres compara com todos os
  trechos do tenant. Com o Qdrant ligado, os candidatos vêm dele. O próximo
  passo de escala é HNSW por modelo, medido antes e depois (D-16).
- **Projeção síncrona.** Uma falha vira pendência, e o `rebuild` refaz. Não há
  fila; para um laboratório, isso basta.
- **Uma camada só.** Ainda não existem a camada morna (resumo por período) nem
  a movimentação para a camada fria por idade.
- **Nada liga isto ao app.** Os índices do app (`PIKnowledgeVector`) continuam
  onde estão, com os problemas de apagamento descritos na D-14.

## O que o laboratório já ensinou

**Qdrant 1.19 não abre os dados do 1.12.** Na subida ele entrou em pânico ao
ler o formato antigo do segmento. Como o Qdrant aqui é só projeção, bastou
apagar o volume e rodar `rebuild`. Em décadas, a troca de versão vai acontecer
muitas vezes. Um armazém que é fonte de verdade teria exigido migração em
cadeia, versão por versão.
