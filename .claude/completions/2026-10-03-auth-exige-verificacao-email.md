# Auth: e-mail verificado antes da sessão (Vigia 03/10, achado 9, MÉDIO)

**Branch:** `fix/auth-exige-verificacao-email` · **Data:** 2026-10-03
**Não mergear antes de decidir o backfill de `User.emailVerified` (ver "Impacto em produção").**

## Problema
O sign-up é aberto e criava sessão sem provar a posse do e-mail. Quem cadastrasse o endereço de outra pessoa primeiro ficava dono da conta; e `/invite/[token]/complete` confia no e-mail da sessão (`invitation.email === session.user.email`) para dar `TenantMember`.

## Mudança
- `packages/auth/server.ts`: `emailAndPassword.requireEmailVerification: true`; `emailVerification` com `sendOnSignUp`, `sendOnSignIn` (conta antiga sem verificação recebe o link na primeira tentativa de entrar), `autoSignInAfterVerification` (o clique no link abre a sessão e segue para o `callbackURL`: `/onboarding` no cadastro, `/invite/<token>/complete` no convite) e `sendVerificationEmail` (Resend, mesmo padrão do reset: falha de envio é logada, não lançada).
- `packages/email`: template `verify-email.tsx` + `renderVerificationEmail`; `vitest.config.mts` com JSX automático (os templates não tinham teste).
- Telas: `VerifyEmailNotice` (novo) no `SignUp` e no `AcceptInviteForm` (cadastro agora responde `token: null`, sem sessão; sem isto o botão ficava em "Criando conta…" para sempre); login do app e do back-office mostram mensagem própria para `EMAIL_NOT_VERIFIED` (`signInErrorMessage`) em vez de "senha incorreta".

## Fluxos conferidos (dependiam de conta sem verificação?)
| Fluxo | Depende de sessão imediata no cadastro? | Efeito |
|---|---|---|
| `/sign-up` público → `/onboarding` | sim | passa a exigir o clique no link; o `callbackURL` vai dentro do link |
| Convite (`/invite/[token]`) → `/complete` | sim | idem; um passo a mais para o convidado. Quem já tem conta e abre o convite recebe resposta de sucesso genérica (anti-enumeração do better-auth) e **nenhum e-mail**; o aviso orienta a entrar e abrir o convite de novo |
| Provisionamento (`packages/provisioning`) | não cria `User` | sem efeito; onboarding de cliente chega pelo convite |
| Seeds e fixtures (`seed-*.ts`, e2e) | não | já gravam `emailVerified: true` |
| Back-office / staff (PZ-22: "criar a própria conta em /sign-up do app") | sim | a conta de staff nasce não verificada e precisa do clique; o texto do processo PZ-22 não foi alterado |
| `changeEmail`, 2FA, reset de senha | não | sem efeito |
| E2E (Playwright) | não encontrei teste que se cadastre pela UI | sem efeito |

## Impacto em produção (decisão do dono)
Todo `User` criado por sign-up ou convite até hoje tem `emailVerified = false` (default do schema). Com a exigência ligada, **essas contas não entram** até clicar num link. O `sendOnSignIn` reenvia o link na primeira tentativa, então elas se curam sozinhas, **desde que o envio pelo Resend funcione em produção** (domínio de `RESEND_FROM` verificado). Se não funcionar, ninguém sem verificação entra, inclusive staff.
Antes do deploy (quem tem acesso ao banco; eu não tenho credencial de produção):
1. `SELECT count(*) FILTER (WHERE NOT "emailVerified") AS sem_verificacao, count(*) AS total FROM "User";`
2. Decidir: (a) deixar o auto-reparo por e-mail, depois de testar um envio real em produção; ou (b) backfill `UPDATE "User" SET "emailVerified" = true WHERE NOT "emailVerified" AND "createdAt" < <data do deploy>` (escrita em produção: "vai" do CEO, por operação; confia nos cadastros de hoje).
A mensagem de e-mail depende de `RESEND_FROM` e do token do Resend no ambiente; não conferi o ambiente.

## Testes (RED antes do código)
- `packages/auth/__tests__/email-verification.test.ts` (6), `sign-in-error.test.ts` (2): 45 passam no pacote.
- `packages/email/__tests__/verificacao.test.ts` (2): 9 passam.
- `apps/app/__tests__/auth/verificacao-de-email.test.tsx` (5): cadastro e convite mostram o aviso (e não ficam em "Criando conta…"), erro do servidor continua no formulário, login com `EMAIL_NOT_VERIFIED` vs senha errada.
- `apps/backoffice/__tests__/sign-in-email-nao-verificado.test.tsx` (2): falha sem a mudança no formulário (verificado revertendo o arquivo).
- `tsc --noEmit` limpo em `packages/auth`, `packages/email`, `apps/app`, `apps/backoffice`; Biome 2.3.11 limpo nos arquivos tocados.

## Não coberto
Reenvio manual do link (só o automático no login); clique do link ponta a ponta contra o better-auth real; e-mail de "você já tem conta" para cadastro duplicado (`onExistingUserSignUp`).
