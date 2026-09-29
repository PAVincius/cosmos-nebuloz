# Memória dos agentes (`apps/memoria`)

Memória de longo prazo dos agentes da Nebuloz (Maestri, Claude Code). Roda na
máquina, em Docker, e responde por MCP em `http://127.0.0.1:8003/mcp`.

**Não é produção.** Nenhum cliente é atendido por ela, e nem o app nem o
back-office a chamam. O primeiro tenant é a própria Nebuloz (D-18). As regras
estão no [registro de decisões](../../docs/produto/registro-de-decisoes.md),
D-12 a D-18.

Começou como laboratório (`experiments/memoria-stec`), montado a partir de um
pacote externo. No pacote, todo endpoint devolvia resposta fixa, o `/health`
dizia "connected" sem checar nada, qualquer chave passava e o tenant vinha do
corpo da requisição. Aqui tudo funciona e tem testes.

## Subir

Precisa do Docker Desktop aberto. Para subir pelo Maestri, com conferência e o que fazer quando algo falha, use o
[runbook](../../docs/runbooks/memoria-dos-agentes.md).

```bash
pnpm memoria:up
```

O script (`scripts/iniciar.sh`) pode rodar quantas vezes quiser:

1. Na primeira vez, gera o `.env` com senhas aleatórias. O arquivo fica fora do git.
2. Sobe o Postgres e o serviço, cerca de 100 MB de RAM parado. Qdrant, Neo4j e MinIO só sobem se ligados (veja "Projeções opcionais").
3. Cria o tenant `nebuloz`, uma chave de escrita por papel do Maestri e a chave geral.
   Elas ficam em `~/.nebuloz/memoria`, com permissão 600, fora do repo.
4. Importa as lições do Maestri, as ADRs e o registro de decisões.

| Comando | O que faz |
|---|---|
| `pnpm memoria:up` | sobe tudo, cria a chave e importa |
| `pnpm memoria:importar` | sincroniza de novo com os arquivos |
| `pnpm memoria:test` | roda os testes de integração |
| `pnpm memoria:down` | para os contêineres; os dados ficam nos volumes |

## Ligar aos agentes

O `.maestri/setup-canvas.sh` registra o MCP sozinho, no escopo do usuário, se o `pnpm memoria:up` já tiver rodado.
Então basta subir a memória e rodar o setup do Maestri de novo. Fora do Maestri, rode uma vez por máquina;
o registro vale para todas as pastas de papel:

```bash
claude mcp add-json --scope user memoria \
  '{"type":"http","url":"http://127.0.0.1:8003/mcp","headersHelper":"sh ~/.nebuloz/memoria/cabecalho.sh"}'
```

Se o MCP já estava registrado com `cat ~/.nebuloz/memoria/cabecalhos.json`, remova antes com
`claude mcp remove --scope user memoria` e registre de novo.

**Uma chave por papel.** O `pnpm memoria:up` lê os papéis de `.maestri/setup-canvas.sh`
(`hire "Crivo" "QA"`, `recruit "Vigia" --role "Security Reviewer"`). Para cada papel, ele cria
uma chave de escrita, com o nome do agente como rótulo, e a guarda em `~/.nebuloz/memoria/chaves/<papel>.json`.
Papel novo no canvas ganha chave na próxima subida.

O Claude Code roda o `cabecalho.sh` a cada conexão, na pasta onde o agente trabalha:
- na pasta de um papel (`.maestri/roles/<id>/role.json`, no Ground ou num andar), ele manda a chave daquele papel;
- fora dela (o terminal Maestro, uma sessão avulsa), ele manda a chave geral, que grava como `maestri`.

O agente de cada memória vem da chave, e o `lembrar` não aceita outro. A auditoria mostra qual papel fez o quê,
e revogar a chave de um papel (`python -m app.cli revogar-chave <prefixo>`) não afeta os outros. A chave nunca entra
na configuração do Claude Code.

As ferramentas do MCP:

| Ferramenta | Papel | O que faz |
|---|---|---|
| `lembrar` | escrita | grava uma decisão, compromisso, lição, fato ou preferência, com origem e confiança (medido, estimado ou declarado); o agente é o da chave. Texto idêntico a uma memória vigente do mesmo projeto não é gravado de novo. Fato atômico que contradiz um vigente volta em `conflitos` |
| `buscar` | leitura | busca híbrida (vetor e texto). `valido_em` responde "o que valia em março"; `sabido_em` responde "o que sabíamos em março" |
| `listar` | leitura | lista as memórias vigentes |
| `substituir` | escrita | cria a versão nova de uma memória; a anterior fica no histórico |
| `revogar` | escrita | marca que deixou de valer, sem apagar |
| `historico` | leitura | todas as versões de uma memória, com o motivo de cada mudança |
| `relacionadas` | leitura | entidades ligadas a uma entidade no grafo; exige o perfil `grafo` |

Apagar não existe no MCP, de propósito: apagamento é decisão de gente. Ele se
faz pela API de governança, com chave admin (`POST /api/v1/governance/erasure`).

## O que a importação traz

O importador é `app/importar.py`, e cada item guarda a origem.

| Fonte | Vira | Origem |
|---|---|---|
| `.maestri/memoria/*.md` | uma lição por linha | `maestri-memoria`, arquivo#hash da linha |
| `docs/adr/NNNN-*.md` | decisão: título, status e a seção "Decisão" | `adr`, caminho do arquivo |
| `docs/produto/registro-de-decisoes.md` | decisão, uma por D-NN, com o dono | `registro-de-decisoes`, arquivo#D-NN |

Rodar de novo sincroniza:
- texto igual não mexe;
- texto mudado vira versão nova, com o motivo "a fonte mudou";
- lição riscada com `~~` no Maestri vira memória revogada.

Os arquivos continuam sendo a fonte (D-12). A memória é o índice que os agentes
consultam.

## Por dentro

```
Postgres + pgvector  ← sistema de registro (fonte da verdade)
   │  RLS forçada por tenant · papel da API sem superuser
   │  memória bitemporal, imutável, com auditoria só de INSERT
   ├──► Qdrant  (vetor, uma coleção por tenant, só a versão vigente)
   ├──► Neo4j   (entidades e relações, chave inclui o tenant)
   └──► MinIO   (um JSON por versão: a camada fria)
```

### Projeções opcionais

Por padrão, tudo roda no Postgres: a busca vetorial e por texto também (D-16, Postgres até medir o limite).
Cada projeção é um perfil do compose, ligado no `apps/memoria/.env`:

| Perfil | Serviço | Para quê | RAM medida, parado |
|---|---|---|---|
| (nenhum) | Postgres + serviço | tudo o que a memória faz, menos `relacionadas` | ~100 MB |
| `vetor` | Qdrant | candidatos da busca vetorial, quando o volume pedir | ~30–450 MB |
| `grafo` | Neo4j | a ferramenta `relacionadas` | ~450–700 MB |
| `arquivo` | MinIO | um JSON por versão (a camada fria) | ~60 MB |

Para ligar, ponha `COMPOSE_PROFILES=vetor,grafo,arquivo` (ou só os que quiser) no `.env` e rode `pnpm memoria:up`
de novo. Ele sobe o que faltar e refaz as projeções a partir do Postgres (`python -m app.cli reconstruir nebuloz`).
Para desligar, tire o perfil e rode `docker compose stop <serviço>`; os dados ficam no volume.

O Mac de 24 GB já ficou sem memória com os agentes abertos (README do Vigilante). Por isso o padrão é o mínimo.

- **O Postgres é a fonte.** As projeções ligadas se refazem dele
  (`POST /api/v1/maintenance/rebuild`). Toda resposta relê o Postgres, então
  projeção atrasada nunca devolve memória apagada ou substituída (D-12).
- **Dois tempos por fato.** `valid_from` e `valid_to` dizem quando o fato valeu
  no mundo. `tx_from` e `tx_to` dizem quando o sistema acreditou nele.
- **Memória não se edita.** Uma versão nova fecha a anterior. A trigger bloqueia
  UPDATE e DELETE fora de três casos: fechar a versão, apagar o conteúdo e
  trocar o vetor. A regra vale até para o superusuário.
- **Apagamento de verdade.** O apagamento zera texto, entidades, relações,
  marcadores e vetor em todas as versões, e sai do Qdrant, do Neo4j e do MinIO.
  Apagar por origem é o caminho para revogar consentimento e para o pedido de
  titular da LGPD (D-14, D-15). A auditoria registra o pedido sem o texto.
- **O tenant vem da chave.** A chave é emitida pela CLI e guardada só como hash.
  Os papéis são leitura, escrita e admin. O MCP usa a mesma chave, o mesmo
  tenant e o mesmo papel da API HTTP. O `/mcp` aceita só os hosts `127.0.0.1`,
  `localhost` e `[::1]`, contra DNS rebinding.

A API HTTP completa, com Swagger, fica em `http://127.0.0.1:8003/docs`.
Embeddings semânticos locais saem do perfil `ollama` (instruções no
`docker-compose.yml`). Sem ele, o serviço usa um embedder por hash de termos:
determinístico e sem modelo, mas sem sinônimo. A busca por texto em português
compensa parte disso.

## Por que não roda na Vercel

A Vercel roda funções. Este serviço precisa de quatro bancos com estado (Postgres, Qdrant, Neo4j e MinIO) e de um
processo contínuo. Para servir fora da máquina, o caminho é um host de contêiner (Fly, Railway, uma VM) com os mesmos
`docker-compose.yml` e `.env`, atrás de TLS. Antes disso vêm as decisões D-14 e D-10.

## O que ficou de fora do pacote original, e por quê

| Cortado | Motivo |
|---|---|
| Mem0 e Cognee | Seriam três camadas de memória para o mesmo trabalho. Este serviço é a camada. |
| LangGraph | O pacote trazia só um `requirements.txt`. E a D-07 começa por um agente com ferramentas; multiagente só depois de uma avaliação que prove a necessidade. |
| Consolidação e deduplicação por LLM | Um resumo que reescreve a memória perde a origem (D-16). O que entra depois é resumo por período, com link a cada fonte. |
| Context Layer (Snowflake, SAP, Salesforce…) | Conector de sistema do cliente é outro projeto. |
| Redis, UIs, o "MCP" do Mem0 | Nenhum tinha uso. O MCP daqui é o Model Context Protocol, em `/mcp`. |
| Nota de confiança 0–1 | O mapa de fronteiras proíbe uma segunda escala. |
| Senhas padrão no compose | Toda senha é obrigatória no `.env`, e as portas só escutam em 127.0.0.1. |

Do segundo pacote (2026-09-28: `mcp_main.py` de fatos atômicos, `nebulus-stack.md`), entraram duas ideias:
- **o conflito de fato atômico:** mesmo sujeito e predicado, com outro objeto. Ele é apontado, não resolvido, porque
  a D-13 manda manter a contradição viva e datada;
- **a recusa de duplicata.**

Ficaram de fora, pelos motivos da tabela:
- o armazenamento em dicionário;
- o tenant vindo do corpo e a chave não validada;
- o `update` capaz de trocar o tenant e o `delete` sem checar o tenant;
- o Cognee como motor, o LangGraph Server e as senhas padrão.

## Testar

```bash
pnpm memoria:test
```

São 37 testes de integração contra os serviços reais. Eles usam tenants
temporários e os purgam no fim, sem tocar no tenant `nebuloz`. Os testes cobrem:
- **segurança:** chave, papel, isolamento de tenant, RLS e imutabilidade;
- **memória:** bitemporal, revogação, busca, apagamento por origem e retenção;
- **projeções:** falha visível, isolamento e `rebuild`;
- **MCP:** chave, host, papel, agente pela chave, isolamento, duplicata, conflito de fato atômico e ausência de apagamento;
- **importador:** sincronização, versão nova e lição riscada.

Nenhum script do pacote se chama `test`, `build` ou `dev`. Assim, `pnpm test`,
`pnpm build`, `pnpm dev` e o hook de pre-push não passam a exigir Docker.

## Limites conhecidos

- **Sem índice vetorial.** A coluna `vector` não tem dimensão fixa, para aceitar
  a troca de modelo. A busca no Postgres compara com todos os trechos do tenant;
  com o Qdrant ligado, os candidatos vêm dele. O próximo passo é HNSW por
  modelo, medido antes e depois (D-16).
- **Projeção síncrona.** Uma falha vira pendência, e o `rebuild` refaz. Não há fila.
- **Uma camada só.** Ainda faltam a camada morna (resumo por período) e a
  movimentação para a camada fria por idade.
- **A chave por papel separa papéis, mas não isola um do outro.** Todos rodam com o mesmo usuário do sistema, então
  um agente que quisesse ler a chave de outro papel em `~/.nebuloz/memoria/chaves` conseguiria. A chave evita
  erro de atribuição e dá auditoria por papel; contra um agente mal-intencionado, não protege.
- **Nada liga isto ao app.** Os índices do app (`PIKnowledgeVector`) continuam
  onde estão, com os problemas de apagamento descritos na D-14.

## O que já aprendemos

**Qdrant 1.19 não abre os dados do 1.12.** Na subida, ele entrou em pânico ao
ler o formato antigo do segmento. Como o Qdrant aqui é só projeção, bastou
apagar o volume e rodar `rebuild`. Em décadas, a troca de versão vai acontecer
muitas vezes. Se o Qdrant fosse a fonte de verdade, teria exigido migração em
cadeia, versão por versão.
