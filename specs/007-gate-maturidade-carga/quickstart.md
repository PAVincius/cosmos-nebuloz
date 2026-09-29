# Quickstart: Gate de maturidade + teste de carga (k6)

## Cenário 1 — Aplicar o gate a um produto (US1, FR-001/FR-002)

1. Abrir `docs/qualidade/gate-maturidade-carga.md`.
2. Marcar os três critérios pro Meridian.
3. **Esperado**: apto (todos os critérios cumpridos, compliance aplicável e cumprido).
4. Repetir pro Scaffold (sem SC formal, sem dogfood em curso).
5. **Esperado**: não apto, com os critérios específicos listados como pendentes.

## Cenário 2 — Não-aplicabilidade de compliance (Edge case)

1. Aplicar o gate a um produto que não coleta dado de terceiro.
2. **Esperado**: critério de compliance marcado "não aplicável", não bloqueia o resultado.

## Cenário 3 — SC-011 do Meridian existe e é verificável (US2, FR-004/FR-005)

1. Abrir `docs/produto/meridian-prd.md`, tabela de SCs.
2. **Esperado**: linha SC-011, com cenário de referência e número (marcado hipótese).
3. Rodar o script k6 (`k6/meridian-pi-planning.js`) num ambiente local/staging.
4. **Esperado**: relatório com p95 e taxa de erro, comparável contra o critério do SC-011, com aviso de hipótese.

## Cenário 4 — Nunca contra produção (FR-006, SC-003)

1. Tentar apontar o script k6 pra URL de produção.
2. **Esperado**: script recusa rodar (mesmo padrão de guard de `scripts/seed-meridian-load.ts`, que recusa fora de `localhost`/`127.0.0.1`/`::1`).

## Cenário 5 — Atualizar a hipótese de concorrência (US3, FR-009)

1. CPO/CEO valida o número real com os 3 leads.
2. Atualizar o campo "Status do critério" do SC-011 (e o número, se mudar) em `meridian-prd.md`.
3. **Esperado**: nenhuma outra estrutura (checklist do gate, script k6) precisa mudar.
