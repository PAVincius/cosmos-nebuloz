# Signal F4 — evidência de pessoa é sempre MANUAL (Farol, MÉDIO)

- Falha: `recordObservation` aceitava `source` SYNC/IMPORT do cliente; com SYNC gravava `recordedById=null`, e o mapeamento podia ser de outra iniciativa. Um OWNER forjava "veio da fonte X" sem autor.
- Correção (`evidence.ts`): `source` sai do schema; o servidor grava `source=MANUAL` e `recordedById=ctx.userId`; mapeamento precisa ser global ou da mesma iniciativa (`evidence.mapping.foreign`). `modal.tsx` deixa de mandar `source`.
- Teste: `__tests__/signal/integration/evidence.test.ts` (source/autor do cliente ignorados; mapeamento de outra iniciativa recusado; global e próprio aceitos). O teste antigo "sync não é atribuído a pessoa" foi substituído: descrevia o comportamento que o Farol apontou como falha.
- Fora do escopo: não existe ainda caminho de job para SYNC/IMPORT; quando houver, será outra action.
- Verificação: `pnpm exec vitest run __tests__/signal` (34 arquivos, 548 testes) verde.
