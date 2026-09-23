# Maestri — fundação de conhecimento por produto

**Data**: 2026-09-03
**Status**: aprovado em conversa; aguarda plano de implementação
**Sub-projeto**: 1 de 5 (com o 5, rotinas, incorporado — ver §1)

## 1. Por que este é o primeiro

O objetivo do programa é um sistema de agentes especialistas no Maestri,
separados por produto, com o Fable como Maestro, capaz de fazer mudança segura
na empresa inteira sem estourar o custo de computação. Cinco peças:
fundação de conhecimento, especialistas, Maestro, gate de custo, rotinas.

A fundação vem primeiro porque **sem ela "especialista" é generalista com
nome**. E as rotinas vêm junto, não depois, porque a fundação envelhece no
primeiro dia em que um especialista começa a trabalhar — o corpus vivo
(completions e ADRs novos) diverge do recorte, e o especialista passa a falar
com autoridade falsa.

Princípio de contexto que governa tudo aqui: **just-in-time, não empilhado.**
O agente mantém identificadores leves e carrega sob demanda; nada de grafo ou
memória inteiros no prompt. Isso é o que o Claude Code já faz com `CLAUDE.md`
mais `grep`, e é o que a pesquisa de referência recomenda.

## 2. Não-objetivos

- Não define roles, recruits nem o Maestro — sub-projetos 2 e 3.
- Não decide o gate de custo — sub-projeto 4.
- Não cria MCP server de memória. O graphify já expõe `path`, `explain` e
  aceita `--graph <arquivo>`; a consulta por ferramenta já existe. Um MCP é
  candidato futuro se a consulta por CLI se mostrar insuficiente.
- Não reextrai o grafo por produto. Recorta o mestre.

## 3. Componentes

### 3.1 Recorte do grafo — `scripts/knowledge/recortar-grafo.ts`

Função pura sobre `graphify-out/graph.json`:

```
recortar(grafo, prefixos: string[], hops = 2) → subgrafo
```

Seleciona os nós cujo `source_file` começa por um dos prefixos, expande `hops`
níveis pelas arestas, e devolve o subgrafo induzido — nós selecionados mais os
alcançados, e só as arestas entre eles. Comunidades preservadas do mestre,
para `explain` continuar coerente.

Prefixos por produto, dados pela estrutura do repositório:

| Produto | Prefixos |
|---|---|
| meridian | `apps/app/app/(meridian)`, `apps/app/components/meridian`, `apps/app/lib/meridian`, `packages/database/prisma/schema/meridian.prisma` |
| charter | `apps/app/app/(charter)`, `apps/app/lib/charter`, `packages/database/prisma/schema/charter.prisma`, `packages/rbac/src/charter*` |
| scaffold | `apps/app/app/(scaffold)`, `apps/app/lib/scaffold`, `apps/app/lib/inngest/scaffold-*`, `packages/database/prisma/schema/scaffold.prisma`, `packages/rbac/src/scaffold-*` |
| cosmos | `apps/app/app/(cosmos)`, `apps/app/components/cosmos`, `apps/app/app/actions`, `apps/app/lib/inngest` (exceto `scaffold-*`), `packages/safe-engine` |
| plataforma | `apps/backoffice`, `packages/provisioning`, `packages/auth`, `packages/database` (exceto os `.prisma` de produto) |
| signal | *nenhum* — o grafo nasce vazio, e o `index.md` diz isso |

`packages/*` não listados entram **por hop**, não por prefixo: o que um
produto toca aparece no recorte dele; o que nenhum toca não aparece em nenhum.

Saída: `.maestri/knowledge/<produto>/graph.json`, consultável com
`graphify explain "X" --graph .maestri/knowledge/<produto>/graph.json`.

### 3.2 Roteador de memória — `scripts/knowledge/rotear-memoria.ts`

Função pura: `rotear(nomeArquivo, titulo?) → produto | "compartilhado"`.

Regras, por palavra-chave no nome do arquivo e no título, em ordem:

| Casa com | Produto |
|---|---|
| `meridian` | meridian |
| `charter` | charter |
| `scaffold` | scaffold |
| `kanban`, `pi-planning`, `epic`, `meeting`, `cosmos`, `story-0`, `wsjf` | cosmos |
| `lgpd`, `rbac`, `isolamento`, `tenant`, `rls`, `platformdb`, `backoffice`, `seed` | plataforma |
| nada | compartilhado |

Fontes e destino:

| Fonte | Quantidade hoje | Vai para |
|---|---|---|
| `.claude/completions/*.md` | 29 | `memory.md` do produto — resumo de até 200 palavras por completion, com link para o original |
| `docs/adr/*.md` | 18 | `index.md` do produto — título, status, uma linha, link |
| `~/.claude/projects/.../memory/*.md` | 4 | Maestro — são de empresa, não de produto |
| `.claude/sessions/*.md` | 1 | `memory.md` do produto, mesma regra |

O que cai em `compartilhado` não é descartado nem chutado: vai para
`.maestri/knowledge/compartilhado/` e a note do Maestro lista os não roteados,
para alguém decidir.

### 3.3 Exportador — `scripts/knowledge/exportar.ts`

Orquestra 3.1 e 3.2 e escreve, por produto, em `.maestri/knowledge/<produto>/`:

- `index.md` — o que existe: caminhos-raiz, contagem de nós do grafo, ADRs
  aplicáveis, quantas completions, comandos de consulta prontos para copiar.
  **É o documento que a note de trabalho resume.**
- `graph.json` — o recorte.
- `memory.md` — resumos das completions roteadas, mais recentes primeiro.
- `note.md` — a note de trabalho, gerada a partir do `index.md`: até 60 linhas,
  o que o especialista lê ao acordar. Tem duas seções vazias reservadas, que
  só o especialista escreve: `## Estado de tarefa` e `## Obstáculos`.

E `.maestri/knowledge/maestro/`: as 4 memórias de empresa, os não roteados, e
um `mapa.md` com uma linha por produto apontando para o `index.md` de cada.

Tudo versionado no repositório. **Fonte de verdade é o arquivo.**

### 3.4 Notes no Maestri — memória de trabalho

Um fichário por produto, com uma note de mesmo nome (`meridian`, `charter`,
`scaffold`, `cosmos`, `plataforma`, `signal`) cujo conteúdo é o `note.md`
correspondente. Mais a note `maestro`.

Direção única: **arquivo → note**. A rotina reescreve a note a partir do
`note.md`, **preservando** as seções `## Estado de tarefa` e `## Obstáculos`
que o especialista escreveu — o script lê a note atual, extrai as duas seções,
regenera o resto, recompõe. Note nunca alimenta arquivo.

Comandos (executados de um terminal Maestro). **Sintaxe a confirmar** com
`maestri note --help` na primeira execução dentro do Maestri — o CLI só
responde com `MAESTRI_SOCKET`, e as skills que documentam `note` não estavam
acessíveis quando esta spec foi escrita. A forma abaixo é a intenção; se o
comando receber conteúdo por argumento em vez de `--file`, o exportador passa a
imprimir o `note.md` e a rotina faz `note write "<p>" "$(cat …)"`:

```
maestri note create "meridian" --file .maestri/knowledge/meridian/note.md
maestri note write  "meridian" --file .maestri/knowledge/meridian/note.md   # rotina
```

### 3.5 Rotina — `refresh-conhecimento`

Uma só, diária, num floor `--no-git` chamado `conhecimento` para não disputar
com trabalho ativo. Comando, em ordem:

1. `graphify update .` no mestre — a guarda do próprio graphify não sobrescreve
   se o rebuild vier com menos nós; a rotina respeita e **não passa `--force`**.
2. `exportar.ts` — refaz recortes, reroteia memória nova, regera `note.md`.
3. Para cada produto, `maestri note write` preservando as seções do
   especialista (3.4).
4. Escreve uma note `refresh-<data>` com o que mudou: nós por produto, arquivos
   novos roteados, não roteados. Não sobrescreve a do dia anterior.

```
maestri routine create "refresh-conhecimento" \
  --daily 06:00 --terminal "conhecimento" \
  --command "pnpm knowledge:refresh"
```

## 4. Fluxo de dados

```
graphify-out/graph.json ──recortar──▶ .maestri/knowledge/<p>/graph.json
.claude/completions/*   ──rotear───▶ .maestri/knowledge/<p>/memory.md
docs/adr/*              ──rotear───▶ .maestri/knowledge/<p>/index.md
                                              │
                                        note.md (gerado)
                                              │  maestri note write
                                              ▼
                                   note "<p>" no canvas
                                   (Estado de tarefa / Obstáculos preservados)
```

## 5. Erro e degradação

- Completion sem produto identificável → `compartilhado`, listada na note do
  Maestro. Nunca silenciosa.
- Recorte com menos de 20 nós → aviso no `index.md` e na note de refresh; não
  falha. Signal cai aqui de propósito.
- `graphify update` recusando por queda de nós → a rotina registra e segue com
  o mestre anterior. Não força.
- Note do especialista com as seções reservadas ausentes (apagou à mão) → a
  rotina recria vazias e avisa na note de refresh.

## 6. Teste

Duas funções puras, testadas com fixtures pequenas em
`scripts/knowledge/__tests__/`:

- `recortar`: grafo de 12 nós em dois "produtos"; dado prefixo X com 2 hops,
  devolve os de X, os vizinhos até 2 hops, e **nenhum** nó só de Y sem caminho.
  Arestas do resultado só entre nós do resultado.
- `rotear`: tabela de nomes reais das 29 completions → produto esperado;
  nome inventado sem palavra-chave → `compartilhado`.
- `preservarSecoes`: note com conteúdo nas duas seções reservadas, regenerada,
  mantém o conteúdo byte a byte.

O exportador não tem teste unitário — é composição; o teste dele é rodar
contra o repositório e conferir o `index.md` de cada produto.

## 7. Decisões que ficam para os sub-projetos seguintes

- Quem lê qual note (roles) — sub-projeto 2.
- Se a consulta por CLI (`graphify explain --graph`) basta ou precisa de MCP —
  decidir depois de os especialistas usarem por uma semana.
- Se o Signal, sem código, deve ter especialista ou só uma note dizendo
  "spec em `specs/003-signal-measure`" — sub-projeto 2.

## 8. Emenda de 2026-09-22 — consolidação da base

- **Back-office é produto.** Saiu de `plataforma` e ganhou especialista: tem
  usuário, UI e `DESIGN.md` próprios, e as completions das áreas dele (funil,
  financeiro, catálogo de IP…) caíam em `compartilhado` porque nenhuma diz
  "backoffice" no nome — as palavras-chave agora são as áreas. `plataforma`
  fica com `packages/provisioning`, `packages/auth` e `packages/database`, a
  infra que os seis usam. A supervisão do Scaffold mora em `apps/backoffice`
  mas é do Scaffold, por exclusão explícita.
- **Signal tem código** desde 2026-09-04 (#182) e, portanto, especialista —
  o que responde o último item do §7. Ganhou prefixos e palavra-chave; o
  recorte segue vazio até o grafo mestre, de 2026-09-03, ser atualizado.
- **Prefixos corrigidos.** Charter e Scaffold não recortavam os próprios
  `components/`; Meridian e Charter ganharam o RBAC e o provisionamento deles.
- **A note aponta a verdade de produto.** A tabela `CONTEXTO` em
  `produtos.mts` dá a cada produto um resumo de uma linha, a raiz Impeccable
  (`PRODUCT.md` + `DESIGN.md`), PRD, SRD ou spec e o endereço de produção;
  toda note cita também o mapa de fronteiras. `produtos.test.ts` falha se
  algum caminho não existir. O mapa do Maestro ganhou o resumo por produto e
  a regra de roteamento: tarefa que toca mais de um produto vai a todos eles.
- **A note é prompt para o Opus 5.5.** Três partes vêm do
  [guia de prompting do modelo](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5):
  "Antes de agir" manda explorar as fontes — inclusive as que a tarefa não
  cita — antes de mudar qualquer coisa, porque o modelo começa a agir rápido
  em tarefa pouco especificada; o texto lido é declarado dado, não instrução,
  porque a exploração o faz agir sobre o que lê; e "Como trabalhar" nomeia a
  parada precoce a evitar (encerrar o turno anunciando o próximo passo), as
  paradas que valem, e manda manter as partes da tarefa em
  `## Estado de tarefa`.
- **§3.5, passo 1, revogado.** `graphify update .` (v0.9.20, só AST)
  reconstruiu o mestre de 35 243 para 23 697 nós, descartou os nós semânticos
  de documentação e sobrescreveu `graph.json`; a guarda de "menos nós" citada
  aqui não disparou. A rotina só recorta o mestre versionado. Atualizar o
  mestre é passo manual com `/graphify --update`, conferindo a contagem de
  nós antes de commitar — ver `docs/runbooks/maestri-conhecimento.md`.
