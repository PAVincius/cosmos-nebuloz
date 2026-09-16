# Signal — polish (impeccable)

10 telas inspecionadas em 1440 e 390, dark e light, com sessão real e banco semeado.

## Corrigido
- Casca sem colapso responsivo: sidebar vira gaveta abaixo de 960px (Esc, backdrop, fecha ao navegar); topbar perde o que não cabe.
- `<div>` dentro de `<p>` no detalhe → erro de hidratação. Trocado por `Note`.
- Bolhas da matriz cortadas nas bordas: camada recuada em `MAX_R`.
- Datas de período/janela um dia atrás em BRT: `lib/signal/dates.ts` formata dia de calendário em UTC.
- `fmtBRL` negativo: `−R$ 24 mil` em vez de `R$ -24 mil`.
- Formulário de réguas mostrava `NaN` ao apagar campo (estado em string).
- `acknowledge` de alerta engolia erro; `FactorsForm` sem feedback de sucesso.
- Relatórios sem forma de criar rascunho → `DraftReportForm`.
- Sem lastro não há veredito: badge neutro "Sem veredito" + próximo passo.
- Filtros da auditoria cobrem todos os tipos de registro.
- Paleta ⌘K: `role="dialog"`, `aria-modal`, foco preso.
- `<main tabIndex={0}` (axe scrollable-region-focusable).
- Razão de bloqueio persistida com a lista de fontes.
- Seed sem observações: evidências vazias e congelamento nunca travava. 8 observações, 2 congeladas por Zendesk.
- `seed:signal` roda no globalSetup do Playwright; rascunho volta a DRAFT a cada rodada.

## Consolidado
- `components/signal/list-card.tsx`: `ListCard`, `ListCardHead`, `MetaRow`, `Note`, `CodeBlock`, `InlineError`. Cinco telas usam; pills viraram `Badge` do kit.

## Verificação
- vitest `__tests__/signal`: 417/417
- playwright signal (isolation + journey + a11y): 18/18 em :3021
- ultracite + tsc limpos nos arquivos do Signal

## Fora de escopo, notado
- Charter/Meridian têm a mesma casca sem colapso responsivo.
- CSP bloqueia posthog/vercel-scripts em dev (3 erros de console em toda página, plataforma).
- Banco local foi recriado via `db push` (sem `_prisma_migrations`): triggers/RLS de migration SQL podem faltar.
