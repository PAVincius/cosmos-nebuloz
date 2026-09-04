# charter — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Onde o código vive
- `apps/app/app/(charter)`
- `apps/app/lib/charter`
- `packages/database/prisma/schema/charter.prisma`
- `packages/rbac/src/charter`

## Grafo
- 1662 nós, 5506 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/charter/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/charter/graph.json
```

## ADRs que valem aqui
- [ADR-0010 — Tema próprio do Charter reusando o kit do Cosmos](../../../docs/adr/0010-tema-proprio-reusando-kit.md)
- [ADR-0009 — Auditoria do Charter reusa `AuditLog`](../../../docs/adr/0009-auditoria-reusa-auditlog.md)

## Memória de execução
- 2 completions em `memory.md`
