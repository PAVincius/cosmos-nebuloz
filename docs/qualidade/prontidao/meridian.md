# Prontidão do Meridian para cliente externo

**Auditoria de QA, 2026-09-29.** Metodologia: `docs/qualidade/gate-maturidade-carga.md` (o arquivo está no `main` local e ainda não em `github/main`; o `scaffold.md` já o cita da mesma forma). Base: `github/main` `8d1a17fe` (#286). O #287 (diário do dogfood local, script k6 e evidências) e o #288 (correções dos atritos A1, A2 e A4) estão **abertos**; o que depende deles está marcado. O que vi rodar foi só local (`cosmos_dev`, `localhost`). **Não conferi produção**: o que digo dela vem dos pareceres do Lacre, do runbook do Inngest e do que a Morgana informou, e está marcado como tal.

## Veredito: **NÃO APTO para cliente externo** · **APTO para o dogfood interno da Nebuloz**

O produto anda de ponta a ponta e não erra sob carga local: os onze passos do roteiro (M1–M11) passaram no local sem quebra, o E2E está verde e o k6 fecha a meta no build. O que impede o cliente externo não é funcionalidade, é o que o parecer de compliance manda ter antes (C3) e o que só existe no papel em produção: o Inngest, que executa a retenção de 90 dias e a eliminação de titular, está sem as chaves certas, e o enquadramento operadora/controladora ainda não virou posição contratual. Isso resulta em **C3 não cumprido**; C1 está cumprido e C2 está cumprido no local, com ressalvas.

## 1) Gate de maturidade (os três critérios)

| Critério | Resultado | Evidência |
|---|---|---|
| C1 — SC formal E2E verde | ✅ Cumprido | `docs/produto/meridian-prd.md` §6 traz SC-001..SC-010 (critérios de `specs/001-meridian-diagnose/spec.md`). E2E: `e2e/meridian-*` deu **25/25** em `41169984` (ancestral do `github/main`), em 2026-09-29; `e2e/meridian-dogfood.spec.ts` deu 6/6 na árvore do #288 (`ef30d1a9`) e `e2e/meridian-load` passou. A coluna "estado na main" da tabela do PRD (`meridian-prd.md:154-163`) é de 2026-09-26 e diz "ausente" para SC-001, SC-006 e SC-010: está desatualizada, ver §2 |
| C2 — Dogfood sem P0/P1 aberto | ⚠️ Cumprido no local, com ressalvas; **produção incompleta** | Diário de 2026-09-29 (#287, `docs/qualidade/dogfood/meridian/diario.md`): M1–M11 no local, nenhum P0/P1 novo. Os P0/P1 antigos do `atrito.md` estão corrigidos (links perdidos no AS-112: revogar em 2026-09-26, reemitir por spec 006 com `meridian-reemitir-link` e `-lote` verdes; o P1 de seleção de organização que o gate cita está no `atrito.md` do `main` local e não em `github/main`; o seletor de conta com confirmação entrou pela spec 009 US2, `1c5da6bb`, e eu não o reexercitei). Ressalvas: (a) os 5 atritos do dogfood local: A1, A2 e A4 corrigidos e aprovados no #288 (aberto); A3 e A5 e um achado de foco do `ModalShell` seguem sem dono e data (§Condições); (b) o dogfood em **produção** parou no M2 (AS-112, três tentativas com links perdidos, `diario.md` de 2026-09-25/26); M3–M11 nunca rodaram em produção |
| C3 — Compliance quando aplicável | ❌ Cumprido só para o dogfood interno | `docs/compliance/2026-09-24-parecer-meridian-respondente.md`: liberado com condições para dogfood interno, **bloqueado para cliente externo** até 5 condições. Hoje: cond. 1 (aviso na tela) cumprida; cond. 2 (eliminação do objeto) e 3 (retenção de 90 dias) cumpridas no código, parecer de 2026-09-28 (#277); cond. 5 (rate limit do token) no código (`respondent.ts:153`, commits `1646b50e`, `011c75f7`, `3db7c7b5`); **cond. 4 (posição operadora/controladora do CEO e cláusulas C1–C7 no DPA) pendente**; e a execução da retenção em produção depende do Inngest (§4) |

## 2) Success Criteria contra o que vi rodar

Local, 2026-09-29, no assessment AS-110 criado do zero e nos assessments do seed. "Não verificado" quer dizer que não rodei.

| SC | Situação | Evidência |
|---|---|---|
| SC-001 do zero ao relatório sem planilha | Cumprido no local | AS-110: novo assessment, 8 respondentes, scoring, gaps, plano e relatório, tudo pela tela; `meridian-dogfood.spec.ts` M1/M2 e consultora. Em produção não fechou |
| SC-002 scoring idêntico nas repetições | Cumprido (teste) | `vitest run __tests__/lib/meridian-scoring.test.ts`, 13/13. A comparação com o gabarito AS-NBZ-001 em produção não foi feita |
| SC-003 score final rastreável | Cumprido | override 40 → 45 na trilha, "Score final: 40 → 45" (FR-038) |
| SC-004 contestado na fila antes do relatório | Parcial | a fila global lista o eixo contestado antes do override; não verifiquei que o relatório consulte a fila |
| SC-005 nenhuma comparação com coorte < 5 | Cumprido | pool: agronegócio n = 2 "leitura bloqueada"; relatório do AS-110 (n = 0) sem percentil. Não capturei o corpo da resposta da action |
| SC-006 respondente conclui em < 10 min | Cumprido | cerca de 10 s por sessão, evidência `.pdf` anexada; feito por agente, não por pessoa nova |
| SC-007 plano sem item antes de pré-requisito | Cumprido | SQL no AS-104: 5 dependências, 0 violações; plano do AS-110 em Q1..Q4 |
| SC-008 toda leitura de evidência na trilha | Cumprido no servidor | `e2e/meridian-dogfood.spec.ts:523`. Na tela, o botão "Ver evidência" só aparece no painel de divergência (`atrito.md:129`); no AS-110, sem eixo contestado, não vi caminho para abrir a evidência |
| SC-009 gap promovido só editável no Meridian | Cumprido | G-10 virou a trilha TR-910 no Scaffold ("Semeada da lacuna G-10", sem controle de edição) |
| SC-010 carteira e registro < 2 s com 200 assessments e 2.000 gaps | Cumprido no `next dev` local | `e2e/meridian-load`: `/meridian` 1004 ms, `/meridian/registry` 351 ms |

## 3) Carga (k6)

`apps/app/load/k6/meridian-responder.js` (no #287): 50 respondentes sem conta abrindo o link e gravando respostas pela server action, rampa de 1 a 50 VUs em 3 minutos, metas p95 < 800 ms e erro < 1 %. Só `localhost:3012` (o script recusa outro host).

| Alvo | Requisições | Erro | p50 | p95 |
|---|---|---|---|---|
| `next dev` | 2.212 | 0 % | 193 ms | 2,92 s (fora da meta) |
| `next build` + `next start` | 2.852 | 0 % | 13 ms | **26 ms** (dentro da meta) |

O app não erra sob 50 respondentes concorrentes; o p95 alto é do modo de desenvolvimento. **Isto não mede a infraestrutura de produção** (Vercel, banco remoto, Storage remoto): mede o código na máquina do QA. Não existe SC de carga escrito (`grep SC-011` volta vazio em `docs/` e `specs/`); a regra do gate diz que carga "de verdade" só conta como validação depois de C2 fechar.

## 4) Produção × local

O que está em produção não foi conferido por mim (sem credencial). Fontes:

- **Inngest.** O runbook `docs/runbooks/inngest-producao.md` (2026-09-28) diagnosticou o `cosmos-nebuloz-app` sem nenhuma variável `INNGEST_*` e `GET /api/inngest` em 500. A Morgana informa que hoje há chaves, mas as do alvo Branch, não as de Production: as funções não registram e **os jobs ficam parados**. Entre elas, `eliminateExpiredMeridianEvidence` (cron diário 03:00, retenção de 90 dias, `apps/app/lib/inngest/meridian-evidence-retention.ts:32`) e `processErasureRequest` (eliminação de titular). Sem isso, a política de retenção que o parecer de 2026-09-28 deu como atendida existe no código e não executa.
- **Reset de produção.** Segundo a Morgana, o reset do domínio Meridian foi executado em produção em 2026-09-29, com as contagens conferidas. O parecer de 2026-09-29 (`docs/compliance/2026-09-29-parecer-reset-meridian-producao.md`) deu OK com condições e mantém um backup no banco (`backup_meridian_20260929`) **com `DROP SCHEMA` até 2026-10-29**; as cópias da plataforma (backup diário e PITR do Supabase) seguem além dessa data, e a data efetiva de eliminação total é essa data mais a janela da plataforma (parecer, C4).
- **Aviso ao respondente com os 90 dias.** O commit `23bc6815` ("aviso ao respondente menciona os 90 dias") **não está em `github/main`**: só no `main` local. Em `github/main`, `respondent-form.tsx` não cita os 90 dias (recomendação do parecer de 2026-09-28, não bloqueante).
- **Dogfood em produção:** M1 ok (AS-112); M2 falhou três vezes (`diario.md`); reemissão de link e revogação foram entregues depois. Nada de M3 a M11 em produção.

## Condições para liberar cliente externo

| # | Condição | Evidência | Dono | Bloqueia? | Tamanho |
|---|---|---|---|---|---|
| 1 | Posição do CEO sobre operadora/controladora e cláusulas C1–C7 incorporadas ao `dpa-modelo.md` e ao contrato | parecer de 2026-09-24, condição 4; `docs/compliance/operadora-controladora.md` | CEO (decisão) e jurídico; Lacre acompanha | **Sim** | M |
| 2 | Inngest em produção com as chaves do alvo Production; conferir `GET /api/inngest` respondendo 200 e um run de `eliminateExpiredMeridianEvidence` | `docs/runbooks/inngest-producao.md` §1; informação da Morgana | Infra/SRE, com "vai" do CEO por operação | **Sim** (a retenção de 90 dias e a eliminação de titular são a condição 3 do parecer) | P |
| 3 | Fechar o backup do reset: `DROP SCHEMA backup_meridian_20260929` até 2026-10-29, com "vai" do CEO; registrar no relatório a janela de backup/PITR do Supabase, a contagem do bucket, a linha no RoPA e a regra de eliminação de titular dentro da janela | parecer de 2026-09-29, C2 a C5 | Pilar (execução), Lacre (confirma e abre o lembrete), CEO ("vai") | Sim, para o dado já em produção; data-limite 2026-10-29 | P |
| 4 | Levar o aviso com os 90 dias para `github/main` (commit `23bc6815`) | parecer de 2026-09-28, §2 | Morgana/Bussola | Não | P |
| 5 | Contagem em produção de linhas de `AuditLog` com `fileName` legado em `target` | parecer de 2026-09-28, §3 | quem tiver leitura no Postgres de produção (CEO/Infra) | Não | P |
| 6 | Mergear o #288 (A1, A2, A4) e o #287 (diário, k6, evidências); o E2E `meridian-dogfood.spec.ts` já foi ajustado no #288 para o passo "Confirmar promoção" | #288 `ef30d1a9` (QA aprovou); #287 `d296953d`, `6be188af` | Morgana/CEO | Não | P |
| 7 | Rodar M2–M11 em produção depois das condições 2 e 3, com "vai" do CEO por operação, registrando no `diario.md` | `docs/qualidade/dogfood/meridian/roteiro.md` | CEO (vai) e QA | Sim para C2 em produção | M |
| 8 | Atualizar a coluna "estado na main" do PRD §6 (2026-09-26) e escrever o SC de carga; aceitar o k6 contra o build (p95 < 800 ms), não contra `next dev` | `meridian-prd.md:154-163`; §3 | Norte (spec) e QA | Não | P |
| 9 | Medir carga contra infraestrutura real (preview ou staging) com dados sintéticos, só com go-ahead; hoje só existe medição em `localhost` | §3 | Infra/SRE e QA | Não | M |
| 10 | Atritos abertos do dogfood local: A3 (caminho na tela para abrir a evidência fora do painel de divergência, decisão de produto), A5 (ciclo de dependência e ajuste de severidade/esforço não exercitados pela tela) e o foco inicial do `ModalShell`, que fica no `body` ao abrir o modal | diário de 2026-09-29; §2 | Bussola (implementa), Norte (decide A3); **data a definir** (o gate pede dono e data) | Não | P |
| 11 | Canal para o respondente externo pedir eliminação sem depender do cliente | parecer de 2026-09-24, §4; `lgpd-ropa-e-lacunas.md` | Lacre e Bussola | Recomendado antes de cliente externo | M |

## Próximas 3 ações

1. **Resolver o Inngest em produção (condição 2) e a decisão operadora/controladora (condição 1).** São os dois bloqueios que só o CEO destrava; sem eles o cliente externo entra num produto cuja retenção não executa e cuja posição contratual não está escrita.
2. **Cumprir o prazo do backup (condição 3) e mergear #288 e #287.** A data 2026-10-29 é do RoPA; o merge fecha o que este parecer usa como evidência de C2.
3. **Rodar M2–M11 em produção com "vai" do CEO (condição 7)**, com o Inngest já certo, e só então tratar o k6 contra infraestrutura real como validação.
