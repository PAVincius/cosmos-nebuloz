# Fork

Upstream: [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) @ `e3f262a` (MIT).

Por quê: o console da TypeSafe não emite chave nova; o Vercel AI Gateway serve o mesmo modelo (`typesafe-ai/jev`) sem fila.

O que muda (e só isso):

- `src/request.ts`: chave `vck_…` vai para `ai-gateway.vercel.sh/v4/ai/evaluation-model` com o protocolo do Gateway
  (`noul` vira `boolean`, `zeroDataRetention: true` em toda chamada); `noulAnswer` aceita `probability`.
- `hooks/fast-jev.ts`: `getApiKey` cai para `AI_GATEWAY_API_KEY` quando não há `TYPESAFE_API_KEY`.
- Testes: 3 novos (request do Gateway, resposta `probability`, ordem das chaves). 32 verdes.

Verificado ao vivo em 2026-09-23: uma requisição, ~0,7 s. Com `keepThreshold` 0.5 cortou todas as chamadas de um
trecho de teste, inclusive um arquivo ainda em uso; o setup usa 0.3.

Rodar os testes: `npm ci && npx vitest run` nesta pasta. Atualizar: copiar de novo do upstream e reaplicar o diff acima.
Candidato a PR upstream (suporte a Gateway), com o aval do dono do repo.
