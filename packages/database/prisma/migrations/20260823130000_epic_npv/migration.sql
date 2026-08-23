-- Epic.npv — NEB-182.
--
-- O Lean Business Case (hipótese, resultados, indicadores, MVP, NFRs,
-- alocação) não tinha NPV em lugar nenhum, e o critério de aceite do épico
-- pai pede "Business Case com NPV e hipótese de valor por épico".
--
-- Decimal(18,6), não Float: dinheiro nasce Decimal aqui. leanBudgetAllocation
-- é Float — NEB-138 registra isso como dívida a corrigir, não como padrão a
-- repetir.
--
-- IF NOT EXISTS: migrate deploy roda no deploy de produção agora, e uma
-- reexecução não pode falhar por coluna que já está lá.

ALTER TABLE "Epic"
  ADD COLUMN IF NOT EXISTS "npv" DECIMAL(18,6);
