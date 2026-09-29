-- SignalPlanMetric.baselineDimensionKey: qual dimensão do baseline assinado
-- (SignalBaselineDimension.key) alimenta o baselineValue no congelamento.
-- Aditivo, nulo por padrão, sem FK.
ALTER TABLE "SignalPlanMetric" ADD COLUMN "baselineDimensionKey" TEXT;
