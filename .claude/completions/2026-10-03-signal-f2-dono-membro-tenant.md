# Signal F2 — dono só é membro do Signal do tenant (Farol, MÉDIO)

- Falha: `ownerId` de iniciativa (cuid) e de conexão (string) ia direto para FK de `User` global. Com o id de usuário de outro tenant, o nome e o e-mail dele apareciam nas leituras (`owner`).
- Correção: `requireSignalMember` em `_shared.ts` (filtra por `tenantId` do contexto; recusa com `owner.not-member`, sem dizer se o usuário existe fora). Aplicado em `createInitiative` (quando o dono não é quem cria), `updateInitiative` (quando o dono muda) e `upsertConnection`.
- Teste: `initiatives.test.ts` e `connections.test.ts` (recusa sem escrever nem auditar; consulta filtrada por tenant; sem consulta quando não há troca de dono).
- Pendente (mesmo padrão): `plan-edit.ts` mantém seu `requireTenantMember` local com a regra `plan.owner.not-member`; unificar fica para a próxima rodada.
- Verificação: `pnpm exec vitest run __tests__/signal` (34 arquivos, 553 testes) verde; biome sem erros.
