# Contrato: ação de back-office `alterarTipoDeConta` (nova, FR-004)

Local: `apps/backoffice/app/actions/accounts.ts` (mesmo arquivo que já lê
`isSystem: false` na linha 178).

## Input

```ts
{ tenantId: string /* cuid */, type: TenantType }
```

Validado por schema Zod, reusando primitivos de `_base.ts`/`schemas.ts` já
existentes no back-office (mesmo padrão de
`apps/backoffice/app/actions/tenant-members.ts`).

## Guard

`requirePlatformStaff` + `assertCanWrite` (`apps/backoffice/lib/guard.ts`) —
mesmo par usado por `tenant-members.ts` para trocar `role`. Sem papel de
staff com permissão de escrita → `Result` de erro `FORBIDDEN`, sem alterar
nada.

## Efeito

1. `database.tenant.update({ where: { id: tenantId }, data: { type } })`.
2. `logPlatformAudit({ tenantId, actorUserId, actorName, action: "updated", entityType: "tenant", entityId: tenantId, target: "<slug>: <tipo antes> → <tipo depois>", diff: [["type", antes, depois]] })` —
   mesma chamada de `tenant-members.ts:147-158`, campos adaptados.
3. `invalidateModuleCache`/cache de sessão não precisa de invalidação —
   `Tenant.type` é lido por request, não cacheado (SC-004: reflete sem
   deploy nem logout).

## Output

`Result<{ tenantId: string; type: TenantType }>` — segue o padrão
`safeAction`/`Result<T>` já usado no back-office.

## Erros

| Caso | Resultado |
|---|---|
| `tenantId` não existe | erro `NOT_FOUND` |
| Ator sem papel de staff/escrita | erro `FORBIDDEN`, nenhuma escrita |
| `type` igual ao atual | sucesso, sem novo registro de auditoria (no-op idempotente) — decisão de implementação, não gera ruído em auditoria para "troca" que não trocou nada |
