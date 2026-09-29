---
status: approved
---

# Intent: Benchmark do Meridian travado por tenant

**Feature Branch**: `012-benchmark-travado-tenant`

**Created**: 2026-09-29

**Input**: descrição original do usuário: "Decisão do CEO de 29/09: benchmark do Meridian desligado no 1º contrato E travado no produto. Regra completa no PR #294, PRD §10 'Benchmark travado por tenant' (d9062595). (1) habilitação de benchmark por tenant, default desligada; (2) só staff Nebuloz liga, no back-office (ficha do cliente), com a referência do aditivo (DPA §2.1) obrigatória e auditoria; nenhum papel do tenant cliente mexe; (3) ligada, o opt-in continua por assessment como hoje; (4) o servidor recusa: createAssessment com benchmarkOptIn=true e habilitação off volta erro, e runScoring/contributeToBenchmark não contribui com a habilitação off, mesmo com opt-in antigo; (5) tenant interno segue a regra, sem exigir aditivo."

## Problema

Hoje, qualquer consultor de qualquer tenant cliente liga o opt-in de benchmark ao criar um assessment — é uma caixa de marcar na tela (`apps/app/components/meridian/screens/assessments.tsx:81,114,211`), default `false` só no schema (`apps/app/app/(meridian)/actions/assessments.ts:365`), sem nenhuma trava acima do consultor. Marcada, o scoring contribui para a coorte anônima automaticamente (`apps/app/app/(meridian)/actions/scoring.ts:200` chama `contributeInTx`, `apps/app/app/(meridian)/actions/benchmark.ts:55-72`).

Isso torna a Nebuloz controladora de dado do cliente (ele entra na coorte) sem RoPA, sem aviso ao respondente e sem lastro contratual — o único freio hoje é o julgamento do consultor no momento de criar o assessment.

## Contexto

Decisão do CEO em 2026-09-29, registrada no memo de compliance (`docs/compliance/2026-09-29-memo-ceo-operadora-controladora-meridian.md`, item 4 e §5.a) e formalizada no PRD do Meridian (`docs/produto/meridian-prd.md` §10, "Benchmark travado por tenant", PR #294 / commit `d9062595`). Bloqueia o primeiro contrato de cliente externo — não é melhoria incremental, é pré-requisito de venda.

A regra tem duas camadas que a spec precisa manter distintas:
1. **Habilitação por tenant** (nova) — se o tenant pode, em tese, ter qualquer assessment contribuindo. Só staff Nebuloz liga, só no back-office, só com referência de aditivo.
2. **Opt-in por assessment** (já existe) — dado a habilitação ligada, o consultor decide assessment a assessment, exatamente como hoje.

A habilitação é a porta de fora; o opt-in continua sendo a porta de dentro. Uma sem a outra não basta.

## Restrições

- **Nenhum papel do tenant cliente liga ou desliga a habilitação** — nem ADMIN, nem CONSULTANT. Só staff Nebuloz, no back-office.
- **Referência do aditivo (DPA §2.1) é obrigatória** para ligar a habilitação de um tenant externo; a ação grava auditoria com ator, data e referência.
- **Tenant interno (`isInternalTenant = true`, `packages/database/prisma/schema/tenant.prisma:42`) segue a mesma trava mecânica**, mas sem exigir aditivo — a Nebuloz já é controladora do próprio dado.
- **O servidor recusa, não só a tela**: `createAssessment` recusa `benchmarkOptIn = true` com a habilitação desligada; `contributeInTx`/`runScoring` não contribui com a habilitação desligada no momento do scoring, mesmo com um `benchmarkOptIn = true` gravado antes de a habilitação cair.
- **Retirar contribuição já feita segue a regra atual** de `withdrawContribution` (`benchmark.ts:90-121`) — esta spec não muda esse fluxo.
- **Fora desta regra**: linha no RoPA e aviso próprio ao respondente são pré-requisito para ligar a habilitação de um cliente externo de verdade, mas são responsabilidade da Lacre e não bloqueiam a trava em si (memo, §5.a).
- Onde a habilitação é armazenada (`Tenant` — ao lado de `isInternalTenant` — , `TenantModule`, ou um campo/model novo) fica a critério de quem implementar; esta spec não prescreve.

## Resultado desejado

Um tenant cliente novo nasce com o benchmark do Meridian completamente fora do alcance: a caixa de opt-in não aparece na tela de criar assessment, e mesmo que alguém chame a action diretamente com `benchmarkOptIn: true`, o servidor recusa. Só depois de um staff Nebuloz ligar a habilitação no back-office — com a referência do aditivo registrada e auditada — a caixa volta a aparecer, e o consultor do cliente decide, assessment a assessment, como já decide hoje. Se a habilitação for desligada de novo, nenhuma contribuição nova acontece, mesmo para assessments com opt-in antigo ainda marcado.

## Fora de escopo

- RoPA e aviso ao respondente (Lacre, não bloqueia esta trava).
- Mudar o comportamento de `withdrawContribution` (retirar contribuição já feita).
- Decidir o local de armazenamento da habilitação — fica com quem implementar.
- Qualquer alteração no cálculo de coorte, percentil ou limiar de leitura (`BENCH_THRESHOLD`) — não muda nesta spec.
