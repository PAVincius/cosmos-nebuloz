# charter — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Contexto do produto
- GOVERNAR (transversal), "É permitido? Sob qual risco?" — risco e política multi-tenant: casos de uso, política versionada, fornecedores e trilha de auditoria
- Verdade de produto e sistema visual: `apps/app/components/charter/PRODUCT.md` e `apps/app/components/charter/DESIGN.md` — UI passa por `/impeccable` com alvo `apps/app/components/charter`
- `docs/produto/charter-prd.md`
- `docs/produto/charter-srd.md`
- `docs/runbooks/charter-em-producao.md`
- Fronteiras com os outros produtos (dono de cada entidade compartilhada): `docs/produto/mapa-de-fronteiras.md`
- Produção: https://app.nebuloz.ai/charter

## Onde o código vive
- `apps/app/app/(charter)`
- `apps/app/components/charter`
- `apps/app/lib/charter`
- `packages/database/prisma/schema/charter.prisma`
- `packages/rbac/src/charter`
- `packages/provisioning/src/charter`

## Grafo
- 2094 nós, 7787 arestas (recorte do mestre com 2 hops)

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
- 14 completions em `memory.md`
