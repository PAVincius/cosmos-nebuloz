# Spec 004 (login genérico) — US3 trocar senha + US4 esqueci senha ponta a ponta

**Data**: 2026-09-26
**Origem**: Morgana — porta 5434 recriada/semeada, tenant `nebuloz-e2e-interno` existe. "Siga US3/US4 da 004."

## US3 — Trocar senha logado (P2)

- `apps/app/app/(authenticated)/settings/security/page.tsx` (novo) — usa o
  `SecurityForm` que já existia (`security-form.tsx`, de sessão anterior),
  chama `authClient.changePassword`.
- Item "Segurança" na nav de settings (`settings-nav.tsx`), ao lado de
  "Segurança & SSO" (SSO fica intacto, é rota diferente).
- Testes: `__tests__/settings/security.test.tsx` (já existia, verde),
  `e2e/trocar-senha.spec.ts` (novo) — login/troca/relogin via UI de verdade
  contra o servidor local (não storageState, porque muda a senha).

## US4 — Esqueci a senha, ponta a ponta (P2)

- `packages/email/templates/reset-password.tsx` (novo, mesmo padrão de
  `invite.tsx`) + `renderResetPasswordEmail`/`keys` exportados em
  `packages/email/index.ts`.
- `packages/auth/server.ts`: `emailAndPassword.sendResetPassword` configurado
  — manda pelo `@repo/email`, remetente `keys().RESEND_FROM`, engole erro de
  envio e loga (mesmo padrão do convite em `actions/settings/workspace.ts`,
  não interrompe o fluxo). Precisou de `@repo/email` como dependência nova de
  `packages/auth/package.json`.
- `packages/auth/components/reset-password.tsx` (novo) + página
  `apps/app/app/(unauthenticated)/reset-password/[[...reset-password]]/page.tsx`
  — lê `token`/`error` da query (`authClient.resetPassword({newPassword, token})`),
  trata link inválido/expirado com CTA pra pedir outro.
- Issuer do 2FA trocado de "Cosmos" pra "Nebuloz" (`server.ts:78`).
- Testes: `packages/auth/__tests__/send-reset-password.test.ts` (novo),
  `apps/app/__tests__/reset-password/reset-password.test.tsx` (novo),
  `e2e/esqueci-senha.spec.ts` (novo, lê o email de verdade no Mailpit —
  `localhost:8025/api/v1`), `server.test.ts` estendido (issuer + comentário
  de por que trocar issuer não invalida segredo TOTP já cadastrado — só
  entra na URI de enrollment, não em `createOTP(secret,...).verify()`).
- FR-012 (resposta idêntica pra email existente/inexistente): comportamento
  padrão do Better Auth, confirmado por leitura do código instalado e pelo
  segundo teste do e2e — não precisou de mudança.

## Obstáculo achado e corrigido

`apps/app/app/(unauthenticated)/reset-password/[[...reset-password]]/page.tsx`
com `dynamic(..., { ssr: false })` quebra o build no App Router
("`ssr: false` is not allowed with `next/dynamic` in Server Components") —
só apareceu rodando o e2e de verdade (unit test com mock não pega, porque
não builda a página). Troquei por `dynamic()` sem `ssr:false` + `<Suspense>`
em volta, mesmo efeito (evita o de-opt do `useSearchParams`) sem violar a
regra do Server Component.

## Rodado localmente (DB :5434 + Mailpit já estavam de pé)

- `pnpm migrate` — sem pendência.
- `pnpm seed:e2e` — recria `dev@cosmos.local`/`sm@cosmos.local`/etc com
  `Cosmos@2026!`.
- `pnpm dev` (porta 3012) — havia um `next start` (produção, sem HMR) preso
  na porta de uma sessão anterior; matei e subi `next dev` de verdade, senão
  os testes rodariam contra build velho.
- `npx playwright test e2e/trocar-senha.spec.ts e2e/esqueci-senha.spec.ts --workers=1`
  — 4/4 verdes, ponta a ponta, senha real trocada e revertida.
- Unit: `packages/auth`, `packages/email`, `apps/app` (vitest) — tudo verde
  exceto `apps/app/__tests__/actions/produtos.test.ts`, falha pré-existente
  (mock de `@repo/database` sem `MemberRole`, não é do US2/US3/US4 tocado
  aqui — não mexi.

## Cuidado pra quem rodar de novo

`trocar-senha.spec.ts` e `esqueci-senha.spec.ts` trocam senha de verdade de
personas semeadas (`dev@cosmos.local`, `sm@cosmos.local`) e revertem no fim.
Rodando os dois arquivos **juntos com múltiplos workers contra um dev server
frio** (Turbopack ainda compilando rotas), uma navegação pode abortar
(`ERR_ABORTED`) no meio da troca e deixar a senha não revertida — não é
race entre os dois testes do mesmo arquivo (`fullyParallel: false` no
`playwright.config.ts` já serializa isso), é o servidor engasgando sob
carga. Rodar com `--workers=1` ou aquecer o servidor primeiro evita. Se
achar `dev@cosmos.local` sem logar com `Cosmos@2026!`, é isso — `pnpm
seed:e2e` reseta.

## Fora do escopo

T031 (rodar `quickstart.md` cenário a cenário) e T032 (confirmar domínio
verificado no Resend com o CEO) ficam para quando as 4 stories estiverem
todas fechadas — T031 cobre cenários 1-3 (US1/US2) que não mexi agora.
Deixei `pnpm dev` rodando na 3012 pra continuidade.
