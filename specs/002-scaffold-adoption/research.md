# Research — Scaffold

Fase 0 de [`plan.md`](plan.md). Resolve todo `NEEDS CLARIFICATION` do Technical
Context. Cada item: **Decisão · Porquê · Alternativas rejeitadas**.

---

## R1 — Escopo: produto no monorepo ou ligação Meridian→Engagement?

**Decisão:** produto. Um quarto route group `(scaffold)` em `apps/app`, com
schema Prisma próprio (`scaffold.prisma`), espelhando o padrão do Meridian.

**Porquê:** a instrução foi "Implement: `scaffold.html`", e `scaffold.html` é um
app de 6 telas com máquina de estado de gate, versionamento de template e
artefato assinado imutável. O PRD e o SRD v1.0 anexados ao mesmo projeto de
design especificam esse produto em detalhe, com IDs de requisito (`S-*`, `SG-*`,
`ST-*`, `SN-*`) que o próprio mock referencia (`scaffold-data.jsx` cita S-05,
S-08, ST-01..04; `scaffold-baseline.jsx` cita SG-04). Não é um protótipo solto:
é a materialização de um par PRD/SRD.

**Alternativa rejeitada — a ligação de [`docs/produto/scaffold-prd.md`](../../docs/produto/scaffold-prd.md):**
aquele documento diz, textualmente, que tratar o Scaffold como quarto produto
"seria o erro mais caro possível", porque serviço não escala como software.
Rejeitada **por instrução explícita do usuário**, não por estar errada. Ela
continua sendo a leitura comercialmente mais barata, e se a decisão for
revertida o plano encolhe para a Fase 1 (S-01) mais um ADR.

**Ponto de sobrevivência:** as duas leituras concordam em S-01. A promoção
`MeridianGapPromotion.targetEntityId → ScaffoldTrack.id` é a primeira fatia
entregável em qualquer cenário — e é onde a Fase 1 do plano começa.

> ✅ **Confirmada em 2026-09-02**, antes de `/speckit-tasks`: é produto. As oito
> fatias do plano seguem válidas.

---

## R2 — Gating de módulo: `ProductModule` não tem `SCAFFOLD`

**Contexto:** `packages/database/prisma/schema/modules.prisma` define
`enum ProductModule { COSMOS CHARTER SIGNAL MERIDIAN }`. O layout do Meridian
(`app/(meridian)/layout.tsx`) usa esse enum via `getShellData()` para negar
acesso a módulo não contratado — *default deny*, conforme ADR-0001.

**Decisão:** adicionar `SCAFFOLD` a `ProductModule` e gatear
`app/(scaffold)/layout.tsx` por `TenantModule`, exatamente como o Meridian.

**Porquê:** `TenantModule` é rastro de contratação, não feature flag. Um tenant
que comprou um pacote Scaffold tem uma linha; um que não comprou não tem, e o
layout redireciona para `/scaffold-indisponivel`. Sem o valor no enum não há
como negar acesso, e o produto ficaria aberto a todo tenant.

**Alternativas rejeitadas:**
- *Reusar `MERIDIAN` como gate* — acopla dois produtos que se vendem separado.
- *Feature flag em `packages/feature-flags`* — flag é rollout, não contrato;
  ADR-0001 já separou as duas coisas.

**Ressalva comercial, não bloqueante:** `docs/produto/scaffold-prd.md` §6 diz
que `SCAFFOLD` fica **fora** de `PrecoDeModulo` porque preço de módulo é
assinatura e Scaffold não recorre. Isso não conflita: `ProductModule` governa
**acesso**, `PrecoDeModulo` governa **preço recorrente**. Entrar num sem entrar
no outro é coerente — e a migration deve deixar isso escrito, senão alguém
"conserta" a ausência depois.

---

## R3 — Baseline: tabela plana (SRD §3) ou artefato versionado (design)?

**Contexto:** o SRD §3 modela `baseline` como linha plana — `volume`,
`cycle_time`, `error_rate`, `captured_at`, `signed_by`. Já `scaffold-baseline.jsx`
modela um **caso de negócio** de primeira classe: N métricas com unidade,
linha de base, meta, direção, nível de confiança (`measured` / `estimated` /
`declared`), fonte e amostra; benefício anual com base de cálculo e visto de
Finanças; máquina de estado `draft → awaiting → signed → superseded` com ramo
`contested`; e histórico de versões imutável.

**Decisão:** o modelo do design vence. O SRD §3 é o esboço, o
`scaffold-baseline.jsx` é a especificação — e o comentário no topo do arquivo é
normativo: *"Scaffold é a FONTE DA VERDADE. Emite artefato assinado, imutável e
versionado; o Signal apura contra ele e nunca o edita."*

**Porquê:** três métricas fixas não descrevem "Laudos dentro da janela de
plantio" nem "Casos por analista/semana". O nível de confiança é o que separa um
número medido de um número declarado — e é exatamente a distinção que faz a
contestação de BC-105 existir (*"a taxa de 12% mistura divergência clínica com
erro de transcrição"*). Achatar isso perde o mecanismo.

**Consequência sobre S-06 / SC-004:** o contrato de export do SRD §6 (`volume_per_period`,
`cycle_time_minutes`, `error_rate`, `headcount_touching`) vira um **shape legado
derivado**, não o schema interno. Ver [`contracts/signal-baseline-export.md`](contracts/signal-baseline-export.md).

---

## R4 — Fila de supervisão cross-tenant vs ADR-0013

**Contexto — o conflito duro.** SN-06 e S-08 exigem uma fila de gates que
atravessa organizações. ADR-0013 estabeleceu `platformDb` (em
`packages/provisioning`) como **porta única** de leitura cross-tenant, importável
apenas por `packages/provisioning` e `apps/backoffice`, e diz textualmente:
*"Um teste falha se `apps/app` importar `platformDb`."*

A fila de supervisão em `apps/app/(scaffold)` quebraria esse teste.

**Decisão:** a fila de supervisão vive em **`apps/backoffice`**, não em
`apps/app`. Todas as outras cinco telas ficam em `apps/app/(scaffold)`.

**Porquê:** a consultora é staff da Nebuloz, não usuária do tenant do cliente.
O próprio protótipo diz isso — o item de nav tem `who: ["consultant"]` e o
rodapé do seletor de persona lê *"A fila de supervisão só existe para a
consultora — é a única superfície cross-cliente."* Colocá-la no back-office
não é contorno de ADR: é a leitura correta de onde a superfície pertence.
Custo zero de ADR novo, e o teste de fronteira continua verde.

**Alternativas rejeitadas:**
- *Novo ADR ampliando `platformDb` para `apps/app`* — abre a porta que a
  ADR-0013 fechou, pelo benefício de manter seis telas no mesmo app. Barato
  agora, caro na primeira auditoria.
- *Tabela de projeção no tenant de sistema, escrita fire-and-forget a cada
  transição de gate, lida por `apps/app`* — tecnicamente satisfaz SN-06 (só
  metadado atravessa), mas ainda precisa de leitura cross-tenant da projeção e
  acrescenta uma tabela denormalizada com risco de deriva. Mantida em reserva
  caso a consultora venha a precisar da fila dentro do app do cliente.

**Consequência:** "abrir um artefato" a partir da fila é uma travessia
**explícita e logada** para o tenant do cliente (SN-02 + SN-06), não um link
direto. Ela precisa de `AccessLog` — o modelo já existe em `platform-ops.prisma`.

---

## R5 — Armazenamento de artefato

**Decisão:** `@repo/storage` (Vercel Blob), com chave opaca em
`ScaffoldArtefact.objectKey`, e leitura sempre por server action que registra
`AccessLog` antes de emitir URL assinada de curta duração.

**Porquê:** o pacote já existe e já traz `@vercel/blob`; SN-02 exige cifra em
repouso (o Blob entrega) e log na leitura (a action entrega). Nunca expor a URL
do Blob no HTML — se ela vaza, o log não vale nada.

**Alternativa rejeitada:** coluna `bytea` no Postgres. Simples até o primeiro
`handover-pack.zip`.

---

## R6 — SN-04, residência de dado configurável

**Decisão:** **fora do V1**, declarado. Não há infraestrutura multi-região no
monorepo hoje, e inventá-la para o Scaffold seria a decisão mais cara do plano
com o menor lastro de demanda.

**Porquê:** o mesmo raciocínio da ADR-0011, que tirou notificações e job de SLA
do V1 do Charter. Registrar a ausência é honesto; implementar por antecipação é
o custo que não volta.

---

## R7 — Padrão de rota e shell

**Decisão:** copiar o Meridian, integralmente.

```
app/(scaffold)/layout.tsx                 guard: sessão → módulo → papel
app/(scaffold)/actions/*.ts               server actions por domínio
app/(scaffold)/scaffold/[[...seg]]/page.tsx   rota única + generateMetadata
components/scaffold/screens/registry.ts   SCREENS: id → Server Component
components/scaffold/shell.tsx             "use client"; recebe screenIds: string[]
```

**Porquê:** já é o padrão de três produtos (Cosmos, Charter, Meridian). O
comentário no `page.tsx` do Meridian explica o único detalhe não óbvio —
`generateMetadata` existe porque, com rota única, toda aba leria
`localhost:3012` e o axe acusa isso em todas. Copiar inclui copiar essa
correção.

**Detalhe herdado:** `SCREENS` só é importado no Server Component; o shell é
`"use client"` e recebe apenas as chaves. Quebrar isso quebra as telas que são
Server Components.

---

## R8 — Detecção de estagnação (S-09 / SN-07)

**Decisão:** função Inngest agendada, espelhando `apps/app/lib/inngest/solution-staleness.ts`.
Limiar default 14 dias (`STALL_THRESHOLD` do mock), configurável por tenant.

**Porquê:** o precedente existe, com o mesmo formato de problema — varrer
entidades sem movimento e sinalizar. Notificação por `@repo/notifications`,
fire-and-forget conforme o princípio II da constituição: o alerta não pode
derrubar a varredura.

---

## R9 — Merge de overlay de template (ST-02)

**Decisão:** overlay é armazenado como **lista de operações** contra uma versão
base (`add` / `remove` / `replace` por `stepKey` ou `criterionKey`), não como
cópia da árvore. Na publicação de nova base, cada operação é reaplicada; se o
alvo mudou desde a base do overlay, gera-se `ScaffoldOverlayConflict` **pendente**
e a resolução é explícita.

**Porquê:** ST-02 exige "sobrevive ao upgrade **ou** levanta conflito explícito",
e ST-01 exige que a versão publicada seja imutável. Guardar a árvore inteira
transformaria overlay em fork — e fork é justamente o que o SRD §5 diz para não
fazer. O conflito do mock é o caso de teste literal: overlay da Vanta sobre a
`v3` afrouxa o critério de rollback que a `v4` endureceu.

**Alternativa rejeitada:** merge de três vias em JSON. Resolve mais casos e
produz conflitos que ninguém sabe ler.

---

## R10 — O Signal não existe no repositório

**Contexto:** `ProductModule` tem `SIGNAL`, mas não há `signal.prisma` nem rota.
O `scaffold-baseline.jsx` navega para `signal.html` e mostra contagem de
leituras.

**Decisão:** o Scaffold **emite** o artefato e expõe o contrato de leitura; não
tenta chamar o Signal. `signalInitiative`, `signalRead.reads` e a variância
ficam como campos nulos, e a UI degrada para o estado que o próprio mock já
desenha: *"o Signal mostra esta iniciativa como aguardando promessa — não como
zero."*

**Porquê:** SRD §8 é explícito — *"Charter e Signal podem estar ausentes; toda
interface deve degradar graciosamente quando o produto contraparte não está
provisionado."* Construir o consumidor junto do produtor duplicaria o escopo.

**Mesma regra para o Charter (S-11 / SG-05):** o Charter **existe**
(`charter.prisma`), então o vínculo de política da Fase 3 é implementado de
verdade — mas condicionado a `TenantModule(CHARTER)` ativo, e SG-05 só bloqueia
quando o Charter está presente.

---

## R11 — Personas do protótipo

**Decisão:** as cinco personas de `SC_PERSONAS` mapeiam para papéis RBAC reais
(`ScaffoldRole`), **não** para um seletor de persona em produção.

**Porquê:** ADR-0004 já decidiu isso — seletor de persona fica fora de
produção. No protótipo ele é ferramenta de demo; no produto o papel vem da
sessão. O switcher da topbar não é portado.

---

## Resumo de decisões

| # | Decisão | Risco se errada |
|---|---|---|
| R1 | Produto, não ligação | **Invalida o plano inteiro** |
| R2 | `SCAFFOLD` em `ProductModule` | Produto sem gate de acesso |
| R3 | Caso de negócio versionado vence o baseline plano | Perde confiança/contestação |
| R4 | Supervisão em `apps/backoffice` | Quebra ADR-0013 |
| R5 | `@repo/storage` + `AccessLog` na leitura | SN-02 não atendido |
| R6 | SN-04 fora do V1 | — (declarado) |
| R7 | Espelhar route group do Meridian | Divergência de padrão |
| R8 | Inngest agendado | S-09 vira manual |
| R9 | Overlay como lista de operações | Overlay vira fork (viola ST-01) |
| R10 | Emitir contrato, não chamar o Signal | Escopo dobra |
| R11 | Papel RBAC, não seletor de persona | Viola ADR-0004 |
