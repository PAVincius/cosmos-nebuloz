# 2026-09-28 — Grafo mestre com o Signal

## Pedido
O grafo mestre (`graphify-out/`) era de 2026-09-03, anterior ao código do Signal, e o recorte do Signal no Maestri
tinha 0 nós. O pedido: atualizar com `/graphify --update` com o aval do dono (o custo é dele), conferir que a contagem
de nós não caiu, rodar `pnpm knowledge:refresh`, ver o recorte do Signal passar de 20 nós e atualizar os números e a
frase "It predates the Signal code" do `CLAUDE.md`.

## Entregue
- Mestre: 35 243 → 40 801 nós, 58 626 → 70 828 arestas, 2 676 → 2 631 comunidades, `built_at_commit` `4ae0b559`
  (a main de 2026-09-28). Recorte do Signal: 0 → 2 154 nós, 623 deles do código do Signal.
- Detect por conteúdo (`kind="ast"`), aprovado pelo dono em 2026-09-23. As 2 880 linhas do manifesto tinham
  `semantic_hash` vazio, e o detect padrão do `update.md` contava tudo como mudado. Foram marcados 1 097 arquivos
  (918 de código, 178 docs e 1 imagem) e 47 apagados.
- `.graphifyignore` com `.maestri/`: os recortes saem do próprio mestre.
- Part A com código e docs. O mestre guarda o AST de markdown (títulos, `contains`) de cada doc, e o `build_merge`
  troca todos os nós de um arquivo reextraído. Part B: 172 docs em 18 subagentes Sonnet; outros 7 vieram do cache.
- Cache semântico versionado em `graphify-out/cache/semantic/` (184 entradas, 1,7 MB) e `graphify-out/cost.json`.
- O manifesto novo tem `semantic_hash` nas 3 642 linhas, e o `/graphify --update` literal volta a marcar só o que
  mudou.
- Step 9 do skill: saíram 50 intermediários versionados de 02/09, anteriores ao próprio mestre. Os 44
  `.graphify_chunk_*` entrariam no glob do merge do próximo `--update`.
- `.maestri/knowledge` regenerado. `CLAUDE.md`: números, aviso dos ids duplicados e god nodes e exemplos com o id de
  caminho completo, porque os ids antigos de 4 exemplos sumiram com a reextração. Runbook §5 sem a data velha do mestre.

## Verificado
- A contagem não caiu. Passou pela guarda #479 e por uma checagem própria contra o mestre antigo.
- Saúde do grafo: 0 arestas soltas ou colapsadas. Há 2 auto-laços em `apps/memoria` (import Python resolvido para o
  próprio módulo).
- `graphify explain` e `path` com os ids novos do `CLAUDE.md`, e `explain` num nó do recorte do Signal.
- Refresh: Meridian 1 737 → 2 345, Charter 2 094 → 3 143, Scaffold 1 847 → 2 674, back-office 1 599 → 3 950.
  Cosmos (8 924 → 8 644) e plataforma (6 686 → 6 256) caíram no 2-hop, mas os nós de base subiram (4 252 → 4 262 e
  523 → 591). Os arquivos reextraídos perderam o nó em dobro do esquema de id antigo.
- Depois de tudo, o detect literal (`kind="semantic"`) marca 0 arquivos.

## Custo
- 2026-09-28: 5 055 204 tokens em 18 subagentes Sonnet. É o total de cada agente, porque o host não separa entrada
  e saída.
- 2026-09-23, primeira tentativa: 9 subagentes. 8 estouraram o teto de 64k tokens de saída numa resposta só e não
  informaram uso. O que passou (373 789 tokens) virou cache de 7 docs. A segunda rodada usou chunks de até 150 KB,
  gravados em partes de ~12k tokens.

## Não feito, e por quê
- **Ids duplicados nos arquivos não reextraídos** (ex.: `actions_base_safeaction` ao lado de
  `apps_app_app_actions_base_safeaction`): limpar pede um `graphify extract --force` completo, fora do aval.
- **18 `.sql` sem nós:** falta `tree_sitter_sql` (`graphifyy[sql]`). O mestre de 03/09 também não tinha nós de SQL.
- **Checkout principal:** o dono aprovou rodar no worktree, porque o detect por conteúdo não depende do mtime. A #243
  entrou na main durante o trabalho, então a branch avançou para a main (fast-forward de 203 commits) e o PR vai
  direto para ela.
- **`graph.html`:** não é gerado acima de 5 000 nós (`CLAUDE.md`).
