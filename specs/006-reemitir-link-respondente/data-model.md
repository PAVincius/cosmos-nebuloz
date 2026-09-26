# Data Model: Reemitir link do respondente (Meridian)

Sem migration — reaproveita campos e tabelas já existentes.

## MeridianRespondent (sem mudança de schema, mudança de regra de escrita)

Campos já existentes, tocados pela reemissão:

| Campo | Mudança na reemissão |
|---|---|
| `tokenHash` | Regravado com hash do token novo (mesmo padrão de `revokeRespondent`). |
| `tokenExpiresAt` | Passa a ser fixado por reemissão como `min(now + 14 dias, assessment.deadline)`, em vez de copiar `assessment.deadline` (regra atual só na atribuição inicial, que não muda). |
| `status` | **Não muda** — é o que distingue reemitir de revogar. |
| `id`, `axis` | **Não mudam** — preservados por definição do requisito (FR-001). |

## Novo valor de evento de auditoria

Tabela de auditoria do Meridian já existente (`logMeridianAudit`, `actions/_shared.ts`) — só um novo `action` string:

| Action | Quando | Entity |
|---|---|---|
| `meridian.respondent.reissue` | Reemissão individual ou, uma vez por respondente, dentro da reemissão em lote | `meridian.respondent` |

Sem entidade nova de auditoria — mesmo formato `AuditDiff` (`[campo, antes, depois][]`) já usado por `assign`/`revoke`.

## Retorno da ação em lote (shape de transporte, não persistido)

```ts
type ReemitidoPendente = {
  respondentId: string;
  name: string;
  axis: MeridianAxis;
  link: string; // montado no client a partir do token em claro + window.location.origin, mesmo padrão de assignRespondent
};
```

Não é uma entidade de banco — existe só na resposta da action, pra UI montar a lista de copiar/baixar.
