# Signal F3 — troca de papel invalida o cache (Farol, MÉDIO)

- Falha: `setMemberRole` gravava o papel novo mas não invalidava `signal-role:<tenant>:<user>` (TTL 300 s); um ADMIN rebaixado seguia ADMIN por até 5 minutos.
- Correção: `invalidateRoleCache` (melhor-esforço, depois do commit) compartilhado por `setMemberRole` e `addSignalMember` em `settings.ts`.
- Teste: `__tests__/signal/integration/members.test.ts` (invalida depois do update; não invalida quando recusa; Redis fora não desfaz a troca).
- Fora do escopo: ação de revogar acesso (remover membro) segue sem existir.
- Verificação: `pnpm exec vitest run __tests__/signal` (34 arquivos, 547 testes) verde.
