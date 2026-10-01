---
status: draft
---

# Intent: Dispensa visível (D-28, PR 3)

**Feature Branch**: `017-scaffold-dispensa-visivel`

**Created**: 2026-09-30

**Input**: descrição original do usuário: terceiro de três PRs do Scaffold (D-28, `docs/produto/scaffold-prd.md` §10, commit `7fdcdadd`). PR 3: dispensa manual do entregável A2 por instância, pela consultora, com motivo obrigatório; e o motivo visível na fila de supervisão do back-office (FR-020, Painel). Prazo: `github/main` até 2026-11-07.

## Problema

Hoje A2 só é dispensado automaticamente (pela regra "nenhum eixo com confiança < 0,6", D-24/§7.7) ou por overlay (PR 2, independente de instância específica). Não existe caminho para a consultora dispensar manualmente um entregável de uma trilha específica, por um motivo que não se encaixa nas regras automáticas. E mesmo quando algo é dispensado — por qualquer via —, o motivo não aparece em lugar nenhum que o back-office acompanhe: a dispensa existe no banco, mas é invisível para quem supervisiona.

## Contexto

Decisão de produto do CPO (D-28), terceiro PR, depois de PR 1 (gate) e PR 2 (overlay, de onde vem a outra forma de dispensar). A exigência de origem é da própria D-24: entregável dispensado "não some" e precisa aparecer na supervisão — é o que impede o gate de virar formalidade em silêncio, mesmo quando a dispensa é legítima.

## Restrições

- Dispensa manual exige papel CONSULTANT e motivo obrigatório — sem motivo, não dispensa.
- A fila de supervisão do back-office (Painel) é leitura — não é dali que se dispensa ou reativa, só se vê o motivo.
- Regra do CEO: PR com os testes junto, sem depender de PR aberto.

## Resultado desejado

Uma consultora dispensa manualmente um entregável de uma trilha específica, com motivo. O motivo aparece na fila de supervisão do back-office, junto com a trilha e o entregável — quem supervisiona vê não só que algo foi dispensado, mas por quê.

## Fora de escopo

- Qualquer mudança no gate em si (PR 1) ou no mecanismo de overlay (PR 2).
- Reativar um entregável dispensado a partir do back-office — a fila é só leitura.
