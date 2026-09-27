# Quickstart: validar Conta ativa sempre visível

## Pré-requisitos

- `pnpm dev` rodando (`apps/app` em `:3012`)
- Usuário de teste com 6 memberships (`TenantMember`) em contas diferentes,
  papel `ADMIN` em todas — mesmo perfil descrito no spec (US1)
- Acesso a duas sessões autenticadas da mesma pessoa (dois navegadores/perfis)
  para validar US4

## US1 — Nome da conta sempre visível (P1)

```bash
# Em cada um dos 5 produtos:
open http://localhost:3012/meridian
open http://localhost:3012/scaffold
open http://localhost:3012/cosmos
open http://localhost:3012/signal
open http://localhost:3012/charter
```

**Esperado**: nome da conta ativa aparece como texto no topo, sem hover, nos
5 — mesmo componente (inspecionar: mesmo `data-testid`/classe nos 5, não uma
implementação por produto).

## US2 — Trocar de conta com confirmação (P1)

1. No seletor de conta (qualquer um dos 5 produtos), escolher outra conta.
2. **Esperado**: diálogo de confirmação aparece antes de qualquer escrita.
3. Cancelar → **Esperado**: nenhuma troca, conta ativa igual.
4. Repetir e confirmar → **Esperado**: redirect ao catálogo (tenant interno)
   ou produto contratado da conta nova; nome da conta ativa atualizado na
   tela sem reload manual.

Ver contrato reusado: [contracts/switch-tenant-api.md](./contracts/switch-tenant-api.md).

## US3 — Fallback determinístico (P2)

```sql
-- Zerar activeTenantId da sessão de teste
UPDATE session SET "activeTenantId" = NULL WHERE id = '<session-id-de-teste>';
```

Acessar qualquer produto e repetir a atualização + acesso 5x.

**Esperado**: a conta escolhida (checar `session.activeTenantId` após cada
acesso) é sempre a mesma — a de `TenantMember.createdAt` mais antigo para
aquele `userId`.

## US4 — Convite/onboarding não vaza entre sessões (P2)

1. Sessão A (navegador 1): login, anotar conta ativa.
2. Sessão B (navegador 2, mesma pessoa): aceitar um convite pendente para uma
   terceira conta (ou completar onboarding de workspace novo).
3. Voltar à sessão A e recarregar.

**Esperado**: sessão A continua na conta anotada no passo 1. Sessão B está na
conta nova.

## Testes automatizados (rodar antes de considerar a fase pronta)

```bash
cd apps/app
npx vitest run __tests__/auth          # fallback determinístico + escopo de sessão
npx vitest run __tests__/actions/auth  # switch-org / switch-tenant (regressão)
npx playwright test e2e/workspace-switcher.spec.ts
```
