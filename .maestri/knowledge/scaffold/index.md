# scaffold — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Contexto do produto
- CONTRATAR, "O que foi prometido?" — engajamento faseado por template: trilhas, gates com assinatura, caso de negócio e baseline assinados
- Verdade de produto e sistema visual: `apps/app/components/scaffold/PRODUCT.md` e `apps/app/components/scaffold/DESIGN.md` — UI passa por `/impeccable` com alvo `apps/app/components/scaffold`
- `docs/produto/scaffold-prd.md`
- `docs/produto/scaffold-srd.md`
- `specs/002-scaffold-adoption/spec.md`
- Fronteiras com os outros produtos (dono de cada entidade compartilhada): `docs/produto/mapa-de-fronteiras.md`
- Produção: https://app.nebuloz.ai/scaffold

## Onde o código vive
- `apps/app/app/(scaffold)`
- `apps/app/components/scaffold`
- `apps/app/lib/scaffold`
- `apps/app/lib/inngest/scaffold-`
- `apps/backoffice/app/(staff)/scaffold`
- `apps/backoffice/app/actions/scaffold`
- `packages/database/prisma/schema/scaffold.prisma`
- `packages/rbac/src/scaffold-`

## Grafo
- 1847 nós, 7537 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/scaffold/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/scaffold/graph.json
```

## ADRs que valem aqui
- [ADR-0017 — Fila de supervisão do Scaffold vive no back-office](../../../docs/adr/0017-scaffold-supervisao-no-backoffice.md)
- [ADR-0016 — Residência de dado configurável fica fora do V1 do Scaffold](../../../docs/adr/0016-residencia-de-dado-fora-do-v1.md)
- [ADR-0015 — Caso de negócio versionado vence o baseline plano do SRD](../../../docs/adr/0015-caso-de-negocio-versionado.md)
- [ADR-0014 — Promoção para Scaffold materializa no back-office](../../../docs/adr/0014-promocao-scaffold-materializa-no-backoffice.md)

## Memória de execução
- 9 completions em `memory.md`
