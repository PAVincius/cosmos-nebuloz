# plataforma — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Onde o código vive
- `packages/provisioning`
- `packages/auth`
- `packages/database`

## Grafo
- 6708 nós, 19911 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/plataforma/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/plataforma/graph.json
```

## ADRs que valem aqui
- [ADR-0013 — Porta única de acesso cross-tenant](../../../docs/adr/0013-porta-unica-de-acesso-cross-tenant.md)
- [ADR-0012 — RLS anulada pela conexão como superuser](../../../docs/adr/0012-rls-anulada-por-conexao-superuser.md)
- [ADR-0001 — Contratação modular via `TenantModule`](../../../docs/adr/0001-contratacao-modular-tenant-module.md)

## Memória de execução
- 10 completions em `memory.md`
