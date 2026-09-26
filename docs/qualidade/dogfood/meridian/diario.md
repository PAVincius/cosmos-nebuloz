# Diário · Dogfood Meridian

Cada linha é uma operação em produção (`app.nebuloz.ai`), com o "vai" do CEO.

| Quando | Passo | "Vai" | Quem operou | Resultado | Evidência |
|---|---|---|---|---|---|
| 2026-09-25 14:00 | M1 — criar assessment pela carteira | CEO, 14:00 | CEO (consultor) | OK — criou **AS-112** (o código é gerado pelo sistema; não é `AS-NBZ-002`) | print da carteira + detalhe: pendente |
| 2026-09-25 16:47 | M2 — 10 atribuições (5 eixos × fundador + auditoria) no AS-112 | CEO | CEO (consultor) | FALHOU — 10 atribuições feitas, nenhum link copiado; sem botão de revogar, a coleta travou (P1 no `atrito.md`, corrigido no #253) | — |
| 2026-09-26 14:43 | M2-bis — revogar os 10 respondentes do AS-112 e atribuir de novo, copiando cada link | CEO, 14:43 | CEO (consultor) | FALHOU — 10 revogações e 10 atribuições feitas, links copiados mas não colados em lugar nenhum; perdidos de novo | — |
| 2026-09-26 14:56 | M2-ter — revogar e atribuir de novo, colando cada link em `~/Documents/links-as112.txt` (aberto no TextEdit antes) | CEO | CEO (consultor) | FALHOU — o arquivo e a janela do TextEdit ficaram sem nenhum link (verificado por contagem, sem ler os valores); terceira perda seguida. M2 suspenso até o "Reemitir link" (P0, `meridian-prd.md` §10) | — |

Pré-condição do M1/M2: deploy `dpl_Hs1rcL1Ys7e4nLtVEhtZNbL46WPp` READY, commit `86f8153f` (merge do #248).
Pré-condição do M2-bis: deploy `dpl_4QSbrS8MQjs3zF85o1LWVv3KXMJk` READY, commit `d846faed` (merge do #253).
