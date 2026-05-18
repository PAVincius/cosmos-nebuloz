# Story: Motor de Cálculo WSJF (SAFe Engine)
**Epic:** epic-003
**Status:** pending
**WSJF Score:** 18.0

## Description
Como um Analista de Negócios (PO/PM), quero que o sistema calcule automaticamente o WSJF (Weighted Shortest Job First) de todas as Features sempre que houver alteração em qualquer parâmetro (Business Value, Time Criticality, Risk Reduction, Job Size), para priorizar meu backlog de forma ágil e científica.

## Acceptance Criteria
- [ ] Criar o pacote isolado `@repo/safe-engine` utilizando TypeScript puro.
- [ ] Implementar a fórmula `WSJF = (BV + TC + RR) / JS`.
- [ ] Criar um tRPC router ou Server Action que recebe as notas da Feature, invoca o `safe-engine` e salva o novo valor no banco.
- [ ] A interface deve atualizar a ordem do backlog em tempo real caso uma nota seja alterada num input da tabela.

## Technical Notes
- Criar a pasta `packages/safe-engine`.
- Manter o pacote independente de Next.js, puro TypeScript e testável via Vitest.
- Prevenir divisão por zero caso JS (Job Size) não seja informado (assumir `1`).

## Test Plan
- Teste Unitário: Verificar o cálculo de `BV=8`, `TC=5`, `RR=2` e `JS=3`, o WSJF resultante deve ser `5.0`.
