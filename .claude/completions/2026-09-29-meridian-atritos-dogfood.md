# Meridian — atritos do dogfood local (A1, A2, A4)

Origem: diário `docs/qualidade/dogfood/meridian/diario.md` (branch `qa/meridian-dogfood-local`), pedido da Morgana.

- **A1** — modal de override mostra `RationaleHint`: mínimo de 20 caracteres e quantos faltam (`rationale-hint.tsx`, `tab-scoring.tsx`).
- **A2** — "Promover a iniciativa" e "Virar caso de negócio" só abrem `PromoteConfirm` (escolha de destino Cosmos/Scaffold + "Confirmar promoção"); nada grava antes (`promote-confirm.tsx`, `gap-register.tsx`). E2E `meridian-dogfood.spec.ts` ganhou o passo de confirmar.
- **A4** — removido o card "Export para o Scaffold" da aba Plano (exemplo fixo G-01/governance 66). O botão "Exportar JSON" segue com dados reais de `exportPlan`.
- **A5 (não implementado, só levantado)** — a spec pede: FR-021/FR-023 e PRD M-14 (`parcial`: "edição e dependência só no servidor", `actions/gaps.ts:152-354`). Falta UI para ligar dependência (recusando ciclo) e ajustar severidade/esforço. Precisa de spec/tela própria antes de implementar.
- **A3** — do Norte, fora do escopo.

Testes: `__tests__/meridian/atritos-dogfood.test.tsx` (7, RED antes → verde); `vitest run __tests__/meridian` 185/185; biome sem erro nos arquivos tocados; tsc sem erro em meridian. E2E não rodado neste worktree (sem banco/app local).
