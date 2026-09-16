# Charter — gates de verdade e confirmação em política/caso de uso (onda 4b)

**Data:** 2026-09-16 · **Branch:** `fix/charter-politica-gates` · **PR:** ver descrição do PR

Origem: crítica de design do Charter — telas de política (`policy.tsx`) e
detalhe de caso (`case-detail.tsx`, `policy-scope.tsx`).

## O que entrou

- `policy.tsx`: os três `<span opacity/pointerEvents>` ("Publicar versão",
  "Editar texto", "Aprovar seção") viraram `GatedButton` com motivo sempre
  visível — o span nunca bloqueava de verdade, só escondia o motivo atrás do
  `title` no hover; `disabled` real cobre Tab+Enter. "Reabrir para revisão"
  passa a exigir confirmação (`ReopenSectionModal`, nomeando a consequência)
  antes de rebaixar uma seção publicada. "Solicitar revisão" ganhou gate por
  corpo vazio. Skeleton trocado por `SkeletonCard`; corpo de seção longa ganhou
  `max-height` + scroll. Extraídos `gated-footer-action.tsx` e
  `policy-confirm-reopen.tsx` para manter `policy.tsx` dentro da baseline do
  size:guard (943 → 941 linhas).
- `case-detail.tsx`: mesmo defeito em "Registrar decisão" → `GatedButton`.
  KPI "SLA restante" trocado do tom fixo (amber para qualquer valor > 2,
  nunca verde) para `slaTone()` de `lib/charter/rules.ts`. MetaCell "Revisor"
  renomeada para "Decidido por": o valor é o papel de quem decidiu
  (`deciderRole`), não um revisor — a view não expõe nome de `reviewerId`, e
  actions não foram tocadas. Skeleton trocado por `SkeletonCard`.
- `policy-scope.tsx`: erro de leitura trocado de texto vermelho mudo por
  `ScreenError` com "Tentar de novo".

## Verificação

vitest 4110/0 · tsc limpo · `size:guard` verde sem `--update` (`policy.tsx`
943→941, `case-detail.tsx` ≤768, `policy-scope.tsx` ≤154) · build "Compiled
successfully" (falha posterior em `/api/analytics/executive` é pré-existente,
fora do diff — confirmado por `git diff --name-only origin/main...HEAD`).
Provas de mutação literais no corpo do PR.
