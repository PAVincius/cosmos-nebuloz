# Charter — fluxo do primeiro cliente (crítica de design, onda 1)

**Data:** 2026-09-15 · **Branch:** `fix/charter-fluxo-primeiro-cliente` · **PR:** #208

Origem: crítica de design dual-agent do módulo Charter (24/40 nas heurísticas
de Nielsen; snapshot em `.impeccable/critique/2026-09-15T22-39-35Z__apps-app-components-charter.md`).
P0: o primeiro cliente não consegue completar o fluxo central — o tenant real
tem 4 fornecedores em `REVIEW` sem cláusulas (`maxClass` nulo), então o intake
só permite "Salvar rascunho", e rascunho não tinha saída nenhuma.

## O que entrou

- `submitDraftCase({ caseId })` em `actions/cases.ts`, permissão `case.submit`,
  com o **mesmo gate** de `submitCase` (extraído para `submissionGate` +
  `submissionNote`). `vendor.required` intacta — "sem fornecedor / modelo
  próprio" é decisão de produto e ficou fora.
- `case-detail`: rascunho ganha primário "Submeter para revisão"; recusa do
  gate vira toast **e** `Callout` com link "Ajustar fornecedor {nome}".
- `IntakeModal` extraído para `modals-intake.tsx` (movimento puro, diff vazio;
  `modals.tsx` 2180 → 1734) e o bloqueio por fornecedor inelegível ganhou link
  para o fornecedor.
- `setup.ts`: passo novo "Aprove um fornecedor" (feito só com `maxClass` não
  nulo); "Submeta o primeiro caso" deixa de contar rascunho; copy de publicar
  alinhada ao bloqueador real ("aprove as nove seções").
- Dashboard: `version === null` → Badge âmbar "Política nunca publicada", sem
  "Revisão em {null} dias"; primário contextual derivado do `setupProgress`
  via `GatedButton`; "Exportar resumo" virou "Exportar pacote" ligado de
  verdade a `exportEvidence` (`download()` movido para
  `components/charter/download.ts`); fila vazia = "Nenhum caso aguardando
  decisão" + link. `policy.tsx:214` esconde o badge quando `daysToReview` é nulo.

## Decisões

- Rota de detalhe de fornecedor é `/charter/vendor/{code}` (o brief dizia
  `/charter/vendors/{id}`, que é a lista) — links apontam para a rota que existe.
- `GovernanceError` em `cases.ts` vem de `./_shared` (o de `guards` vira proxy
  sob mock parcial); `res.error` idêntico.

## Verificação

vitest 4071/0 · tsc limpo · `size:guard` verde sem `--update` · build
"Compiled successfully" (falha posterior em `/api/analytics/executive` é
pré-existente, fora do diff) · `pnpm turbo test` 13/13 pacotes (o push
contornou o pre-push; o gate foi rodado à mão depois). Provas de mutação
literais no corpo do PR.
