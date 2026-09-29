-- Reverte 20260929000100_process_registry. Derruba o registro inteiro; os ids
-- de produto são referências, então nenhum dado de produto se perde.
DROP TABLE "ProcessRegistry";
