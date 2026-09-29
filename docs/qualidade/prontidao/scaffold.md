# Prontidão do Scaffold para cliente externo

**QA da branch `fix/scaffold-p0-sa05-sb01`, 2026-09-29.** Base testada: `7b899e80` (HEAD da branch) no banco local `cosmos_dev` (localhost:5434). O worktree tinha edições não commitadas do Andaime em `deliverable-list.tsx`, `actions/deliverables.ts` e testes (anexar e baixar arquivo do entregável). O fluxo de navegador rodou antes de elas aparecerem na tela e **não cobre anexo nem download**. Metodologia: `docs/qualidade/gate-maturidade-carga.md`, gate de PR em `.maestri/knowledge/compartilhado/gate-de-pr.md`.

## Veredito

**Branch: APROVADA COM RESSALVAS.** Nenhum bloqueador de segurança ou de dado. As duas recusas de permissão que testei (papel, escalada, escrita de papel só-leitura) o servidor barrou e auditou. Há quatro achados de UX/consistência (§4) para o Andaime antes do dogfood.

**Prontidão para cliente externo: continua NÃO APTO.** Esta rodada fecha SA-05 (papel de adoção) e o começo de SB-01 no local; não fecha o que segue.

- C2 (dogfood sem P0/P1) e C3 (parecer de compliance) seguem em aberto. Não existe `docs/qualidade/dogfood/scaffold/`.
- O caso de negócio nasce com a trilha (BC-903 apareceu como Rascunho ao criar TR-903), mas a tela ainda não edita as métricas: trilha nova para na Fase 1 pela interface (sabido, Andaime está fazendo).
- Não conferi produção nem o merge. Tudo aqui é local, na branch.

## 1. Testes automatizados

| Verificação | Resultado |
|---|---|
| `vitest run __tests__/scaffold __tests__/e2e-setup` (apps/app) | 463 passam, 0 falham |
| `vitest run` em `packages/rbac` | 137 passam, 0 falham |
| `vitest run` em `packages/database` | 150 passam, 0 falham |
| `tsc --noEmit` em apps/app | 0 erros |
| `playwright test e2e/scaffold-track-lifecycle` (`AUTH_TEST=1`, `globalSetup` roda `seed:scaffold-e2e`) | 1ª rodada 4/5; 2ª rodada **5/5** |

A falha da 1ª rodada foi timeout de 30 s no primeiro `page.goto("/scaffold")` (compilação a frio do dev, `e2e/scaffold-track-lifecycle.spec.ts:64/68`), não defeito de produto. Achado F7.

## 2. Fluxo real local (agent-browser, quatro sessões: consultora, dono do processo, patrocinador, líder do time)

| Passo | Resultado |
|---|---|
| Atribuir papel (SA-05): Marina → Patrocinador, Tiago → Líder do time | OK; gravado em `ScaffoldMembership`, auditado `scaffold.membership.assign`, vale na requisição seguinte |
| Escalada: consultora atribui Administrador à Marina | Negado com mensagem clara; nada gravado; auditado `assign_denied` (`ROLE_ASSIGNMENT_FORBIDDEN`) |
| Escalada: consultora atribui Consultor à Marina | Negado, idem |
| Alterar o próprio papel | Negado (`SELF_ROLE_CHANGE`), auditado |
| Catálogo | 5 templates; a versão vigente de cada um tem 16 entregáveis, todos obrigatórios. TR-903 nasceu com 16 (Assess 4, Pilot 5, Scale 3, Embed 4) |
| Ciclo do entregável A2.1 | Não iniciado → Em elaboração → Em revisão → **Ajuste pedido** → Em revisão → Aprovado → **Reaberto**, todos os eventos em `ScaffoldDeliverableEvent` |
| Ajuste pedido e Reabrir sem comentário | Botão desabilitado até haver texto |
| Autoria × aprovação | Quem produz vê "Aprovar/Pedir ajuste" desabilitados com o motivo "Ninguém aprova nem pede ajuste no que é seu" |
| Quem não trabalha no entregável | "Iniciar" desabilitado com "Só o responsável, o líder de transformação ou o consultor…" |
| Patrocinador e Líder do time: escrita | Entregáveis desabilitados com motivo; "Concluir/Desmarcar passo" e "Cancelar trilha" o servidor **nega** e nada é gravado (passos seguiram DONE, trilhas ACTIVE). Mas ver F2 |
| "Papéis de adoção" para papel sem `membership.manage` | Recusa com "Requer papel Consultor ou Administrador" |
| Gate "Revisar e assinar" na TR-901 (Fase 2) | Desabilitado com o motivo: "5 entregáveis obrigatórios pendentes: B1.1, B1.2, B1.3, B2.1, B3.1" |

## 3. Acessibilidade (X-06, T133)

axe embutido do agent-browser, tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, sessão da consultora, tema escuro:

- **0 violações** em: portfólio, papéis de adoção, biblioteca de templates, casos de negócio (`/scaffold/baselines`), detalhe do caso (BC-903), trilha TR-901 (Fase 2), trilha TR-903 (Fase 1), modal "Nova trilha" e modal "Cancelar trilha" (amostra do `ModalShell`).
- **`color-contrast` ficou "incomplete" em todas** (3 a 10 nós, título, parágrafo, `.mono`, `.display`): o axe não decide o contraste sobre fundo em gradiente. Não está verificado; precisa de conferência manual dos pares de cor.
- Não cobertos: os diálogos "Pedir ajuste" e "Reabrir" (o "Enviar para revisão" mudou com o WIP do anexo e não consegui levar um entregável à revisão a tempo), tema claro, navegação por teclado e foco.

## 4. Achados

| # | Severidade | Achado | Onde | Dono |
|---|---|---|---|---|
| F1 | Média | O comentário do "Pedir ajuste" (e do "Reabrir") é gravado (`ScaffoldDeliverableEvent.comment`) mas a lista só mostra o estado "Ajuste pedido". Quem produz não vê o que precisa ajustar. A tabela `ScaffoldDeliverableComment` tem 0 linhas e não achei uso dela em `components/scaffold` nem em `app/(scaffold)` | `components/scaffold/deliverable-list.tsx` (o comentário só aparece no diálogo, `:112` a `:296`) | Andaime |
| F2 | Média | Papel só-leitura (patrocinador, líder do time) vê habilitados "Concluir/Desmarcar passo", "Cancelar trilha", "Nova trilha" e o link "Papéis de adoção". Ao clicar em "Concluir/Desmarcar passo" a tela inteira vira "Não foi possível carregar — Requer papel…" com "Tentar de novo". O servidor barra corretamente; a interface deveria desabilitar com motivo, como faz nos entregáveis | `components/scaffold/step-list.tsx:66` (`disabled={!editable}`), `screens/track-detail.tsx:354` (`editable` calculado sem permissão), `screens/portfolio.tsx:325` | Andaime |
| F3 | Média | "Dono do processo" no modal lista qualquer papel, inclusive patrocinador, líder do time (só leitura) e consultor. Uma trilha com dono sem escrita fica sem quem produza e aprove o que é do dono (consequência inferida, não testada) | `components/scaffold/new-track-modal.tsx:98-101` | Andaime |
| F4 | Baixa | Rótulos de arquétipo cobrem 3 dos 5 templates: o seletor mostra "Análise e priorização · ANALYSIS" e "Relatórios · Relatórios"; o filtro do portfólio só tem 3 chips e `ARCHETYPE_LABEL[t.archetype]` sai vazio para `ANALYSIS` e `CONVERSATIONAL`. Trilhas criadas do catálogo aparecem "sem arquétipo" (causa provável: `actions/tracks.ts:147/193/248` só grava se `input.archetype` vier e o modal não envia; não testei a correção) | `new-track-modal.tsx:21-25`, `screens/portfolio.tsx:40-44` e `:546-548`, `screens/templates.tsx:40` | Andaime |
| F5 | Baixa | O seletor de papel oferece Administrador e Consultor a quem é Consultor (será negado) e o "Salvar" segue habilitado depois da recusa | `components/scaffold/screens/members.tsx:31-39` | Andaime |
| F6 | Baixa | "Pedir ajuste" aceita comentário de 2 caracteres ("ok"). A UI só barra vazio; o schema não tem mínimo. "Cancelar trilha" exige 20 caracteres | `deliverable-list.tsx:269`, `lib/scaffold/schemas.ts:301-306`, `track-detail.tsx:530` | Andaime (decisão de produto: mínimo) |
| F7 | Baixa | O 1º teste do E2E estoura os 30 s no cold compile. Passou no 2º | `e2e/scaffold-track-lifecycle.spec.ts:64/68` | Crivo/QA |
| F8 | Informativo | Versões antigas dos templates têm 0 entregáveis (`docreview` v1–v2, `reporting` v2–v3, `triage` v3–v4); só a vigente tem 16. Confirmar que nova trilha sempre usa a última | banco local | Alicerce |

## 5. O que este QA não fez

- Não testei anexo nem download de arquivo do entregável (WIP do Andaime, não commitado).
- Não testei o gate da Fase 1 (Assess): exige caso de negócio assinado e a tela não o edita ainda.
- Não conferi produção, deploy nem merge.
- Não rodei suíte inteira nem `pnpm test` (regra de convivência da máquina): só testes escopados e um spec de Playwright por vez.

## 6. Estado deixado no banco local

TR-903 ("QA trilha relatórios") com A2.1 em Reaberto e BC-903 em Rascunho; Marina Duarte = Patrocinador e Tiago Ferraz = Líder do time em `ScaffoldMembership`; `seed:scaffold-e2e` reposicionou a TR-901 na Fase 2. Nada disso vai a produção.
