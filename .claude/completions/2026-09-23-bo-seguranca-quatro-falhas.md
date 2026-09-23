# Quatro falhas de segurança do back-office

**Data:** 2026-09-23 · **Branch:** `fix/bo-seguranca-quatro-falhas` · **PR:** #247

Achadas em 2026-09-22 na consolidação da base de conhecimento (PRD do back-office
B-20 e B-38 citam duas delas). A primeira foi confirmada em produção com um GET
anônimo; as outras, por leitura de código.

## O que mudou

- **`/api/health` público (back-office e app).** A resposta passa a ser só
  `{status, checks.database.{status, latencyMs}}`, 200/503. Saíram host do
  pooler, usuário com o ref do projeto, tamanho da senha e presença das envs de
  auth. O gêmeo do app (`app.nebuloz.ai/api/health`) vazava o mesmo alvo do mesmo
  banco e recebeu a mesma correção. A causa de uma falha vai para o log do
  servidor, sanitizada. Não foi para trás de `requirePlatformStaff` porque o
  guard cai junto com o banco.
- **Trilha de acesso (FR-30).** `registrarAcesso` era action pública sem sessão
  nem teto e foi removida. Quem grava agora é a rota
  `app/api/auth/[...all]/route.ts`, a partir do desfecho do better-auth
  (`lib/registro-de-acesso.ts`):
  - RECUSADO em 4xx de `/sign-in/email`, com o e-mail tentado e sem a senha;
  - LOGIN quando a lib devolve `user`. Em `/two-factor/verify-totp`, só com o
    cookie de desafio `two_factor` no pedido: o cadastro do 2FA responde igual a
    um login;
  - teto `acesso` de 30/h, pela pessoa ou pelo IP. O estouro avisa no log;
  - resposta sem `user` e sem 2FA pendente também avisa no log.
- **Aba Usuários.** `tenantPorSlug` filtra `isSystem: false`: um ADMIN do
  painel não muda mais o papel de outro staff por RPC.
- **Autocadastro.** `platformStaff` opcional (padrão staff) em
  `logPlatformAudit`, `contractModule` e `provisionTenant`; o onboarding do app
  passa `false`. As linhas antigas continuam marcadas: `AuditLog` é append-only
  no banco. O PR traz um SELECT de dimensionamento.

## Verificação

- Cada falha tem teste que falhou antes e passa depois (vitest escopado).
- Suítes completas: back-office 1746/1746, `@repo/provisioning` 102/102, app
  4287/4288. A falha do app é `screens/teams.test.tsx`, fora do diff: passa
  5/5 sozinha e falhou só sob carga, com o `tsc` rodando em paralelo.
- `tsc --noEmit`: nenhum erro nos arquivos do diff. Restam 7 erros alheios no
  back-office e 44 no app.
- security-reviewer no diff: itens 1, 1b, 3 e 4 fechados; item 2 fechado quanto
  à falha original. Dois ajustes aceitos: aviso no teto e aviso de formato.
  Rejeitado o achado de IP forjável, porque a Vercel reescreve
  `x-forwarded-for` na borda.
- Pre-push (`turbo test`) verde, rodado com `DATABASE_URL` fictícia, que o
  worktree não tem.
- Produção, depois do deploy: `curl -s https://backoffice.nebuloz.ai/api/health`
  e `https://app.nebuloz.ai/api/health` devem devolver só status e latência.

## Pendências

- `packages/auth/auth-events.ts`: a mesma classe do item 2 no app (actions sem
  sessão chamadas pelo login). Ficou em tarefa separada.
- O better-auth está sem `rateLimit` explícito: força bruta no login depende
  do padrão da lib, com contador em memória por instância.
- TOTP errado continua sem linha na trilha.
- Depois do merge, as linhas B-20 e B-38 do PRD podem sair de "parcial".
