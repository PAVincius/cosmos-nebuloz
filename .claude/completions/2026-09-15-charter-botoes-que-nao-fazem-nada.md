# Charter — botões que não fazem nada (crítica de design, onda 3a)

**Data:** 2026-09-15 · **Branch:** `fix/charter-botoes-que-nao-fazem-nada` · **PR:** #207

Origem: crítica de design dual-agent do módulo Charter (snapshot em
`.impeccable/critique/2026-09-15T22-39-35Z__apps-app-components-charter.md`).
P2: controles "construídos e inertes" — botão sem handler, botão "Exportar"
que só navega, literal fingindo ser dado, estado vazio inexistente.

## O que entrou

| Tela | Controle | Era | Virou |
|---|---|---|---|
| `risk` | Exportar matriz | sem `onClick`, sem action de export | removido |
| `risk` | eyebrow "7 categorias de risco" | literal | `Object.keys(RISK_CATEGORY_LABEL).length` |
| `risk` | badge "0 mitigação atrasada" | sem concordância | singular/plural |
| `risk` | heatmap / rastreador vazios | grade de "·" + `TableHead` solto | `SmartEmptyState` com link para `/charter/cases` |
| `cases` | Exportar fila | só `router.push("/charter/audit")` | removido (auditoria já está na nav lateral) |
| `vendors` | Biblioteca de cláusulas | modal real | **intacto** — a crítica errou, não era export morto |
| `audit` | KPI "Exportações registradas" | `tone="green"` | `tone="accent"` (exportar não é sucesso) |

Não foi inventada exportação nova para a matriz de risco: nenhuma action
existente serve a ela.

## Verificação

vitest 4056/0 · tsc limpo · `size:guard` verde sem `--update`
(`compliance.tsx` não tocado) · build "Compiled successfully" (falha posterior
em `/api/analytics/executive` é pré-existente, fora do diff). Provas de
mutação literais no corpo do PR.
