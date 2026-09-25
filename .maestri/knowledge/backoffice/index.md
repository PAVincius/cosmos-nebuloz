# backoffice — índice de conhecimento

Gerado por `pnpm knowledge:refresh`. Fonte de verdade: os arquivos abaixo. Não editar à mão.

## Contexto do produto
- VENDER E OPERAR (transversal), "Como isso entra e roda?" — Big Bang, o painel interno: proposta, provisionamento e operação de clientes, mais o sistema interno da Nebuloz
- Verdade de produto e sistema visual: `apps/backoffice/PRODUCT.md` e `apps/backoffice/DESIGN.md` — UI passa por `/impeccable` com alvo `apps/backoffice`
- `docs/produto/backoffice-prd.md`
- `docs/produto/backoffice-srd.md`
- `docs/runbooks/acesso-ao-backoffice.md`
- Fronteiras com os outros produtos (dono de cada entidade compartilhada): `docs/produto/mapa-de-fronteiras.md`
- Produção: https://backoffice.nebuloz.ai

## Onde o código vive
- `apps/backoffice`

## Grafo
- 1599 nós, 5107 arestas (recorte do mestre com 2 hops)

Consultar sem carregar o arquivo:
```bash
graphify explain "<nó>" --graph .maestri/knowledge/backoffice/graph.json
graphify path "<a>" "<b>" --graph .maestri/knowledge/backoffice/graph.json
```

## ADRs que valem aqui
- nenhum roteado

## Memória de execução
- 10 completions em `memory.md`
