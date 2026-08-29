# Research: Meridian V1 · Diagnose

Phase 0. Cada item resolve uma incógnita que o spec deixou como default documentado, ou uma escolha de porte que o handoff de design não fixa.

---

## R-01 · Onde o módulo vive

**Decisão**: grupo de rotas `(meridian)` em `apps/app`, irmão de `(cosmos)` e `(charter)`.

**Rationale**: o Meridian é módulo contratável (`ProductModule`) pelo mesmo tenant. Sessão, RBAC, `AuditLog`, `withTenantDb` e o kit visual já vivem em `apps/app`. Um app separado duplicaria os quatro para não ganhar nada, e a promoção de gap para o Cosmos (FR-027) atravessaria fronteira de processo sem motivo.

**Alternativas consideradas**:
- `apps/backoffice` — descartado: backoffice é operação interna da Nebuloz sobre contas, não produto do cliente. O respondente do assessment é pessoa da organização cliente.
- App próprio — descartado por duplicação de auth/RBAC/auditoria.

---

## R-02 · Guard e papéis

**Decisão**: `requireMeridianContext()` em `apps/app/lib/meridian/guards.ts`, copiando a ordem do Charter: `requireTenantSession` → `requireModule("MERIDIAN")` → `getMeridianRole`. Papéis próprios em `MeridianRole`: `CONSULTANT`, `REVIEWER`, `VIEWER`. Matriz de permissão em `packages/rbac/src/meridian-matrix.ts`.

**Rationale**: o Charter já provou o padrão e a razão vale igual aqui — quem registra um override precisa ser nomeável e não pode ser o admin de plataforma por herança. Ausência de `MeridianMembership` = sem acesso mesmo com o módulo contratado.

Permissões mínimas de V1:

| Permissão | CONSULTANT | REVIEWER | VIEWER |
|-----------|:---:|:---:|:---:|
| `assessment.manage` (criar, atribuir, fechar coleta) | ✓ | | |
| `scoring.run` | ✓ | | |
| `override.write` | ✓ | ✓ | |
| `gap.write` (criar, ajustar, depender) | ✓ | | |
| `gap.promote` | ✓ | | |
| `evidence.read` | ✓ | ✓ | |
| `report.read` | ✓ | ✓ | ✓ |

**Alternativas consideradas**: reusar `MemberRole` do SAFe — descartado, mesma razão do Charter (`charter.prisma`, comentário do enum `CharterRole`).

---

## R-03 · Link seguro do respondente

**Decisão**: token opaco de 32 bytes aleatórios, guardado **hasheado** (SHA-256) em `MeridianRespondent.tokenHash`, com `tokenExpiresAt` igual ao prazo do assessment. Rota `app/(meridian)/responder/[token]/page.tsx`, fora do layout com guard. O tenant sai do respondente encontrado pelo hash — nunca do request.

**Rationale**: o respondente não tem conta (Assumptions do spec). Guardar o token em claro transformaria um dump de banco em acesso à bateria inteira. Hash permite lookup exato por índice único sem guardar o segredo.

Regras de acesso, todas testáveis por negativo:
- token inexistente ou expirado → 404 genérico (não revela se o assessment existe);
- token válido → acesso somente à bateria do **eixo daquele respondente**, daquele assessment;
- toda leitura ou upload pelo token entra na trilha com `actor = respondent:<id>`.

**Alternativas consideradas**: JWT assinado — descartado: revogar exigiria lista de bloqueio, e o caso de uso normal (consultora remove respondente) tem de revogar na hora.

---

## R-04 · Motor de scoring determinístico

**Decisão**: função pura `computeAxisScore(questions, answers)` em `apps/app/lib/meridian/scoring.ts`, sem acesso a I/O, relógio ou aleatório. Recebe as perguntas da versão de template congelada e as respostas normalizadas; devolve `{ score, confidence, n, spread }`.

Normalização por tipo de pergunta (o handoff já usa valores 0–1 em `DIVERGENCE`):
- `LIKERT` (5 pontos) → `índice / 4`;
- `YES_NO` → `1` para sim, `0` para não;
- `SCALE` de k faixas → `1 - índice / (k - 1)` quando a faixa alta é pior (declarado por `inverted` na pergunta), senão `índice / (k - 1)`.

Score do eixo: média ponderada pelos pesos das perguntas, dos valores médios por pergunta entre respondentes, arredondada para inteiro 0–100.

```
perQuestion[q] = média dos valores normalizados dos respondentes que responderam q
score          = round(100 × Σ(peso[q] × perQuestion[q]) / Σ(peso[q]))
```

Confidence, em [0, 1], produto de três fatores — cada um cai por um motivo distinto e nomeável:

```
cobertura   = respostas dadas / respostas esperadas no eixo
amostra     = min(1, n_respondentes / 2)          // um respondente só nunca chega a 1
concordância= 1 - spread/100                       // spread = dispersão, abaixo
confidence  = round(cobertura × amostra × concordância, 2)
```

`spread` = maior diferença, em pontos de 0 a 100, entre os scores individuais dos respondentes do eixo. Com um respondente, `spread = 0`.

**Determinismo** (FR-014, SC-002) é garantido por: sem `Date.now()`, sem `Math.random()`, sem iteração sobre `Object.keys` de ordem não fixada (usa a ordem canônica de perguntas do template), e arredondamento único no fim.

**Alternativas consideradas**: guardar o score como fórmula avaliada na leitura — descartado: o assessment fecha e o número tem de ficar fixo mesmo se a regra mudar depois. Persistir é o comportamento correto aqui, e é a mesma exceção que o Charter documenta para `approvalPath`/`slaTotal`.

---

## R-05 · Limiar de contestação e de derivação de gap

**Decisão**: dois limiares, ambos colunas da versão de template com default na criação:
- `contestedSpread` (default **25**) — eixo com `spread ≥ contestedSpread` nasce `CONTESTED`;
- `gapThreshold` (default **60**) — eixo com score final `< gapThreshold` deriva gap.

**Rationale**: o handoff mostra `spread 31` marcado como contestado e `spread 8/6/4/0` como computado, então o corte real está entre 8 e 31; 25 é o valor redondo dentro dessa janela. Para `gapThreshold`, o handoff deriva gaps dos eixos com 46/38/57/61 e nenhum dos eixos 74+ — 60 é o corte consistente com o exemplo. Como coluna do template, mudar o valor não reescreve assessment já fechado.

---

## R-06 · Grafo de gaps e plano de 12 meses

**Decisão**: dependências em tabela de aresta `MeridianGapDependency(gapId, dependsOnGapId)`. Validação de ciclo por DFS com marcação tri-estado (branco/cinza/preto) **antes** da escrita, dentro da mesma transação; ciclo detectado lança erro nomeando os gaps do ciclo. Plano por Kahn (ordenação topológica estável), com desempate por custo de atraso decrescente e depois por id, e bucketização em quatro trimestres.

Bucketização: nível topológico → trimestre, com capacidade máxima por trimestre (`ceil(total / 4)`). Um gap nunca cai em trimestre anterior ao de qualquer pré-requisito — invariante verificada em teste sobre grafo gerado (SC-007).

**Rationale**: Kahn com desempate explícito é determinístico; DFS tri-estado é a checagem de ciclo mais curta que ainda nomeia o ciclo, que é o que a mensagem de erro precisa dizer. Grafo desconexo cai naturalmente: cada componente recebe seus próprios níveis.

**Alternativas consideradas**: coluna `dependsOn String[]` no gap — descartado: sem chave estrangeira, um gap apagado deixa referência pendurada e o ciclo vira detectável só na leitura.

---

## R-07 · Benchmark, coorte e limiar de leitura

**Decisão**: `cohortKey = "<setor slug> · <faixa de tamanho>"`. Contribuição gravada apenas quando `assessment.benchmarkOptIn = true` e o scoring finaliza. Agregado (`p25`, `p50`, `p75` por eixo, mais `n`) recalculado na contribuição e guardado em `MeridianBenchmarkCohort`. **O limiar é aplicado na leitura**: o agregado existe no banco; `readCohort()` devolve `{ withheld: true, n }` quando `n < 5`, e nenhuma superfície recebe os percentis.

**Rationale**: aplicar o limiar na escrita perderia o agregado e obrigaria a recomputar quando a coorte cruzasse o mínimo. Aplicar na leitura é o que o handoff descreve ("o agregado existe, leitura bloqueada") e o que mantém FR-033 verificável num único ponto.

Percentis por interpolação linear sobre a lista ordenada de scores finais da coorte — método único, documentado, para o número não mudar conforme quem o calcula.

---

## R-08 · Evidência

**Decisão**: bucket privado `meridian-evidence` no mesmo Supabase Storage já usado por `@repo/storage`; caminho `${tenantId}/${assessmentId}/${evidenceId}`. Banco guarda só metadado (`storagePath`, `fileName`, `mimeType`, `sizeBytes`, autor, horário). Download servido por URL assinada de curta duração, emitida por action que registra a leitura na trilha **antes** de emitir a URL.

**Rationale**: `ensureBucket()` hoje é fixo no bucket do playground; generalizar para receber o nome do bucket é a mudança mínima (`ensureBucket(bucket = AI_PLAYGROUND_BUCKET)`). Registrar antes de emitir garante FR-037 mesmo se o download não completar — auditoria de acesso concedido, não de byte entregue.

---

## R-09 · Reuso de primitivas visuais

**Decisão**: três camadas, sem duplicar nenhuma.
1. `@repo/design-system/cosmos/kit` e `/cosmos/icons` — Button, Badge, Card, SectionCard, KpiCard, Progress, PageHeader, Tabs, Avatar, Skel, IconButton. Usados tal e qual.
2. `apps/app/components/charter/base.tsx` — Eyebrow, MetaCell, FilterChips, Legend, TableHead, TableRow, SmartEmptyState, SkeletonCard, Field/Input/Textarea/Select. Reexportados por `components/meridian/base.tsx`, que é o único ponto de acoplamento e carrega o comentário que explica por quê.
3. `components/meridian/` — só o que não existe: `ScoreRing`, `Radar`, `BenchBand`, `DivergencePanel`, `ConfPill`, `InheritedFrom`, `AwaitingUpstream`.

Ícones ausentes no design system e usados pelo handoff: `crosshair`, `diff`, `outbound`. Adicionados a `packages/design-system/cosmos/icons.tsx` com os paths do próprio handoff — três entradas, não um arquivo novo.

**Alternativas consideradas**: mover `charter/base.tsx` para um diretório compartilhado — descartado por ora: obrigaria a tocar os imports de 12 telas do Charter para ganhar organização, não comportamento. O reexport deixa o movimento barato quando um terceiro consumidor aparecer.

---

## R-10 · CSS escopado

**Decisão**: `components/meridian/meridian.css`, gerado a partir de `charter.css` trocando `.charter-root` por `.meridian-root` e o prefixo dos `@keyframes` de `charter-` para `meridian-`. Mais os keyframes que só o Meridian usa (`meridian-merPulse`).

**Rationale**: as primitivas do kit compartilhado dependem de nomes de classe (`.btn`, `.lift`, `.navitem`, `.skeleton`, `.kpi`, `.scroll`) definidos sob a raiz de cada módulo. Sem a raiz própria, tela do Meridian herda estilo nenhum. A paleta é a mesma do Charter (sky → baby → butter sobre `#07080c`), então a cópia não introduz divergência de identidade — introduz escopo.

Marcar a raiz do Meridian com `class="charter-root meridian-root"` resolveria o CSS com zero duplicação e foi rejeitado: um DOM que diz "charter" numa tela do Meridian é a próxima meia hora de alguém.

---

## R-11 · Promoção de gap entre produtos

**Decisão**: `MeridianGapPromotion(gapId, targetProduct, targetEntityId, targetLabel, promotedById, promotedAt)`. Para `COSMOS`, a promoção cria um `Epic` carregando `originGapId`. Para `CHARTER`, cria vínculo com política. Para `SCAFFOLD` e `SIGNAL` — produtos que ainda não existem no repositório — a promoção é gravada e a criação do trabalho no destino fica declarada como pendente, sem stub falso.

**Rationale**: FR-028 exige que a posse fique no Meridian. Guardar a promoção como linha própria (em vez de coluna no gap) permite histórico: gap promovido, destino removido, gap volta ao estado anterior — o Edge Case do spec — sem perder o registro de que a promoção existiu.

---

## R-12 · Auditoria

**Decisão**: reusar o `AuditLog` existente (`system.prisma`), com `entityType = "meridian.<entidade>"` e `diff` no formato `Array<[campo, antes, depois]>` — idêntico ao Charter. Helper `logMeridianAudit(db, …)` em `actions/_shared.ts`, recebendo `db` para participar da transação da escrita principal.

**Rationale**: a tabela já é append-only por trigger. Uma segunda tabela de auditoria criaria dois lugares para o auditor procurar. O helper recebe `db` pelo motivo que o Charter documenta: decisão persistida sem trilha é pior do que decisão que não persistiu.

Escritas auditadas em transação (falham juntas): criação de assessment, atribuição de respondente, fechamento de coleta, scoring, override, criação e transição de gap, promoção. Leitura de evidência é auditada **antes** da emissão da URL, também em transação.
