# 2026-09-06 — Telas Empresa do back-office

Spec: docs/superpowers/specs/2026-09-05-telas-empresa-modelo-design.md
Plano: docs/superpowers/plans/2026-09-05-telas-empresa-modelo.md

Entregue: empresa.prisma (7 tabelas, migration 20260906000000_empresa com
RLS), deriveVendorMaxClass em @repo/provisioning, lib/empresa (plano de
contas, DPA, CAC, DRE/caixa, aviso), quatro actions, seed create-only
(18 fornecedores, 7 perguntas), seção Empresa com quatro telas.

Decisões em execução:
- Plano de contas ficou com 27 contas — o plano previa 25.
- A fixture do DRE foi corrigida (a linha 5.2 passou a valer 150).
- `deriveVendorMaxClass` foi extraída para `@repo/provisioning` em vez de
  ficar duplicada no back-office.
- As escritas do CAC rodam em transação.
- O `DecisaoDeConsentimento` é criado na primeira escrita, não antes.
- A `key` por competência/valor ficou persistida nas telas, não recalculada
  a cada render.
- O comando de teste escopado por arquivo é `npx vitest run <arquivo>`
  dentro do app/pacote — a forma `pnpm --filter <app> test -- <arquivo>` do
  plano não restringe o escopo.

Pendente para produção: build da Vercel aplica a migration; rodar
`seed:empresa:nebuloz` contra produção só com "vai" do usuário; o percurso
no navegador (Task 18, passo 3) fica para o controller, que tem login de
staff.
