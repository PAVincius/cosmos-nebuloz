# ADR-0001 — Contratação modular via `TenantModule`

**Status**: Accepted
**Data**: 2026-07-28
**Contexto de origem**: premissa de negócio do BRD/MRD do Charter

## Contexto

O cliente contrata Cosmos, Charter, Signal ou qualquer combinação. O repo não
tinha nenhum conceito de módulo contratado: `grep -ril "entitlement\|productModule"`
não retornava nada. Existiam três candidatos a reuso, todos com o problema de
significar outra coisa:

- `FeatureFlagOverride` — toggle de rollout. "Ainda não liberamos" ≠ "o cliente
  não comprou". Sem data de contratação, sem trilha para billing.
- `SubscriptionPlan` (ORBIT/GALAXY/NEBULA/UNIVERSE) — pacotes fixos. Não
  representa "só Charter + Signal, sem Cosmos".
- `CustomRole.permissions[]` — permissão de usuário, não direito de organização.

## Decisão

Tabela própria:

```prisma
enum ProductModule { COSMOS CHARTER SIGNAL }
enum ModuleStatus  { ACTIVE TRIAL SUSPENDED CANCELED }

model TenantModule {
  tenantId, module, status, contractedAt, expiresAt, seats
  @@unique([tenantId, module])
}
```

**Default deny**: tenant sem linha não tem o módulo. `SUSPENDED` e `CANCELED`
fecham a porta sem apagar dado — inadimplência não é motivo para destruir
evidência de auditoria.

Guard em três camadas, e as três são obrigatórias:

1. `app/(charter)/layout.tsx` — redireciona quem navega sem contrato.
2. **Toda** server action — layout protege navegação, não protege RPC.
3. Nav e app-switcher — filtram por `listModules(tenantId)`.

Ordem fixa e não invertível: `requireTenantSession` → `requireModule` →
`requireCharterPermission`. Permissão checada sem sessão de tenant válida é
vazamento cross-tenant.

A migration semeia `COSMOS` para todos os tenants existentes, preservando o
comportamento atual.

## Alternativas consideradas

Ver Contexto — as três foram avaliadas e descartadas por significarem outra
coisa. Reusar qualquer uma delas teria custado zero migration e criado uma
ambiguidade permanente entre "não liberado", "não comprado" e "não permitido".

## Consequências

- Combos arbitrários funcionam sem código novo. `SIGNAL` já está no enum: quando
  o produto existir, o app-switcher o acomoda sem migration.
- Cache de 5 min em Redis (`invalidateModuleCache` após contratar/suspender).
  Sem Redis, consulta direta.
- **Nenhum código do Charter pode importar de `components/cosmos/screens/*` nem
  de `app/(cosmos)/actions/*`** — um tenant pode ter Charter sem Cosmos. As
  primitivas puras de `kit.tsx` são a exceção deliberada (ver ADR-0010).
- Billing ainda não lê `TenantModule`. Quando ler, `contractedAt`/`expiresAt`/
  `seats` já estão lá.
