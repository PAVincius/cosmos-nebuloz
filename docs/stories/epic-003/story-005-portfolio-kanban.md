# Story: Portfolio Kanban Colaborativo
**Epic:** epic-003
**Status:** pending
**WSJF Score:** 22.5

## Description
Como um Release Train Engineer (RTE) ou Product Manager, quero visualizar os Épicos do Portfólio em um quadro Kanban, e quero que outros líderes possam editar as posições ao mesmo tempo que eu, para que o PI Planning seja totalmente síncrono e evite conflitos.

## Acceptance Criteria
- [ ] A tela `/dashboard/portfolio` deve renderizar um quadro Kanban (Backlog, Review, Analysis, Portfolio Backlog, Implementing, Done).
- [ ] O movimento dos cartões deve ser propagado em tempo real para os outros usuários através do pacote `@repo/collaboration` (Liveblocks).
- [ ] Cursores visíveis ("multiplayer presence") devem ser exibidos na tela.
- [ ] O design deve seguir diretrizes ricas (Micro-interações, cores modernas, vidro/glassmorphism nos cards) conforme o `DESIGN.md`.

## Technical Notes
- Utilizar os hooks nativos do `@liveblocks/react` (e.g. `useMutation`, `useStorage`) configurados no `@repo/collaboration`.
- Os dados base (Épicos) são puxados do Prisma (via Server Actions/tRPC), e injetados no initialStorage do Liveblocks Room.
- Ao sair da sala ou mover colunas, um webhook do Liveblocks ou Sync Action deve salvar a nova posição no banco de dados (`yjsDocumentState` ou apenas a coluna).

## Test Plan
- Abrir a mesma sala em dois navegadores distintos: o movimento do épico no Navegador A deve refletir em menos de 50ms no Navegador B.
