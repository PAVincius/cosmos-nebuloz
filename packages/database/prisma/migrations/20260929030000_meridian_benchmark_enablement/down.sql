-- Reverte 20260929030000_meridian_benchmark_enablement.
-- Policy, FK e grants da tabela caem junto com o DROP. Perde a habilitação de
-- todos os tenants: o benchmark volta a "desligado para todos", que é o default.
DROP TABLE "MeridianBenchmarkEnablement";
