# Charter — diff de versão de política que diz o que mudou (onda 7a)

**Data:** 2026-09-22 · **Branch:** `fix/charter-diff-real`

Origem: P0 da crítica de design do Charter. `getVersionDiff` montava a linha do
diff com `body.slice(0, 180)` dos dois lados, então o artefato central do
produto não entregava o que vende. Onda paralela a 7b (`screens/*`, `modal.tsx`,
`form-kit.tsx`) — escopo restrito a `actions/policy.ts` (só `getVersionDiff` e
`VersionDiff`), `modals/diff.tsx`, `lib/charter/diff.ts` e testes.

## O problema, verificado

1. **Dois blocos idênticos.** Mudança no 3º parágrafo de uma seção caía fora
   dos primeiros 180 caracteres: "Antes" e "Depois" mostravam o *mesmo* texto.
   O auditor conclui que a tela quebrou ou que nada mudou.
2. **Reticência incondicional.** `${body.slice(0, 180)}…` concatenava `…`
   mesmo numa seção de 40 caracteres, que se apresentava como truncada.
3. **Promessa quebrada.** `screens/audit.tsx` (`PACKAGE_CONTENT`) vende "cada
   versão com diff campo a campo".

## O que entrou

### `lib/charter/diff.ts` (novo, puro)

- **LCS clássico por linha (DP), sem dependência nova.** O repo não tem lib de
  diff; a entrada aqui é seção de política (dezenas de linhas), o DP cabe com
  folga e não tem heurística que erre em caso difícil. Myers só ganharia em
  arquivo grande de código, que não é o caso.
- **Recuo para diff por palavra.** Seção de política costuma ser parágrafo
  corrido — uma linha só. Diff por linha nesse texto degenera em "tudo mudou",
  que é a mesma mentira por outro caminho. Todo par `removida`→`adicionada`
  cuja linha passa de 80 caracteres é reaberto por palavra e vira `partes`;
  concatenar as `partes` devolve a linha inteira (testado).
- **Agrupamento em função irmã, não no diff.** `diffTexto` devolve os segmentos
  crus e `agruparSegmentos(segmentos, contexto)` decide o que colapsa.
  Justificativa: o action serializa os segmentos crus (fidelidade total, o
  auditor sempre pode abrir), e quantas linhas de contexto mostrar é decisão de
  apresentação — fica no cliente, testada à parte. Bloco colapsado carrega os
  seus segmentos: abrir é só deixar de esconder, nada é descartado.
- **Sem truncagem calada.** Há teto de linhas (`MAX_LINHAS`) para o DP não
  estourar memória com entrada patológica, e quando ele vale o dado diz:
  `truncado: true` + `linhasOmitidas`. O que é exibido é sempre diff verdadeiro
  do que entrou — o teto nunca muda o significado do que aparece.

### `getVersionDiff`

`VersionDiff.rows` troca `{ before, after }` por
`{ field, segmentos, nova, truncado, linhasOmitidas }`. "Seção nova" e "nome
alterado" continuam linhas próprias, agora com o conteúdo inteiro em vez do
excerto (`nova: true` substitui a string `"— (seção nova)"`). Preservados:
`safeAction`, `requireCharterContext`, `withTenantDb`, filtro por `tenantId` e
o comentário sobre a variável `before`/linter.

### `modals/diff.tsx`

Sai o par de excertos lado a lado, entra **diff unificado**: removida em
`--red-text`/`--red-soft`, adicionada em `--green-text`/`--green-soft`, linha
intocada em `--ink-muted` (zero cor literal). Trecho longe da mudança entra
colapsado como botão "N linhas sem alteração" (`aria-expanded`, disclosure
local — `DisclosurePanel` é `SectionCard`, pesado demais para uma tira dentro
de um bloco de diff). Linha longa reescrita mostra as marcas por palavra.
Tipografia só por `FS.*`. Região rolável é `<section>` com `aria-label` e
`tabIndex={0}` — o bug de `policy.tsx` não se repete. Cabeçalho, `Kbd esc` e
rodapé preservados.

## Fica de fora — e por quê

A copy de `screens/audit.tsx` ("cada versão com diff campo a campo") passou a
ser verdade **na tela**, não no pacote exportado. O CSV de auditoria carrega o
`AuditDiff` gravado em `publishVersion`, que é
`[versão, "Seções alteradas" (contagem), "Trilhas para reatribuir" (contagem)]`
— contagem, não conteúdo por seção. `actions/audit.ts`, `actions/_shared.ts` e
a copy estão fora do escopo desta onda; a correção do export é tarefa própria.

## Verificação

vitest suíte inteira **4236 passed / 20 skipped, 0 falhas** ·
`tsc --noEmit` limpo · `pnpm size:guard` verde **sem `--update`** ·
build "✓ Compiled successfully in 26.5s" (falha posterior em "Collecting page
data" de `/api/cron/billing-sync-dispatch` é pré-existente e fora do diff).

Mutações que falham: remover o recuo para palavra derruba "uma linha só, uma
palavra mudada"; voltar `slice(0, 180)` derruba "mudança no 3º parágrafo não
devolve dois blocos idênticos"; remover o agrupamento derruba "colapsa o
trecho inalterado com a contagem de linhas".
