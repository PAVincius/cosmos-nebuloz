# Scaffold — Software Requirements Document

> **PRODUCT** Scaffold · **COMPANION** [Scaffold PRD](./scaffold-prd.md)
> **STATUS** Engineering draft · **VERSION** 1.0 · **AUDIENCE** Engenharia, Segurança

O Scaffold responde "O que foi prometido?": gate bloqueante por fase e caso de negócio assinado, que o Signal apura e nunca edita.

---

## 1. Escopo

Especifica o Scaffold da main (`ea512044`): o app do cliente em `apps/app` (rota `/scaffold`, cinco telas), a fila de gates em `apps/backoffice`, o schema de 19 modelos, a matriz de papéis de adoção, duas varreduras Inngest e as fronteiras com Meridian, Charter e Signal. O [PRD companheiro](./scaffold-prd.md) descreve a leitura de serviço; a nota de 2026-09-02 no topo dele registra a decisão pelo produto, que é o que este documento especifica, e o conflito que sobrou está na §6.

O alvo é o [Mapa de fronteiras (Arquitetura de produto, ago/2026 v1)](./mapa-de-fronteiras.md): o Scaffold está em CONTRATAR e é dono do baseline, do caso de negócio e de engajamento, fase e gate. O código é o estado. Cada requisito diz o estado na main — implementado, parcial ou ausente — com a evidência; **gap** marca a distância até o mapa e diz o que teria de mudar; [inferido] marca leitura de código não reproduzida em banco.

**Fora de escopo:** preço e RACI (PRD §5, §6 e §9), sync com o tracker do cliente (S-13), envio de notificação, residência de dado (ADR-0016) e as trilhas de IA de `docs/produto/trilhas/`, que não viraram template.

Evidência abreviada: `actions/` = `apps/app/app/(scaffold)/actions/` · `lib/` = `apps/app/lib/scaffold/` · `ui/` = `apps/app/components/scaffold/` · `inngest/` = `apps/app/lib/inngest/` · `bo/` = `apps/backoffice/` · `rbac/` = `packages/rbac/src/` · `schema` = `packages/database/prisma/schema/scaffold.prisma` · `tests/` = `apps/app/__tests__/scaffold/`.

### Definições

| TERMO | SIGNIFICADO |
|---|---|
| CONTRATAR | Lugar do Scaffold na cadeia do mapa; o site chama o mesmo degrau de "Estruturar" |
| Trilha (`TR-nnn`) | Um processo do cliente em Assess, Pilot, Scale e Embed, com versão de método pinada |
| Gate · critério | Decisão que fecha a fase; critério MANUAL ou DERIVED, hoje todos marcados à mão |
| Override | Fechamento com critério não atendido: ator, critérios dispensados e justificativa, sem edição |
| Caso de negócio (`BC-nnn`) | O baseline versionado e assinado; "promessa" na tela |

### Requisitos funcionais do spec na main

| ID | REQUISITO | ESTADO | ONDE |
|---|---|---|---|
| S-01 | Trilha nasce de lacuna do Meridian | implementado | §6 · `actions/tracks.ts:115-173` |
| S-02 | Quatro fases com gate bloqueante | implementado | §5.1 |
| S-03 | Gate assinado por aprovador nomeado; override só com justificativa | parcial | §5.2 · SA-08 |
| S-04 | Passo com artefato esperado e estado de conclusão | implementado | `actions/steps.ts:57-194` |
| S-05 | Templates versionados; customização do cliente sobrevive a upgrade | parcial | §5.5 |
| S-06 | Baseline da Fase 1 no schema que o Signal consome | parcial · gap | §5.6 · §6 |
| S-07 | Portfólio com trilha, fase, dono e bloqueio | implementado | `actions/tracks.ts:230-381` |
| S-08 | Fila cross-cliente da consultora | parcial | §2 |
| S-09 | Estagnação acima do limiar | parcial | SN-07 |
| S-10 | Handover pack ao fechar a Fase 4 | parcial | §5.4 |
| S-11 | Política do Charter na Fase 3 | parcial | SG-05 |
| S-12 | Templates por arquétipo | implementado | 3 templates, 6 versões (`packages/database/scripts/scaffold-templates.ts:199-337`) |
| S-13 | Sync com o tracker do cliente | ausente | fora de escopo (`specs/002-scaffold-adoption/spec.md:122`) |

---

## 2. Arquitetura

```
CLIENTE (tenant)                              NEBULOZ (staff)
apps/app · /scaffold/[[seg]] · cinco telas    apps/backoffice · Fila de gates
  ▼ sessão → módulo → papel (lib/guards.ts)     ▼ requirePlatformStaff, com 2FA
actions/ · scaffoldAction · withTenantDb      listGateQueue · enterTenantContext
  ▼ AuditLog na mesma transação                 ▼ platformDb (ADR-0013) · AccessLog
  └─────────────▶ PostgreSQL · 19 modelos ◀─────┘
Storage "scaffold-artefacts" (privado, 10 MB) · Inngest: 0 3 * * * e 0 4 * * *
Meridian ──promoção──▶ Scaffold ──JSON baseline/2, baixado à mão──▶ Signal
Charter ──política publicada──▶ gate da Scale (SG-05)
```
*FIGURA 1 — TOPOLOGIA. O CLIENTE ENTRA POR `apps/app`; A CONSULTORA VÊ A CARTEIRA NO BACK-OFFICE E SÓ LÊ CONTEÚDO ENTRANDO NO CLIENTE.*

| COMPONENTE | RESPONSABILIDADE |
|---|---|
| `apps/app/app/(scaffold)/layout.tsx` · `lib/guards.ts` · `rbac/scaffold-*.ts` | Guard de navegação e de action; matriz e resolução de papel |
| `lib/gate-machine.ts` · `actions/gates.ts` | Tabela de transição pura; dono único do fechamento |
| `actions/tracks.ts` · `actions/steps.ts` · `actions/business-case.ts` | Trilha, portfólio, passo, artefato e caso de negócio |
| `actions/templates.ts` · `lib/overlay-merge.ts` | Versão de método, overlay e conflito |
| `actions/export.ts` · `inngest/scaffold-stall.ts` · `inngest/scaffold-observation.ts` | JSON para o Signal, pacote offline, estagnação e fim da janela de 30 dias |

> **CONTRATO DE ACTION**
> Toda action devolve `Result<T>` por `scaffoldAction`, que preserva o código da recusa e os bloqueios para a tela (`lib/action.ts:29-50`). `tenantId` e ator vêm da sessão. Cada action é uma transação de `withTenantDb` (`packages/database/tenant-db.ts:20-33`), e o audit entra nela (`actions/_shared.ts:28-78`): audit que falha derruba a escrita.

### O lado da consultoria (back-office, ADR-0017)

| PEÇA | ESTADO | EVIDÊNCIA |
|---|---|---|
| Fila: "Aguardando decisão", "Bloqueado", "Em observação"; trilhas ACTIVE/STALLED; sem paginação | implementado | `bo/app/actions/scaffold-supervision.ts:84-177`; `bo/app/(staff)/scaffold/fila-de-gates.tsx:73-101` |
| "Entrar no cliente": motivo de 12+ caracteres, `AccessLog` LOGIN, devolve `/scaffold/track/<id>` | parcial: o destino abre no próprio back-office, que não tem a rota [inferido] | `scaffold-supervision.ts:196-243`; `fila-de-gates.tsx:243` |
| Consultora opera dentro do cliente | ausente: exige `ScaffoldMembership` CONSULTANT ali (SA-05) | `ui/new-track-modal.tsx:98-105` |
| Materialização em `Engagement` (ADR-0014) | parcial: actions sem tela desde `37ecceb9` (2026-09-20); só testes as chamam | `bo/app/actions/scaffold.ts:50-307` |
| Contratação do módulo e rateio de CAC | implementado | `bo/app/(staff)/clientes/[slug]/module-form.tsx`; `bo/app/(staff)/empresa/cac/painel.tsx:155` |
| Bootstrap de papéis de adoção | ausente | `bo/app/actions/provisioning.ts:5-6` só tem Charter e Meridian |

---

## 3. Modelo de dados

```
Tenant ──1:N── Membership (userId, role) · Settings · Sequence
Tenant ──1:N── Track ──N:1── TemplateVersion (pinada) · TemplateOverlay (nunca aplicado)
                ├──1:4── PhaseInstance ──1:N── StepInstance ──1:N── Artefact
                │         └──1:N── GateResult (um por ciclo) ──0:1── GateOverride
                └──0:1── BusinessCase ──1:N── BusinessCaseVersion ──1:N── BusinessCaseMetric
                          └──1:N── BusinessCaseContest
MÉTODO, global: Template ──1:N── TemplateVersion ──1:N── StepTemplate · GateCriterion
POR TENANT:     TemplateOverlay ──1:N── OverlayConflict
MeridianGapPromotion.targetEntityId ◀··▶ Track.sourcePromotionId    (texto, sem FK)
```
*FIGURA 2 — 19 MODELOS E 12 ENUMS EM `scaffold.prisma`, PREFIXO `Scaffold` OMITIDO. MIGRATION ÚNICA: `20260902170100_scaffold_adocao`.*

| ENTIDADE | CAMPOS-CHAVE | NOTA |
|---|---|---|
| `ScaffoldMembership` | `tenantId`, `userId`, `role` | única fonte do papel de adoção; nada a escreve |
| `ScaffoldTrack` | `templateVersionId`, `overlayId`, `sourceGapId`, `status`, `currentPhase`, `lastGateAt` | `lastGateAt` alimenta a estagnação |
| `ScaffoldPhaseInstance` · `ScaffoldStepInstance` | `state`, `observationEndsAt`, `reopenCountAtClose` · `statement`, `required` | sem `tenantId`; texto do passo copiado do template (ST-03) |
| `ScaffoldArtefact` | `objectKey`, `filename`, `sizeBytes` | sem `tenantId`; isolado só pelo `where` da action |
| `ScaffoldGateResult` · `ScaffoldGateOverride` | `cycle`, `approverId`, `criteriaSnapshot` · `actorId`, `unmetCriteria`, `rationale` | um resultado por `[tenantId, phaseInstanceId, cycle]` |
| `ScaffoldBusinessCase` · `…Version` | `currentVersionId`, `signedVersionId`, janela, benefício · `state`, `signedByLabel`, `contentHash` | métricas pendem da versão; janela e benefício, do caso (SB-07) |

**Append-only é convenção testada, não trigger.** Resultado, override e versão de template não têm `updatedAt`, e nenhuma action os altera (`tests/gates-append-only.test.ts`; `tests/templates.test.ts`); ao contrário do `AuditLog`, nenhum trigger os protege, e a FK apaga em cascata a partir do tenant e da fase (`schema:513-514`). O cabeçalho do schema diz que toda tabela tem `tenantId` (`schema:15`); sete das dezenove não têm (`packages/database/prisma/migrations/20260902170100_scaffold_adocao/migration.sql:596-609`).

---

## 4. O guard

O layout e toda action passam pelos mesmos quatro portões (`lib/guards.ts:18-86`). O layout protege navegação; não protege RPC.

```
requisição      ──sem sessão ───────────────▶ UNAUTHORIZED → /sign-in
  ▼ requireTenantSession
módulo SCAFFOLD ──sem TenantModule ativo ───▶ FORBIDDEN → /scaffold-indisponivel
  ▼
papel de adoção ──sem ScaffoldMembership ───▶ FORBIDDEN → "peça a um consultor"
  ▼ o admin do tenant não herda papel
matriz          ──papel sem a permissão ────▶ FORBIDDEN → "Requer papel X — ação"
  ▼ ScaffoldContext { tenantId, userId, scaffoldRole }
```
*FIGURA 3 — ORDEM DAS PERGUNTAS. O TERCEIRO PORTÃO NÃO TEM, HOJE, COMO SER ABERTO SEM SQL.*

| ID | REQUISITO DE GUARD | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SA-01 | Toda action repete sessão, módulo, papel e permissão | implementado | `lib/guards.ts:52-86`; `tests/guard.test.ts` |
| SA-02 | Sem `ScaffoldMembership` não há acesso, nem para o admin do tenant | implementado | `lib/guards.ts:56-65`; `rbac/scaffold-resolve.ts:10-29` |
| SA-03 | Matriz sem coringa: override só do Consultor, assinatura só do Dono do processo | implementado | `rbac/scaffold-matrix.ts:84-131` |
| SA-04 | Controle negado diz qual papel falta ("Requer papel X — ação") | implementado | `rbac/scaffold-matrix.ts:152-159` |
| SA-05 | Existe caminho para atribuir papel de adoção | ausente · P0 | nenhuma escrita de `scaffoldMembership` em `apps/` ou `packages/` |
| SA-06 | Mudança de papel vale na requisição seguinte | ausente | `invalidateScaffoldRoleCache` sem chamador; cache de 300 s, também para "sem papel" (`rbac/scaffold-resolve.ts:14,31-60`) |
| SA-07 | Ator de override e de assinatura vem da sessão | implementado | `actions/gates.ts:435-455`; `actions/business-case.ts:272-281` |
| SA-08 | Aprovador do gate é pessoa nomeada com papel | parcial | `approverId` vem do payload e não é conferido (`lib/schemas.ts:124-130`); a tela manda sempre o dono (`ui/screens/track-detail.tsx:207`) |
| SA-09 | Papel de adoção é lente sobre usuário e papel do Charter, sem segundo modelo (mapa) | ausente · gap | `ScaffoldMembership` (`schema:103`) e matriz própria (`rbac/scaffold-matrix.ts:84-131`) |

> **BLOQUEIO P0 — NINGUÉM RECEBE PAPEL DE ADOÇÃO**
> O terceiro portão exige `ScaffoldMembership`, e nada no repositório a escreve: nem bootstrap no back-office, nem tela no cliente, nem seed. A recusa manda "pedir a um consultor" (`apps/app/app/scaffold-indisponivel/page.tsx:100-102`), e a matriz diz que o Administrador "gerencia ScaffoldMembership" (`rbac/scaffold-matrix.ts:10`), sem action para isso. Sem membros, o modal de nova trilha não tem dono a oferecer. Hoje, entrar exige SQL.
>
> O mapa soma um gap (SA-09): papel é do Charter, e persona de produto é lente sobre ele, "nunca um segundo modelo de permissão". Teria de mudar: o papel de adoção deriva do papel do Charter, e `ScaffoldMembership` deixa de ser fonte de permissão. **Pergunta ao dono:** a atribuição nasce no modelo de papel do Charter, como o mapa pede, ou num bootstrap provisório no back-office até lá?

---

## 5. Gate engine e caso de negócio

O spec é categórico: fechar fase sem critérios atendidos ou override atribuído é defeito de severidade máxima (`specs/002-scaffold-adoption/spec.md:135-138`). Só `actions/gates.ts` grava CLOSED e OBSERVING, e `tests/gates-architecture.test.ts` falha se outro arquivo tentar.

### 5.1 Máquina de fase e bloqueio

```
IDLE             ──a fase anterior fecha───▶ OPEN
OPEN             ──passos requeridos DONE──▶ GATE_READY       · desmarcar volta a OPEN
GATE_READY       ──critérios atendidos─────▶ CLOSED
GATE_READY       ──critério não atendido───▶ BLOCKED          · sem resultado gravado
BLOCKED          ──atendidos, ou override──▶ CLOSED           · override só daqui
CLOSED           ──se a fase é a EMBED─────▶ OBSERVING        · janela de 30 dias
OBSERVING        ──30 dias sem reabrir─────▶ trilha EMBEDDED  · a fase segue OBSERVING
CLOSED|OBSERVING ──reabrir, com motivo─────▶ OPEN             · REOPENED não é gravado
```
*FIGURA 4 — `lib/gate-machine.ts:44-75`. O QUE NÃO ESTÁ NA TABELA É REGRA: NÃO HÁ OPEN → CLOSED, OVERRIDE A PARTIR DE GATE_READY, NEM OBSERVING → CLOSED.*

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SG-01 | GATE_READY só com todo passo requerido DONE | implementado | `actions/steps.ts:91-115`; `actions/gates.ts:89-97` |
| SG-02 | CLOSED só com critérios atendidos ou override | implementado | `actions/gates.ts:317-382`; `tests/gates-negative.test.ts` |
| SG-03 | Override com ator, critérios dispensados e justificativa | implementado | §5.2 |
| SG-04 | Assess só fecha com caso de negócio assinado; override não dispensa | implementado · sem saída (P0) | `actions/gates.ts:113-121,408-413` |
| SG-05 | Scale exige aceite de política do Charter quando o Charter está ACTIVE/TRIAL | parcial | `actions/gates.ts:130-150`; o aceite grava qualquer `policyId`, em qualquer fase (`:532-562`) |
| SG-06 | Fechar a Embed abre 30 dias; EMBEDDED só sem reabertura | parcial | §5.3 |
| SG-07 | Resultado e override append-only, um por ciclo | implementado | `actions/gates.ts:242-260,477-483`; `tests/gates-append-only.test.ts` |
| SG-08 | Taxa de override por organização no portfólio; `null` sem gate fechado | implementado | `actions/tracks.ts:273-277,346-349`; `lib/stall.ts:42-50` |

A recusa segue a ordem passos (SG-01), baseline (SG-04), Charter (SG-05), critérios (SG-02) (`actions/gates.ts:330-335`). Critério sem fato conta como não atendido, e chave desconhecida é ignorada (`lib/gate-machine.ts:147-165`). O snapshot congela enunciado, `met` e nota (`actions/gates.ts:242-260`). Fechar avança `currentPhase` e abre a fase seguinte só se ela estiver IDLE (`:283-306`). Reabrir pede motivo de 20+ caracteres, grava OPEN, limpa `closedAt` e `observationEndsAt` e não fecha a fase seguinte, que pode já estar aberta (`:484-529`).

> **ACHADO [inferido] — O BLOQUEIO PODE NÃO FICAR GRAVADO**
> `closePhase` grava BLOCKED e em seguida lança `CRITERIA_UNMET` (`actions/gates.ts:347-356`) dentro da transação de `withTenantDb`; o erro desfaz a transação, BLOCKED inclusive. Se confirmado em banco, a fase volta a GATE_READY, "Registrar override" não aparece (`ui/gate-panel.tsx:233`) e `overridePhase` cai em `GateTransitionError`. Os testes usam Prisma em mock e não pegam isso; falta teste de integração em banco.

### 5.2 Override atribuído e justificado — implementado no servidor; pela tela, depende do achado acima

- Só o Consultor tem `gate.override` (`rbac/scaffold-matrix.ts:111-122`), e só a partir de BLOCKED (`lib/gate-machine.ts:65-71`).
- Pede ao menos um critério e justificativa de 20 a 10.000 caracteres depois do trim (`lib/schemas.ts:35-45`). A recusa sai do Zod: `RATIONALE_REQUIRED` e `UNMET_CRITERIA_REQUIRED` existem em `lib/errors.ts:23-24`, e nada os lança.
- Ator e aprovador vêm da sessão; override não dispensa passo, baseline nem política (`actions/gates.ts:408-455`). Resultado OVERRIDDEN, override e audit com a justificativa entram na mesma transação (`:435-467`).
- O snapshot marca os dispensados como não atendidos e todos os outros como atendidos, sem fato marcado. As chaves não são conferidas contra a fase: uma chave inexistente faria o snapshot dizer "tudo atendido" (`:420-433`) [inferido].

### 5.3 Fechamento com 30 dias sem a Nebuloz — parcial

- Fechar a Embed grava OBSERVING, `observationEndsAt` = agora + 30 dias e congela `reopenCountAtClose` (`actions/gates.ts:226-277`). O cron `0 4 * * *` marca EMBEDDED a trilha ACTIVE ou STALLED cuja janela venceu sem reabertura; a janela vence no 30º dia, e a fase não é tocada (`inngest/scaffold-observation.ts:21-79`; `lib/observation.ts:42-69`).
- "Processo sobrevive 30 dias sem envolvimento da Nebuloz" é critério DERIVED que nada calcula: para fechar a Embed, alguém o marca à mão ou o Consultor o dispensa, antes de a janela existir (`packages/database/scripts/scaffold-templates.ts:111-117`) [inferido].
- O mesmo vale para "Handover pack entregue e aceito pelo time" e para o passo requerido "Gerar handover pack", mas o pacote só sai depois do fechamento (`scaffold-templates.ts:95-110`; `actions/export.ts:185-190`).
- Reabrir a Embed depois de EMBEDDED volta a fase a OPEN e não mexe no status: a trilha segue EMBEDDED (`actions/gates.ts:499-515`) [inferido].
- A varredura de estagnação não exclui a janela: no limiar padrão de 14 dias, a trilha em observação vira STALLED (`inngest/scaffold-stall.ts:57-86`) [inferido].

### 5.4 Pacote offline — parcial

- Só sai com a Embed fechada (`HANDOVER_NOT_READY`), e basta `artefact.read`, que os cinco papéis têm (`actions/export.ts:140-190`).
- `index.html` com estilo inline, sem script, sem fonte remota e sem URL da plataforma, com texto do cliente escapado (`lib/handover-pack.ts:1-13,79-86`); artefatos baixados do storage e embutidos por fase (`actions/export.ts:297-311`).
- Aprovador e autor do override saem como id de usuário, não como nome (`actions/export.ts:251,255`): quem abre sem conta não sabe quem decidiu.
- O ZIP fica gravado no bucket em `<tenant>/handover/` (`actions/export.ts:313-318`), ao contrário do comentário "não há cópia intermediária" (`:137-138`). Não houve validação com usuário (SC-006).

### 5.5 Método versionado, customização como operações

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| ST-01 | Versão publicada é imutável | implementado | sem `updatedAt` (`schema:166-175`); rótulo repetido recusa (`actions/templates.ts:220-231`); o seed só cria |
| ST-02 | Overlay sobrevive ao upgrade ou vira conflito explícito | parcial | detecção pronta (`lib/overlay-merge.ts:144-202`); `publishVersion` só reaplica overlays do tenant de quem publica (`actions/templates.ts:265-268`); a tela só resolve `keep_overlay` (`ui/screens/templates.tsx:291-298`) |
| ST-03 | Trilha em curso não muda com a publicação | implementado | passos copiados (`actions/_seed-track.ts:116-127`); critérios lidos da versão pinada (`actions/gates.ts:73-85`) |
| ST-04 | Trilha diz qual versão e qual overlay produziram seus passos | parcial | as colunas existem; o overlay nunca é aplicado — `applyOverlay` só tem chamador em teste |

- Trilha nova usa a versão mais recente; overlay com conflito pendente recusa a criação (`actions/_seed-track.ts:20-80`). Operações ADD, REMOVE e REPLACE, até 50; conflito é TARGET_REMOVED, TARGET_ADDED_UPSTREAM ou BOTH_EDITED, e REMOVE concordante não conta (`lib/overlay-merge.ts:43-202`). Publicar não falha por conflito.
- Sem botão, por decisão: `publishVersion`, `saveOverlay`, `getTemplate` e `evaluateGate` (`.claude/completions/2026-09-16-scaffold-ui-wiring.md:72-84`); versão nova só entra por `seed:scaffold`. `template.publish` é de Consultor e Admin do tenant cliente, e `publishVersion` grava versão global (`rbac/scaffold-matrix.ts:113-130`; `actions/templates.ts:233-262`) — risco para quando houver editor.

### 5.6 Caso de negócio

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SB-01 | O caso de negócio nasce no Scaffold, ligado à trilha (mapa) | ausente · gap · P0 | nenhum `scaffoldBusinessCase.create`; `nextCode` só com `kind: "track"` (`actions/_seed-track.ts:92-97`) |
| SB-02 | Rascunho: métricas trocadas em bloco (até 20), janela de 1 a 36 meses, cadência, benefício | parcial | `actions/business-case.ts:95-160`; nenhuma tela chama `saveDraft` |
| SB-03 | Envio exige versão DRAFT com ao menos uma métrica | implementado | `actions/business-case.ts:163-204` |
| SB-04 | Assinatura: só Dono do processo, versão AWAITING, nome digitado de 4+ caracteres; grava `contentHash`; a anterior vira SUPERSEDED | implementado | `actions/business-case.ts:218-309` |
| SB-05 | Contestação: objeção de 20+ e pedido de 4+ caracteres; CONTESTED mantém a Assess bloqueada | implementado | `actions/business-case.ts:317-364` |
| SB-06 | Versão nova clona as métricas e não toca `signedVersionId` | implementado | `actions/business-case.ts:378-452` |
| SB-07 | Assinado é imutável (mapa, ADR-0015) | parcial · gap | janela e benefício pendem do caso, e `saveDraft` os reescreve sobre a versão assinada (`actions/business-case.ts:133-147`; `schema:557-573`) [inferido] |
| SB-08 | `contentHash` prova a promessa: 8 hex de SHA-256 sobre métricas, janela e benefício | parcial | `lib/business-case-hash.ts:50-93`; janela sem início entra vazia no hash e vira a data da assinatura depois (`actions/business-case.ts:238,290`) |
| SB-09 | Versão e caso conferem entre si ao assinar e contestar | ausente | `actions/business-case.ts:226-232,325-329` |
| SB-10 | Visto de Finanças no benefício | ausente | `financeReviewedAt` só é lido (`actions/export.ts:91`) |

Quem assina: a matriz dá `businesscase.sign` só ao Dono do processo (`rbac/scaffold-matrix.ts:94-100`), e o comentário do enum diz que o sponsor é um Líder de transformação que assina (`schema:72-78`). O patrocinador sem conta assina pelo nome digitado na sessão do Dono: `signedById` é a sessão, `signedByLabel` é o nome (`actions/business-case.ts:272-281`). Para fechar os gaps, o caso nasce no Scaffold (SB-01), e janela e benefício passam a pender da versão, de modo que mudar depois da assinatura exija versão nova com justificativa, como a costura do mapa pede (SB-07).

> **BLOQUEIO P0 — A ASSESS NÃO FECHA** [inferido]
> SG-04 exige `signedVersionId` e não aceita override. Nenhuma action cria `ScaffoldBusinessCase`, nenhuma tela edita métricas, e a lista de casos manda "emitir um caso de negócio a partir do gate de Assess" (`ui/screens/baselines.tsx:201`) — gatilho que não existe. No Meridian, "Virar caso de negócio" cria promoção que vira trilha, não caso (`apps/app/components/meridian/screens/gap-register.tsx:295-299`). Sem SQL, toda trilha para na Fase 1. **Pergunta ao dono:** onde nasce o caso de negócio — no gate de Assess? — e quem o redige: a consultoria ou o cliente?

---

## 6. Interfaces

No mapa, o Scaffold vem depois de AVALIAR (Meridian) e antes de EXECUTAR (Cosmos) e APURAR (Signal). O alvo é o mapa, salvo onde a linha diz outra fonte; **gap** diz o que falta para chegar lá.

| ITEM | ALVO | NA MAIN | ESTADO |
|---|---|---|---|
| Baseline e caso de negócio · dono Scaffold | costura crítica; leem Signal e Cosmos | modelo, versão e assinatura existem, mas o caso não nasce (SB-01); nem Signal nem Cosmos leem | parcial · gap |
| Engajamento, fase, gate · dono Scaffold | leem Cosmos e Big Bang | o back-office lê a fila e também cria `Engagement` próprio (conflito abaixo); o Cosmos não lê | parcial · gap |
| Costura Scaffold → Signal · baseline assinado | passa métrica, linha de base, meta, janela, signatário e versão; imutável; o Signal não edita e não apura sem baseline ("aguardando promessa", não zero) | `exportBusinessCase` emite `nebuloz.signal.baseline/2` (e v1 derivado) só de versão assinada, a qualquer papel, em download manual (`actions/export.ts:42-125`; `ui/screens/baseline-detail.tsx:101-123`); o Signal não importa e captura baseline próprio (`packages/database/prisma/schema/signal.prisma:172`; `specs/003-signal-measure/spec.md:69-71`) | parcial · gap |
| Costura Signal → Scaffold · lição de encerramento | benefício final, variância e lição viram insumo do template, sem reabrir a trilha | nenhum campo, nenhuma leitura | ausente · gap |
| Gap register · dono Meridian | o Scaffold lê; o gap segue do Meridian | `promoteGap(SCAFFOLD)` grava `targetEntityId` nulo (`apps/app/app/(meridian)/actions/gaps.ts:391-449`); o portfólio lista as pendentes, e `createTrackFromGap` grava o id da trilha na promoção sem conferir `targetProduct` (`actions/tracks.ts:123-156,281-295`) | implementado · gap: escreve em entidade do Meridian |
| Avaliação de prontidão · dono Meridian | o Scaffold usa o score para escolher template | template escolhido à mão (`ui/new-track-modal.tsx:53-64`) | ausente · gap |
| Escala de confiança · dono Meridian | vocabulário único | mesmos três níveis, em enum e rótulos próprios (`schema:707`; `ui/metric-row.tsx:9-27`) | parcial · gap |
| Hierarquia de portfólio · dono Cosmos | o Scaffold lê | nenhuma leitura | ausente · gap |
| Política · dono Charter | produto avalia contra a política; violação vira evento no Charter, não flag privado | lê política publicada para SG-05, mas aceite e bloqueio ficam no Scaffold (`actions/tracks.ts:522-540`; `actions/gates.ts:130-150,532-562`) | implementado · gap |
| Costura Scaffold → Charter · evento de auditoria | formato do Charter, registro canônico único | grava no `AuditLog` único, com o diff `[campo, antes, depois]` usado por Charter e Meridian (`actions/_shared.ts:28-78`) | implementado |
| Lacuna resolvida no Meridian | PRD §4: a entrega termina com a lacuna RESOLVED | nada escreve em `MeridianGap` | ausente |

O mapa separa gate de fase (Scaffold), de ciclo de vida (Cosmos) e de política (Charter). Na main, o gate de fase só consulta o do Charter como pré-condição da Scale e não troca nada com o Cosmos.

O que teria de mudar:
- **Signal:** com iniciativa vinda de trilha, importar `nebuloz.signal.baseline/2` e não capturar baseline próprio — "Scaffold cria, Signal apura" (colisão 2 do mapa).
- **Cosmos:** ler caso de negócio, fase e gate da trilha; hoje é a pergunta Q5 do spec (`specs/002-scaffold-adoption/spec.md:199`).
- **Meridian:** ninguém fora dele grava em `MeridianGapPromotion`; o Scaffold já guarda `sourceGapId` e `sourcePromotionId` (`schema:339-340`) para ler o vínculo do seu lado. A criação de trilha lê a avaliação de origem para escolher template, e as métricas usam `MeridianConfidence`, como a tela do Meridian prescreve (`apps/app/components/meridian/screens/confidence-scale.tsx:5`).
- **Template e Charter:** o template ganha onde anexar a lição do Signal sem tocar versão publicada; o aceite de política vira fato do Charter, que o gate da Scale só lê.

> **CONFLITO ADR-0014 × CÓDIGO, MEDIDO CONTRA O MAPA**
> A [ADR-0014](../adr/0014-promocao-scaffold-materializa-no-backoffice.md) segue "Accepted", sem substituta: Scaffold é serviço, fica fora de `ProductModule`, e a promoção vira `Engagement` no back-office. O código fez o contrário: `SCAFFOLD` está em `ProductModule` (`packages/database/prisma/schema/modules.prisma:15-21`) e a promoção vira `ScaffoldTrack`. As duas rotas estão na main e gravam o mesmo `MeridianGapPromotion.targetEntityId` — a trilha pelo app (`actions/tracks.ts:153-156`), o `Engagement` pelo back-office (`bo/app/actions/scaffold.ts:176-190`). A revogação só consulta `Engagement` quando o alvo não é SCAFFOLD (`apps/app/app/(meridian)/actions/gaps.ts:501-522`); uma promoção SCAFFOLD materializada em `Engagement` pode ser revogada e deixar o engajamento sem origem [inferido]. Nenhuma das duas rotas tem dado em produção: 0 trilhas e 0 engagements (banco de produção, consulta de 2026-09-22).
>
> Pelo mapa, engajamento, fase e gate são do Scaffold, e o Big Bang só lê. Contra esse alvo, a rota da ADR-0014 é gap, e as duas rotas são gap onde gravam na promoção do Meridian. O mapa não decide o modelo comercial — assinatura por workspace, projeto S/M/L ou serviço mais licença — nem o status formal da ADR-0014: os dois seguem como pergunta ao dono.

---

## 7. Requisitos não-funcionais

| ID | REQUISITO | ESTADO | EVIDÊNCIA |
|---|---|---|---|
| SN-01 | Isolamento de tenant no banco via RLS | parcial | policy em 12 das 19 tabelas, inerte com conexão superuser (`migration.sql:590-611`; ADR-0012); o isolamento real é `tenantId` no `where` |
| SN-02 | Artefato cifrado em repouso; leitura escopada e registrada | parcial | bucket privado; audit antes da URL de 300 s, no `AuditLog` e não no `AccessLog` do contrato (`actions/steps.ts:206-254`); cifra em repouso é do provedor — premissa não confirmada |
| SN-03 | Auditoria de toda transição, assinatura e override | implementado | na transação da escrita (`actions/_shared.ts:45-78`), não fire-and-forget como diz o contrato (`specs/002-scaffold-adoption/contracts/server-actions.md:14-15`) |
| SN-04 | Residência de dado por organização | ausente, declarado | ADR-0016 |
| SN-05 | RBAC de cinco papéis | parcial | matriz pronta; sem atribuição (SA-05) e fora do modelo do Charter (SA-09) |
| SN-06 | Fila cross-tenant só com metadado de gate | parcial | saída fechada (`bo/app/actions/scaffold-supervision.ts:48-59`); a consulta traz o `criteriaSnapshot` inteiro (`:130-136`), contra "a defesa está na consulta" (ADR-0017) |
| SN-07 | Estagnação agendada, com aviso ao dono e ao sponsor | parcial | cron `0 3 * * *` marca e desmarca STALLED (`inngest/scaffold-stall.ts:74-124`); aviso só no audit, para dono e consultor; limiar sem tela |
| SN-08 | Dado de cliente nunca treina modelo | implementado | nenhum SDK de IA nos diretórios do Scaffold |
| SN-09 | Handover pack auto-contido, legível sem acesso | parcial | §5.4 |
| SN-10 | WCAG 2.2 AA na superfície do cliente | parcial | alvo de 44 px em `pointer: coarse` (`ui/scaffold.css:230-232`); axe não rodou (T133, `specs/002-scaffold-adoption/tasks.md:382`) |

> **CUIDADO COM LEITURA CRUZADA**
> A fila é a única tela cross-tenant, e `tests/adr-0013-boundary.test.ts` barra `platformDb` em `apps/app`. As duas varreduras Inngest, porém, leem vários tenants numa consulta pelo cliente global, sem `platformDb` e sem `withTenantDb` (`inngest/scaffold-stall.ts:34-43`; `inngest/scaffold-observation.ts:28-51`): leitura cruzada que a ADR-0013 não nomeia.

---

## 8. Restrições e premissas

- **Dois apps.** Cliente em `apps/app` (:3012), fila em `apps/backoffice` (:3013), pela ADR-0013 e pela ADR-0017; `OBSERVATION_WINDOW_DAYS` é duplicado nos dois (`bo/app/actions/scaffold-supervision.ts:27`). O plano otimiza correção e auditoria, não vazão (`specs/002-scaffold-adoption/plan.md:56-58`).
- **Método global.** Template e versão não têm `tenantId` (`schema:150-153`); o seed cria e nunca atualiza (`packages/database/scripts/seed-scaffold.mts:1-14`), e duas versões têm autor de protótipo (`scaffold-templates.ts:220,313`).
- **Critério DERIVED é marcado à mão**, apesar de `lib/gate-machine.ts:130-133`. Sem Charter, "Política do Charter … aceita" segue entre os critérios da Scale (`scaffold-templates.ts:120-128`) [inferido]. Com Charter ativo e nenhuma política publicada, o card some (`ui/phase-cards.tsx:85-87`) e SG-05 trava a Scale sem saída, nem por override [inferido].
- **Dado pessoal.** O schema guarda o nome digitado de quem assina ou contesta sem conta (`schema:606-608,672`); o DPA lista como titulares só "Usuários do Cliente" (`docs/compliance/dpa-modelo.md:76`), e a RoPA não cita o Scaffold. Premissa não confirmada: conformidade com a LGPD.
- **Preço.** Não fixado, e as fontes divergem: `PROJETO` (PRD §6), "fora do catálogo" (`docs/comercial/icp-e-precificacao.md:33`), "Por workspace" (`packages/internationalization/dictionaries/pt.json:540`), "por projeto" (`apps/app/app/scaffold-indisponivel/page.tsx:89`). `PrecoDeModulo` não tem linha para SCAFFOLD (banco de produção, consulta de 2026-09-22); reexecutado, `packages/database/scripts/2026-08-comercial.sql:85-100` a insere a R$ 0 [inferido].
- **Produção** (banco de produção, consulta de 2026-09-22). O módulo SCAFFOLD está ACTIVE só no tenant `nebuloz`, de dogfood, e há 0 trilhas, 0 casos de negócio e 0 engagements: nenhum cliente tem o produto, e os números batem com os dois P0 — nenhuma trilha foi aberta, nenhum caso de negócio existe. O índice de planos diz "Em produção" (`docs/superpowers/plans/INDEX-MESTRE.md:39`), e o back-office já sofreu `22P02` por oferecer SCAFFOLD antes de o enum existir (`bo/lib/versao.ts:5-8`).

---

## 9. Critérios de aceite

- **SC-001** — Trilha nasce de lacuna do Meridian e chega a EMBEDDED sem engenharia. Ausente: barrada por SA-05 e SB-01, e a produção tem 0 trilhas e 0 casos de negócio (banco de produção, consulta de 2026-09-22); o e2e não existe (T124, `specs/002-scaffold-adoption/tasks.md:347`).
- **SC-002** — Nenhum caminho fecha fase sem critério atendido ou override, verificado por teste. Implementado (`tests/gates-negative.test.ts`, `tests/gates-architecture.test.ts`); falta teste em banco para o BLOCKED.
- **SC-003** — Publicar versão deixa idênticos os passos de trilha em curso. Implementado (`tests/templates.test.ts`).
- **SC-004** — O caso assinado valida contra o schema do Signal e importa sem transformação. Parcial: valida do lado produtor (`tests/signal-export.test.ts`); o Signal não importa.
- **SC-005** — Um tenant não lê artefato de outro por nenhuma API. Implementado pelo `where` (`tests/tenant-isolation.test.ts`, `tests/adr-0013-boundary.test.ts`); a RLS não participa.
- **SC-006** — O handover pack abre sem conta Nebuloz. Parcial: abre offline (`tests/handover-pack.test.ts`), com ids no lugar de nomes e sem validação com usuário.
- **SC-007** — Cobertura de 80% ou mais, com suíte negativa. Parcial: 96,26% de statements e 76,52% de branches relatados em 2026-09-02 (`.claude/completions/2026-09-02-scaffold-polish.md:36`), sem nova execução.
- Papel de adoção atribuído sem SQL, valendo na requisição seguinte: ausente (SA-05, SA-06). Assess fechada pela tela, com caso criado e assinado: ausente (SB-01).
- Recusa por critério deixa a fase em BLOCKED em banco real, e o Consultor registra o override pela tela: parcial, persistência não verificada. A consultora sai da fila e chega à trilha no app do cliente, com o acesso registrado: parcial, o destino não abre [inferido].
- O Signal apura contra o baseline do Scaffold e não cria o próprio: ausente · gap. axe sem violação nas cinco telas do cliente: ausente (T133).

---

*Engineering draft. Documento companheiro: Scaffold PRD. Estado conferido na main em `ea512044`, 2026-09-22.*
