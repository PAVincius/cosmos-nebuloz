# Quickstart: Login genérico + seleção de produto pós-login

Pré-requisito: `pnpm dev` rodando (`apps/app` em `:3012`), migration aplicada (`pnpm migrate`), tenant Nebuloz marcado com `isInternalTenant = true` no banco local.

## Cenário 1 — Login sem marca de produto (FR-001)

1. Deslogado, abrir `/sign-in`.
2. **Esperado**: sem wordmark/headline/ilustração do Cosmos — só identidade Nebuloz.

## Cenário 2 — Catálogo pós-login, tenant interno (FR-002 a FR-006, US2)

1. Logar com usuário do tenant Nebuloz (`isInternalTenant = true`).
2. **Esperado**: aterrissa em `/produto` (catálogo), com Meridian clicável e os demais desabilitados ("em breve"), perfis visíveis por produto.
3. Clicar em Meridian.
4. **Esperado**: entra no Meridian.

## Cenário 3 — Tenant sem a flag, comportamento inalterado (SC-003)

1. Logar com usuário de um tenant sem `isInternalTenant` (ou `false`).
2. **Esperado**: vai direto pro produto contratado, sem ver o catálogo — igual ao comportamento atual, antes desta feature.

## Cenário 4 — Trocar senha logado (US3, FR-007/FR-008)

1. Logado, ir em Configurações → Segurança.
2. Informar senha atual + nova senha, salvar.
3. Deslogar, logar de novo com a nova senha.
4. **Esperado**: login bem-sucedido com a nova senha.
5. Repetir com senha atual errada — **esperado**: erro claro, senha não muda.

## Cenário 5 — Esqueci a senha, ponta a ponta (US4, FR-009 a FR-012)

Requer `RESEND_TOKEN`/`RESEND_FROM` configurados (produção) ou `MAIL_CATCHER_SMTP` (dev/staging).

1. Deslogado, ir em "Esqueci minha senha", informar e-mail válido.
2. **Esperado**: e-mail chega (Resend em produção; catcher local em dev) com link de redefinição.
3. Abrir o link.
4. **Esperado**: chega em `/reset-password` com formulário funcional (não 404).
5. Definir nova senha, logar com ela.
6. **Esperado**: login bem-sucedido.
7. Repetir o passo 1 com um e-mail que não existe na base.
8. **Esperado**: resposta idêntica à do passo 1 (não revela se a conta existe).

## Cenário 6 — Issuer do 2FA (FR-015)

1. Usuário com 2FA já cadastrado (antes da mudança) faz login.
2. **Esperado**: TOTP continua validando normalmente (segredo preservado, só o rótulo no app autenticador muda de "Cosmos" para "Nebuloz" em cadastros novos).
