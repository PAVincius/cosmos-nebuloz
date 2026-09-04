# plataforma — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Onde o código vive
- `apps/backoffice`
- `packages/provisioning`
- `packages/auth`
- `packages/database`

## Grafo
- 7304 nós, 21110 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/plataforma/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/plataforma/graph.json
```

## ADRs que valem aqui
- [ADR-0013 — Porta única de acesso cross-tenant](../../../docs/adr/0013-porta-unica-de-acesso-cross-tenant.md)

## Memória de execução
- 6 completions em `memory.md`
