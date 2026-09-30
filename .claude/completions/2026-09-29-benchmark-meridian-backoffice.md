# Benchmark do Meridian na ficha do cliente (back-office)

Spec: `specs/012-benchmark-travado-tenant` (PR #307), US1. Branch `feat/meridian-benchmark-backoffice`, base `feat/meridian-benchmark-travado` (540784d0).

## Feito
- `apps/backoffice/app/actions/meridian-benchmark.ts`: `setMeridianBenchmarkAction` (`requirePlatformStaff` + `assertCanWrite` antes do escritor, que não checa papel; referência validada ≤200) e `getMeridianBenchmark` (estado, default desligado).
- Ficha do cliente, aba Meridian: cartão "Benchmark do Meridian" (`meridian-benchmark.tsx` servidor + `meridian-benchmark-controle.tsx` cliente): estado, referência gravada, campo do aditivo (DPA §2.1), Ligar/Desligar com `ConfirmarAcao`, erro em `Erro`, sucesso em `Confirmacao`, somente leitura com motivo escrito. Interno liga sem referência.
- `ProntidaoDoModulo` ganhou `extra` (cartão que vale com ou sem bootstrap pendente).
- 4 testes de página ganharam o mock da action nova.

## Verificação
- vitest backoffice: 1773 passam; `tsc --noEmit` limpo; biome sem diagnóstico nos arquivos tocados.
- Suíte do backoffice sem SKIP_ENV_VALIDATION: 1774 passam, tsc limpo.
- NÃO conferido no navegador.

## Pendências
- Rebase sobre #323 (a683df49) feito e casts removidos: a action chama `setMeridianBenchmarkEnablement(platformDb, ...)` e lê `platformDb.meridianBenchmarkEnablement`.
- Merge depois do #323. Conferir em backoffice.nebuloz.ai depois do deploy (não conferido no navegador).
