# T031 — spec 004, quickstart cenário a cenário (Chromium real)

**Data**: 2026-09-26
**Executor**: QA (Crivo)
**Ambiente**: local, `apps/app` :3012 contra `cosmos-dev-db` (:5434), Mailpit (`cosmos-mailpit`, :8025) como catcher.
**HEAD no momento do teste**: `79a8961c` (fix revoga outras sessões / rate-limit esqueci-senha / min senha), em cima de `3a5036c0`/`2a295c94` (Sentry scrub) e `da368d86` (US3/US4).

Todos os cenários rodados manualmente em Chromium real (não Playwright), via `claude-in-chrome`.

## Cenário 1 — Login sem marca de produto (FR-001)
**APROVADO.** `/sign-in`, `/sign-up`, `/forgot-password`, `/invite/<token inválido>` — só identidade Nebuloz ("Uma suíte. Um só login."), sem wordmark/headline/ilustração do Cosmos em nenhuma das 4 telas.

## Cenário 2 — Catálogo pós-login, tenant interno (FR-002 a FR-006, US2)
**APROVADO.** Login com `interno.catalogo@nebuloz.exemplo` (tenant `nebuloz-e2e-interno`, `isInternalTenant=true`) aterrissa em `/produto`. 5 produtos listados com perfis; só Meridian com badge "Ativo" e clicável, os outros 4 "Em breve". Clicar em Meridian navega pra dentro do Meridian (`/meridian-indisponivel` — página de gate de papel de diagnóstico do próprio Meridian, não falha da 004: essa persona não tem `MeridianMembership`, comportamento esperado e documentado em `e2e/setup/auth.setup.ts`).

## Cenário 3 — Tenant sem a flag, comportamento inalterado (SC-003)
**APROVADO.** Login com `admin@cosmos.local` (tenant `cosmos-dev`, sem `isInternalTenant`) foi direto pro `/cosmos` dashboard, sem passar pelo catálogo. Confirma o fix de `scripts/seed-e2e.ts` (commit `7be272d0`, upsert idempotente de `TenantModule` COSMOS) que resolveu o achado registrado antes deste teste (tenant `cosmos-dev` tinha ficado sem módulo COSMOS após a recriação do banco).

## Cenário 4 — Trocar senha logado (US3, FR-007/FR-008)
**APROVADO.**
- Senha atual errada → rejeitado, mensagem "Invalid password" (não quebra o fluxo, senha não muda). **Achado menor**: mensagem em inglês, não localizada PT-BR como o resto da tela — não bloqueia, mas destoa.
- Senha atual certa + nova senha → "Senha alterada com sucesso.", logout, login com a nova senha funciona.
- **Revoga outras sessões** (fix `79a8961c`): abri 2 sessões (2 logins separados) pro mesmo usuário — confirmei no Postgres (`Session` table) que existiam 2 registros antes da troca. Depois de trocar a senha, restou **1 sessão**. Nota metodológica: as duas abas do teste compartilham o mesmo cookie jar (mesmo Chrome), então não simulam dois dispositivos de verdade pela UI — a prova real veio da query direta no banco, não da navegação na segunda aba.

## Cenário 5 — Esqueci a senha, ponta a ponta (US4, FR-009 a FR-012)
**APROVADO**, com achado de config.
- `/forgot-password` com `admin@cosmos.local` → "Email enviado! Verifique sua caixa de entrada."
- E-mail chegou de verdade no Mailpit (catcher local, `MAIL_CATCHER_SMTP`), assunto "Redefina sua senha no Nebuloz".
- **Achado**: remetente veio como `noreply@nebuloz.com` — spec (FR-014) pede `no-reply@nebuloz.ai`. É o valor de `RESEND_FROM` em `apps/app/.env.local`, provável config de dev desatualizada, não bug de código. Reportar pro Alicerce/CEO conferir o valor real antes de ir pra produção (depende também do domínio `nebuloz.ai` verificado no Resend, T032).
- Link do e-mail levou a `/reset-password?token=...` — tela real, não 404.
- Nova senha definida → "Senha redefinida", login com a senha nova funcionou.
- E-mail inexistente (`nao-existe-e2e-fake@nebuloz.exemplo`) → mesma mensagem exata "Email enviado! Verifique sua caixa de entrada.", e confirmei no Mailpit que nenhum e-mail foi de fato enviado pra esse endereço (FR-012: não revela se a conta existe).

## Cenário 6 — Issuer do 2FA (FR-015)
**Não executável via UI — verificado no código.** Não existe tela de cadastro/enrollment de 2FA no produto hoje (`grep` em `apps/app/app` e `apps/app/components` não achou nenhuma UI de TOTP/QR code). `packages/auth/server.ts:100` confirma `issuer: "Nebuloz"` no plugin `twoFactor` do Better Auth. O teste unitário `packages/auth/__tests__/server.test.ts:362` ("usa Nebuloz como issuer do 2FA, sem tocar o segredo TOTP já cadastrado") já prova a garantia central do FR-015: o `issuer` só entra na URL de provisioning (QR code), não no cálculo de verificação do TOTP (`createOTP(secret,...).verify()`), então contas com 2FA cadastrado antes da troca continuam validando. Mesma classe de "bloqueio que a UI não alcança" documentada em `meridian-reemitir-link.spec.ts` pro caso DONE.

---

## Resumo
| Cenário | Veredito |
|---|---|
| 1 — Login sem marca | APROVADO |
| 2 — Catálogo tenant interno | APROVADO |
| 3 — Tenant sem flag | APROVADO |
| 4 — Trocar senha | APROVADO |
| 5 — Esqueci a senha | APROVADO (achado: remetente de e-mail) |
| 6 — Issuer 2FA | Verificado no código (sem UI pra testar) |

## Achados abertos (não bloqueiam)
1. Mensagem de erro "Invalid password" (senha atual errada) em inglês, não PT-BR.
2. `RESEND_FROM` em `.env.local` aponta `noreply@nebuloz.com`, spec pede `no-reply@nebuloz.ai` — conferir antes de validar US4 em produção (junto com T032).
