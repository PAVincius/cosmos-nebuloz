# Contracts: Reemitir link do respondente (Meridian)

Contrato = assinatura das novas server actions em `apps/app/app/(meridian)/actions/collection.ts`.

## `reissueRespondentLink`

```ts
const ReissueSchema = z.object({ respondentId: cuid });

export async function reissueRespondentLink(
  raw: z.input<typeof ReissueSchema>
): Promise<Result<{ id: string; token: string }>>
```

- Requer `requireMeridianPermissionContext("assessment.manage")`.
- Busca respondente por `id` + `tenantId`, com o `assessment` (pra ler `deadline`).
- Recusa (`MeridianRuleError`) se `status` for `DONE` ou `REVOKED`.
- Recusa (`StateConflictError`) se `assessment.deadline < now`.
- Sucesso: gera token novo, regrava `tokenHash` e `tokenExpiresAt = min(now + 14d, deadline)`, grava auditoria `meridian.respondent.reissue`, devolve `{ id, token }` (mesmo shape de `assignRespondent`, pro client montar o link).
- `revalidatePath("/meridian")`.

## `reissuePendingLinks`

```ts
const ReissueAllSchema = z.object({ assessmentId: cuid });

export async function reissuePendingLinks(
  raw: z.input<typeof ReissueAllSchema>
): Promise<Result<{
  assessmentId: string;
  reissued: Array<{ respondentId: string; name: string; axis: MeridianAxis; token: string }>;
}>>
```

- Requer `requireMeridianPermissionContext("assessment.manage")`.
- Busca assessment por `id` + `tenantId`; recusa (`StateConflictError`) se `deadline < now`.
- Busca todos os respondentes do assessment com `status` em `INVITED`/`PENDING`/`OVERDUE`.
- Se a lista vier vazia: devolve sucesso com `reissued: []` — a UI distingue esse caso (mensagem "nada pra reemitir") de uma falha.
- Pra cada respondente elegível, numa única transação: gera token, regrava `tokenHash`/`tokenExpiresAt`, grava auditoria `meridian.respondent.reissue`.
- `revalidatePath("/meridian")`.
- Client monta `link` de cada item (`${window.location.origin}/meridian-responder/${token}`), mesmo padrão de `assignRespondent`/`tab-coleta.tsx:71`, e monta o texto pra copiar/baixar (`nome · eixo · link`, um por linha).

## UI — pontos de entrada (sem contrato de API, só do componente)

- `tab-coleta.tsx`: botão "Reemitir link" na linha do respondente (chama `reissueRespondentLink`, mostra o link novo no mesmo modal de `AssignRespondentModal`).
- `tab-coleta.tsx`: botão "Reemitir e copiar todos os pendentes" (chama `reissuePendingLinks`, abre modal de lista com "copiar tudo" e "baixar .txt/.csv").
