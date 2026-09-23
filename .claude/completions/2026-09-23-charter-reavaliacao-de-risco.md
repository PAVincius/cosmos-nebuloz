# Charter — reavaliação de risco e fim dos números padrão

**Data:** 2026-09-23 · **Branch:** `claude/angry-heisenberg-1c52ff`, empilhada sobre
`docs/kb-consolidacao` (PR #243, onde vivem PRD, SRD, PRODUCT.md e DESIGN.md do Charter)

Origem: duas lacunas que o SRD do Charter registrou ao ser conferido contra
`ea512044`.

## O que estava errado

1. `rescoreCase` existia, auditado e com permissão `risk.score`, mas nenhuma tela
   o chamava. O intake não pede risco, então todo caso criado pela interface
   nascia com os sete eixos no default 1 e aparecia como **"1 · Baixo"** — em
   lista, detalhe, decisão, fila da Visão Geral e na célula 1×1 da matriz. A
   capacidade RISK_SCORING contava esses casos como risco pontuado no mapa de
   conformidade.
2. O score 0–100 do fornecedor é uma coluna com default 50 que nenhuma escrita
   calcula, e o detalhe o mostrava como medição.

## Decisões do dono (nesta sessão)

- Fornecedor: **"sem medição"** no lugar do 50. A regra do 0–100 não está em
  nenhum doc (o protótipo só pinta faixas ≥70/≥45); nada foi inventado.
- Caso: coluna **`riskScoredAt`** (migration só com `ADD COLUMN IF NOT EXISTS`,
  sem UPDATE). Pontuado = data preenchida ou algum eixo fora de 1, para que seed
  e dogfood (risco gravado antes da coluna, sem data) continuem pontuados.

## O que mudou

- `caseRisk()` e `SEM_PONTUACAO` em `lib/charter/rules.ts`: a regra única de
  "sem pontuação", usada por `cases.ts`, `risk.ts`, `dashboard.ts` e
  `capabilities.ts`. `riskAxisTone()` saiu do detalhe do caso para cá (dois
  leitores).
- `rescoreCase`: justificativa obrigatória, grava `riskScoredAt`; na primeira
  pontuação a trilha registra os sete eixos e "sem pontuação → n", mesmo se
  todos ficarem em 1 (sem isso o diff saía vazio).
- Tela de reavaliação `components/charter/modals/rescore.tsx` (via
  `/impeccable`, extensão do mundo existente): anatomia do intake — eixos à
  esquerda com a regra antes da escala, composto ao vivo à direita com posição
  na matriz e o "antes" na reavaliação. Caso sem pontuação abre **sem eixo
  marcado**; o botão diz o que falta no rodapé.
- Aba Risco extraída para `screens/case-risk.tsx` (o detalhe passaria de 800
  linhas): sem pontuação, explica o default e oferece "Pontuar risco"; sem o
  papel, botão desabilitado com o motivo nominal escrito.
- Matriz: caso sem pontuação fora do heatmap e da exposição, nomeado sob o mapa;
  sem nenhum pontuado, "Nenhum risco avaliado ainda".
- Fornecedor: `score` saiu de `VendorRow`; o KPI diz "sem medição".
- SRD §3, §5.5, §6.1, §6.2, §7, §9 e PRD FR-5, FR-7, FR-8, §6, §7, §9
  atualizados. Critério "Caso sem pontuação não mostra score" passou a **Atende**.

## Verificação

- Testes primeiro: 22 falhas pelo motivo certo antes do código; depois
  `npx vitest run __tests__/charter` → 493/493.
- `tsc --noEmit` em `apps/app`: 44 erros, os mesmos 44 alheios de antes
  (compliance-pdf, qr-code, theme, layout, command-palette, modal-shell).
- Biome nos arquivos tocados limpo; `pnpm size:guard` ok (case-detail 771 → 697
  linhas); detector do Impeccable `[]`; `pnpm test:knowledge` ok.
- O SQL que `prisma migrate diff` gera para a coluna é idêntico ao da migration.
- Visual: duas rodadas numa página temporária (apagada) com as peças reais,
  claro e escuro — o login da tela real exige senha, que o agente não digita.
- Revisão de código em subagente: nenhum achado com confiança ≥ 80.

## Ponytail

- Cortado: a régua "como o composto sai" no trilho repetia os limiares da
  legenda da matriz; virou um Callout de uma frase acima da escala.
- Mantido: `getCase` calcula `caseRisk` duas vezes (no próprio corpo e em
  `toRow`) — era assim com `riskScore` antes; mudar a assinatura de `toRow`
  por sete comparações de inteiro não paga.
- Mantido: `riskColumns(riskProfile(uc))` no diff de `rescoreCase` — uma linha
  no lugar de sete campos repetidos.

## Achado fora do escopo

A escala tipográfica do Charter não resolve em tela: `--fs-*` só existe em
`.cosmos-root`, e todo `FS.*` herda 16px (o DESIGN.md do Charter já registrava
a dívida como leitura de código). Virou tarefa separada.

## Ambiente local

Para a verificação: Docker Desktop e `cosmos-dev-db` ligados; a coluna nova
aplicada no `cosmos_dev` local; `seed:charter cosmos-dev` semeou o Charter de
demonstração no tenant local `cosmos-dev`. Nada tocou produção.

## Em aberto

- Regra do score do fornecedor (PRD, questão 10).
- Exigir pontuação antes de decidir o caso (PRD, questão 2).
- As sete colunas `prob*` seguem sem tela; a regra usa a média dos eixos de
  impacto como probabilidade.
