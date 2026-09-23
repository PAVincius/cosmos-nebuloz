# cosmos — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Contexto do produto
- EXECUTAR, "O que estamos fazendo?" — portfólio SAFe: hierarquia, WSJF, PI e gates de ciclo de vida sobre um único banco de fatos
- Verdade de produto e sistema visual: `apps/app/components/cosmos/PRODUCT.md` e `apps/app/components/cosmos/DESIGN.md` — UI passa por `/impeccable` com alvo `apps/app/components/cosmos`
- `docs/produto/cosmos-prd.md`
- `docs/produto/cosmos-srd.md`
- `docs/cliente/index.md`
- Fronteiras com os outros produtos (dono de cada entidade compartilhada): `docs/produto/mapa-de-fronteiras.md`
- Produção: https://app.nebuloz.ai/cosmos

## Onde o código vive
- `apps/app/app/(cosmos)`
- `apps/app/components/cosmos`
- `apps/app/app/actions`
- `apps/app/lib/inngest`
- `packages/safe-engine`

## Grafo
- 8924 nós, 22675 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/cosmos/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/cosmos/graph.json
```

## ADRs que valem aqui
- nenhum roteado

## Memória de execução
- 12 completions em `memory.md`
