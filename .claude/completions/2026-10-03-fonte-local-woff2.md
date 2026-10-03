# Fontes: next/font/google → next/font/local

**Branch:** `fix/fonte-local-woff2` · **Data:** 2026-10-03

## Problema
Build do app e do back-office na Vercel falhava às vezes com `Module not found: @vercel/turbopack-next/internal/font/google/font` (02/10, 03/10; também em 28/09, `.maestri/aprendizado.jsonl`, "passou no redeploy"). O `next/font/google` depende de um módulo interno do Turbopack e de buscar o CSS no Google na hora do build.

## Mudança
- `packages/design-system/lib/fonts.ts`: Inter, Inter Tight, JetBrains Mono, Manrope e Space Grotesk passam a `localFont` com `.woff2` do repo. Geist continua pelo pacote `geist` (já era local).
- `packages/design-system/fonts/*.woff2` (5 arquivos, ~170 KB): variable fonts, subset `latin`, eixo de peso no intervalo que cada família já carregava (400–600, 500–900, 400–800, 500–800, 400–700). Origem e licença (OFL) em `fonts/README.md`.
- Variáveis CSS iguais: `--font-inter`, `--font-inter-tight`, `--font-jetbrains-mono`, `--font-manrope`, `--font-space-grotesk`. Nenhum CSS ou componente mudou.
- Pesos: mantive os declarados (o que já ia para produção), sem enxugar mais. Os DESIGN.md já registram as dívidas de peso (Manrope 400 cai no 500; Inter sem 700/800) e continuam valendo.

## Verificação
- `next build` do `apps/backoffice` e do `apps/app` (Turbopack, Next 16.3.7): exit 0, "Compiled successfully", TypeScript e páginas estáticas ok. Em `.next/static/media` saem os 5 `*_latin-s.p.*.woff2`; o CSS compilado tem `@font-face` com `font-weight` em faixa e as 5 variáveis `--font-*` com fallback.
- Build com variáveis dummy (`localhost`, chaves falsas) e client Prisma regenerado no worktree; nada de produção tocado.
- Não buildei `apps/web` nem `apps/api` (também importam `fonts`; mesma fonte do código). A prova final é o preview da Vercel do PR.
- Sem teste automatizado: a mudança é de configuração/ativo; o build é o teste.

## Diferença visível
Pixel idêntico esperado (mesmos arquivos que o Google serve, mesmo subset). O fallback passa a usar métricas calculadas do arquivo local sobre Arial (o `next/font/google` usava tabela própria): ajuste de CLS ligeiramente diferente no instante antes de a fonte carregar.
