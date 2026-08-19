// As colunas do board do time são dado, não ação — e por isso não podem morar
// em `board.ts`, que é `"use server"`. Um arquivo com essa diretiva só pode
// exportar função async: qualquer outro export vira, em runtime,
//
//   Error: A "use server" file can only export async functions, found object.
//
// e o erro não é local. Ele derruba o POST de toda tela cujo chunk carregue o
// módulo, com o GET respondendo 200 — foi assim que este array derrubou
// `/cosmos/kanban` em produção.
//
// Aqui também é o lugar certo por outro motivo: `board.tsx` é client component
// e precisa das colunas para renderizar o cabeçalho. Importá-las de um módulo
// `"use server"` arrastaria `@repo/auth/server` e `@repo/database` para o
// bundle de cliente.

/** Mesma ordem de StoryStatus em app/actions/_base.ts. */
export const COLUNAS = [
  { status: "BACKLOG", label: "Backlog" },
  { status: "TODO", label: "A fazer" },
  { status: "IN_PROGRESS", label: "Em andamento" },
  { status: "REVIEW", label: "Revisão" },
  { status: "DONE", label: "Concluído" },
] as const;
