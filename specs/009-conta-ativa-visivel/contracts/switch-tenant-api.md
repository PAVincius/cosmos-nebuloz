# Contrato: `POST /api/auth/switch-tenant` (reusado, não alterado)

Fonte: `apps/app/app/api/auth/switch-tenant/route.ts`. Esta fase não muda o
contrato — só passa a ter um novo caller (o seletor do componente
compartilhado, FR-012) além do já existente (`workspace-switcher.tsx:70`).

## Request

```
POST /api/auth/switch-tenant
Content-Type: application/json

{ "tenantId": "<cuid da conta de destino>" }
```

Validado por `SwitchTenantSchema` (`apps/app/app/actions/schemas.ts`).

## Responses

| Status | Corpo | Quando |
|---|---|---|
| 200 | `{ "success": true, "activeTenantId": "<id>" }` | pessoa é membro da conta de destino; sessão atualizada, cookie `better-auth.session_data` removido |
| 400 | `{ "error": "Invalid JSON body" }` ou `{ "error": "Validation failed", "details": [...] }` | corpo malformado |
| 401 | `{ "error": "UNAUTHORIZED" }` | sem sessão |
| 403 | `{ "error": "FORBIDDEN" }` | pessoa não é `TenantMember` da conta de destino (FR-014 continua valendo — sem mudança) |

## Garantia coberta por teste nesta fase (FR-009/SC-004)

O 200 já limpa o cookie de cache (linha 53). O que falta é o teste que prove
que, depois do 200, uma leitura imediata de `requireTenantSession` (sem
esperar os 60s de janela de revalidação) já enxerga a conta nova — não só
que o endpoint respondeu certo.
