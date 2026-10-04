# Signal F1 — trilha só do Signal (Farol, ALTO)

- Falha: `listAudit` aceitava `entityType` livre e o leitor do Signal lia o AuditLog de Meridian/Charter/Scaffold do mesmo tenant.
- Correção: `entityType` virou enum `SIGNAL_ENTITIES` (`_shared.ts`); o prefixo `signal.` entra sempre no `where` (`AND`).
- Teste: `__tests__/signal/integration/audit.test.ts` (outro módulo é recusado e `findMany` não é chamado; prefixo presente mesmo com filtro).
- Desvio do pedido: entityType de outro módulo devolve erro de validação, não lista vazia; sem vazamento nos dois casos.
- Verificação: `pnpm exec vitest run __tests__/signal` (34 arquivos, 546 testes) verde.
