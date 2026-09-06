# Growth · motor de AI readiness

**Data**: 2026-09-06
**Escopo pedido**: seção de growth no back-office, a partir do documento de
composição de stack (`~/Downloads/md.md`).

## Decisão de entrada: nenhum repositório foi clonado

O pedido original era clonar e juntar os repositórios públicos do documento.
Isso não foi feito, por dois motivos independentes — cada um sozinho já
bloqueia:

**Licença.** Twenty, PostHog, Chatwoot, Formbricks, GrowthBook, Langfuse,
Operately e Mautic são AGPL-3.0/GPL-3.0 (a API do GitHub reporta `NOASSERTION`
por serem dual-license com edição enterprise); listmonk é AGPL-3.0; n8n é
Sustainable Use License, que proíbe revenda/white-label. AGPL é copyleft **de
rede**: servir o back-office com esse código dentro obriga a abrir o
back-office inteiro sob AGPL.

**Físico.** PostHog são 6,6 GB de Python + ClickHouse; Chatwoot é Ruby; Mautic
é PHP/Symfony; Operately é Elixir; listmonk é Go; Twenty são 1,7 GB. Nenhum
entra num Turborepo Next.js — são aplicações inteiras, que integram por
API/webhook, não por merge de código.

**E metade do escopo já existe.** `BO_NAV` já tinha Funil, Propostas, Serviços,
Contas, Benchmark, CAC e Financeiro sobre o schema multi-tenant. O papel que o
documento dava ao Twenty já está feito, nativo.

Decisão do dono do produto, registrada na sessão: **nativo, sem porte nenhum** —
nem do único repositório MIT viável (`kodustech/agent-readiness`). A rubrica é
escrita do zero e é IP da Nebuloz.

## O que foi entregue

| Arquivo | Papel |
|---|---|
| `apps/backoffice/lib/growth/maturidade.ts` | Rubrica (6 dimensões × 5 níveis × 18 critérios) e as contas. Puro: sem Prisma, sem React, sem I/O. |
| `apps/backoffice/app/actions/maturidade.ts` | Persistência e auditoria. Quatro actions. |
| `apps/backoffice/app/(staff)/growth/readiness/` | Lista + criação, e a folha de respostas em `[id]`. |
| `packages/database/prisma/schema/platform-ops.prisma` | `AvaliacaoDeMaturidade`, `RespostaDeMaturidade`. |
| `packages/database/prisma/migrations/20260909000000_growth_readiness/` | Criação + RLS no mesmo ato. |
| `apps/backoffice/__tests__/maturidade.test.ts` | 14 testes do motor. |

### Decisões que carregam o módulo

- **Rubrica em código, não em tabela.** É IP da Nebuloz e vale igual para todos
  os clientes — é isso que a torna comparável e, portanto, benchmark. Peso
  configurável por tenant destruiria a comparação. `rubricaVersao` carimbada na
  avaliação permite reler uma avaliação antiga com a rubrica que a pontuou.
- **Score congelado no fecho**, não recalculado na leitura: o número que foi ao
  cliente em março não pode mudar em junho porque um peso mudou.
- **Faltando um critério, o score é nulo** — não parcial. Mesma regra do CAC:
  "sem número, sem chute".
- **Nível fora da escala não pontua** — nem como 0 nem como 4; as duas leituras
  mentem em direções opostas.
- **Cortes de faixa em 12,5/37,5/62,5/87,5**, e não 20/40/60/80, para que "tudo
  em nível N" caia na faixa N (tudo em nível 1 dá 25; com corte em 20 isso
  viraria "Definido").
- **Elo fraco → degrau da Escada.** A dimensão de menor score escolhe o próximo
  produto. Empate resolve pela ordem de `DIMENSOES`, determinístico de propósito.
- **Growth vem antes de Comercial no menu**: o diagnóstico decide por qual porta
  o lead entra no funil, não o contrário. Também preserva a adjacência
  Comercial→Empresa que `empresa-nav.test.ts` protege.

## Verificação

- `npx vitest run` no back-office: **536 passam, 0 falham** (14 novos).
- `npx tsc --noEmit`: **zero erros nos arquivos novos**. Os 6 restantes são
  pré-existentes (`app/layout.tsx`, `cosmos/qr-code.tsx`, providers do
  design-system).
- `npx ultracite fix` nos arquivos novos: limpo.
- Migration aplicada em `localhost:5434/cosmos_dev`: as duas tabelas existem,
  `rowsecurity = true` nas duas, policy `tenant_isolation` nas duas.
- Ida-e-volta no banco local: cria avaliação → grava resposta → o
  `@@unique(avaliacaoId, criterioId)` recusa duplicata com `P2002` → o delete
  em cascata apaga as respostas.

**Não verificado no navegador**: `apps/backoffice/.env.local` só tem
`VERCEL_OIDC_TOKEN`, e o dev server morre em "Invalid environment variables"
antes de renderizar. Lacuna pré-existente do ambiente local.

## Pendente

- **Migration em produção** — não aplicada. Escrita em prod exige "vai" por
  operação.
- Ligar a avaliação ao lead pela UI: a coluna `leadId` e a validação existem na
  action, o seletor na tela não.
- Reabrir avaliação concluída não existe. Concluir é irreversível hoje; se isso
  virar problema na prática, é uma action a mais com registro de motivo.
- Relatório/export do diagnóstico para o cliente.
- As outras superfícies de growth (aquisição, integrações com PostHog/listmonk/
  n8n self-hosted) — nenhuma tem entidade no schema ainda, e por isso nenhuma
  aparece no menu.
