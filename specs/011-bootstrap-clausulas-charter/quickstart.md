# Quickstart: validar bootstrap de cláusulas do Charter

Pré-requisito: implementação das tasks de `tasks.md` concluída (catálogo `charter-clauses.ts`, `bootstrapCharter` criando cláusulas, seed usando o catálogo).

## 1. Testes automatizados (principal via de validação)

```bash
cd apps/app  # ou onde os testes de packages/provisioning rodam no monorepo
npx vitest run packages/provisioning/src/__tests__/charter.test.ts
npx vitest run packages/provisioning/src/__tests__/charter-clauses.test.ts
```

Cobre os três cenários de aceite do `spec.md`:
- US1: bootstrap cria as 8 cláusulas para tenant sem elas.
- US2: rodar de novo não duplica nem sobrescreve uma cláusula alterada entre as duas execuções (mock retornando a cláusula já existente + valor diferente do catálogo; `createMany` com `skipDuplicates` não deve tocar nela).
- US3: catálogo é a única fonte — teste do seed importa de `packages/provisioning/src/charter-clauses.ts`, não de um array local.

## 2. Verificação manual ponta a ponta (ambiente local)

```bash
pnpm dev  # sobe apps/app em :3012
```

1. Provisionar um tenant de teste pelo fluxo do back-office com módulo Charter contratado (ou rodar o bootstrap diretamente via script/console apontando para esse tenant).
2. Abrir `/charter/fornecedores`, cadastrar um fornecedor novo.
3. Abrir o detalhe do fornecedor → aba de postura contratual: confirmar que a biblioteca de cláusulas não está vazia (8 itens, CL-01 a CL-08).
4. Associar o fornecedor às cláusulas críticas (CL-01, CL-02, CL-03, CL-04, CL-08) → confirmar que o teto derivado sobe acima de PUBLIC (comportamento de `deriveVendorMaxClass`, não alterado por esta feature, mas agora alimentado corretamente).
5. Editar o nome de uma cláusula (ex. CL-07) pela UI do Charter (Legal).
6. Rodar o bootstrap de novo para o mesmo tenant.
7. Reabrir a biblioteca de cláusulas: confirmar que ainda são 8 (sem duplicata) e que a edição do passo 5 continua valendo.

**Lembrete da sessão** (`~/.claude/…/feedback_kill_dev_server.md`): matar o `pnpm dev` / porta 3012 ao terminar o teste manual.

## 3. Fora do quickstart

- Backfill de tenants existentes: não é validado aqui — decisão do CEO foi não fazer backfill nesta entrega.
- Aval jurídico do texto das cláusulas (ADR-0003): não é uma verificação técnica, é pendência de processo (Lacre), fora do quickstart de engenharia.
