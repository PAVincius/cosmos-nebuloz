# Story: Enterprise BPMN Canvas Wrapper
**Epic:** epic-005
**Status:** pending
**WSJF Score:** 19.0

## Description
Como um Scrum Master ou RTE, quero modelar fluxos internos complexos das equipes utilizando a notação corporativa oficial BPMN 2.0, com uma interface que suporte arrastar elementos (gateways, tarefas, raias) e visualizar propriedades, para padronizar os processos com conformidade.

## Acceptance Criteria
- [ ] Criar o componente React `BpmnModelerWrapper` que instancia o `bpmn-js/lib/Modeler`.
- [ ] Carregar os arquivos CSS nativos do `bpmn-js` (diagram-js.css, bpmn-font/css/bpmn.css) de forma compatível com o Next.js.
- [ ] Exibir o painel de ferramentas (Palette) à esquerda e o painel de propriedades à direita.
- [ ] Disponibilizar botões na barra superior para "Exportar XML" e "Salvar Fluxo".

## Technical Notes
- Instalar `bpmn-js` no `apps/app`.
- Como o `bpmn-js` manipula o DOM diretamente via SVG, o componente wrapper deve usar `useRef` e rodar estritamente no client-side (`"use client"` com carregamento via `next/dynamic` se necessário para evitar SSR mismatch).

## Test Plan
- Abrir a rota `/workflows/[teamId]/bpmn`, arrastar um nó de Tarefa da paleta para o canvas, e verificar se o console não apresenta erros de SVG/DOM.
