# Contracts: Login genérico + seleção de produto pós-login

Contrato = assinatura das server actions e do redirect server-side deste app (não é uma API pública externa).

## Resolução de destino pós-login

`apps/app/app/(authenticated)/page.tsx` (server component, sem input do cliente — lê a sessão):

```text
RootPage():
  ctx = requireTenantSession(headers())
  if ctx.tenant.isInternalTenant:
    redirect("/produto")   // catálogo, mesma rota/action já existente
  else:
    redirect(<primeiro módulo contratado do tenant, via listModules()>)
    // hoje, na prática, resolve para o mesmo destino de antes (ex.: /cosmos/dashboard)
    // para qualquer tenant sem a flag — sem mudança observável de comportamento.
```

## `listarProdutos()` (extensão)

`apps/app/app/actions/produtos/index.ts` — assinatura não muda (`(): Promise<Result<ProdutoNoPainel[]>>`), só o shape de `ProdutoNoPainel` ganha `perfis: string[]` (ver data-model.md).

## Troca de senha (logado)

Client chama `authClient.changePassword` (built-in do Better Auth, `better-auth/react`):

```ts
authClient.changePassword({
  currentPassword: string,
  newPassword: string,
}): Promise<{ data: unknown; error: RespostaDeErro }>
```

- Entrada: nova aba `settings/security`.
- Falha (senha atual incorreta): `error` populado, mensagem exibida inline (FR-008) — sem lançar exceção (mesma convenção já documentada em `client.ts` sobre chamadas do Better Auth que não lançam em falha de credencial).

## Esqueci a senha (já existe, sem mudança de assinatura)

```ts
authClient.requestPasswordReset({
  email: string,
  redirectTo: "/reset-password",
}): Promise<{ data: unknown; error: RespostaDeErro }>
```

Muda: `packages/auth/server.ts` passa a configurar `sendResetPassword` (callback do lado do servidor, dispara o e-mail via `packages/email`); antes, nada acontecia no envio.

## Redefinir senha (nova rota)

Nova página `(unauthenticated)/reset-password/[[...reset-password]]/page.tsx`, client component:

```ts
authClient.resetPassword({
  newPassword: string,
  token: string, // lido da URL (query param que o Better Auth injeta no redirectTo)
}): Promise<{ data: unknown; error: RespostaDeErro }>
```

## `sendResetPassword` (servidor, novo)

`packages/auth/server.ts`, dentro de `emailAndPassword`:

```ts
emailAndPassword: {
  enabled: true,
  minPasswordLength: 12,
  sendResetPassword: async ({ user, url }) => {
    // chama packages/email (Resend em produção / catcher em dev),
    // template packages/email/templates/reset-password.tsx
  },
}
```
