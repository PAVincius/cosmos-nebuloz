# Epic 003 — Walkthrough Log

**Date:** 2026-05-12  
**Stories:** 005 (Portfolio Kanban) + 006 (WSJF Engine)  
**Status:** ✅ Done

---

## Story 005 — Portfolio Kanban Colaborativo

### Acceptance Criteria

- [x] `/dashboard/portfolio` renderiza Kanban com 6 colunas SAFe (Funnel → Done)
- [x] Movimento de cards propagado em tempo real via Liveblocks (`useMutation` + `useStorage`)
- [x] Cursores multiplayer visíveis (`useOthers` + `useMyPresence`)
- [x] Design per DESIGN.md (glassmorphism shimmer, border-t accent por coluna, WSJF badge colorido)

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `app/actions/epics/get-portfolio.ts` | Server Action — busca Epics do tenant com feature count |
| `app/actions/epics/update-status.ts` | Server Action — persiste statusId + order no DB |
| `dashboard/portfolio/page.tsx` | RSC — fetch epics, monta Room Liveblocks |
| `dashboard/portfolio/components/kanban-board.tsx` | Client — DndContext + Liveblocks storage + cursors |
| `dashboard/portfolio/components/kanban-column.tsx` | Client — useDroppable, drop target, count badge |
| `dashboard/portfolio/components/kanban-card.tsx` | Client — useDraggable, glassmorphism, WSJF badge |

### Liveblocks Storage (config.ts)

```typescript
Storage: {
  kanbanEpics?: LiveList<LiveObject<{
    id: string; title: string; statusId: string; order: number; wsjfScore: number;
  }>>;
};
```

`kanbanEpics` opcional → `Room` não precisa de `initialStorage` obrigatório.  
Board semeia via `useMutation` no `useEffect` se empty.

### Drag-Drop

- `@dnd-kit/core` (já em apps/app)
- `useDraggable` em cada card, `useDroppable` em cada coluna
- `DragOverlay` mostra ghost card rotacionado durante drag
- `closestCorners` collision detection

### Fixes colaterais

- `packages/collaboration/room.tsx` → `initialStorage` passado como `{} as Storage`
- `app/(authenticated)/portfolio/portfolio-board.tsx` (Antigravity scaffold) → import corrigido para `@repo/collaboration/hooks`, types corrigidos

---

## Story 006 — Motor de Cálculo WSJF

### Acceptance Criteria

- [x] Pacote isolado `@repo/safe-engine` com TypeScript puro (Antigravity já criou)
- [x] Fórmula `WSJF = (BV + TC + RR) / JS` implementada e testada
- [x] Server Action que recebe notas, invoca `calculateWSJF`, salva no DB
- [x] Divisão por zero protegida (retorna 0 se JS ≤ 0)

### Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `app/actions/features/update-wsjf.ts` | Server Action — `calculateWSJF` + `database.feature.updateMany` |

### `safe-engine` (criado pela Antigravity)

```
packages/safe-engine/src/
  wsjf.ts                  → calculateWSJF({ bv, tc, rr, js }): number
  confidenceVoteMachine.ts → XState confidence vote state machine
  index.ts                 → exports both
  __tests__/
    wsjf.test.ts           → 4 Vitest specs (correct calc, rounding, zero, negative)
    confidenceVoteMachine.test.ts
```

### WSJF Server Action

```typescript
const wsjfScore = calculateWSJF({ bv, tc, rr, js });
await database.feature.updateMany({
  where: { id: featureId, tenantId: ctx.tenantId },
  data: { bv, tc, rr, js, wsjfScore },
});
```

---

## Typecheck Final

```
pnpm --filter app typecheck → EXIT 0
pnpm --filter @repo/auth typecheck → EXIT 0
pnpm --filter @repo/database typecheck → EXIT 0
```
