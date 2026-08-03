# Story 060 — Tela Strategy Map (pilares agrupando temas)

**Epic:** epic-007 — Solution Train & Advanced Features
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**Story mãe:** `docs/stories/epic-007/story-031.md` (AC-001 "Orphan/disconnected nodes appear in
a 'Misaligned' sidebar", AC-002 "Broken links show a 'Alignment gap' icon at the break point")
**Também:** `docs/srd-epic-007.md:296` FR-027 (DAG com "orphan/disconnected nodes"),
`docs/srd-epic-007.md` FR-029 (detecção de lacuna de alinhamento)

> Por que uma história separada da 031: a 031 é o **canvas DAG completo** (Theme→OKR→Epic→Feature,
> tamanho por WSJF, export PNG/SVG/PDF) servido por `app/actions/strategy-map/`. A tela
> `/cosmos/strategy` é a outra superfície da mesma hierarquia — a grade de pilares que a
> Portfolio Manager usa para ver a estratégia em blocos, sem canvas. Ela nasceu sabendo **ler**
> a hierarquia pilar → tema → épico e **criar** pilar, e sem os dois lados que fazem a leitura
> valer alguma coisa: não havia como **pôr um tema dentro de um pilar**, e um tema fora de
> qualquer pilar simplesmente **sumia do mapa**. Nenhum critério aqui é inventado: cada AC
> aponta para um AC da 031 ou para a FR-027.

---

## Jornada do usuário

A Portfolio Manager abre **Portfolio → Estratégia → Strategy Map** para responder a uma pergunta
de QBR: "para onde a estratégia está apontando, e o que está sendo feito a respeito?".

O que ela encontrava era um mapa que só podia estar vazio. `createPillar` criava o pilar;
`StrategicTheme.pillarId` existia no schema; e **nenhuma escrita no repo gravava esse campo**.
Um pilar criado pela tela nascia com "Nenhum tema vinculado", contagem de épicos 0 e progresso
0% — para sempre. O rollup que a tela anuncia ("o rollup abaixo reflete o progresso real desse
trabalho") era, na prática, decorativo.

Do outro lado, `listStrategyPillars` lê `StrategyPillar` e desce para os temas de cada pilar.
Um tema com `pillarId` nulo não aparece em lugar nenhum da tela — nem como problema. Isso é o
oposto do que a 031 AC-001 pede: nó órfão vai para uma faixa de "desalinhados", não some. Um
tema estratégico que não está sob nenhum pilar é uma aposta de investimento que ninguém
consegue ligar à estratégia — exatamente a lacuna que a FR-029 existe para caçar.

E o zero: um pilar sem épico mensurável exibia `0%`. "0% concluído" e "não há o que medir" são
estados diferentes, e o segundo não é o primeiro.

---

## Acceptance Criteria

### AC-001: Vincular e desvincular tema de pilar
_(story-031 AC-001, que pressupõe a grade pilar→tema montada; `StrategicTheme.pillarId` já existe)_

Given um tema e um pilar do mesmo tenant,
When um ADMIN/STE vincula o tema ao pilar,
Then:
- `StrategicTheme.pillarId` passa a apontar para o pilar;
- a ação é auditada **com o pilar anterior**, para que mover um tema entre pilares deixe rastro
  de origem e destino;
- o pilar passa a contar esse tema e os épicos dele no rollup.

Given um tema vinculado,
When o vínculo é removido (pilar nulo),
Then `pillarId` volta a nulo e o tema reaparece entre os desalinhados — desvincular **não**
apaga o tema nem toca em épico algum.

Given um `themeId` ou um `pillarId` de outro tenant,
When a vinculação é submetida,
Then é recusada e nada é gravado — os **dois** ids vindos do cliente são reconferidos dentro do
tenant, não só um.

Given um usuário sem papel ADMIN/STE,
When ele tenta vincular,
Then a ação é recusada e nada é gravado.

### AC-002: Tema ativo sem pilar aparece como lacuna de alinhamento
_(story-031 AC-001 "Orphan/disconnected nodes appear in a 'Misaligned' sidebar"; AC-002
"Alignment gap"; `docs/srd-epic-007.md:296` FR-027 "orphan/disconnected nodes")_

Given temas ativos sem `pillarId`,
When a tela carrega,
Then eles aparecem numa faixa de desalinhados, nomeados, com o caminho para vinculá-los — não
somem do mapa.

Given nenhum tema desalinhado,
When a tela carrega,
Then a faixa não aparece: ausência de lacuna não vira um aviso vazio.

Given um tema **arquivado** sem pilar,
When a tela carrega,
Then ele **não** conta como lacuna: tema arquivado saiu do portfólio, e cobrar alinhamento dele
seria um alarme que ninguém pode resolver.

### AC-003: Rollup sem épico mensurável é "—", nunca 0%
_(audit 2026-07-23, eixo "Data integrity")_

Given um pilar sem tema, ou com temas cujos épicos não têm feature alguma,
When a tela renderiza,
Then o progresso é **"—"** e não `0%`: média de conjunto vazio não é zero, e "0% concluído"
afirma uma medição que não existe.

Given um pilar com épicos mensuráveis,
When a tela renderiza,
Then o progresso é a média das porcentagens desses épicos, e épico sem feature não entra no
denominador.

### AC-004: Estado vazio e estado de erro sem pilar fabricado
_(audit 2026-07-23, eixo "Data integrity")_

Given `listStrategyPillars` falha,
When a tela carrega,
Then aparece a mensagem de erro e **nenhum** pilar é renderizado — hoje a falha caía no mesmo
texto do vazio e a tela dizia "nenhum pilar cadastrado" para um tenant que tem pilares.

Given o tenant sem pilar algum,
When a tela carrega,
Then aparece o estado vazio convidando a criar o primeiro.

---

## Technical Notes

- **Sem migration.** `StrategicTheme.pillarId` já existe (`packages/database/prisma/schema/`,
  comentado como "Strategy Map pillar grouping") com `onDelete: SetNull` e índice `[pillarId]`.
  Apagar um pilar solta os temas em vez de apagá-los — o que torna "desvincular" a operação
  natural do modelo, não uma exceção.
- A leitura dos desalinhados é uma action separada (`listUnlinkedThemes`) em vez de um campo
  novo em `listStrategyPillars`: o payload de pilares tem consumidor além desta tela
  (`pillar-detail`), e alargar a forma dele para carregar uma lista que só a grade usa
  espalharia a mudança sem necessidade. A tela busca as duas em paralelo.
- `avgProgress` passa a ser `number | null`. O `0` anterior era indistinguível de "nada
  concluído"; o `null` é o que a tela traduz para "—". Mesma regra já aplicada em
  `actualAllocationPct` no nó `themes`.
- Vincular **não** cascateia: nenhum `Epic` é tocado. O épico pertence ao tema; o tema é que se
  move entre pilares.

## Test Plan

- **Risco:** Médio — escrita com dois FKs vindos do cliente.
- **Action** (`apps/app/__tests__/actions/strategy.test.ts`): vincular exige papel; os dois ids
  são reconferidos por tenant (tema de outro tenant e pilar de outro tenant, separadamente);
  o audit registra o pilar anterior; desvincular grava nulo; `listUnlinkedThemes` devolve só
  tema ativo sem pilar, escopado por tenant; `avgProgress` é null sem épico mensurável e a
  média ignora épico sem feature.
- **Tela** (`apps/app/__tests__/screens/strategy.test.tsx`): o pilar sem épico mostra "—";
  a faixa de desalinhados nomeia os temas e some quando não há nenhum; vincular pela tela chama
  a action e recarrega; erro distinto do vazio. Asserção sobre conteúdo — sem snapshot.
