# meridian — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Contexto do produto
- AVALIAR, "Estamos prontos?" — prontidão para IA aplicada pela consultoria Nebuloz: assessment em cinco eixos com respondentes externos, override humano, gap register e benchmark
- Verdade de produto e sistema visual: `apps/app/components/meridian/PRODUCT.md` e `apps/app/components/meridian/DESIGN.md` — UI passa por `/impeccable` com alvo `apps/app/components/meridian`
- `docs/produto/meridian-prd.md`
- `docs/produto/meridian-srd.md`
- `specs/001-meridian-diagnose/spec.md`
- Fronteiras com os outros produtos (dono de cada entidade compartilhada): `docs/produto/mapa-de-fronteiras.md`
- Produção: https://app.nebuloz.ai/meridian

## Onde o código vive
- `apps/app/app/(meridian)`
- `apps/app/app/meridian-responder`
- `apps/app/components/meridian`
- `apps/app/lib/meridian`
- `packages/database/prisma/schema/meridian.prisma`
- `packages/rbac/src/meridian-`
- `packages/provisioning/src/meridian`

## Grafo
- 1737 nós, 7105 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/meridian/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/meridian/graph.json
```

## ADRs que valem aqui
- nenhum roteado

## Memória de execução
- 1 completions em `memory.md`
