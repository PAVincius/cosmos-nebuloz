---
status: approved
---

# Intent: Operar a trilha pela tela (D-28, PR 1)

**Feature Branch**: `015-scaffold-operar-trilha`

**Created**: 2026-09-30

**Input**: descrição original do usuário: pedido do CEO via Morgana e Norte — primeiro de três PRs do Scaffold, ordem fixada por D-28 (`docs/produto/scaffold-prd.md` §10, commit `7fdcdadd`, branch `docs/scaffold-operavel-prioridade`, a partir da main pós-#331). PR 1: (0) achados do Vigia sobre o #331 — `validateOverlay` ausente em `resolveConflict` e em `seedTrack`; `assignDeliverable` não recusa entregável dispensado; origem da trilha aceita assessment em qualquer estado; `sourceAssessmentId` pode divergir do assessment do gap. (1) decisão do gate na tela via `closePhase`: critérios, evidência, motivo de bloqueio, override restrito a quem tem o papel. (3) modal "Nova trilha": ordem do DOM, Tab preso, Esc fecha. Prazo: `github/main` até 2026-10-07.

## Problema

O #331 entregou o molde "Fundação de Prontidão de IA" com as regras certas no servidor, mas o Vigia achou quatro furos que deixam essas regras contornáveis, e a tela de gate — embora exista (`gate-panel.tsx`) — não cobre evidência nem esconde o botão de override por permissão. Sem o gate funcionando de ponta a ponta pela interface, nenhuma trilha real sai da ASSESS: é o item que "trava tudo", segundo a própria ordem do CEO.

## Contexto

Decisão de produto do CPO (D-28), delegação do CEO. Ordem de três PRs definida pelo critério único "o que impede uma consultora de levar uma trilha real da ASSESS ao EMBED em produção vem primeiro" — este é o primeiro. Investigação de código já confirma cada achado do Vigia:

- **`resolveConflict`** (`apps/app/app/(scaffold)/actions/templates.ts:470-510`): a resolução `keep_overlay` marca o conflito resolvido sem chamar `validateOverlay` — só `saveOverlay` chama (linha 370). Quem tem `template.publish` e não é consultor pode manter um REMOVE de entregável que virou obrigatório numa versão nova.
- **`seedTrack`** (`apps/app/app/(scaffold)/actions/_seed-track.ts`): aplica o overlay (`applyOverlay`) ao criar a trilha, mas nunca chama `validateOverlay` antes — uma trilha pode nascer já com overlay inválido.
- **`assignDeliverable`** (`apps/app/app/(scaffold)/actions/deliverables.ts:366-385`): atribui responsável e aprovador sem checar se o entregável está dispensado.
- **`assertSourceAssessment`** (`_seed-track.ts`): confere só existência e tenant do assessment, sem checar `status` — aceitaria um assessment ainda em `DRAFT`.
- **`createTrackFromGap`** (`tracks.ts:120-186`): recebe `sourceAssessmentId` do input sem checar que é o mesmo assessment do gap de origem.
- **Gate na tela** (`gate-panel.tsx`, já existe e já cobre critério, motivo de bloqueio e override pós-BLOCKED) — falta campo de evidência por critério, e o botão de override não é escondido por permissão no cliente (mesmo padrão já visto em outros módulos nesta sessão).
- **Modal "Nova trilha"** (`new-track-modal.tsx` + `ModalShell` em `apps/app/components/charter/modal.tsx:423,433`): `{actions}` (Cancelar/Criar) renderiza no JSX **antes** de `{children}` (os campos) — é um achado no componente compartilhado, não só no Scaffold.

## Restrições

- **Regra do CEO**: este PR não depende de nenhum outro PR aberto; testes entram junto.
- Ordem interna do PR 1: os achados do item (0) entram **antes** dos itens de tela, porque a tela de gate passa a exercitar esses caminhos.
- `resolveConflict` com `keep_overlay` que mantém REMOVE de obrigatório exige papel CONSULTANT e motivo — mesma regra da D-24 §7.7, não uma regra nova.
- Origem da trilha aceita assessment com `status` REVIEW **ou** FINALISED — nunca só FINALISED (nenhum caminho do produto grava FINALISED hoje; exigir isso travaria toda trilha real).
- O achado do `ModalShell` é no componente **compartilhado** entre Scaffold, Charter e Meridian — a correção de ordem do DOM beneficia os três, mas o critério de pronto desta spec é só sobre a tela "Nova trilha" do Scaffold.

## Resultado desejado

Um E2E leva a trilha do Atlas da ASSESS ao EMBED só pela interface: fecha gate quando os critérios estão atendidos, vê o motivo quando algo bloqueia, e um override fica registrado quando usado por quem tem o papel. No modal "Nova trilha", Tab não escapa do modal e Esc fecha, navegando só pelo teclado. Nenhum dos quatro furos do Vigia continua aberto: `resolveConflict` e `seedTrack` validam overlay como `saveOverlay` já valida; entregável dispensado não recebe responsável; a origem da trilha exige assessment com coleta fechada; e `sourceAssessmentId` nunca diverge do assessment do gap.

## Fora de escopo

- Tela de criar/editar overlay (passo, entregável, critério) — PR 2.
- Overlay de critério com efeito real no gate — PR 2 (a recusa provisória continua valendo neste PR).
- Dispensa manual de entregável por instância e fila de supervisão no back-office — PR 3.
