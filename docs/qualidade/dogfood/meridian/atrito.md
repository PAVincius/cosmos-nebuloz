# Atrito — Meridian dogfood

Formato: `P0..P3 | tela | passo de reprodução | dono`.

---

**P0** | Carteira (`/meridian`) e detalhe do assessment (`/meridian/assessment/[id]`, aba Coleta) | M1/M2 do roteiro (`docs/qualidade/2026-09-23-plano-dogfood-esteira.md`): abrir um assessment do zero pela carteira e convidar respondente por eixo. Não existe botão nem formulário para nenhuma das duas ações em nenhuma tela do módulo. Confirmado por `grep -rl "createAssessment\|assignRespondent" apps/app/components apps/app/app` — as duas actions só aparecem nos próprios arquivos onde são definidas:
  - `apps/app/app/(meridian)/actions/assessments.ts:348` — `createAssessment`, nunca importada por nenhum componente.
  - `apps/app/app/(meridian)/actions/collection.ts:40` — `assignRespondent`, nunca importada por nenhum componente.
  - Por comparação, as actions da mesma família que a UI **usa** de fato: `registerOverride` (`overrides.ts:30`) em `components/meridian/screens/tab-scoring.tsx:240`, e `promoteGap` (`gaps.ts:391`) em `components/meridian/screens/gap-register.tsx:101`.

  Bloqueia não só o Ensaio local (E2E não consegue dirigir M1/M2 pelo navegador — precisou de workaround via seed, ver nota abaixo) mas o **M1 e M2 do roteiro em produção**: o CEO, ao operar como cliente em `app.nebuloz.ai`, não vai achar onde criar o AS-NBZ-002 nem onde convidar respondentes por eixo. Sem essas duas telas, a esteira de dogfood do Meridian não anda em produção — é bloqueador para o passo 3 (Execução em produção) do ciclo padrão.

  **Workaround usado só para viabilizar o E2E local**: `scripts/seed-meridian.ts` planta à mão (via Prisma, fora da UI) o assessment `AS-200 Solaris Digital` com 4 respondentes já atribuídos e um 5º com token fixo conhecido, comentado no próprio seed como decorrência deste atrito. Isso não é solução — é o E2E confirmando o problema.

  **Dono**: dev Meridian.

  **Resolvido em 2026-09-24, commit `4cf68a24`** — Bussola entregou "Novo assessment" na carteira e "Atribuir respondente" por eixo na aba Coleta. Rodei M1+M2 de verdade contra a UI real (não fixme): cria assessment (`AS-110 · Nebuloz`), navega pro detalhe, atribui os dez respondentes (fundador + auditoria × 5 eixos) — passou. Ver P1/P2 abaixo para atrito novo encontrado nessa mesma UI.

---

**P0** | Ambiente local (`pnpm dev`, todos os apps) | Qualquer passo do Ensaio (M1–M11 do roteiro): `pnpm dev` (`turbo dev --filter=!docs --continue`) sobe e cada app derruba na inicialização com `Invalid environment variables` — `app:dev` falta `BETTER_AUTH_SECRET` (`packages/auth/keys.ts:13`), `web:dev` falta `BASEHUB_TOKEN` (`packages/cms/keys.ts:13`), `api:dev` reproduz o mesmo erro de `BETTER_AUTH_SECRET`. Nenhum `.env.local` existe em nenhum app nem na raiz (`find . -iname ".env.local" -not -path "*/node_modules/*"` não retorna nada, até profundidade 5); não há `.envrc`, `op`/`doppler` CLI, nem script `env:pull` no repo para provisionar. Confirmado às 2026-09-24 08:5x, terminal reiniciado por hook travado (ver handoff da Morgana) — não é um problema de código, é o ambiente local desta sessão sem segredos configurados.

  Bloqueia 100% do Ensaio: sem `app:dev` respondendo em `:3012`, nenhum teste Playwright roda (`meridian-dogfood.spec.ts` não pôde ser executado nesta sessão — M1–M9 ficam sem veredito de execução, só a revisão estática do spec).

  **Dono**: CEO/infra (provisionar `.env.local` de `apps/app/.env.example` + `apps/web` + `apps/api`, ou apontar onde os segredos já vivem).

  **Resolvido em 2026-09-24** — CEO autorizou e copiou os `.env.local` de dev (raiz, `apps/app`, `apps/api`, `apps/web`, `apps/backoffice`, `packages/database/.env`) pro clone; `pnpm dev` sobe e `app:dev` responde em `:3012`.

---

**P1** | `/meridian-responder/<token>`, botão "Anexar evidência" | M3 do roteiro: anexar evidência a uma resposta. `attachEvidence` (`apps/app/app/(meridian)/actions/respondent.ts:280`) sobe pro bucket `meridian-evidence` via `storageClient` (`packages/storage/src/index.ts:7-10`), que lê `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. Nenhum dos `.env.local` copiados (app/api/web/backoffice/raiz/database) define essas chaves — confirmado por grep antes de rodar o E2E, então o client cai no placeholder hardcoded `http://localhost:54321`, que não está de pé neste ambiente (`lsof -i :54321` vazio, sem docker-compose/CLI de Supabase local no repo). Upload falha por conexão recusada; o toast de erro (`Falha ao anexar evidência: …`) aparece e some, sem deixar o arquivo anexado.

  Confirmado **antes** de rodar o E2E que o alvo não é o projeto de produção `aosdvvluokrbgpyqwoor` (não é nenhum projeto real — é o placeholder local) — não se aplica a instrução de pular por risco de produção, mas o resultado prático é o mesmo: sem storage funcional, a etapa de evidência do M3 não tem como ser provada localmente. Ajustei `meridian-dogfood.spec.ts` pra não travar nisso (espera o toast assentar, sucesso ou erro, e segue pro envio) — SC-006 fica provado pra "responder a bateria e enviar", não pra "evidência efetivamente armazenada".

  **Dono**: CEO/infra (apontar um Supabase local — `supabase start` ou docker — e as duas env vars, ou confirmar que evidência só é provada em `app.nebuloz.ai`).

  **Corrigido em 2026-09-24, commit `107c8aa2`** — Pilar subiu Supabase local (`supabase start` com storage/auth/kong/db, runbook `docs/runbooks/supabase-local.md`), `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` em `apps/app/.env.local`. Voltei o E2E a exigir sucesso de verdade no upload (`evidencia-infra.txt anexado.` + arquivo listado na pergunta) e rodei M3 de novo — passa. SC-006 provado completo agora, resposta e evidência.

---

**P2** | `apps/app/app/(meridian)/actions/collection.ts:76` | `assignRespondent` copia `tokenExpiresAt` de `assessment.deadline` no momento da atribuição, em vez de um TTL próprio e curto. Se o consultor estender o prazo do assessment depois de já ter emitido tokens, os tokens já emitidos ganham vida extra em silêncio, sem reemissão — o respondente segue com o mesmo link válido por mais tempo do que foi comunicado a ele. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | `apps/app/app/(meridian)/actions/respondent.ts:96` (`loadRespondent`, chamada por `getBattery`:115, `saveDraft`:183, `submitBattery`:245, `attachEvidence`:286) | Lookup de token por `tokenHash` sem rate-limit — `/meridian-responder/<token>` é rota sem sessão, então nada impede tentativas repetidas de adivinhar um hash válido além do próprio espaço de 32 bytes do token. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | `apps/app/app/(meridian)/actions/respondent.ts:317` (`attachEvidence`, chama `ensureBucket`) | `ensureBucket(MERIDIAN_EVIDENCE_BUCKET)` roda a cada upload de evidência em vez de uma vez na provisão — idempotente, não corrompe nada, mas é uma chamada de rede redundante por request que devia ter acontecido só no provisionamento do bucket. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | `packages/storage/src/index.ts:21` (`ensureBucket`) | Bucket de evidência criado sem política de lifecycle (retenção/expiração de objetos) — evidência anexada por um respondente sem conta fica armazenada indefinidamente, sem uma regra declarada de por quanto tempo. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | Modal "Novo assessment" (`components/meridian/screens/assessments.tsx:149-172`) | Os campos Organização, Setor e Porte usam `<Field label="...">` (`components/charter/base.tsx:564`) sem passar `htmlFor`/`id` — o `<label>` renderiza mas não fica associado ao `<input>` (`Field` só liga o `for` quando o chamador passa `htmlFor`, e nenhum dos três passa). `getByLabel()` não acha nenhum dos três; só "Prazo" e "Template" têm `aria-label` explícito e funcionam. Achado rodando M1 de verdade — tive que usar `getByPlaceholder` como contorno no E2E. Efeito real: leitor de tela não anuncia o rótulo desses três campos ao focar o input.

  **Dono**: Bussola. **Estado**: novo, achado 2026-09-24 rodando M1/M2.

  **Corrigido em 2026-09-24, commit `509071e7`** — `Field`/`Input` ligados por `useFieldId` (mesmo padrão do onboarding). Troquei o E2E de volta pra `getByLabel` nos três campos e rodei de verdade — passa.

---

**P0** | `AssignRespondentModal` (`components/meridian/screens/tab-coleta.tsx:32-100`) | Depois de `assignRespondent` ter sucesso, o componente muda pra tela "Link de coleta gerado" (`if (link) return <ModalShell title="Link de coleta gerado">...`) — é o **único lugar** onde o token do respondente aparece (o banco só guarda o hash, comentário do próprio componente: "O token só aparece agora"). Rodando o E2E de verdade (dez atribuições, M2), essa tela nunca ficou observável: `getByRole("dialog", { name: "Link de coleta gerado" })` não achou nada em nenhuma das dez tentativas, com até 5s de espera — só o toast de sucesso ("X atribuído ao eixo Y") apareceu, e a lista de respondentes já reflete a atribuição no próximo instante.

  Sem o link, o consultor não tem como reenviar o convite pro respondente por fora (não há canal automatizado ainda, é copiar e mandar manualmente) — bloqueava M2/M3 em produção também, não só o E2E. Morgana subiu pra P0 assim que reportei.

  **Dono**: Bussola. **Estado**: achado 2026-09-24 rodando M2 de verdade.

  **Corrigido em 2026-09-24, commit `509071e7`** — causa raiz era `onAssigned()` (= reload do detalhe) disparando logo após `setLink`, derrubando o `ModalProvider` pro skeleton antes do consultor ver o link. Agora `onAssigned` só dispara quando o consultor fecha o modal de propósito. Rodei M2 de verdade (dez atribuições): as dez telas "Link de coleta gerado" aparecem, o campo com o link (`/meridian-responder/...`) é conferido antes de fechar — passa.

---

**P2** | Carteira (`/meridian`) vs. `scripts/seed-meridian.ts` | O assessment `AS-200 Solaris Digital` (plantado pelo seed pra M3-M9) não aparece na carteira da consultora — bloqueia o terceiro teste de `meridian-dogfood.spec.ts` (fecha coleta → promove gap), que precisei marcar `test.fixme` de novo. Causa raiz **confirmada** via consulta direta ao Postgres local (`Tenant`, `MeridianAssessment`, `Session`):
  - `AS-200` tem `tenantId` do tenant `cosmos-dev` (slug correto — o seed rodou com `pnpm seed:meridian cosmos-dev`, como o `globalSetup` manda).
  - A sessão mais recente de `marina.duarte@nebuloz.exemplo` (a mesma que o E2E usa) tem `activeTenantId` do tenant **`nebuloz`** — não `cosmos-dev`. `requireTenantSession` "auto-seta na primeira requisição" (comentário de `auth.setup.ts:4`), e parece ter fixado `nebuloz` numa sessão antiga (a mais velha encontrada é de 2026-09-15, bem antes desta rodada).
  - `TENANT_SLUG` do seed (`scripts/seed-meridian.ts:74`) tem default `"nebuloz"` quando chamado sem argumento — então algum `pnpm seed:meridian` sem argumento, rodado dias atrás contra este mesmo banco local persistente, deve ter criado os 4 assessments que a carteira mostra hoje (`Mira Varejo`, `Helix Agro`, `Vanta Saúde` ×2) sob o tenant `nebuloz`, e é esse tenant que a sessão da Marina carrega — não `cosmos-dev`, onde o `AS-200` de hoje vive.
  - `listAssessments` (`actions/assessments.ts:123`) em si está correto — filtra só por `tenantId: ctx.tenantId`, sem bug de paginação nem de escopo extra. O isolamento por tenant está funcionando como deveria; o problema é dado de teste em tenants diferentes.

  Não é bug de produto — é o banco local persistente (não resetado entre rodadas) tendo dados do Meridian espalhados em dois tenants diferentes, e a sessão da consultora presa no mais antigo. Não mexi na sessão nem no seed (fora da minha alçada, `scripts/seed-meridian.ts` é da Bussola). Rodei M1 pela UI de verdade nessa mesma sessão (tenant `nebuloz`) e funcionou — cria e mostra no ato; o problema é só quando o dado nasce em `cosmos-dev` via seed enquanto a sessão fica em `nebuloz`.

  **Dono**: Bussola/infra — alinhar o slug default do seed com o tenant que a sessão da Marina realmente usa (ou resetar o banco local, ou o `globalSetup` recriar a sessão depois do seed). **Estado**: achado 2026-09-24 — bloqueava execução real de M4-M9 localmente; roteiro em produção não era afetado (lá não existe esse mismatch de tenant entre rodadas de seed).

  **Corrigido em 2026-09-24, commit `509071e7`** — `pinPersonaToTenant` no seed apaga qualquer membership da persona em outro tenant logo após o upsert, então a sessão regenerada pelo `globalSetup` (`AUTH_TEST=1`) fica presa no tenant certo. Reseedei (`npx tsx scripts/seed-meridian.ts cosmos-dev`), regenerei a sessão via `globalSetup`, tirei o `test.fixme` de M4-M9 e rodei a suíte inteira de ponta a ponta: `AS-200 Solaris Digital` aparece na carteira, fecha coleta → scoring → contesta Data → override → gap register → plano de 12 meses → relatório com override visível → promove gap pro Scaffold — passa.

---

**P2** | `/settings/audit` (`audit-log-table.tsx:157-207`) | Roteiro M8 pede filtrar a trilha "por prefixo `meridian.`" — não dá de nenhum jeito: `listAuditLogs` (`actions/audit/index.ts:31`) faz match exato em `entityType`, sem `startsWith`; e o dropdown de filtro (`ENTITY_TYPES`, `audit-log-table.tsx:14-25`) só lista entidades do Cosmos/SAFe (Team, Feature, Epic...) — nenhum valor do Meridian aparece como opção. Única forma de chegar lá é navegar direto pra URL com `entityType` exato (`meridian.assessment`, `meridian.respondent`, `meridian.override`, `meridian.promotion`...), um valor por vez, sabendo de antemão os literais usados em cada action.

  Além disso, a tabela não tem coluna de `target` — cada `logMeridianAudit` grava um rótulo legível em `metadata.target` (ex. "AS-200 · Solaris Digital"), mas a tela só renderiza `entityId` (cuid ilegível) na coluna "Entidade". Dá pra amostrar que o EVENTO aconteceu (ação certa, tipo certo), mas não dá pra saber, olhando a tela, **qual** assessment/gap/respondente sem consultar o banco. `meridian-dogfood.spec.ts` (M8) amostra por tipo de ação, não por org, por causa disso.

  **Dono**: dev Cosmos (tela compartilhada) — adicionar coluna de `target`/metadata legível, e um jeito de filtrar por prefixo ou pelo menos listar os `entityType` do Meridian no dropdown. **Estado**: novo, achado 2026-09-24 escrevendo M8.

  **Corrigido em 2026-09-24, commit `ea0454dd`** — `listAuditLogs` aceita `entityType` terminado em "." como prefixo (`startsWith`), pill "Meridian" no filtro; coluna "Entidade" usa `metadata.target` quando presente, com fallback pro `entityId`. Orbita.

---

**P2** | `/settings/audit`, coluna "Detalhe" (`formatDiff`, `audit-log-table.tsx:42-54`) | FR-038 pede que a entrada de override mostre o valor antes e depois. O diff grava certo — `AuditDiff = [string,string,string][]` (`_shared.ts:14`), formato `[campo, antes, depois]`, deliberadamente diferente do `Record<string,unknown>` que o Cosmos usa (comentário do próprio `_shared.ts:33-35` já avisa disso). Mas `formatDiff` assume `Record<string,unknown>` e faz `Object.entries(diff)` — num array, isso itera por índice ("0", "1"...), não por campo. O resultado não é "Score final: 50 → 30", é algo como "0: Score final,50,30". Não é bug do Meridian (o dado grava certo, auditável de verdade no banco); é a tela genérica não sabendo ler o formato que o próprio time documentou como intencionalmente diferente. Marquei `test.fixme` em `meridian-dogfood.spec.ts` (M8) pra esse caso específico, esperando o texto correto — hoje ele não aparece.

  **Dono**: dev Cosmos (tela compartilhada) — ou `formatDiff` aprende a reconhecer array de triplas, ou o Meridian passa a gravar `Record<string,unknown>` (mas aí perde a ordem/semântica documentada do formato "campo, antes, depois"). **Estado**: novo, achado 2026-09-24 escrevendo M8.

  **Corrigido em 2026-09-24, commit `ea0454dd`** — `formatDiff` reconhece os dois formatos agora, renderiza "campo: antes → depois" pro array de triplas do Meridian. Tirei o `test.fixme` em `meridian-dogfood.spec.ts` e rodei de verdade — passa. Orbita.

---

**P2** | `requestEvidenceUrl` (`actions/report.ts:264`, grava `meridian.evidence.read` **antes** de emitir a URL assinada — pensado pra SC-008) | Mesmo padrão do atrito P0 original (`createAssessment`/`assignRespondent` antes de `4cf68a24`): a action existe, grava auditoria corretamente, mas **nenhum componente a chama** (`grep -rn "requestEvidenceUrl" apps/app/components apps/app/app` só acha a própria definição e um import não usado em `scaffold/actions/steps.ts`). Não existe botão "ver evidência" ou "baixar" em nenhuma tela do Meridian — o consultor nunca aciona essa trilha, nem aqui nem em produção. SC-008 ("cada pedido de URL de evidência do M3 tem entrada correspondente") não tem como ser provado até essa UI existir. Marquei `test.fixme` em M8 apontando pra cá.

  **Dono**: Bussola. **Estado**: novo, achado 2026-09-24 escrevendo M8.

  **Corrigido em 2026-09-24, commit `c08657af`** — botão "Ver evidência" (`EvidenceButton`, `tab-scoring.tsx`) no `DivergencePanel` da aba Scoring & Revisão, chama `requestEvidenceUrl`. Ver P1 abaixo — a primeira versão tinha outro bug (`window.open` com `noopener`), corrigido em `65136545`. Rodei M8 de verdade contra o Chromium do Playwright depois do fix real: clique abre aba nova, a aba navega pra URL assinada do storage local, e a trilha ganha a entrada `meridian.evidence.read` — passa.

---

**P1** | `EvidenceButton` (`components/meridian/screens/tab-scoring.tsx`) | Primeira tentativa de corrigir o P2 acima (commit `94a86212`) tinha um bug próprio: `window.open("", "_blank", "noopener,noreferrer")` — pela spec do HTML, `window.open` com `"noopener"` nas features **sempre devolve `null`**, em todo browser. O código guardava o retorno como se fosse sempre um objeto (`tab.location.href = url` depois do `await`), então a aba abria em branco e nunca navegava — pior que não ter o botão, porque parecia funcionar (abria algo) mas nunca chegava na evidência. Achado do Vigia antes de eu rodar o E2E de verdade.

  **Corrigido em 2026-09-24, commit `65136545`** — `window.open("", "_blank")` sem `"noopener"` nas features (mantém a referência da aba), corta `tab.opener = null` na mão logo em seguida (mesmo efeito de segurança do `noopener`, sem perder a referência). Rodei o M8 de evidência no Chromium real do Playwright (não RTL/mock) depois desse fix: `context.waitForEvent("page")` confirma que uma aba nova abre de fato no clique (síncrono, antes do `await` — não é bloqueada como pop-up), a aba chega em `.../storage/v1/object/sign/meridian-evidence/...` (URL assinada real do Supabase local), e a trilha grava `meridian.evidence.read`. Achado de teste à parte: `DivergencePanel` é montado duas vezes (`tab-scoring.tsx:423` no card do eixo, `:664` dentro do modal) — o locator do botão precisa ser escopado pelo `role="dialog"`, senão resolve ambíguo entre a cópia visível e a de trás do modal.

---

**P3** | `closeCollection` (`actions/collection.ts:230-271`) | Não é idempotente por design — fecha a coleta uma vez (`status: DRAFT/COLLECTING → REVIEW`) e computa o scoring na mesma transação; rodar de novo sobre o mesmo assessment já fechado falha (o botão "Fechar coleta e rodar scoring" nem aparece mais depois do primeiro fechamento, a aba já mostra "Em revisão"). Descoberto rodando `meridian-dogfood.spec.ts` (M4-M9) repetidas vezes sem reseedar entre corridas — a segunda tentativa trava esperando um botão que não existe mais. Não é bug: reabrir uma coleta já fechada e já com scoring/override em cima seria reescrever histórico, o que o design append-only do Meridian recusa de propósito.

  Efeito prático: em produção, **não dá pra "re-rodar" o passo M4 do roteiro** sobre o mesmo `AS-NBZ-002` depois que a coleta fecha uma vez — qualquer correção de dado exige reavaliação nova (`reassessmentOfId`), não repetição do mesmo fechamento. Nota adicionada no roteiro (M4) pra próxima vez que alguém operar isso em produção não tentar fechar coleta duas vezes esperando idempotência.

  **Dono**: n/a — comportamento correto, registrado só como nota operacional. **Estado**: documentado 2026-09-24, sem ação pendente.

---
