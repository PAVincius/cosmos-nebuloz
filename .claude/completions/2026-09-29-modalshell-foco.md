# ModalShell — foco inicial e devolução do foco

`apps/app/components/charter/modal.tsx` é o `ModalShell` compartilhado por Charter, Meridian, Scaffold e Signal (Meridian/Scaffold/Signal reexportam em `base.tsx`).

- **Causa:** o foco inicial fazia `querySelector('… button …')` sem excluir desabilitados nem cobrir links, e sem fallback. Primeiro controle desabilitado, ou corpo só de leitura → `focus()` sem efeito, foco no body.
- **Correção:** seletor só de controles habilitados (inclui `a[href]`); sem nenhum, o foco vai ao próprio diálogo (`tabIndex={-1}`). A devolução ao gatilho já existia no `ModalProvider` (coberta por teste agora).
- **Sem `outline:none` inline** no diálogo (`control-states.test.ts` proíbe apagar o anel de foco).
- **Testes:** `__tests__/charter/modal-shell-focus.test.tsx` (7; 4 vermelhos antes). Suítes charter, meridian, scaffold, signal, produtos e components: 2476/2476 (`--maxWorkers=2 --testTimeout=30000`; com a carga padrão 27 testes estouram os 5 s, sem relação com a mudança).
- **Fora do escopo:** existe outro `ModalShell`, em `app/(authenticated)/components/modal-shell.tsx` (só `settings/workspace`), sem gestão de foco nem trap. Não mexi.
