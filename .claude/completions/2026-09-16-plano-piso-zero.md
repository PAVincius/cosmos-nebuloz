# Plano de piso zero em produção — 2026-09-16

**O que:** SKU de diagnóstico vendável sem assinatura. `PlanoComercial` slug
`diagnostico` (ordem -1, 0 assentos, R$ 0) inserido em produção; código do
#204 (`planoPadrao` + `assentos ?? 40`) deployado em `ea65681b`.

**Verificado em backoffice.nebuloz.ai:** proposta nova abre em Scale (não em
Starter nem no piso zero); rascunho com plano diagnóstico e 0 assentos reabre
com 0.

**Aprendido:** o SQL Editor do Supabase não honra `BEGIN`/`COMMIT` explícito —
a primeira execução mostrou a linha no SELECT e não persistiu. Rodado de novo
sem transação. Registrado em memória (`project_prod_database`).

**Fica aberto:** preço do SV-01 (R$ 48.000) vs alçada do CIO — decisão
comercial, não de código. Ver `docs/comercial/icp-e-precificacao.md` §3.
