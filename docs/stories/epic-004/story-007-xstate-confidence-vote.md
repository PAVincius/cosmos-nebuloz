# Story: Máquina de Estado para Votação de Confiança (Confidence Vote)
**Epic:** epic-004
**Status:** pending
**WSJF Score:** 20.0

## Description
Como um RTE, quero que o evento de "Confidence Vote" siga regras restritas de estado (Não Iniciado -> Votação Aberta -> Apuração -> Retrabalho ou Aprovado), para que não haja adulterações nas notas finais do PI Planning.

## Acceptance Criteria
- [ ] Criar a máquina de estado `confidenceVoteMachine` utilizando o pacote `xstate`.
- [ ] O banco de dados só pode atualizar o status do PI/Votação caso a transição seja válida na máquina (ex: não pode pular de "Não Iniciado" direto para "Aprovado").
- [ ] A interface da UI deve desabilitar botões baseados no `.nextEvents` disponíveis da máquina atual.

## Technical Notes
- Instalar `xstate` (v5) no workspace raiz ou em um pacote de domínio (`packages/safe-engine`).
- O estado salvo no banco (`xStateStatus`) deve ser hidratado no servidor na rota tRPC `pi.sendVoteEvent`.

## Test Plan
- Teste Unitário XState: Enviar evento `VOTE` no estado `CLOSED` deve ser ignorado pela máquina.
