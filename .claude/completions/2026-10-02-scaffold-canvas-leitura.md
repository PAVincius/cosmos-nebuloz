# Scaffold — "Abrir no canvas" (D-28, PR A): trilha em diagrama, só leitura

Branch `feat/scaffold-canvas-leitura`, a partir de github/main (a62a1f6f). Sem migration, sem RBAC novo, sem LLM, sem auditoria (leitura não grava).

- Aproveitado do Bussola (`a1e577fa`, repasse em `.claude/completions/2026-10-02-scaffold-canvas-repasse-ao-andaime.md`): `lib/scaffold/canvas-layout.ts` (gate no trilho, na altura dos cabeçalhos) e `canvas-view.ts` (zoom, pan, enquadrar, trazer à vista), com 25 testes; `STATUS` movido para `lib/scaffold/deliverable-labels.ts`; foco visível no `scaffold.css`.
- Novo: `track-canvas.tsx` (diálogo, vista, foco preso, teclado), `track-canvas-world.tsx` (colunas, passos, nós, gates), `track-canvas-panel.tsx` (detalhe), `track-canvas-model.ts` (seleção e resumo do gate), botão no `track-detail.tsx`, seção no DESIGN.md.
- `getTrack` passa a devolver `code` em cada passo (leitura do código do passo no método), para o bloco do passo mostrar o nome.

Verificado: tsc limpo; `__tests__/scaffold` 61 arquivos / 1104 testes; axe real no navegador (harness Vite descartável, sem banco): 0 violações nos temas escuro e claro, com e sem seleção; contraste ficou "incompleto" no axe (fundo pontilhado + escala), conferido pelos tokens. Interação real: clique, roda, `+`, arrastar, Esc; 390px sem rolagem horizontal. Bug achado e corrigido na tela: medida do viewport e roda presas ao elemento por ref (Strict Mode/portal deixavam o tamanho em 0x0 e a roda sem efeito).

Não verificado: com dados reais (Docker parado, sem banco) e o botão no detalhe real; o teste da entrada cobre o fluxo com actions mockadas. Passo sem entregável não aparece (a leitura vem dos entregáveis).
