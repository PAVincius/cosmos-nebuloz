# 2026-09-26 — Gerador de BPMN e os seis primeiros processos da Nebuloz

Branch `feat/bpmn-processos-nebuloz`. Entrega 1 de 2: sem LLM (o botão de
gerar no editor é a entrega 2 e reusa o mesmo esquema e validador).

## O que entrou

1. **`@repo/bpmn`** (pacote novo, `packages/bpmn`). Pacote, e não pasta do
   back-office, porque o seed roda em `apps/app/scripts` (fora do Next), as
   actions de diagrama rodam no back-office e a entrega 2 reusa tudo.
   - `esquema.ts`: esquema fechado (Zod `strictObject`) — pool, raias, nós
     `inicio | fim | tarefaUsuario | tarefaServico | tarefaManual |
     gatewayExclusivo`, fluxos com `condicao`, `fonte[]`, `lacunas[]`,
     `origem` por nó — mais integridade referencial.
   - `estrutura.ts`: checagens próprias sobre grafo neutro — todo nó
     alcançável do início, todo caminho chega a um fim, gateway que decide
     com ≥2 saídas rotuladas (ou junção com ≥2 entradas), início sem entrada,
     fim sem saída; evento de borda conta pela hospedeira.
   - `compilar.ts` + `layout.ts`: `bpmn-auto-layout` (dependência nova)
     decide coluna e linha; o layout próprio põe cada nó na faixa da sua raia
     (o auto-layout não desenha pool nem raia), roteia ortogonal, desvia de
     nó pelo corredor da sub-linha. Serializa com `bpmn-moddle`. O XML gerado
     passa de novo pelo validador e pelo bpmnlint `recommended` sem nenhum
     relato — se não passar, o compilador falha.
   - `lint.ts`: bpmnlint `recommended` com resolver estático (o resolver de
     Node faz `require` dinâmico que bundler nenhum acompanha).
   - `validar.ts`: XML → moddle → checagens estruturais, usado pelas actions.
   - `testes/bpmn-js-no-jsdom.ts`: stubs de SVG e de medida de texto para o
     bpmn-js abrir no jsdom. Sem a medida de texto o laço de quebra de rótulo
     do diagram-js nunca termina — o teste trava em vez de falhar.
2. **Seis definições** em `packages/provisioning/src/processos-bpmn/`
   (PZ-01, PZ-02, PZ-08, PZ-10, PZ-22, PZ-23), com `fonte`, `origem` e
   `lacunas`; golden `.bpmn` em `processos-bpmn/golden/`
   (`ATUALIZAR_GOLDEN=1 npx vitest run src/__tests__/processos-bpmn.test.ts`
   em `packages/provisioning` para regerar). PZ-22 (Acesso ao back-office,
   Plataforma) e PZ-23 (Resposta a incidente, Governança) entraram em
   `PROCESSOS_NEBULOZ`, com a ligação PZ-23 → PZ-22 "conta comprometida →
   revoga".
3. **Seed** `pnpm seed:diagramas:nebuloz` (`apps/app/scripts/
   seed-diagramas-nebuloz.ts` sobre `sincronizarDiagramasNebuloz` em
   `packages/provisioning/src/diagramas-nebuloz.ts`): cria `StaffDiagram`
   BPMN no tenant `system` com v1 e nota "gerado de <fonte>", versão nova só
   quando o XML muda e a última versão foi do seed, não sobrescreve edição
   feita no editor, liga `diagramId` só quando o processo não tem diagrama.
   Recusa `DATABASE_URL` não local sem `SEED_DIAGRAMAS_PERMITIR_REMOTO=1`.
4. **Validação no servidor**: `createDiagramAction`/`updateDiagramAction`
   recusam BPMN que não importa no moddle ou falha nas checagens estruturais;
   salvar sem mudança continua sendo um nada; `BPMN_EM_BRANCO` do estúdio
   passou a nascer com início → fim ligados.

## Verificado

- `packages/bpmn`: 36 testes; `packages/provisioning`: 129; `apps/backoffice`:
  1 753 (suíte inteira). `tsc` limpo em `packages/bpmn` e
  `packages/provisioning`; em `apps/app` e `apps/backoffice`, nenhum erro nos
  arquivos tocados.
- Os seis golden abrem no bpmn-js: no jsdom (teste) e no Chromium real
  (Playwright + `bpmn-viewer`), zero avisos no `importXML`; conferidos a olho.
- Banco local `cosmos-dev-db` (5434): criada a linha `system` da migration
  `20260728020000_system_tenant` (faltava), `seed:empresa:nebuloz` (23
  processos, 24 ligações), `seed:diagramas:nebuloz` (6 criados e vinculados);
  segunda execução: 6 × "igual / já vinculado".
- Mapa renderizado localmente por rota temporária (apagada) lendo o banco
  local: filtro "Modelado" mostra os seis; painel do PZ-08 diz "BPMN v1".

## Não feito / pendente do dono

- Produção: nada foi escrito. Para levar ao ar: `seed:empresa:nebuloz` (ou SQL
  equivalente para PZ-22/PZ-23 e a 24ª ligação — o
  `2026-09-seed-processos.sql` segue com 21/23) e `seed:diagramas:nebuloz`
  com `SEED_DIAGRAMAS_PERMITIR_REMOTO=1`, cada um com "vai".
- Lacunas por processo: no campo `lacunas` de cada definição e no corpo do PR.
