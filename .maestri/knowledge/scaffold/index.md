# scaffold — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Onde o código vive
- `apps/app/app/(scaffold)`
- `apps/app/lib/scaffold`
- `apps/app/lib/inngest/scaffold-`
- `packages/database/prisma/schema/scaffold.prisma`
- `packages/rbac/src/scaffold-`

## Grafo
- 1426 nós, 4809 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/scaffold/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/scaffold/graph.json
```

## ADRs que valem aqui
- [ADR-0017 — Fila de supervisão do Scaffold vive no back-office](../../../docs/adr/0017-scaffold-supervisao-no-backoffice.md)
- [ADR-0016 — Residência de dado configurável fica fora do V1 do Scaffold](../../../docs/adr/0016-residencia-de-dado-fora-do-v1.md)
- [ADR-0014 — Promoção para Scaffold materializa no back-office](../../../docs/adr/0014-promocao-scaffold-materializa-no-backoffice.md)

## Memória de execução
- 8 completions em `memory.md`
