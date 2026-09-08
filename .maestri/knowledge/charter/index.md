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
- [ADR-0008 — Geração de rascunho sem provedor de LLM no V1](../../../docs/adr/0008-geracao-rascunho-sem-provedor-llm.md)
- [ADR-0005 — Congelamento do caminho de aprovação na submissão](../../../docs/adr/0005-congelamento-caminho-aprovacao.md)
- [ADR-0004 — Seletor de persona do protótipo não vai para produção](../../../docs/adr/0004-seletor-persona-fora-de-producao.md)
- [ADR-0003 — Derivação da classe máxima do fornecedor](../../../docs/adr/0003-derivacao-classe-maxima-fornecedor.md)
- [ADR-0002 — Papel de governança ortogonal ao papel SAFe](../../../docs/adr/0002-papel-governanca-ortogonal-safe.md)

## Memória de execução
- 2 completions em `memory.md`
