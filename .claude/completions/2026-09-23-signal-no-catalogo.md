# Signal entra pelo catálogo; um descritor só

**Data:** 2026-09-23 · **Branch:** `fix/signal-no-catalogo`

O Signal está em produção (`app.nebuloz.ai/signal`), mas `/produto` ainda o
mostrava como "Em breve aqui": o catálogo tinha `href: null` e o resumo
"Métrica de carteira que exige pipeline de dados.".

## O que mudou

- `apps/app/app/actions/produtos/index.ts` — Signal com `href: "/signal"`.
  Sem produto de href nulo, o estado `SEM_ROTA` ficou órfão e saiu: membro da
  união, ramo em `listarProdutos` e o selo "Em breve aqui" em
  `app/(authenticated)/produto/page.tsx`. `CATALOGO.href` passa a `string`.
- Descritor aprovado pelo dono nesta data: **"Valor realizado de IA"** — a
  cabeça da coluna "O que faz" do mapa de fronteiras. Aplicado em quatro
  lugares que divergiam:
  - switchers do Signal, Charter e Meridian (`components/*/shell.tsx`, `blurb`);
  - `/produto`: "Valor realizado de IA — adoção, ROI com confiança, veredito.";
  - topo de `/signal-indisponivel`: "Signal · Valor realizado de IA" (quarta
    variante, não citada no `PRODUCT.md`).
- `__tests__/actions/produtos.test.ts` — o caso "SIGNAL não vira link" virou
  "SIGNAL contratado vira link para /signal". Nenhum outro teste lê esses
  textos.
- Documentos que a #243 trouxe e esta mudança desmentia: `PRODUCT.md` do
  Signal (Entradas; Brand Commitments, onde "Unificar é pendência" vira o
  descritor aprovado), `docs/produto/signal-prd.md` §8 (linha do Cosmos) e
  `apps/app/DESIGN.md` (Chips → State, que citava o "Em breve aqui").

## SV-12 "Minecraft Server Hosting" (back-office, produção)

O back-office não apaga serviço, de propósito (`apps/backoffice/app/actions/services.ts:179`):
proposta antiga aponta para ele e a FK de `ProposalItem` é RESTRICT.
"Arquivar" é "Tirar do catálogo" — `setServiceAtivoAction`, `ativo=false`,
com linha na auditoria. O SV-12 já está inativo, logo já arquivado; continua
esmaecido em `/servicos` porque a tela de gestão mostra tudo. O dono decidiu
deixar como está. Nenhuma escrita em produção.

## Verificação

- `npx vitest run __tests__/actions/produtos.test.ts` — 8/8.
- `tsc --noEmit` em `apps/app` — nenhum erro nos arquivos tocados. Restam 44
  erros em 7 arquivos alheios (design-system, `lib/charter/compliance-pdf.tsx`,
  `app/layout.tsx`, `components/cosmos/command-palette.tsx`).
- Biome nos 7 arquivos — limpo.
- Tela não vista rodando: `/produto` e os switchers exigem sessão de tenant.
  Conferir em `app.nebuloz.ai/produto` depois do deploy.

## Pendências

- O comentário sobre `ORDEM` em `produtos/index.ts` descreve a ordem do funil
  (Meridian → Scaffold → Charter → Cosmos → Signal), mas o array segue outra.
  Divergência anterior a esta mudança; não mexi.
