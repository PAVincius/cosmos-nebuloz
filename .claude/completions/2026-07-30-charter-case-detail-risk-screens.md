# Charter — CaseDetail e Risk portados contra o protótipo — Complete

**Date:** 2026-07-30

## Scope

Últimas duas telas do V1 do Charter (`case-detail.tsx`, `risk.tsx`), refeitas
contra `charter-screens-2.jsx` — antes bloqueadas por dependerem de um arquivo
não disponível localmente. Baixado via MCP `claude_design` (Design tool
`get_project`/`list_files`/`get_file`, projeto `691f7fe5`) e arquivado em
`docs/design-handoff/charter-prototype/charter-screens-2.jsx`.

## Mudanças

- `case-detail.tsx`: header com 4 badges, 4 KpiCard, abas Visão geral/Risco/
  Mitigações/Trilha, card de Fornecedor com `Callout` de inelegibilidade,
  `RiskMiniMatrix`/`MitigationTable`/`AuditList` reusados de `parts.tsx`.
- `risk.tsx`: `Heatmap` de `parts.tsx`, painel direito alternando "Exposição
  por categoria" ↔ "Casos na célula" conforme seleção (fiel ao JSX — a versão
  anterior mostrava as duas coisas sempre e tinha uma tabela extra de "N casos"
  e filtro de mitigação ausentes no protótipo; ambos removidos).
- `getCase()` (`actions/cases.ts`): ganhou `can.decide` (mesmo padrão de
  `PolicyView.can`) e os campos de fornecedor (`vendorCode/vendorCategory/
  vendorRegion/vendorDpa/vendorRetention`) que o card de Fornecedor precisa.
- `getRiskBoard()` (`actions/risk.ts`): `cases[]` ganhou `dataClass`, usado no
  badge da lista de casos por célula.

## Verificação

- `tsc --noEmit`: 0 erros novos (erros pré-existentes em `__tests__/actions/
  pae/*` e `github-sync.test.ts` não tocados por este trabalho).
- `biome check` em `components/charter` + `app/(charter)`: 0 erros.
- `vitest run __tests__/charter`: 31/31.
- `verify:charter`: 33/35 (2 falhas de propósito — ADR-0012, BYPASSRLS do
  usuário postgres em dev).
- Verificado no browser (tenant `medcore`, Marina Alves/Compliance): caso
  UC-109 (Restrito, SLA vencido) — 4 tabs, `RiskMiniMatrix`, `MitigationTable`,
  modal de decisão com papel correto no rodapé; Matriz de Risco — heatmap
  clicável alternando o painel direito, `MitigationTable` no rodapé.

## Outstanding

- `HANDOFF.md` atualizado: as 10 telas do V1 estão portadas; próximo passo é
  E2E (§6 do handoff lista os 5 fluxos por ordem de valor).
- KPIs de `cases.tsx` (tela pré-existente, não tocada) mostraram uma
  inconsistência transitória de contagem no browser (títulos corretos, KpiCard
  zerado) que não reproduziu de forma consistente — provável animação de
  contagem ainda em andamento no frame do screenshot, não um bug confirmado.
  Vale um olhar rápido se reaparecer.
