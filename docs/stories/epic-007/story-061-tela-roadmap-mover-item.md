# Story 061 — Tela Roadmap (mover item no horizonte)

**Epic:** epic-007 — Solution Train & Advanced Features
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**Story mãe:** `docs/srd-epic-007.md` FR-028 "Roadmap Items & Scenario Planning"
(`RoadmapItem` epic↔quarter/year; "drag-from-Unscheduled"; "max 25/ART/quarter")
**Também:** `docs/stories/epic-007/story-031.md` (AC-003/004/005, planejamento por cenário)

> Por que uma história separada da 031: a 031 é o **planejamento por cenário** (deep-copy,
> diff, promote-to-base). A tela `/cosmos/roadmap` é o horizonte base — a grade Gantt de
> trimestres por ART que a Portfolio Manager usa fora de qualquer cenário. Ela nasceu
> **somente leitura**, e o próprio cabeçalho do componente diz isso: "drag-to-edit /
> context-menu date editing needs a mutation this screen doesn't wire". Um roadmap que não
> se pode replanejar é um slide, não uma ferramenta. Nenhum critério aqui é inventado: cada
> AC aponta para a FR-028.

---

## Jornada do usuário

A Portfolio Manager abre **Portfolio → Planejamento → Roadmap** depois de uma decisão de
comitê: um épico escorregou um trimestre. Ela vê a barra no lugar antigo e não tem o que
fazer na tela — o replanejamento acontece em outro lugar e volta para cá como leitura.

Existe uma camada CRUD em `app/actions/roadmap/index.ts`, mas ela não serve como está para
esta superfície: escreve sem `requireRole` (qualquer membro do tenant move ou apaga item de
roadmap), sem `logAudit` (replanejamento sem rastro), e revalida `/portfolio/roadmap`, que
não é a rota desta tela. O que falta não é "um update" — é a **operação de roadmap**: levar
o item para outro trimestre preservando o que ele é.

Duas coisas precisam ser verdade nessa operação:

1. **Mover preserva a duração.** Um item de seis semanas que vai para o trimestre seguinte
   continua com seis semanas. Definir só a nova data de início deixaria o fim onde estava e
   poderia **inverter o intervalo** — e é justamente por causa de intervalo invertido que a
   grade carrega hoje uma defesa (`positionItem` força o fim a ser maior que o início).
   Mover por duração preservada faz a inversão não poder nascer deste caminho.
2. **O trimestre tem teto.** A FR-028 fixa "max 25/ART/quarter". Sem o teto, replanejar vira
   empurrar tudo para a frente até que um trimestre concentre o portfólio inteiro — que é
   exatamente o que um roadmap deveria impedir.

---

## Acceptance Criteria

### AC-001: Mover o item para outro trimestre preservando a duração
_(FR-028: `RoadmapItem` epic↔quarter/year, "drag-from-Unscheduled … to Q3 2027")_

Given um item que começa em 05/01/2026 e termina em 10/02/2026 (36 dias),
When um ADMIN/RTE/PO o move para o 3º trimestre de 2027,
Then:
- `startDate` passa a ser o primeiro dia do trimestre destino;
- `endDate` passa a ser `startDate + 36 dias` — a duração é preservada, não recalculada;
- a ação é auditada com o trimestre de origem e o de destino;
- a rota da tela é revalidada.

Given um id de item de outro tenant,
When o movimento é submetido,
Then é recusado e nada é gravado.

Given um usuário sem papel ADMIN/RTE/PO,
When ele tenta mover,
Then a ação é recusada e nada é gravado.

### AC-002: Mover nunca produz intervalo invertido
_(FR-028; a defesa em `positionItem` existe porque o intervalo invertido é possível hoje)_

Given qualquer item,
When ele é movido,
Then `endDate >= startDate` — a duração preservada é sempre não-negativa, então este caminho
não consegue inverter o intervalo, independentemente do trimestre destino.

Given um item cujo intervalo **já está** invertido no banco (dado corrompido por outra
escrita),
When ele é movido,
Then a duração usada é 0 e o item sai do movimento com fim igual ao início — o movimento
**corrige** a inversão em vez de propagá-la, e não inventa uma duração que ninguém registrou.

### AC-003: Teto de 25 itens por ART por trimestre
_(FR-028: "max 25/ART/quarter")_

Given um ART com 25 itens de roadmap já no trimestre destino,
When alguém move um 26º item para lá,
Then o movimento é recusado com mensagem que cita o teto, e nada é gravado.

Given o item que está sendo movido já está nesse trimestre e nesse ART,
When o movimento é submetido,
Then ele não conta contra si mesmo no teto — reposicionar dentro do mesmo trimestre não é
adicionar um item.

Given um item sem ART,
When ele é movido,
Then o teto é contado sobre os itens sem ART: o teto é por faixa da grade, e "sem ART" é uma
faixa como qualquer outra.

### AC-004: Trimestre e ano fora de faixa são recusados
_(FR-028: `quarter` 1–4)_

Given trimestre 0, 5 ou ano fora de uma faixa plausível de planejamento,
When o movimento é submetido,
Then é recusado na validação e nenhuma consulta de escrita acontece.

### AC-005: A tela oferece antecipar e adiar por item, e recarrega
_(FR-028, superfície da grade)_

Given a grade com itens,
When a Portfolio Manager adia um item,
Then a action é chamada com o trimestre seguinte ao de início do item, e a grade recarrega
com a nova posição.

Given a mesma grade,
When ela antecipa um item,
Then a action é chamada com o trimestre anterior.

---

## Technical Notes

- **Sem migration.** `RoadmapItem` já tem `startDate`, `endDate`, `artId`, `status`,
  `milestone` e `color`. O trimestre não é campo: é derivado das datas, que é como a grade
  já monta o eixo (`computePeriods` em `components/cosmos/screens/roadmap.tsx`).
- A action nova mora em `(cosmos)/actions/roadmap.ts` e **não** substitui
  `app/actions/roadmap/index.ts`. Aquela camada é CRUD genérico com outro consumidor
  (`/portfolio/roadmap`); endurecê-la com RBAC mudaria o contrato de quem já a usa. O que é
  específico da grade — mover por trimestre, preservar duração, teto por ART/trimestre — é
  regra desta superfície e mora com ela. Mesma precedência de `(cosmos)/actions/kanban.ts`,
  que é a action da tela e delega o que é compartilhado.
- **Lacuna registrada, não corrigida aqui:** `UpdateRoadmapItemSchema` é
  `RoadmapItemBaseSchema.partial()`, e `.partial()` é aplicado sobre o schema **antes** do
  `.refine(endDate >= startDate)` — então o update genérico não valida a ordem das datas.
  `updateRoadmapItem` não tem consumidor de produção hoje, então a falha é latente; corrigi-la
  exige decidir o que fazer quando só uma das datas vem no payload, o que é assunto da camada
  genérica, não desta tela.
- **Lacuna registrada:** a FR-028 pede `confidence` 0–100 com codificação visual e alerta ao
  BO quando cai; `RoadmapItem` não tem esse campo. Exige migration — registrado, não
  aproximado por outro campo.
- O teto de 25 é contado por consulta (`count` sobre a janela do trimestre destino e o mesmo
  `artId`), não por campo denormalizado.

## Test Plan

- **Risco:** Médio — escrita que reposiciona dado de planejamento.
- **Action** (`apps/app/__tests__/actions/roadmap.test.ts`): mover exige papel; id de outro
  tenant é recusado; a duração é preservada e o início cai no primeiro dia do trimestre; o
  intervalo já invertido sai com duração 0; o teto de 25 recusa o 26º e não conta o próprio
  item; trimestre fora de 1–4 é recusado antes de qualquer escrita; o audit registra
  origem→destino.
- **Tela** (`apps/app/__tests__/screens/roadmap.test.tsx`): adiar chama a action com o
  trimestre seguinte; antecipar com o anterior; a grade recarrega. Asserção sobre conteúdo —
  sem snapshot.
