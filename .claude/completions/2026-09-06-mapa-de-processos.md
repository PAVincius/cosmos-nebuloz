# 2026-09-06 — Mapa de processos

Spec: docs/superpowers/specs/2026-09-06-mapa-de-processos-design.md
Plano: docs/superpowers/plans/2026-09-06-mapa-de-processos.md
Ledger: .superpowers/sdd/2026-09-06-mapa-de-processos/progress.md

Entregue, por task:

1. Modelo (`435f138d`): `StaffProcess`/`StaffProcessEdge` em
   `packages/database/prisma/schema/processos.prisma` (tenant sempre
   `system`; `codigo` único por tenant; `nivel` 1/2/3 decide o anel;
   `diagramId` `SetNull` porque o processo sobrevive ao diagrama), migration
   `20260909000000_mapa_de_processos` com o bloco RLS `DO $$` das duas
   tabelas. `StaffDiagram` ganhou `processos StaffProcess[]`. Dado dos 21
   processos e 23 ligações em `packages/provisioning/src/processos-nebuloz.ts`
   (`PROCESSOS_NEBULOZ`, `LIGACOES_NEBULOZ`), transcrito de
   `.superpowers/sdd/2026-09-06-mapa-de-processos/dado-do-design.md`, e
   consumido por `apps/app/scripts/seed-empresa-nebuloz.ts`.
2. Regras puras (`42c8fe40`, fix `29881e10`) —
   `apps/backoffice/lib/ferramentas/processos.ts`: `DOMINIOS`, `NIVEIS`,
   `STATUS`/`statusDe`, `layoutPolar` (determinístico, porta do
   `PROC_LAYOUT` do design), `vizinhos`, `buscar` (tokens ≥ 3 letras,
   AND, acento-insensível), `paraJsonCanvas` (JSON Canvas 1.0). Fix: slug do
   nome do arquivo exportado apara hífen na borda, como o slugificar do
   repo (uma coordenada do layout foi cravada errada no teste do revisor —
   o código já estava certo).
3. Actions (`0ba92123`) —
   `apps/backoffice/app/actions/processos.ts`: `listarProcessos`,
   `criarProcesso`/`atualizarProcesso` (zod, código `^PZ-\d{2,3}$`, duplicado
   → erro), `excluirProcesso` (cascade nas ligações), `criarLigacao`
   (`deId !== paraId`, par único), `excluirLigacao`. Todas via `safeAction` +
   `requirePlatformStaff`, escritas com `assertCanWrite` + `logPlatformAudit`
   + `revalidatePath`.
4. Grafo SVG (`01d4c7e0`, fix `bfeb0879`) —
   `apps/backoffice/app/(staff)/ferramentas/processos/grafo.tsx`: 3 anéis,
   manchas por área, arestas com seta, pan/zoom, arrasto temporário com
   retorno para casa. Fix: `onWheel` do React é passivo (`preventDefault`
   não fazia nada) e a pinça do trackpad disparava o zoom do navegador —
   listener registrado manualmente com `{ passive: false }`; `pointercancel`
   adicionado para não deixar o nó longe de casa num arrasto interrompido.
5. Tela, painel do nó e nav (`9744213f`, fix `a83deb8b`) — `page.tsx`,
   `mapa.tsx`, `painel.tsx`, item "Mapa de processos" no nav entre
   "Modelagem BPMN" e "Diagramas". Fix: `ConfirmarAcao` sem `key` por seleção
   trocava o processo errado ao mudar de nó no meio da confirmação; o × da
   ligação excluía com um clique só — passou a confirmar em duas etapas
   também (Ruling 8).
6. Diálogo de processo e formulário de ligação (`69bd05f5`) —
   `processo-dialog.tsx` (criar/editar) e o mini-form de "Nova ligação" no
   painel.
7. Verificação e registro (esta task).

## Rulings do ledger

- Ruling 1: o dado dos 21 processos vive em
  `.superpowers/sdd/2026-09-06-mapa-de-processos/dado-do-design.md`, já
  traduzido — 21 registros longos dentro do plano tornariam o documento
  ilegível. Custo se errado: nenhum, o teste da Task 1 confere contagem,
  unicidade e integridade referencial.
- Ruling 2: `status` continua derivado, sem coluna (spec §0) — usuário
  avisado, sem objeção.
- Ruling 3: realinhamento de coluna em `governance.prisma` pelo `prisma
  format` ao entrar `processos StaffProcess[]` — aceito, não é reformatação
  alheia.
- Ruling 4: `file?: undefined` no tipo `GrupoCanvas` para o teste verbatim
  compilar — aceito, é o discriminante do union.
- Ruling 5: `ProcessoRow.diagram` usa `name` (campo real de `StaffDiagram`),
  não `nome` — aceito, o brief é que estava impreciso.
- Ruling 6: semântica de "quente" = halo de destaque independente de
  hover/seleção — aceito, é o uso do design (nó campeão da busca).
- Ruling 7: botões de escrita somem em vez de desabilitar com motivo — o
  brief e o teste pedem assim; aceito.
- Ruling 8: o × da ligação também confirma em duas etapas — a spec §4 só
  exigia isso do processo, mas `ConfirmarAcao` já existe e o custo é
  ~zero; ação irreversível de um clique num alvo pequeno não passa.
- Ruling 9: clicar numa ligação cujo nó está escondido pelo filtro continua
  abrindo esse nó — pedido explícito do usuário, não um vazamento de
  filtro. Parked, sem mudança.
- Ruling 10: `<select>` nativo em vez de Radix Select, e "Salvar"/
  "Salvando…" em vez de `rotuloSalvar` (semântica não batia) — aceitos, é a
  escada do ponytail.

Reviews: Task 1 clean; Task 2 approved (fix round `29881e10` aplicado antes
da aprovação); Task 3 approved; Task 4 needs-fixes → fix round `bfeb0879` →
re-review clean (junto com o fix do Task 5); Task 5 needs-fixes → fix round
`a83deb8b` → re-review clean; **Task 6 segue com review pendente no ledger no
momento deste registro** (não bloqueia o registro — ver Pendente, abaixo).

## Verificação (Task 7)

- Suíte `apps/backoffice` (`npx vitest run`): **578 testes, 0 falhas.**
- `tsc --noEmit` limpo (zero erros) em `apps/backoffice`, `apps/app`,
  `packages/database` e `packages/provisioning` (cada um com o próprio
  tsconfig).
- Biome/ultracite nos arquivos `.ts`/`.tsx`/`.mts` tocados desde
  `435f138d~1`: `Checked 20 files. No fixes applied.`
- `prisma migrate status` e as contagens locais (Steps 3 e 4 do brief):
  **não executados.** Docker está inacessível nesta sessão — `docker ps`
  não retorna (timeout manual de 6 s sem resposta do daemon) e não há
  processo `dockerd`/`Docker.app` rodando (`pgrep` vazio); o banco local
  `cosmos_dev` (porta 5434) não pôde ser subido nem consultado. Reportado
  como falha de ambiente, não contornado.
- Como substituto parcial do Step 4 (só a parte que não depende de banco): o
  SQL de produção foi gerado por um script descartável
  (`tsx` sobre `processos-nebuloz.ts`, no scratchpad da sessão, não
  commitado) que conta os arrays de origem diretamente —
  `PROCESSOS_NEBULOZ.length = 21`, `LIGACOES_NEBULOZ.length = 23` — e o
  arquivo final tem exatamente 21 linhas `INSERT INTO "StaffProcess"` e 23
  linhas `INSERT INTO "StaffProcessEdge"` (conferido com `grep -c`). **Isto
  não é o mesmo que rodar o script contra um Postgres real**: a resolução do
  `ON CONFLICT`, das subconsultas de `deId`/`paraId` por `codigo`, e o
  `SELECT` final devolvendo `21 | 23` de fato não foram exercitados — ficam
  para quando o Docker local voltar, ou para a conferência em produção (ver
  Pendente).
- `packages/database/scripts/2026-09-seed-processos.sql` gerado a partir de
  `processos-nebuloz.ts`, no formato de `2026-09-seed-funil.sql`: cabeçalho
  com o que semeia / que é create-only / ordem de deploy, `BEGIN`/`COMMIT`,
  um `INSERT ... ON CONFLICT ("tenantId","codigo") DO NOTHING` por processo
  (ids `proc_pz01`..`proc_pz21`), um `INSERT ... ON CONFLICT ("deId","paraId")
  DO NOTHING` por ligação resolvendo `deId`/`paraId` por subconsulta em
  `StaffProcess` pelo par tenant+código, `SELECT` final de contagem.
- `docs/comercial/mapa-de-processo.md`: nota curta no topo apontando que o
  mapa navegável de todos os domínios vive em `/ferramentas/processos` e que
  o documento continua sendo a prosa do processo comercial — sem reescrever
  o resto do documento.

## Pendente (produção)

1. Push do branch — o deploy da Vercel aplica `migrate deploy`
   (`20260909000000_mapa_de_processos`, RLS incluído).
2. Confirmar o deployment READY na Vercel.
3. Rodar `packages/database/scripts/2026-09-seed-processos.sql` no SQL
   Editor do Supabase — só com "vai" do usuário (banco de produção).
4. Conferir o `SELECT` final do script: **`21 | 23`** — esta é a primeira
   vez que o script roda contra um Postgres de verdade (ver a ressalva da
   Verificação, acima); se o resultado não bater, o problema mais provável é
   um `codigo` sem correspondência nas subconsultas de ligação.
5. Verificar `/ferramentas/processos` autenticado: badges (N modelados/
   rascunhos/não mapeados), grafo, painel, export `.canvas`.
6. Re-review da Task 6 (diálogo de processo e formulário de ligação) segue
   pendente no ledger — não bloqueia produção (a tela já está coberta pelos
   21 testes da task; a revisão é sobre qualidade de código, não sobre
   corretude funcional).
7. Quando o Docker local voltar: rodar `prisma migrate status` e o seed uma
   vez contra `cosmos_dev` para fechar a lacuna de verificação local
   apontada acima, antes ou depois do deploy — não bloqueia o deploy em si.

Até o passo 3 rodar, a tela abre vazia com o estado de "nenhum processo" —
não quebra.

## Ponytail

Cortes de escopo já decididos no design (spec §0, não revisitados aqui):
fontes conectadas (Drive/Notion/GitHub/SharePoint) fora — só `docUrl`; busca
por substring em vez de semântica; sem poeira estelar/molas/tema do céu; nó
não persiste posição arrastada (layout polar é determinístico); `status`
sem coluna, derivado.

Cortes/decisões que surgiram durante a execução:

- **Não corrigido — Task 6 sem review no ledger.** Ver Pendente item 6.
- **Parked P1 (Task 3, sem mudança nesta task):** `criarLigacao` sem
  checagem explícita de existência dos dois processos (a FK já cobre, o
  erro só chega com wording diferente do esperado); `donoNome` aceita
  string vazia (herdado do brief, não da action); `excluirLigacao` e o
  mapeamento de `listarProcessos` sem teste dedicado (cobertos
  indiretamente pelos testes de tela). Custo se ficar: uma mensagem de erro
  genérica do Postgres em vez de uma de negócio, num caminho que exige dois
  ids inválidos ao mesmo tempo — baixo.
- **Parked P2 (fix rounds 1/2, Task 4/5, sem mudança nesta task):** as deps
  do `useCallback` de `aoRodar` (handler do wheel/zoom em `grafo.tsx`)
  reregistram o listener a cada tick de pan/zoom — churn de
  addEventListener/removeEventListener, não um bug (o teste afirma que o
  listener é `{ passive: false }`, não a frequência de registro). Avaliar
  memoização mais estável numa onda futura, sem risco atual.
- **Não removido — pilha de stash compartilhada.** A Task 1 encontrou um
  `stash@{0}: lint-staged automatic backup` na pilha de `git stash`
  compartilhada do worktree, gerado por um hook de outra sessão, não desta
  task. Não foi descartado (não é meu para descartar) e continua lá; sinalizo
  aqui para quem fechar a pilha, sem tocar nela por conta própria — a
  constraint desta task também veda `git stash`.
- **Não coberto — Step 3/4 do brief (migrate status + contagens locais).**
  Docker inacessível nesta sessão (ver Verificação). A alternativa aplicada
  (contar os arrays de origem e as linhas do arquivo gerado) confere a
  cardinalidade do SQL, mas não que ele rode sem erro num Postgres real —
  ficou para o passo 4 de produção ou para quando o Docker local voltar.
