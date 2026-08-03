# Story 054 — Tela Decision Log (artefato de auditoria do portfólio)

**Epic:** epic-006 — Enhanced Portfolio & ART
**Status:** pending
**Competência SAFe:** LEAN_PORTFOLIO_MANAGEMENT · **Nível:** Portfolio
**SRD:** FR-010 (`docs/srd-epic-006.md:126`), FR-816 (`docs/srd-epic-008.md:178`)
**PRD:** §7.4.4 Decision Log & Audit Trail (`docs/PRD-v1.0.md:5103`)
**Story mãe:** `docs/stories/epic-006/story-016.md` (cria o `DecisionLogEntry` como
subproduto do fluxo de aprovação)

> Por que uma história separada da 016: a 016 trata o `DecisionLogEntry` como **efeito**
> do workflow de aprovação — quem aprovou, quem rejeitou, quem deu bypass. Esta história
> trata a **superfície** `/cosmos/decisions`: o log como artefato que um auditor externo
> lê e leva embora. São requisitos diferentes (quem pode ler, o que sai no export, o que
> nunca pode ser alterado) e o FR-010 os enumera separadamente.

---

## Jornada do usuário

Chega um pedido de auditoria: "produza o histórico completo de quem aprovou cada
iniciativa relevante nos últimos 12 meses". Hoje esse pedido se responde com thread de
e-mail. O Decision Log existe para ser a resposta.

A Portfolio Manager abre **Portfólio · Governança → Decision Log**. Vê a lista
cronológica: título, decisão, justificativa, tipo, data, tags e quem decidiu. Registra
uma decisão nova quando o comitê fecha um assunto. E, quando o auditor pede, exporta o
log inteiro em JSON — com metadados de quem exportou e quando, porque um export de
registro de governança que não deixa rastro é exatamente o buraco que o controle de
change management do SOC2 procura.

Três coisas o log **não** faz, por definição: não deixa editar entrada, não deixa apagar
entrada, e não é legível por qualquer membro do tenant.

---

## Acceptance Criteria

### AC-001: Leitura restrita
_(FR-010 "RLS SELECT for ORG_ADMIN/RTE/PORTFOLIO_MANAGER only"; FR-816 "view-only table
(RTE/ORG_ADMIN/PORTFOLIO_MANAGER)")_

Given um membro com papel fora de ADMIN/RTE/STE,
When ele chama a leitura do Decision Log,
Then a leitura é negada e **nenhuma** consulta ao `DecisionLogEntry` é feita.

> Mapeamento de vocabulário: a autorização do repo é `MemberRole`
> (`packages/database/prisma/schema/tenant.prisma:8`). ORG_ADMIN → `ADMIN`,
> PORTFOLIO_MANAGER → `STE`. É o mesmo trio que `createDecision` já exige para escrever;
> o log não deve ser mais aberto para ler do que para escrever.

### AC-002: Superfície append-only
_(FR-010 AC "Given a delete attempt on a DecisionLogEntry, Then 405 (no delete route
exists)"; FR-816 AC; PRD AC-7.4.4.2)_

Given o módulo de server actions do Decision Log,
When sua superfície pública é inspecionada,
Then não existe export algum que atualize ou apague uma entrada — só leitura, criação e
export. A ausência é o requisito: não há rota para retornar 405.

### AC-003: Export em JSON, cronológico e completo
_(FR-010 "PDF + JSON export"; FR-816 AC "all entries in chronological order with user IDs,
timestamps, rationale, and an export metadata footer"; PRD AC-7.4.4.1)_

Given entradas registradas no tenant,
When a Portfolio Manager exporta o log,
Then o payload traz:
- as entradas em ordem **cronológica ascendente** (a tela lista da mais recente para a
  mais antiga, porque é assim que se acompanha; o export vai do começo, porque é assim
  que se audita);
- por entrada: id, tipo, alvo, decisão, justificativa, tags, data, **id do decisor** e
  nome quando resolvível, e os dados de suporte guardados com a decisão;
- rodapé de metadados: quem exportou, quando, e o total de entradas.

E a consulta do export é filtrada por `tenantId` da sessão, como toda leitura.

### AC-004: O export é auditado
_(FR-010 "PDF + JSON export (itself audit-logged)"; PRD BR-7.4.4.2 "This prevents silent
data exfiltration of governance records")_

Given um export bem-sucedido,
When ele termina,
Then um registro de auditoria é gravado com o ator, o tenant e o total exportado.

Given a leitura do log falha,
Then nenhum registro de export é gravado — não se audita export que não aconteceu.

### AC-005: A tela distingue vazio, erro e lista
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given a leitura falha,
Then aparece o erro e nenhuma decisão é renderizada.

Given não há decisão registrada,
Then aparece o estado vazio e **o botão de export não aparece** — exportar um log vazio
gera um artefato de auditoria sem conteúdo e um registro de export inútil.

Given há decisões,
Then cada uma mostra título, justificativa, decisão, data e autor vindos do servidor.

---

## Technical Notes

- Sem migration. `DecisionLogEntry` já tem tudo (`decisorId`, `dataDecisao`,
  `justificativa`, `tags`, `dadosSuporte`) em
  `packages/database/prisma/schema/governance.prisma:120`.
- A imutabilidade em nível de banco (trigger INSERT-only) é da story-016 / trilha de
  schema. Aqui a garantia é de superfície: o módulo não expõe mutação.
- Export **PDF** (FR-010/FR-816) fica fora: exige biblioteca de renderização e um layout
  próprio. Registrado como lacuna no nó `docs/cosmos/nodes/decisions.json`. JSON é a
  metade do requisito que fecha sem dependência nova.
- O download é efeito colateral de browser (`Blob` + `URL.createObjectURL`), isolado num
  helper para o teste conseguir observar a chamada da action sem depender dele.

## Test Plan

- **Risco:** Médio-alto — é artefato de compliance; falha aqui é silenciosa até a
  auditoria.
- **Action** (`apps/app/__tests__/actions/decisions.test.ts`): leitura negada por papel
  sem tocar no banco; export tenant-scoped e ascendente; metadados do export; auditoria do
  export; ausência de export nenhum quando a leitura falha; superfície do módulo sem
  update/delete.
- **Tela** (`apps/app/__tests__/screens/decisions.test.tsx`): lista real, vazio, erro, e
  botão de export ausente no vazio / chamando a action quando há entradas. Asserção sobre
  conteúdo — sem snapshot.
