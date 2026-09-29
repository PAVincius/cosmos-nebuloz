# Quickstart: validar Tipo de conta e lançamento (Fase 1)

## Pré-requisitos

- `pnpm dev` rodando (`apps/app` em `:3012`, `apps/backoffice` na porta
  configurada)
- Após a migration do Alicerce: tenants existentes com `type` populado
  conforme o mapeamento (ADR-0018)
- Usuário staff do back-office para US3
- Duas contas de teste: uma `INTERNA` (nebuloz) e uma `CLIENTE`/`TESTE` com
  ao menos um módulo `ACTIVE` fora de `LANCAMENTO_GERAL`

## US1 — Catálogo interno respeita o lançamento

```bash
# Login na conta INTERNA, abrir o catálogo
open http://localhost:3012/produto
```

**Esperado**: só os módulos em `LANCAMENTO_ANTECIPADO` têm card clicável;
os demais mostram "Em breve", sem link. Um módulo `SUSPENSO`/`CANCELADO`
continua mostrando o motivo real de contrato, não "Em breve".

## US2 — Tipo de conta é um campo único

```bash
# Confirmar zero leitura dos booleanos antigos fora de teste/migration/gerado
grep -rn "isSystem\|isInternalTenant" apps/app apps/backoffice \
  --include="*.ts" --include="*.tsx" \
  | grep -v __tests__ | grep -v /generated/ | grep -v /migrations/
# Esperado: 0 linhas de código (comentários residuais são aceitáveis, ver research.md §1)
```

Ver [contracts/guard-lancamento.md](./contracts/guard-lancamento.md) para o
`TenantContext.tenantType` novo.

## US3 — Back-office troca o tipo de uma conta

1. Como staff, chamar a ação `alterarTipoDeConta` (ver
   [contracts/alterar-tipo-de-conta.md](./contracts/alterar-tipo-de-conta.md))
   pra uma conta `TESTE` → `CLIENTE`.
2. **Esperado**: `Tenant.type` atualizado; entrada nova em `AuditLog` com
   `diff: [["type", "TESTE", "CLIENTE"]]`.
3. Repetir sem papel de staff → **Esperado**: `FORBIDDEN`, nada muda.

## US4 — Conta não interna não acessa produto não lançado, nem por URL

```bash
# Login na conta CLIENTE de teste, módulo ACTIVE fora de LANCAMENTO_GERAL
open http://localhost:3012/produto      # card mostra "Em breve", sem link
open http://localhost:3012/charter      # (ou o produto testado) — acesso direto por URL
```

**Esperado**: a segunda URL é bloqueada (`FORBIDDEN`/redirect), não a tela
do produto — ver
[contracts/guard-lancamento.md](./contracts/guard-lancamento.md). Repetir
com a conta `INTERNA` no mesmo cenário (módulo fora de
`LANCAMENTO_ANTECIPADO`): a URL direta **não** é bloqueada (FR-010).

## Testes automatizados

```bash
cd apps/app
npx vitest run __tests__/produto           # FR-007/008, EstadoDoProduto NAO_LANCADO
npx vitest run __tests__/auth              # TenantContext.tenantType

cd ../backoffice
npx vitest run __tests__/accounts          # alterarTipoDeConta + auditoria (ajustar caminho ao existente)
```
