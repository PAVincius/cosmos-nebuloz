# Benchmark do Meridian na ficha do cliente (back-office)

Spec: `specs/012-benchmark-travado-tenant` (PR #307), US1. Branch `feat/meridian-benchmark-backoffice`, base `feat/meridian-benchmark-travado` (540784d0).

## Feito
- `apps/backoffice/app/actions/meridian-benchmark.ts`: `setMeridianBenchmarkAction` (`requirePlatformStaff` + `assertCanWrite` antes do escritor, que não checa papel; referência validada ≤200) e `getMeridianBenchmark` (estado, default desligado).
- Ficha do cliente, aba Meridian: cartão "Benchmark do Meridian" (`meridian-benchmark.tsx` servidor + `meridian-benchmark-controle.tsx` cliente): estado, referência gravada, campo do aditivo (DPA §2.1), Ligar/Desligar com `ConfirmarAcao`, erro em `Erro`, sucesso em `Confirmacao`, somente leitura com motivo escrito. Interno liga sem referência.
- `ProntidaoDoModulo` ganhou `extra` (cartão que vale com ou sem bootstrap pendente).
- 4 testes de página ganharam o mock da action nova.

## Verificação
- vitest backoffice: 1773 passam; `tsc --noEmit` limpo; biome sem diagnóstico nos arquivos tocados.
- NÃO conferido no navegador: a tabela `MeridianBenchmarkEnablement` ainda não existe em nenhum banco (feat/meridian-benchmark-schema em andamento).

## Pendências
- Leitura e escrita passam por cast estrutural (`EnablementReader`, `MeridianBenchmarkDb`) porque o client Prisma gerado ainda não tem o model. Remover os casts quando o schema entrar na base.
- Ordem de merge: schema (Alicerce) → benchmark-travado (Bussola) → esta branch.
- Conferir em backoffice.nebuloz.ai depois do deploy.
