# Signal F5 — overwrite de rascunho de baseline auditado e guardado (Farol, MÉDIO)

- Falha: sobrescrever rascunho aberto não gravava AuditLog, e o update ia por `where:{id}` sem `signedAt:null`. Se `signBaseline` confirmasse no meio, o rascunho apagava as dimensões de um baseline já assinado. Duas assinaturas concorrentes sobrescreviam signedBy/signedAt.
- Correção (`baseline.ts`): overwrite via `updateMany` com `signedAt:null` e `count` conferido (409 `baseline.concurrent`; dimensões só são trocadas depois da guarda); AuditLog "Baseline rascunho atualizado" com diff de janela e de cada dimensão; assinatura (`markSigned`) também por `updateMany signedAt:null` com `count` (`baseline.already-signed`).
- Teste: `__tests__/signal/integration/baseline.test.ts` (filtro signedAt:null; 409 sem tocar dimensões nem trilha; diff na trilha; assinatura concorrente sem evento).
- Fora do pedido, mesmo arquivo: a guarda da assinatura (parte do achado F5 do Farol).
- Fora do escopo: trigger de imutabilidade no banco (F9) continua aberto; sem ele, escrita fora das actions ainda reescreve baseline assinado.
- Verificação: `pnpm exec vitest run __tests__/signal` (34 arquivos) verde; biome sem erros nos 2 arquivos.
