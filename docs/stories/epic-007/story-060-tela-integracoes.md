# Story 060 — Tela Integrações (ciclo de vida e saúde dos conectores)

**Epic:** epic-007 — Solution Train & Advanced Features
**Status:** pending
**Competência SAFe:** CONTINUOUS_DELIVERY_PIPELINE · **Nível:** Portfolio
**SRD:** FR-018 (`docs/srd-epic-007.md:201`), FR-020 (`docs/srd-epic-007.md:222`)
**Story mãe:** `docs/stories/epic-007/story-026.md`+`story-027.md` (Linear/GitHub sync)

> Por que uma história separada: as histórias de sync cobrem o *pipeline* (webhook, HMAC,
> idempotência, import). Nenhuma cobre **a tela `/cosmos/integrations`** — a superfície onde o
> Org Admin vê o que está conectado, se está sincronizando e desliga o que está fazendo estrago.
> Nenhum critério aqui é inventado: cada AC sai de FR-018 (ciclo de vida
> `PENDING/ACTIVE/ERROR/PAUSED/REVOKED`, "lifecycle connect/pause/resume/revoke",
> `docs/srd-epic-007.md:436`) ou de FR-020 (`SyncLog` imutável, saúde de sincronização).

---

## Jornada do usuário

O Org Admin abre **Plataforma → Integrações** quando o Linear começa a sobrescrever status
errado. Ele precisa de três coisas, nessa ordem:

1. **O que está conectado e como está passando?** Cada conector mostra o estado real e a saúde da
   última sincronização — quantos itens entraram, quantos foram pulados, se houve erro. Isso sai
   de `SyncLog`, que FR-020 define como registro imutável; conector sem log algum diz "nunca
   sincronizado", não inventa um horário.
2. **Como paro o estrago agora?** Ele pausa o conector. FR-018 já descreve o efeito: webhook que
   chega numa integração `PAUSED` vai para a dead-letter queue, devolve 200 e **não altera dado
   do Cosmos** — as rotas de ingestão já implementam isso, e a tela é quem faltava para colocar a
   integração nesse estado.
3. **A credencial ainda vale?** Ele testa a conexão. O teste usa a credencial **já guardada**
   (cifrada, no servidor); a tela nunca pede token nem exibe o que está gravado.

---

## Acceptance Criteria

### AC-001: Pausar e retomar escrevem o estado do ciclo de vida
_(FR-018 "Integration lifecycle (PENDING/ACTIVE/ERROR/PAUSED/REVOKED)"; FR-018 AC "Given a PAUSED
integration, When a Linear webhook arrives, Then it is stored in the dead-letter queue, HTTP 200
returned, and no Cosmos data modified")_

Given uma integração `ACTIVE`,
When um ADMIN/STE pausa,
Then `status` vira `PAUSED`, a ação é auditada com o estado anterior, e nada mais da linha muda —
`config`, `mapping` e `lastSyncAt` ficam intactos, porque pausar não é desconectar.

Given uma integração `PAUSED`,
When é retomada,
Then `status` volta para `ACTIVE`.

### AC-002: Testar conexão usa a credencial guardada — a tela nunca pede segredo
_(FR-018 "OAuth PKCE, encrypted `config`"; NFR `docs/srd-epic-007.md:372` "Third-party credentials
... never logged/returned")_

Given uma integração com credencial gravada,
When um ADMIN/STE testa a conexão,
Then o servidor decifra a credencial **dentro** da action, chama o conector e devolve apenas o
veredito — nenhum pedaço da credencial entra na resposta, no log de auditoria ou na tela.

Given uma integração cujo `config` não tem credencial (por exemplo, a linha veio de seed),
When o teste roda,
Then é recusado dizendo exatamente isso, e nenhuma chamada externa é feita.

Given o teste passa,
Then `status` vira `ACTIVE`; **exceto** se a integração estava `PAUSED`, caso em que continua
`PAUSED` — testar não é retomar, e um teste que despausasse sozinho reabriria o estrago que o
Admin acabou de conter.

Given o teste falha,
Then `status` vira `ERROR` — também sem tocar em integração `PAUSED`.

### AC-003: Toda escrita é privilegiada, guardada por tenant e auditada
_(FR-018 "Actors: Org Admin/OWNER"; NFR `docs/srd-epic-007.md:378` "integration lifecycle ...
written to immutable audit trail")_

Given um papel fora de `ADMIN`/`STE`,
When pausa, retomada ou teste é submetido,
Then é recusado e **nada** é gravado.

Given um id de integração de outro tenant,
When qualquer uma das três é submetida,
Then é recusada pela reconferência de `tenantId` e nada é gravado.

### AC-004: Saúde de sincronização vem de `SyncLog`, nunca é estimada
_(FR-020 "`SyncLog` model (immutable, resumable cursors, PARTIAL no-rollback)")_

Given uma integração com histórico de sincronização,
When a tela carrega,
Then o card mostra o resultado da última sincronização e os itens criados/atualizados/pulados
dela, lidos de `SyncLog`.

Given uma integração sem `SyncLog` algum,
When a tela carrega,
Then diz "nunca sincronizado" — e nenhum contador aparece zerado como se tivesse rodado.

Given uma sincronização `partial`,
When a tela carrega,
Then ela é distinguida de `success`: FR-020 diz que PARTIAL não faz rollback, então parcial é um
estado real que o Admin precisa ver, não um sucesso arredondado.

### AC-005: Nem a listagem nem a tela expõem credencial ou mapeamento
_(NFR `docs/srd-epic-007.md:372`)_

Given qualquer integração,
When a listagem é montada,
Then `config` e `mapping` **não** são selecionados — nem para mascarar. O que não é lido não
vaza por acidente de log ou de serialização.

### AC-006: Estado vazio e estado de erro sem conexão fabricada
_(audit `docs/superpowers/plans/2026-07-23-AUDIT-cosmos-screen-depth.md`, eixo "Data integrity")_

Given `listIntegrations` falha,
When a tela carrega,
Then aparece a mensagem de erro e nenhuma integração é renderizada.

Given o tenant não configurou conector algum,
When a tela carrega,
Then todos os cards do catálogo aparecem como "disponível" — nunca como conectado, e sem
horário de sincronização.

---

## Technical Notes

- **Sem migration.** `Integration.status` é `String` livre (`packages/database/prisma/schema/system.prisma:143`);
  `PAUSED` já é lido pelas rotas `POST /api/webhooks/linear` e `/api/webhooks/github`. O que
  faltava era **produtor**: nenhuma action deste app escrevia `PAUSED`, então o caminho de DLQ
  estava escrito, testado e inalcançável pelo produto.
- **O catálogo de conectores continua estático.** `CONNECTOR_CATALOG` (logo/categoria/descrição por
  tipo de conector) é metadado de produto, não dado de tenant. `Integration` não tem colunas
  `category`/`description`/`logo` e criá-las não vale uma migration.
- **"Conectar" continua diferido.** Conectar exige entrada de credencial ou OAuth — outro
  subsistema (`packages/database/prisma/schema/integrations-vault.prisma`). Esta tela não coleta
  segredo e não finge que coleta. Lacuna registrada no nó.
- **Revogar/apagar não entra.** `Integration` tem `billingEntries`/`billingSyncCursor` com
  `onDelete: Cascade`; apagar a integração levaria junto o histórico de custo do FinOps. Pausar é
  reversível e não destrói nada — é a operação certa para esta tela.
- O teste de conexão reusa `linearTestConnection`/`githubTestConnection` de
  `app/actions/integrations/connectors/`, os mesmos do wizard maduro; não há segundo cliente HTTP.

## Test Plan

- **Risco:** Alto — pausar muda o comportamento de ingestão de webhook em produção.
- **Action** (`apps/app/__tests__/actions/cosmos-integrations.test.ts`): leitura filtra por
  `tenantId` e nunca seleciona `config`/`mapping`; pausar/retomar/testar **fecham** para papel sem
  permissão e para id de outro tenant; pausar grava `PAUSED` sem tocar em `config`; teste sem
  credencial não chama conector; teste bem-sucedido não despausa integração pausada; auditoria em
  todas as três.
- **Tela** (`apps/app/__tests__/screens/integrations.test.tsx`): estado pausado visível; saúde da
  última sincronização vinda de `SyncLog`; "nunca sincronizado" sem log; parcial distinguido de
  sucesso; ausência de campo de credencial. Asserção sobre conteúdo — sem snapshot.
- **Seed** (`packages/database/scripts/seed-cosmos.mts`): duas integrações no tenant demo — uma
  ativa com histórico de `SyncLog` (um sucesso e um parcial) e uma pausada sem histórico. `config`
  vai **vazio**: inventar uma credencial no seed seria gravar um segredo falso, e o efeito honesto
  disso é o teste de conexão dizer "sem credencial configurada".
