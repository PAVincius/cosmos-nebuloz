# Auth: reset de senha encerra as sessões (Vigia 03/10, achado 10, MÉDIO)

**Branch:** `fix/auth-revoga-sessoes-no-reset` · **Data:** 2026-10-03

`emailAndPassword.revokeSessionsOnPasswordReset: true` em `packages/auth/server.ts`. No better-auth 1.6.26 a opção chama `deleteUserSessions(userId)` ao concluir o reset (`dist/api/routes/password.mjs`): apaga todas as `Session` do usuário. Quem tinha cookie roubado perde a sessão em até 60 s (`SESSION_REVALIDATE_SECONDS`, o cache do cookie).

Impacto: quem redefine a senha logado em outro aparelho é deslogado de lá e entra de novo. Não afeta `changePassword` (opção própria, `revokeOtherSessions`, fora do escopo).

Teste (RED antes): `server.test.ts` "redefinir a senha encerra as outras sessões da conta". `vitest run` em `packages/auth`: 38 passam. Biome 2.3.11: limpo.
Não testei o reset ponta a ponta contra um banco; a prova é a opção documentada do better-auth e o teste de configuração.
