# Gate de maturidade para teste de carga (k6)

Origem: `docs/produto/regra-maturidade-e-carga.md` (Norte/CEO, 2026-09-26), spec `specs/007-gate-maturidade-carga/`.

Checklist único e reutilizável — mesmo padrão de citação do `checklist-avaliacao-engenharia.md`:
**só marque um critério como cumprido se conseguir apontar o arquivo, o teste, a linha do dogfood ou o parecer que sustenta a resposta.** Sem fonte, o resultado é "não avaliado" — nunca "cumprido por omissão".

## Os três critérios (gate de entrada do k6)

Um produto só entra em teste de carga quando cumprir **os três**:

1. **SC formal verde no E2E** — existe um Success Criterion escrito no PRD do produto (não basta ter suíte E2E; precisa haver o SC contra o qual ela é medida) cobrindo a jornada da persona principal, e o E2E correspondente passou, com data.
2. **Dogfood sem P0/P1 aberto** — nenhum P0 ou P1 sem resolução registrada no dogfood do produto; todo P2 aberto tem dono **e** data (só dono não basta).
3. **Compliance cumprida quando aplicável** — se o produto coleta dado de terceiro, existe parecer de compliance e as condições que ele exige pro estágio atual (dogfood interno vs. cliente externo) estão cumpridas. Produto que não coleta dado de terceiro marca este critério **não aplicável** (não bloqueia).

Resultado por produto: **apto** (os três cumpridos), **não apto** (lista os critérios que falharam), ou **não avaliado** (falta evidência pra decidir — tratado como não apto na prática, mas é uma lacuna de dado, não uma reprovação).

## Ordem de entrada (decidida pelo CPO)

Meridian → Charter → Signal → Scaffold/Cosmos/Backoffice.

## Tabela por produto

| Produto | C1 — SC formal E2E verde | C2 — Dogfood sem P0/P1 | C3 — Compliance | Resultado |
|---|---|---|---|---|
| **Meridian** | ✅ Cumprido — `meridian-prd.md` tem SC-001..SC-010; `meridian-dogfood.spec.ts` rodou de ponta a ponta (M1–M9) em 2026-09-24, ver `docs/qualidade/dogfood/meridian/atrito.md:94` ("rodei a suíte inteira de ponta a ponta... passa"). Não re-executado hoje pra este gate. | ❌ **Não cumprido** — P1 aberto e **ativo agora**: "Seleção de organização" (`atrito.md:156-160`, dono Norte→spec, sem data), causando confusão real neste exato dogfood — não todas em produção: `diario.md` e suas correções de 27/set mostram que o AS-113 foi criado no localhost (não em produção), o AS-114 nunca existiu em produção (leitura errada de SQL), e só o AS-002 foi de fato criado no tenant "errado" em produção (`nebula`, onde a sessão do CEO realmente estava) — M2 ainda "em execução" em 2026-09-27 10:57. Além disso, 4 P2 do Vigia (`atrito.md:42,48,54,60`) têm dono (Bussola) mas **sem data** — falha a exigência "dono e data". | ✅ Cumprido pro estágio atual (dogfood interno) — parecer `docs/compliance/2026-09-24-parecer-meridian-respondente.md`: "LIBERADO COM CONDIÇÕES pro dogfood interno", condição única (aviso mínimo na tela) implementada — texto de operadora/controladora presente em `apps/app/components/meridian/respondent-form.tsx:174-175,211`. **Bloqueado pra cliente externo** até as condições 2-5 da seção 4 do parecer (donos: Bussola 2/5, CEO/jurídico 4, backlog). | **NÃO APTO** — falha C2. |
| **Charter** | ❌ Não cumprido — E2E existe (`charter-intake.spec.ts`, `charter-decision.spec.ts`, `charter-policy-publish.spec.ts`, `charter-default-deny.spec.ts`, `backoffice-charter-provisioning.spec.ts`) mas **não há SC formal escrito** em `charter-prd.md` (sem tabela de Success Criteria) — confirmado por `grep -n "Success Criteria\|## SC"`, zero ocorrências. Mesma lacuna já registrada em `regra-maturidade-e-carga.md`: "Charter (em foco; falta SC formal)". | Não avaliado — sem pasta de dogfood própria (só Meridian tem `docs/qualidade/dogfood/`). | Não avaliado — Charter lida com fornecedores/políticas de terceiro (potencial dado de contato de fornecedor), mas não existe parecer de compliance dedicado pra confirmar ou descartar. | **NÃO APTO** — falha C1; C2/C3 sem dado. |
| **Signal** | ❌ Não cumprido — E2E existe (`signal-journey.spec.ts`, `signal-tenant-isolation.spec.ts`, `signal-a11y.spec.ts`) mas **zero SC no PRD** (mesmo grep, zero ocorrências) — já registrado em `regra-maturidade-e-carga.md`: "Signal (...) 0 SC no spec". | Não avaliado — sem dogfood registrado. | Não avaliado — Signal mede adoção/ROI de iniciativas de IA, provavelmente dado interno do cliente-tenant, não de terceiro; sem parecer que confirme. | **NÃO APTO** — falha C1; C2/C3 sem dado. |
| **Scaffold** | ❌ Não cumprido — **nenhum arquivo E2E existe** (`find apps/app/e2e -iname "*scaffold*"` vazio) e sem SC formal no PRD (mesmo grep, zero ocorrências). | Não avaliado — sem dogfood registrado. | Não avaliado — sem parecer. | **NÃO APTO** — falha C1; C2/C3 sem dado. |
| **Cosmos** | ❌ Não cumprido — cobertura E2E ampla existe (portfolio-*, epic-drilldown, art-detail, teams, rbac-roles, etc.), mas sem SC formal nomeado no `cosmos-prd.md` (mesmo grep, zero ocorrências) contra o qual medir "verde". | Não avaliado — sem dogfood registrado (o dogfood em curso hoje é do Meridian, não do Cosmos). | Não aplicável — Cosmos é planejamento/execução SAFe sobre dado do próprio tenant (times, épicos, portfólio); não coleta dado de pessoa física de terceiro fora da organização cliente (mesmo exemplo dado em `specs/007-gate-maturidade-carga/spec.md` Edge Cases). | **NÃO APTO** — falha C1; C2 sem dado. |
| **Back-office** | ❌ Não cumprido — **nenhum spec E2E existe** em `apps/backoffice/e2e` (só `fixtures/staff.ts`) e sem SC formal no `backoffice-prd.md` (mesmo grep, zero ocorrências). | Não avaliado — sem dogfood registrado. | Não avaliado — o painel lida com dado comercial (leads, contratos) que pode incluir contato de terceiro; sem parecer dedicado que confirme ou descarte. | **NÃO APTO** — falha C1; C2/C3 sem dado. |

## Leitura do resultado

**Nenhum dos 6 produtos está apto hoje**, inclusive o Meridian — que é o mais maduro dos seis, mas falha C2 por um P1 real e ativo (confusão de tenant/organização, acontecendo neste exato momento no dogfood de produção, `diario.md`) e por P2s do security review sem data-alvo. Isso diverge do que o quickstart da spec 007 (cenário 1) esperava ("Meridian: apto") — registrado como achado em T004, não corrigido silenciosamente aqui: o gate aplicado ao dado real encontrou um resultado diferente do hipotetizado ao escrever a spec, e isso é exatamente o que o gate existe para pegar.

Isso não impede escrever o SC-011 e o script k6 do Meridian (T005-T007 não dependem do gate) — só impede a **execução de carga de verdade contra o Meridian** ser lida como "produto validado" enquanto C2 não fechar.
