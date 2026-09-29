# Diário · Dogfood Meridian

Cada linha é uma operação em produção (`app.nebuloz.ai`), com o "vai" do CEO.

| Quando | Passo | "Vai" | Quem operou | Resultado | Evidência |
|---|---|---|---|---|---|
| 2026-09-25 14:00 | M1 — criar assessment pela carteira | CEO, 14:00 | CEO (consultor) | OK — criou **AS-112** (o código é gerado pelo sistema; não é `AS-NBZ-002`) | print da carteira + detalhe: pendente |
| 2026-09-25 16:47 | M2 — 10 atribuições (5 eixos × fundador + auditoria) no AS-112 | CEO | CEO (consultor) | FALHOU — 10 atribuições feitas, nenhum link copiado; sem botão de revogar, a coleta travou (P1 no `atrito.md`, corrigido no #253) | — |
| 2026-09-26 14:43 | M2-bis — revogar os 10 respondentes do AS-112 e atribuir de novo, copiando cada link | CEO, 14:43 | CEO (consultor) | FALHOU — 10 revogações e 10 atribuições feitas, links copiados mas não colados em lugar nenhum; perdidos de novo | — |
| 2026-09-26 14:56 | M2-ter — revogar e atribuir de novo, colando cada link em `~/Documents/links-as112.txt` (aberto no TextEdit antes) | CEO | CEO (consultor) | FALHOU — o arquivo e a janela do TextEdit ficaram sem nenhum link (verificado por contagem, sem ler os valores); terceira perda seguida. M2 suspenso até o "Reemitir link" (P0, `meridian-prd.md` §10) | — |

> **Correção em 2026-09-26:** as quatro linhas acima **não rodaram em produção**. O CEO operou em `localhost:3012` (banco local `cosmos_dev`, recriado do zero no mesmo dia — o AS-112 não existe mais). Confirmado por consulta no db-prd-nz (`aosdvvluokrbgpyqwoor`): só existem `AS-NEBULOZ-01` (tenant `nebuloz`) e `AS-NBZ-001` (tenant `nebula`). Os achados de usabilidade continuam válidos — as três perdas de link aconteceram de verdade e geraram o Revogar (#253) e o Reemitir (#261). O dogfood em produção recomeça do M1, em `app.nebuloz.ai`.
>
| 2026-09-26 | Pré-M1 prod — `UPDATE "Tenant" SET "isInternalTenant" = true WHERE slug = 'nebuloz'` (db-prd-nz) | CEO | CEO (SQL Editor) | OK — `UPDATE 1` | resultado do SQL Editor |
| 2026-09-27 | Pré-M1 prod — CEO recebe CONSULTANT no Meridian, tenant `nebuloz` (backoffice.nebuloz.ai) | CEO | CEO (back-office) | OK — conferido no db-prd-nz: `isInternalTenant = true`, `meridian_role = CONSULTANT` | consulta do CEO no SQL Editor |
| 2026-09-27 00:12 | **M1 (produção)** — login em `app.nebuloz.ai` → catálogo → Meridian → Novo assessment (Nebuloz, template vigente, prazo +30d) | CEO | CEO (consultor) | NÃO FOI EM PRODUÇÃO — rodou de novo em `localhost:3012`. O "AS-113" visto era o do E2E do Crivo no banco local. Nenhuma requisição no `cosmos-nebuloz-app` em 2h; `AS-113` ausente no db-prd-nz | runtime logs Vercel + consulta db-prd-nz |
| 2026-09-27 | **M1 (produção)** — refeito com o localhost desligado: criou **AS-114** em `app.nebuloz.ai` | CEO | CEO (consultor) | OK — conferido no db-prd-nz, mas no tenant **`nebula`** (sessão ativa do CEO), não no `nebuloz`. Há dois tenants da Nebuloz em produção | consulta do CEO no SQL Editor |
| 2026-09-27 | Decisão do CEO: tenant oficial = `nebula`. `isInternalTenant` passa para `nebula` (true) e sai de `nebuloz` (false) | CEO | CEO (SQL Editor) | OK — `UPDATE 1` nos dois; conferido: `nebula` true + CONSULTANT + módulos COSMOS, CHARTER, SIGNAL, MERIDIAN (sem SCAFFOLD); `nebuloz` false | consulta do CEO no SQL Editor |
| 2026-09-27 10:21 | **M2 (produção)** — AS-114: 10 atribuições (5 eixos × fundador + auditoria), depois "Reemitir e copiar todos os pendentes" + baixar `.txt` | CEO, 10:21 | CEO (consultor) | NÃO ACONTECEU — o AS-114 tem 0 respondentes e depois se mostrou inexistente | consulta db-prd-nz |

> **Correção em 2026-09-27:** o AS-114 **nunca existiu em produção**. `WHERE a.code LIKE 'AS-1%'` em todos os tenants volta vazio. A leitura anterior ("AS-114 com slug nebula") estava errada, e com ela a decisão de mover a flag para o `nebula` e as linhas 17 a 19 acima. O CEO é ADMIN em 6 tenants (`__system__`, `dev-teste`, `medcore`, `nebula`, `nebuloz`, `nebuloz-novo-cliente`) e a sessão dele abre no **`nebuloz`** ("Nebuloz"), que tem os 5 módulos. Os nomes "Nebula"/"Nebuloz" e `AS-NBZ-001`/`AS-NEBULOZ-01` se confundem. A partir daqui, os resultados de SQL vêm colados inteiros, não resumidos.

| 2026-09-27 | Decisão do CEO: tenant oficial volta a ser `nebuloz`. `isInternalTenant`: `nebuloz` true, `nebula` false (um SQL por vez) | CEO | CEO (SQL Editor) | OK — conferido: `nebuloz` true, `nebula` false | SELECT de conferência |
| 2026-09-27 10:38 | **M1 (produção, tenant `nebuloz`)** — Novo assessment em `app.nebuloz.ai`, organização "Nebuloz" no topo | CEO | CEO (consultor) | OK — criou **AS-002**, mas no tenant **`nebula`** (sessão real do CEO; o Meridian não mostra a organização ativa) | SELECT colado inteiro: `AS-002 · 2026-09-27 13:51:38 UTC · nebula` |

| 2026-09-27 10:57 | **M2 (produção, AS-002, tenant `nebula`)** — decisão do CEO: laboratório segue no `nebula`. 10 atribuições + "Reemitir e copiar todos os pendentes" + baixar `.txt` | CEO | CEO (consultor) | em execução | — |

> **Lição:** antes de cada "vai", confirmar a URL na barra do navegador; depois de cada passo, confirmar no banco de produção que o registro existe.

Pré-condição do M1/M2: deploy `dpl_Hs1rcL1Ys7e4nLtVEhtZNbL46WPp` READY, commit `86f8153f` (merge do #248).
Pré-condição do M2-bis: deploy `dpl_4QSbrS8MQjs3zF85o1LWVv3KXMJk` READY, commit `d846faed` (merge do #253).

## Rodadas locais (E2E, banco `cosmos_dev`, sem produção)

### 2026-09-29 · M1–M11 no local (a769a762) · QA

`AUTH_TEST=1 pnpm exec playwright test e2e/meridian- --grep-invert load` de dentro de `apps/app`: **14 passaram, 11 falharam**. M10 não rodou.

| Spec | Resultado | Causa (arquivo:linha) |
|---|---|---|
| `meridian-diagnose.spec.ts` guard de papel ×2, carteira, fila de revisão, gap register, benchmark (**M11**, coorte retida <5), escala de confiança, token inválido | passou | — |
| `meridian-reemitir-lote.spec.ts` (5 specs) | passou | — |
| `meridian-dogfood.spec.ts:257` respondente completa a bateria | passou | — |
| `meridian-reemitir-link.spec.ts:235` bloqueia reemissão | passou | — |
| `meridian-diagnose.spec.ts:62, 79, 97, 107` | falhou | `:66/:88/:99/:111` — `getByText("Vanta Saúde").first()` casa o `<span class="sr-only">Abrir assessment Vanta Saúde</span>` (`components/meridian/screens/assessments.tsx:376`), que não recebe clique (`<html>` intercepta) |
| `meridian-dogfood.spec.ts:323` consultora até promover | falhou | `:327` — mesma causa, com "Solaris Digital" |
| `meridian-collection-as112.spec.ts:38` | falhou | `:110` — clique em `{x:10,y:10}` do backdrop "Fechar modal" cai sob a faixa `<output>` "AMBIENTE LOCAL" (`app/environment-banner.tsx`, `position:fixed; top:0; z-index:9999`) |
| `meridian-reemitir-link.spec.ts:68` | falhou | `:159` — mesma causa da faixa de ambiente |
| `meridian-dogfood.spec.ts:162` M1/M2 | falhou | `:242` — "Concluir" do modal "Link de coleta gerado" fica `disabled` até o link ser copiado (`components/meridian/screens/tab-coleta.tsx:241`, `disabled={!copied}`, guarda do P1 AS-112); o spec não copia o link antes |
| `meridian-dogfood.spec.ts:456, 499, 515` M8 auditoria | falhou | `:472/:506/:521` — linhas `meridian.assessment.create`, `override.register`, `evidence.read` inexistentes na trilha. Provável cascata de M1/M2 e da consultora terem falhado (o seed apaga o domínio Meridian); não confirmado isoladamente |
| M10 `meridian-load` | não rodou | `pnpm seed:meridian:load techcorp-sa` → `Tenant "techcorp-sa" não encontrado` (`scripts/seed-meridian-load.ts:63`); o tenant só nasce em `scripts/seed-tenants.ts:140`, que o setup não roda |

Reset local (`apps/app/scripts/sql/meridian-reset.sql`, inteiro, `-v ON_ERROR_STOP=1`): exit 0, BEGIN…COMMIT, guarda de vínculo com Scaffold = 0. Antes → depois: GapPromotion 1→0, PlanItem 8→0, GapDependency 5→0, Gap 8→0, Evidence 2→0, Response 39→0, Override 1→0, AxisScore 10→0, Respondent 22→0, Assessment 13→0, BenchmarkContribution 5→0, BenchmarkCohort 3→0, Sequence 3→0. Mantidos: Template 1, Question 15, Membership 4. Schema `backup_meridian_20260929` criado no banco local.

### 2026-09-29 · M1–M11 no local, segunda rodada (7af22365) · QA

Após 889c91af (seletor por role, backdrop fora da faixa de ambiente, copiar o link antes de Concluir) e 0483f3ea (seed de carga cria `techcorp-sa`). Banco local `cosmos_dev`, `AUTH_TEST=1 pnpm exec playwright test e2e/meridian- --grep-invert load` de dentro de `apps/app`: **25 passaram, 0 falharam** (1,8 min). Inclui `meridian-collection-as112:38`, `meridian-reemitir-link:68/239`, `meridian-dogfood:162/262/328` e M8 (`:464/:507/:523`), que antes falhavam; M8 confirma que era cascata. M11 (benchmark <5 não mostra) em `meridian-diagnose.spec.ts:161`, passou.

M10 (`e2e/meridian-load`): **passou** — `/meridian` 525 ms com 200 assessments, `/meridian/registry` 273 ms com 2.000 gaps (orçamento SC-010: 2 s). O seed criou 200 assessments `LOAD-` no tenant `techcorp-sa` local.

Schema `backup_meridian_20260929` do banco local removido (`DROP SCHEMA … CASCADE`, só `cosmos_dev` em localhost:5434).

## 2026-09-29 ~00:30 BRT (03:30 UTC) — Reset do Meridian em produção

Decisão do CEO (28/09 ~23h): apagar só os dados do Meridian, todos os tenants. Executado pela Morgana no SQL Studio do Supabase, projeto `db-prd-nz` (`aosdvvluokrbgpyqwoor`), papel `postgres`, com `apps/app/scripts/sql/meridian-reset.sql` (sha256 `eb720cbb…`, de0e25c3). O bloco 3 (transação) conferido por hash normalizado igual ao arquivo aprovado antes de rodar.

Revisões: Vigia aprovou para produção; Lacre OK com condições (`docs/compliance/2026-09-29-parecer-reset-meridian-producao.md`); C1 fechada — diagnósticos só nos tenants internos `nebula` (membro único = fundador) e `nebuloz`. Data API expõe só `public` e `graphql_public`: o schema de backup não fica exposto.

| Tabela | Antes | Depois |
|---|---|---|
| MeridianGapPromotion | 0 | 0 |
| MeridianPlanItem | 20 | 0 |
| MeridianGapDependency | 3 | 0 |
| MeridianGap | 37 | 0 |
| MeridianEvidence | 0 | 0 |
| MeridianResponse | 30 | 0 |
| MeridianOverride | 0 | 0 |
| MeridianAxisScore | 10 | 0 |
| MeridianRespondent | 10 | 0 |
| MeridianAssessment | 3 | 0 |
| MeridianBenchmarkContribution | 0 | 0 |
| MeridianBenchmarkCohort | 0 | 0 |
| MeridianSequence | 2 | 0 |
| MeridianTemplate (mantém) | 3 | 3 |
| MeridianQuestion (mantém) | 45 | 45 |
| MeridianMembership (mantém) | 3 | 3 |

Bucket `meridian-evidence`: 0 objetos antes e depois (nada a esvaziar). Vínculo `ScaffoldTrack` → gap/promoção: 0.

Backup `backup_meridian_20260929`: 13 tabelas com RLS ligada e forçada, sem grants; `anon` sem USAGE. Contagens conferem com o antes (Assessment 3, Gap 37, Respondent 10, Response 30). `DROP SCHEMA` previsto para 2026-10-29 (condição C2 do Lacre). Pendentes: declarar no RoPA; registrar a janela de PITR do Supabase (Pilar). Runtime da Vercel sem erro nos 30 min seguintes.

## Rodada local · dogfood M1–M11 + carga k6 (2026-09-29, só local, QA)

Base: `github/main` `8d1a17fe` (#286), worktree `wt-dogfood`, banco `cosmos_dev` (localhost:5434, `migrate deploy`: 0 pendentes), `seed:e2e` + `seed:meridian cosmos-dev`. Navegador: sessão `meridian-local` (Portal Meridian), consultora `marina.duarte@nebuloz.exemplo`. Nada em produção. Evidências em `evidencias/local-2026-09-29/`.

Assessment novo do zero: **AS-110** "Nebuloz (dogfood local)". Diferença para o roteiro de produção: em vez dos dez respondentes do AS-NBZ-001 usei oito (um por eixo, quatro no eixo Process por engano meu ao atribuir) com respostas quaisquer; portanto não há comparação com gabarito no M4(a).

| Passo | Resultado | O que vi |
|---|---|---|
| M1 novo assessment pela carteira | OK | Carteira com 5 assessments do seed; "Novo assessment" (organização, setor, porte, template v3.2, prazo) criou o AS-110 em Rascunho e abriu o detalhe (`m1-carteira-com-novo.png`). O prazo é `input type=date` nativo |
| M2 convidar respondentes | OK | Cinco eixos, cada um com "Atribuir respondente"; 8 links gerados. "Concluir" do diálogo do link só habilita depois de "Copiar" (guarda do P1 AS-112 funcionando). Assessment vai a Coletando ao atribuir o primeiro (`m2-coleta.png`) |
| M3 responder (meridian-responder) | OK | Data: 3 perguntas, evidência `evidencia.pdf` anexada (linha em `MeridianEvidence`, arquivo no bucket `meridian-evidence`), "Enviar respostas" fechou o respondente (DONE). Os outros 7 responderam sem evidência. Cada sessão levou cerca de 10 s (SC-006: meta < 10 min) |
| M4 fechar coleta e scoring | OK | "Fechar coleta e rodar scoring" levou o assessment a REVIEW. Scores: Data 67 (conf 50 %), Process 50 (conf 100 %, 4 resp.), People 33, Governance 25, Infrastructure 33; spread 0, nada contestado (`m4-scoring.png`). SC-002(b): `vitest run __tests__/lib/meridian-scoring.test.ts` = 13/13 |
| M5 fila de revisão e override | OK | O AS-110 não tem eixo contestado, então usei o AS-104 do seed (Data contestado): fila global lista "Revisar Data de Vanta Saúde" (`m5-fila.png`). Rationale curto ("Curto demais") mantém "Registrar override" desabilitado; rationale longo + score diferente do computado habilita. Override 40 → 45 gravado (`m5-override-depois.png`); a trilha mostra "Score final: 40 → 45" |
| M6 gaps, dependências, plano | OK | AS-110: 4 gaps derivados dos eixos abaixo do limiar (G-11 Governance CoD 93, G-10 People 72, G-12 Infrastructure 72, G-09 Process 27); "Gerar plano de 12 meses" distribuiu G-11/G-10/G-12/G-09 em Q1..Q4. Topologia conferida por SQL no AS-104 (o único com dependências): 5 dependências, 0 violações. Ciclo de dependência não foi exercitado pela tela |
| M7 relatório | OK | Aba Relatório & Benchmark: shape dos 5 eixos com confiança, composto 42, narrativa dos três gaps de maior custo, sem ferramenta externa (`m7-relatorio.png`) |
| M8 auditoria | OK | `meridian.assessment.create`, `respondent.assign` (8), `respondent.submit`, `evidence.attach`, `collection.close`, `scoring.run`, `gap.derive`, `plan.generate`, `gap.promote`, `respondent.reissue` presentes; override mostra antes → depois (FR-038) (`m8-auditoria.png`) |
| M9 promoção e Scaffold (X-03) | OK | G-10 "Virar caso de negócio" → `MeridianGapPromotion` SCAFFOLD; o portfólio do Scaffold mostra "S-01 · lacunas promovidas ainda não viraram trilha" com G-10; "Criar trilha" abriu com o processo preenchido, criou a TR-910 com `sourceGapId`, e a promoção passou a apontar para a trilha. A trilha mostra "Semeada da lacuna G-10 do Meridian" sem controle de edição (`m9-registry.png`, `m9-trilha-origem.png`). G-11 foi promovido a COSMOS por engano ("Promover a iniciativa" age direto) e ficou "pendente" |
| Reemissão de link | OK | AS-200: "Reemitir e copiar todos os pendentes" abre lista com "Copiar tudo", "Baixar .txt/.csv"; `meridian.respondent.reissue` +1 |
| M10 carga 200/2.000 | OK | `e2e/meridian-load`: `/meridian` 1004 ms (200 assessments), `/meridian/registry` 351 ms (2.000 gaps); meta 2 s |
| M11 benchmark < 5 | OK | Pool: agronegócio · 200–1.000 com n = 2 "agregado existe, leitura bloqueada"; relatório do AS-110: "A coorte tecnologia · 1–50 tem n = 0, abaixo do mínimo de 5", sem percentil (`m11-benchmark.png`). Não capturei o corpo da resposta da action |

### Carga k6 · `apps/app/load/k6/meridian-responder.js`

Respondentes sem conta abrindo o link (`GET /meridian-responder/<token>`) e gravando respostas (server action `saveDraft` com `Next-Action`, 3 respostas por chamada). Rampa 1 → 50 VUs em 3 min, um respondente (token) por VU, 50 respondentes dedicados no AS-K6-001 (`load/k6/prepare-meridian-responder.ts`). Alvo só `localhost:3012` (o script recusa outro host). Metas: p95 < 800 ms, erro < 1 %.

| Alvo | Requisições | Erro | p50 | p95 | Veredito |
|---|---|---|---|---|---|
| `next dev` (turbopack) | 2.212 (1.106 iterações) | 0 % | 193 ms | **2,92 s** | p95 acima da meta; abrir_link p50 224 ms / p95 2,91 s; gravar p50 156 ms / p95 2,93 s |
| `next build` + `next start` (mesma máquina) | 2.852 (1.426 iterações) | 0 % | 13 ms | 26 ms | dentro da meta; abrir_link p95 24 ms, gravar p95 27 ms |

Leitura: o app não erra sob 50 respondentes concorrentes (4.424 checks, 100 %), e o p95 fora da meta no `next dev` é custo do modo de desenvolvimento (uma instância, sem otimização); no build de produção local o p95 é 26 ms. A meta de 800 ms só vale como aceite contra o build, não contra `next dev`. Isso não mede a infraestrutura de produção (Vercel, banco remoto), só o código no localhost.

### Atritos com causa e dono (nenhum quebrou um passo)

| # | Sev. | Atrito | Onde | Dono |
|---|---|---|---|---|
| A1 | Baixa | Rationale curto de override só desabilita o botão; a tela não diz o mínimo (o roteiro espera "recusa explicando o mínimo") | modal de override, `components/meridian/screens/` | Bussola |
| A2 | Baixa | "Promover a iniciativa" e "Virar caso de negócio" agem no clique, sem confirmação nem escolha de destino; o primeiro clique foi para o produto errado | modal do gap, `components/meridian/screens/registry.tsx` | Bussola |
| A3 | Baixa | Nenhum caminho na tela do consultor para abrir a evidência anexada (Coleta e gap só mostram "1 anexos"); `meridian.evidence.read` só nasce por action | Coleta e gap | Bussola (decisão de produto) |
| A4 | Info | O JSON "Export para o Scaffold" na aba Plano é um exemplo fixo (G-01, governance 66 overridden), não os dados do assessment | aba Plano 12 meses | Bussola |
| A5 | Info | Ciclo de dependência entre gaps e o botão de ajuste de severidade/esforço não foram exercitados pela tela | Gap register | QA (próxima rodada) |

Limpeza: servidor derrubado, `.next` apagado, `load/k6/.tokens.json` fora do git. Estado local deixado: AS-110, AS-K6-001 (50 respondentes), G-10/G-11 promovidos, TR-910, override no AS-104.
