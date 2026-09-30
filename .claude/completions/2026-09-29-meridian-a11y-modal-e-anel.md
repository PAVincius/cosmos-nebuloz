# Meridian — contraste do Badge 'Promovido' e anel de progresso em Coleta

Achados do Crivo fora do A3.

- **(a) Badge 'Promovido' (contraste 1,1:1, axe serious).** Causa: o modal é portado para `<body>` (`components/charter/modal.tsx`), fora de `.meridian-root`, onde vivem `--accent`, os anéis de foco e as classes `.btn`. O Badge de tom accent usa `fg: var(--accent)`, indefinido no portal, e caía na cor herdada (#1c1d21) sobre o fundo escuro. Correção: `ModalProvider` ganha `scopeClassName` opcional; o do Meridian (`meridian/base.tsx`) passa `meridian-root`, com `background: transparent` inline no wrapper fixo para a classe não pintar o canvas por cima da tela. Charter e os demais produtos não mudam (sem a prop, nada muda). Efeito extra: os modais do Meridian passam a ter o anel de foco do módulo (`.meridian-root :focus-visible`).
- **(b) Anel de progresso espremido em Coleta (1280px).** `ScoreRing` (svg) ganha `flex-shrink: 0`; o bloco de texto ao lado, com a lista de evidências, ganha `min-width: 0` para quebrar linha em vez de espremer o anel.
- **Teste:** `__tests__/meridian/modal-escopo-e-anel.test.tsx` (3; 2 vermelhos antes). Charter e Meridian: modal-shell-focus, focus-trap, tab-coleta, gaps-tab verdes; tsc e biome limpos. Contraste medido de verdade (axe) fica com o Crivo: jsdom não resolve custom properties.
- **Fora do escopo, mesma causa provável:** os modais do Charter/Scaffold/Signal também são portados para `<body>` e podem ter tokens do módulo indefinidos; cada um pediria o mesmo `scopeClassName`.
