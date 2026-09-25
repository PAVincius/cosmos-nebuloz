# signal — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Contexto do produto
- APURAR, "Valeu a pena?" — valor realizado: métrica e fórmula versionadas, atribuição de ganho, decisão de valor e encerramento
- Verdade de produto e sistema visual: `apps/app/components/signal/PRODUCT.md` e `apps/app/components/signal/DESIGN.md` — UI passa por `/impeccable` com alvo `apps/app/components/signal`
- `docs/produto/signal-prd.md`
- `docs/produto/signal-srd.md`
- `specs/003-signal-measure/spec.md`
- Fronteiras com os outros produtos (dono de cada entidade compartilhada): `docs/produto/mapa-de-fronteiras.md`
- Produção: https://app.nebuloz.ai/signal

## Onde o código vive
- `apps/app/app/(signal)`
- `apps/app/components/signal`
- `apps/app/lib/signal`
- `packages/database/prisma/schema/signal.prisma`
- `packages/rbac/src/signal-`

## Grafo
- 0 nós, 0 arestas (recorte do mestre com 2 hops)
- ⚠ recorte com 0 nós (< 20) — conferir prefixos, ou o grafo mestre é anterior ao código (rodar /graphify --update)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/signal/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/signal/graph.json
```

## ADRs que valem aqui
- nenhum roteado

## Memória de execução
- 2 completions em `memory.md`
