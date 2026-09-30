# safeAction — a regra nomeada do erro de domínio chega ao cliente como `code`

Origem: observação do Crivo no #323 (o `code` de `benchmark.not-enabled` não chegava; vinha `$undefined`). Separado do #323 por mexer em `app/actions/_base.ts`, nó compartilhado por todos os produtos.

- **Causa dupla:** `safeAction` nunca preenchia o `code` do Result, e `err()` gravava `code: undefined`, que vira `"$undefined"` na serialização das server actions.
- **Correção (aditiva):** `err()` omite a chave `code` quando não há code; `safeAction` passa a `rule` do erro de domínio (`MeridianRuleError`, `StateConflictError`, `GovernanceError`, `SignalRuleError`…) como `code`. `Err.code` já era opcional.
- **Nada interno vaza:** auditei as construções desses erros no app — 138 nomes de regra, todos literais no formato `dominio.motivo` (ex.: `assessment.not-found`, `control.file.too-large`); a única construção dinâmica (`SignalRuleError(e.rule, …)` em `(signal)/actions/confidence.ts`) só reenvia o `rule` estático de outro erro. Como defesa em profundidade, só vira `code` uma regra que casa `^[A-Za-z][\w.-]{0,79}$`: texto livre, e-mail, id ou valor longo não sai do servidor. A mensagem (`error`) já saía antes; o `code` não acrescenta dado.
- **Testes:** `__tests__/actions/base.test.ts` (regra nomeada vira code; sem regra não tem chave `code`; `rule` fora do formato ou não-string é descartada; formatos reais aceitos), RED antes. Suíte inteira do app 5695/0 sem `SKIP_ENV_VALIDATION`.
- **Passa pelo Vigia.** O teste do benchmark que exige o `code` ficará no #323 (ou depois deste PR), sem mudar o escopo dele.
