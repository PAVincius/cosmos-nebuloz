# Scaffold — correções da revisão do PR 1 (#343): gate com estado no where e resolveConflict fechado

Branch `fix/scaffold-pr1-gate-csp`, a partir de github/main (o #343 já estava mergeado).

- `closePhase`: o BLOCKED do SG-02 agora é `updateMany` com `state in [GATE_READY, OPEN]`; count ≠ 1 vira `PHASE_NOT_CLOSABLE`.
- `writeClose` (fechamento e override): `updateMany` com `state: phase.state`; count ≠ 1 lança `PHASE_NOT_CLOSABLE` e a transação desfaz o resultado criado.
- `resolveConflict`: versão de referência ausente falha fechado (`TEMPLATE_HAS_NO_PUBLISHED_VERSION`) em vez de pular a validação do overlay.
- CSP/anexo: já corrigido na main (571617cd: `supabaseOrigin` no connect-src e `ensureBucketWith` que falha alto, com `csp-supabase.test.ts` e `storage-ensure-bucket.test.ts`). Nada a fazer aqui.

Testes: `gates-blocked-persiste` ganhou corrida de estado (fase fechada entre leitura e escrita) para BLOCKED e para fechamento; `templates` ganhou o caso sem versão de referência. `__tests__/scaffold`: 56 arquivos, 1062 testes verdes.
