# Contrato: `requireModule` ganha a checagem de lançamento (FR-007/FR-011)

Local: `apps/app/lib/{meridian,charter,scaffold,signal}/guards.ts` (4
cópias, mesma assinatura hoje — ver research.md §5 sobre Cosmos).

## Assinatura (inalterada)

```ts
export async function requireModule(
  productModule: ProductModule,
  ctx: TenantContext, // ganha ctx.tenantType (data-model.md)
): Promise<void>
```

## Comportamento novo

```
1. hasModule(ctx.tenantId, productModule)?
   não → throw AuthError("FORBIDDEN", "Módulo X não contratado")  [inalterado]
2. ctx.tenantType === "INTERNA"?
   sim → OK, sem checagem de lançamento (FR-010 — URL direta isenta)
   não → productModule está em LANCAMENTO_GERAL?
     sim → OK
     não → throw AuthError("FORBIDDEN", "Módulo X ainda não lançado")  [novo, FR-011]
```

O card do catálogo (FR-007, `listarProdutos()`) aplica a mesma lógica de
lançamento para **todos** os tipos, incluindo `INTERNA` contra
`LANCAMENTO_ANTECIPADO` — só a etapa 2 acima (bloqueio de URL) isenta
`INTERNA`.

## Mensagens de erro distintas

Duas causas de `FORBIDDEN` no mesmo guard precisam de mensagens diferentes
— "não contratado" (fale com o comercial) e "ainda não lançado" (contratado,
aguarde o lançamento) não são a mesma conversa para quem recebe o erro.

## Compatibilidade

Chamadores existentes de `requireModule` (todo entry point de
Meridian/Charter/Scaffold/Signal — layout, page, server action, por
convenção do próprio arquivo) não mudam de assinatura, só passam a poder
receber `FORBIDDEN` por um motivo novo. Nenhum teste que hoje espera
sucesso deve quebrar, desde que o módulo testado esteja em
`LANCAMENTO_GERAL`/`LANCAMENTO_ANTECIPADO` — os testes existentes
precisam ser auditados contra as listas reais na implementação (tarefa do
Alicerce, não deste plano).
