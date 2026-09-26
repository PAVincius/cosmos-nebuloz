# Tasks: Login genérico + seleção de produto pós-login

**Input**: Design documents from `specs/004-login-generico-produto/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/actions.md, quickstart.md

**Tests**: Test-First é NON-NEGOTIABLE nesta constituição (`.specify/memory/constitution.md` III) — toda task de teste precede a de implementação correspondente, mesmo sem pedido explícito na spec.

**Organization**: Tasks agrupadas por user story (US1–US4, prioridades da spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência entre si)
- **[Story]**: US1 (login genérico), US2 (catálogo pós-login), US3 (trocar senha), US4 (esqueci senha)

---

## Phase 1: Setup

- [ ] T001 Confirmar `MAIL_CATCHER_SMTP` (ou `RESEND_TOKEN`/`RESEND_FROM`) configurado no ambiente local, per `docs/runbooks/` de e-mail — pré-condição pra testar US4 localmente sem enviar e-mail de verdade.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infra que bloqueia US2 (catálogo depende da flag de tenant) e a resolução central de destino pós-login (usada por US1 e US2).

**⚠️ CRITICAL**: Nenhuma story de catálogo/redirect começa antes desta fase.

- [ ] T002 [P] Teste de integração: `Tenant.isInternalTenant` tem default `false` e é lido a partir da sessão (não de input) — `packages/database/__tests__/tenant-is-internal.test.ts`. Escrever e confirmar que FALHA (campo ainda não existe).
- [ ] T003 Adicionar campo `isInternalTenant Boolean @default(false)` ao model `Tenant` em `packages/database/prisma/schema/tenant.prisma:25-42` (depende de T002 falhando primeiro).
- [ ] T004 Gerar e aplicar migration Prisma (`pnpm migrate` a partir de `packages/database`) — confirma T002 passa.
- [ ] T005 Criar helper de resolução de destino pós-login (lê `isInternalTenant` da sessão via `requireTenantSession`, decide `/produto` vs. produto contratado) em `apps/app/app/(authenticated)/_lib/resolve-post-login-destination.ts` (depende de T003/T004).

**Checkpoint**: Schema e helper de resolução prontos — US1 e US2 podem prosseguir.

---

## Phase 3: User Story 1 - Login sem marca de produto específico (Priority: P1)

**Goal**: Tela de login em `app.nebuloz.ai` sem wordmark/headline/ilustração de nenhum produto da suíte, pra qualquer tenant.

**Independent Test**: Acessar `/sign-in` deslogado, de qualquer tenant, e confirmar ausência de marca de produto específico.

### Tests for User Story 1

- [ ] T006 [P] [US1] Teste (Vitest, render) confirmando que `(unauthenticated)/layout.tsx` não renderiza wordmark/headline/`CadenceRail` do Cosmos — `apps/app/__tests__/unauthenticated/layout.test.tsx`. Escrever e confirmar que FALHA.
- [ ] T007 [P] [US1] Teste E2E (Playwright) do cenário 1 do quickstart — `apps/app/e2e/login-generico.spec.ts`. Escrever e confirmar que FALHA.

### Implementation for User Story 1

- [ ] T008 [US1] Remover wordmark, headline e `CadenceRail` específicos do Cosmos em `apps/app/app/(unauthenticated)/layout.tsx:73,78-83,104` — substituir por identidade genérica Nebuloz (depende de T006 falhando).
- [ ] T009 [P] [US1] Trocar copy "seu workspace no Cosmos" por copy genérica em `apps/app/app/(unauthenticated)/sign-in/[[...sign-in]]/page.tsx:6`.

**Checkpoint**: US1 completa e testável de forma independente — T006/T007 devem passar.

---

## Phase 4: User Story 2 - Catálogo de produtos pós-login (tenant interno) (Priority: P1)

**Goal**: Tenant com `isInternalTenant = true` aterrissa no catálogo pós-login (reaproveitando `(authenticated)/produto`), com Meridian clicável e os demais "em breve"; demais tenants seguem direto pro produto contratado, como hoje.

**Independent Test**: Logar como usuário do tenant Nebuloz e confirmar landing no catálogo com Meridian clicável; logar como usuário de outro tenant e confirmar que vai direto pro produto contratado.

### Tests for User Story 2

- [ ] T010 [P] [US2] Teste de integração do helper de resolução (T005): tenant interno → `/produto`; tenant sem a flag → produto contratado — `apps/app/__tests__/produto/resolve-post-login-destination.test.ts`. Escrever e confirmar que FALHA.
- [ ] T011 [P] [US2] Teste de integração de `listarProdutos()` com o novo campo `perfis` populado por produto — `apps/app/__tests__/produtos/listar-produtos.test.ts`. Escrever e confirmar que FALHA.
- [ ] T012 [P] [US2] Teste E2E (Playwright) dos cenários 2 e 3 do quickstart — `apps/app/e2e/catalogo-pos-login.spec.ts`. Escrever e confirmar que FALHA.

### Implementation for User Story 2

- [ ] T013 [US2] Adicionar `perfis: string[]` a `ProdutoNoPainel` e ao `CATALOGO` em `apps/app/app/actions/produtos/index.ts`, puxando de `MeridianRole`/`CharterRole`/`ScaffoldRole`/`SignalRole`/`MemberRole` (depende de T011 falhando).
- [ ] T014 [US2] Exibir `perfis` no card de produto em `apps/app/app/(authenticated)/produto/page.tsx` (`CartaoDeProduto`); ajustar rótulo de "não disponível" pra "em breve" quando a tela serve de landing pós-login (depende de T013).
- [ ] T015 [US2] Trocar `redirect("/cosmos/dashboard")` em `apps/app/app/(authenticated)/page.tsx:8` pelo helper de T005.
- [ ] T016 [P] [US2] Trocar `callbackURL: "/cosmos/dashboard"` em `packages/auth/components/sign-in.tsx:39` para `"/"`.
- [ ] T017 [P] [US2] Trocar `window.location.href = "/cosmos/dashboard"` em `packages/auth/components/sign-in.tsx:81` para `"/"`.

**Checkpoint**: US1 e US2 funcionando juntas — T010/T011/T012 devem passar.

---

## Phase 5: User Story 3 - Trocar senha logado (Priority: P2)

**Goal**: Usuário autenticado troca a própria senha (atual + nova) sem sair do produto.

**Independent Test**: Logado, ir em Configurações → Segurança, trocar senha, deslogar e logar com a nova senha.

### Tests for User Story 3

- [ ] T018 [P] [US3] Teste de integração/component da nova aba de segurança (troca com sucesso e com senha atual errada) — `apps/app/__tests__/settings/security.test.tsx`. Escrever e confirmar que FALHA.
- [ ] T019 [P] [US3] Teste E2E (Playwright) do cenário 4 do quickstart — `apps/app/e2e/trocar-senha.spec.ts`. Escrever e confirmar que FALHA.

### Implementation for User Story 3

- [ ] T020 [US3] Criar `apps/app/app/(authenticated)/settings/security/page.tsx` com formulário (senha atual + nova), chamando `authClient.changePassword` (depende de T018 falhando).
- [ ] T021 [P] [US3] Adicionar item "Segurança" na nav de settings em `apps/app/app/(authenticated)/settings/workspace/components/settings-nav.tsx`.

**Checkpoint**: US1, US2 e US3 funcionando juntas — T018/T019 devem passar.

---

## Phase 6: User Story 4 - Esqueci a senha, ponta a ponta (Priority: P2)

**Goal**: Usuário deslogado pede redefinição, recebe e-mail real, define nova senha numa rota funcional, e loga com ela.

**Independent Test**: Cenário 5 do quickstart, ponta a ponta, incluindo o caso de e-mail inexistente (resposta idêntica).

### Tests for User Story 4

- [ ] T022 [P] [US4] Teste de integração de `sendResetPassword` (chama `packages/email` com o template certo) — `packages/auth/__tests__/send-reset-password.test.ts`. Escrever e confirmar que FALHA.
- [ ] T023 [P] [US4] Teste de integração/component da nova rota `/reset-password` (define nova senha, trata token inválido/expirado) — `apps/app/__tests__/reset-password/reset-password.test.tsx`. Escrever e confirmar que FALHA.
- [ ] T024 [P] [US4] Teste E2E (Playwright) do cenário 5 do quickstart — `apps/app/e2e/esqueci-senha.spec.ts`. Escrever e confirmar que FALHA.

### Implementation for User Story 4

- [ ] T025 [P] [US4] Criar `packages/email/templates/reset-password.tsx` (mesmo padrão de `templates/invite.tsx`).
- [ ] T026 [US4] Configurar `sendResetPassword` em `emailAndPassword` (`packages/auth/server.ts:45-48`), chamando `packages/email` com o template de T025 e `keys().RESEND_FROM` como remetente (depende de T022 falhando, e de T025).
- [ ] T027 [US4] Criar `apps/app/app/(unauthenticated)/reset-password/[[...reset-password]]/page.tsx`, client component chamando `authClient.resetPassword({ newPassword, token })` (depende de T023 falhando).
- [ ] T028 [P] [US4] Confirmar (ou ajustar) que `requestPasswordReset` responde de forma idêntica pra e-mail existente/inexistente (FR-012) — comportamento padrão do Better Auth, task de verificação, não de construção.

**Checkpoint**: Todas as 4 user stories funcionando de forma independente — T022–T024 devem passar.

---

## Phase 7: Polish & Cross-Cutting (2FA issuer + dependências operacionais)

- [ ] T029 [P] Trocar `issuer: "Cosmos"` para `issuer: "Nebuloz"` em `packages/auth/server.ts:78`.
- [ ] T030 [P] Teste confirmando que 2FA já cadastrado antes da troca de issuer continua validando (segredo TOTP preservado) — `packages/auth/__tests__/server.test.ts` (estender teste existente).
- [ ] T031 Rodar `quickstart.md` cenário a cenário em ambiente local/staging antes de considerar a feature pronta pra dev encerrar.
- [ ] T032 Confirmar com o CEO que o domínio `nebuloz.ai` está verificado no Resend (SPF/DKIM) antes de validar US4 em produção — dependência operacional registrada no spec, não uma task de código.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: bloqueia US2 (T010/T013/T015 dependem do schema e do helper) — não bloqueia US1, US3 ou US4.
- **US1 (Phase 3)**: só depende de Setup — pode rodar em paralelo com Foundational.
- **US2 (Phase 4)**: depende de Foundational (Phase 2).
- **US3 (Phase 5)**: independente de US1/US2/US4 — só depende de Setup.
- **US4 (Phase 6)**: independente de US1/US2/US3 — só depende de Setup.
- **Polish (Phase 7)**: depende de todas as stories desejadas estarem completas (T029/T030 são independentes das stories, podem rodar a qualquer momento após Setup).

### Parallel Opportunities

- US1, US3 e US4 podem ser trabalhadas em paralelo entre si e com a Fase 2 (Foundational), já que tocam arquivos diferentes (`(unauthenticated)/layout.tsx` e `sign-in/page.tsx` vs. `settings/security/` vs. `packages/auth/server.ts` + `packages/email/templates/` + `(unauthenticated)/reset-password/`).
- Dentro de cada story, as tasks marcadas `[P]` (testes e arquivos independentes) rodam em paralelo.
- T016 e T017 tocam o mesmo arquivo (`sign-in.tsx`) em linhas diferentes — paralelizáveis com cuidado (mesmo arquivo, sem sobreposição de linha), mas mais seguro rodar sequencial se for a mesma pessoa.

---

## Parallel Example: User Story 2

```bash
Task: "Teste de integração do helper de resolução em apps/app/__tests__/produto/resolve-post-login-destination.test.ts"
Task: "Teste de integração de listarProdutos() com perfis em apps/app/__tests__/produtos/listar-produtos.test.ts"
Task: "Teste E2E dos cenários 2 e 3 em apps/app/e2e/catalogo-pos-login.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Completar Setup + Foundational.
2. Completar US1 (login genérico) — já remove o maior atrito de marca errada.
3. Completar US2 (catálogo pós-login) — fecha o objetivo central do laboratório de usabilidade.
4. **PARAR e VALIDAR**: rodar cenários 1–3 do quickstart.
5. US3 e US4 entram na sequência, sem bloquear o laboratório do Meridian.

### Incremental Delivery

1. Setup + Foundational → base pronta.
2. US1 → valida cenário 1 → não depende de mais nada pra ir a produção.
3. US2 → valida cenários 2–3 → é o que destrava o laboratório com o CEO.
4. US3 → valida cenário 4.
5. US4 → valida cenário 5 (depende da dependência operacional T032 pra produção real).
6. Polish (issuer 2FA) → valida cenário 6.

---

## Notes

- Tests são mandatórias por constituição (III) — não pular mesmo sem pedido explícito na spec.
- Commit a cada task ou grupo lógico, sem trailer `Co-Authored-By` (convenção do repo).
- T032 não é uma task de código — é um lembrete de dependência externa antes de considerar US4 pronta em produção.
