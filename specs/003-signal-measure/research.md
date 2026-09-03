# Research — Signal (Fase 0)

Todo `NEEDS CLARIFICATION` do Technical Context resolvido aqui. Nenhuma decisão nova de stack: o repositório já tem três produtos irmãos e o Signal segue o mais recente (Meridian).

---

## D1 · Forma de adoção do produto no monorepo

**Decisão**: route group `app/(signal)` com rota única `signal/[[...seg]]`, `layout.tsx` com guard, e `actions/` por domínio. Componentes em `apps/app/components/signal/`, com `screens/registry.tsx`.

**Racional**: é literalmente o formato de Cosmos, Charter e Meridian. `apps/app/app/(meridian)/meridian/[[...seg]]/page.tsx` resolve `seg[0]` como id de tela e `seg[1]` como parâmetro de detalhe, e o `generateMetadata` existe porque rota única deixaria toda aba com `<title>` do host (o axe acusa). Signal tem exatamente a mesma topologia: 9 telas + `initiative/<id>`.

**Alternativas descartadas**: uma rota por tela (multiplica layout e guard, diverge dos três produtos); app separado em `apps/` (quebra sessão de tenant compartilhada e o `TenantModule`).

---

## D2 · Fronteira Server/Client Component

**Decisão**: `SignalShell` é `"use client"` (tema, persona, paleta ⌘K, preferências). O `registry` de telas é importado **só** no `layout.tsx` (Server Component); para o shell atravessa apenas `screenIds: string[]`. Telas são Server Components que buscam dados via server action e delegam interatividade a um `*-client.tsx`.

**Racional**: comentário normativo em `apps/app/app/(meridian)/layout.tsx` — "SCREENS só é importado aqui… MeridianShell é `use client` e não pode importar o registry, já que telas portadas são Server Components. Só as chaves string cruzam a fronteira."

**Consequência para o protótipo**: o `signal.html` monta tudo com `Object.assign(window, …)` e contexto React global. Na porta, `SgPersonaCtx` e `usePrefs` viram contexto client dentro do shell; `INITIATIVES`/`CONNECTIONS`/… deixam de ser constantes de módulo e passam a vir de server actions.

---

## D3 · Fórmula calculada vs. coluna persistida

**Decisão**: **derivar na leitura** por padrão; **congelar** só onde o número é contrato firmado num momento:
- congelado: `SignalReportSnapshot.payload` (relatório congelado), `SignalRoiFormula` (versão + componentes + premissas do momento), `SignalBaseline` (versão assinada).
- derivado: múltiplo de ROI corrente, % de adoção, score de confiança, veredito, agregados de portfólio.

**Racional**: convenção explícita no cabeçalho de `meridian.prisma` — "Fórmula não vira coluna… As exceções são contrato firmado num momento… e cache com invalidação explícita". E é exatamente o que o PRD pede em TR-2/TR-4: cálculo isolado da UI, relatório a partir de snapshot estruturado, nunca raspagem de tela.

**Alternativa descartada**: persistir `roiMultiple` na iniciativa. Mudar a fórmula reescreveria retroativamente relatórios já apresentados em comitê — o oposto do produto.

---

## D4 · Motor de cálculo

**Decisão**: `apps/app/lib/signal/` puro e sem I/O — `roi.ts`, `confidence.ts`, `verdict.ts`, `adoption.ts`. Recebem dados já carregados, devolvem números. Testados isoladamente com Vitest.

**Racional**: TR-2 ("cálculo isolado da lógica de UI") e TR-3 (rastreabilidade — a função devolve também o *passo a passo*, não só o total). Função pura é o único jeito de o teste cobrir os quatro quadrantes de veredito e as faixas de confiança sem banco.

---

## D5 · Auditoria

**Decisão**: reusar `AuditLog` (`system.prisma`) com `entityType = "signal.<entidade>"` e `diff: Array<[campo, antes, depois]>`, via `logSignalAudit(db, ctx, entry)` em `actions/_shared.ts`, **dentro da mesma transação** da escrita principal.

**Racional**: copiado de `apps/app/app/(meridian)/actions/_shared.ts`, com o mesmo motivo declarado lá: o `logAudit()` do Cosmos tipa `diff` como `Record<string,string>` (formato normativo aqui é o array de triplas) e engole erro de propósito — aceitável para telemetria, inaceitável para evidência. Se a trilha não gravou, a operação inteira falha.

**Trade-off aceito**: duplica ~40 linhas entre Meridian e Signal. Extrair um helper comum é refactor de plataforma, fora do escopo desta feature.

---

## D6 · Códigos legíveis (IN-014, EV-8841, AL-31, RP-118, MP-01, CN-01)

**Decisão**: `SignalSequence` por tenant + `kind`, com `upsert` + `increment` atômico dentro da transação da escrita — cópia de `nextCode()` do Meridian, com `kind ∈ { initiative, evidence, alert, report, mapping, connection, audit }`.

**Racional**: o design usa códigos legíveis em toda a UI e nas referências cruzadas (o alerta cita `IN-014`, a evidência cita `MP-01`). Sem sequência atômica, duas criações concorrentes pegam o mesmo número. Precisa rodar na transação para não queimar número quando a escrita falha.

---

## D7 · Papéis e permissões

**Decisão**: `SignalRole { VIEWER, OWNER, ANALYST, ADMIN }` + `SignalMember` (tenant, user, role), espelhando `MeridianRole`/`CharterRole`. Guards em `apps/app/lib/signal/guards.ts` na ordem fixa: `requireTenantSession` → `requireModule(SIGNAL)` → `requireSignalContext` → `requireSignalPermission`.

**Racional**: comentário normativo em `apps/app/lib/meridian/guards.ts` — "Permissão checada sem sessão de tenant válida é vazamento cross-tenant. Layout protege navegação; NÃO protege RPC — toda server action repete o guard, sem exceção."

**Nota**: o *persona switcher* do protótipo **não** é autorização — é lente de leitura (ordena/prioriza o que aparece primeiro). Tratar como preferência de UI. Confundir os dois seria conceder acesso por dropdown.

---

## D8 · Erros de domínio

**Decisão**: `SignalRuleError` (422, regra nomeada) e `StateConflictError` (409, com `blockers[]`), copiando as classes do Meridian. Casos: congelar relatório com fonte `down` (409, blockers = fontes), versionar fórmula sem baseline assinado (422), reabrir iniciativa `closed` (409).

**Racional**: as três respostas são distintas e o front reage diferente a cada uma — 403 manda pedir acesso, 422 mostra a regra, 409 lista o que destravar. Colapsar tudo em 400 obriga a UI a adivinhar.

---

## D9 · Ingestão de fontes (TR-1)

**Decisão** para V1: modelar `SignalConnection` com `kind` + `config` JSON + saúde persistida, e entregar **observação manual/importada** (`SignalMetricObservation` com `source: MANUAL | SYNC | IMPORT`). Nenhum conector real é hardcoded.

**Racional**: TR-1 exige múltiplos tipos de entrada sem hardcode; a Q1 do PRD ("quais integrações no primeiro segmento?") segue aberta. Modelar a fronteira agora e plugar conector depois custa uma migration; hardcodar Jira/Zendesk agora custa reescrever o domínio.

**Health**: `lastSyncAt` + `expectedFreqMinutes` persistidos; `health` derivado (`> 48h` → `stale`, erro de auth → `down`) e materializado num campo para permitir índice e alerta — cache com invalidação explícita, a exceção prevista em D3.

---

## D10 · Preferências (tema, contraste, movimento, idioma)

**Decisão**: `localStorage` no cliente para tema/contraste/movimento (atributos `data-theme`, `data-contrast`, `data-motion` no `<html>`), e `SignalSettings` no banco só para o que é do **tenant**: `adoptionBar`, `valueBar`, pesos dos fatores de confiança e limiares de alerta.

**Racional**: preferência visual é por pessoa e por dispositivo — round-trip ao servidor para trocar tema é latência sem ganho. Limiar de veredito é decisão de negócio do tenant e entra na trilha de auditoria: mudar `VALUE_BAR` muda o veredito de todas as iniciativas.

---

## D11 · Estratégia de teste (gate risk-based BMAD-TEA)

| Área | Classe | Cobertura exigida |
|---|---|---|
| Guards, isolamento de tenant, papéis | **Crítico** | unit + integration + e2e + negativos (cross-tenant, módulo ausente, papel insuficiente) |
| ROI, confiança, veredito, sequência | **Alto** | unit ≥ 80% (quatro quadrantes, faixas de confiança, concorrência de sequência) |
| Congelamento de relatório, trilha | **Alto** | unit + integration (imutabilidade pós-freeze, append-only) |
| Telas e shell | **Médio** | component (registry resolve, estados vazio/erro) |
| Paleta ⌘K, preferências | **Baixo** | smoke |
