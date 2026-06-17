# COSMOS — Laboratório de Usabilidade (Validado contra código)
**Data:** 2026-05-31
**Autor:** Claude (UX Lab Simulator)
**Versão:** 1.1 — re-julgado e validado
**Método:** Walk-through cognitivo com personas SAFe + validação de cada atrito contra o código-fonte real.

> **Nota de revisão (v1.1):** A v1.0 foi gerada a partir de leitura parcial do código e continha 4 afirmações falsas. Esta versão valida cada ponto lendo os arquivos reais. Cada achado agora tem um **veredito**: ✅ Confirmado · ✏️ Refinado · ❌ Retratado.

---

## 1. Metodologia

Cada persona executa a tarefa-âncora do seu papel. Registro de atrito cognitivo / físico / emocional. **Toda afirmação foi conferida no arquivo-fonte** antes de virar recomendação.

**Severidade:** 🔴 Crítico · 🟠 Alto · 🟡 Médio · 🟢 Baixo

---

## 2. Personas (resumo)

| Persona | Papel | Tarefa-âncora |
|---------|-------|---------------|
| **Lucas** RTE | Saúde do ART pré-Sync | Impedimentos cross-team, PI health, síntese |
| **Beatriz** LPM | Priorização executiva | WSJF, budgets, anomalias, governance |
| **Rafael** Scrum Master | Standup mobile | Facilitar daily, registrar impedimento |
| **Ana** Dev Sênior | Operação diária | Mover task, ver dependências |

(Perfis detalhados mantidos no anexo ao final.)

---

## 3. Vereditos de Validação

### ❌ RETRATADOS — afirmações da v1.0 que o código contradiz

| Afirmação v1.0 | Realidade no código | Evidência |
|----------------|---------------------|-----------|
| "ART não tem link para Impedimentos" | **Falso.** Página do ART tem botão "Impedimentos" → `/arts/[artId]/impediments` | `arts/[artId]/page.tsx:145` |
| "Sub-páginas do ART não acessíveis (Program Board, Pre/Post-PI)" | **Falso.** Página do ART é um hub: PI Workspace, Program Board, Flow Metrics, OKRs do ART, Inspect & Adapt, Impedimentos | `arts/[artId]/page.tsx:110-152` |
| "Flow Metrics não tem filtro por ART" | **Falso.** Flow suporta `scope = team \| art \| value_stream` com seletor (`scopeOptions`) | `analytics/flow/page.tsx:26-52,95+` |
| "Não há roll-up de impedimentos no nível do ART" | **Falso.** `/arts/[artId]/impediments` agrega impedimentos por ART (`listImpedimentsByArt`) | `arts/[artId]/impediments/page.tsx` |

**Lição:** O ART **já é** o hub que a v1.0 dizia faltar. O R1 ("ART Impediment Roll-up") como descrito não é necessário.

---

### ✏️ REFINADOS — atrito real existe, mas a causa raiz mudou

#### F1 — Hub do ART some quando não há PI Plan 🟠 (Lucas)
Os 6 botões de navegação do ART (incl. Impedimentos) só renderizam `if art.piPlans.length > 0`.
> Um ART recém-criado, sem PI Plan, não mostra nenhum link de navegação. RTE fica sem caminho.
**Fix:** Desacoplar links que não dependem de PI (Impedimentos, Times) do gate `piPlans.length > 0`.
**Evidência:** `arts/[artId]/page.tsx:111` `{art.piPlans.length > 0 && (() => {...links...})()}`

#### F2 — Hub do ART não é descoberto via sidebar 🟡 (Lucas)
O roll-up existe, mas só pela página do ART. A sidebar não expõe sub-itens do ART ativo nem badge de impedimento crítico.
> Lucas precisa lembrar: "primeiro entro no ART, depois vejo os botões". Funciona, mas não é discoverable.
**Fix:** Sidebar contextual — quando `artId` está na URL, expandir sub-itens. Badge de contagem na lista de ARTs.

#### F3 — Standup captura blockers como texto livre, não cria Impedimento rastreável ✏️🟠 (Rafael)
A v1.0 disse "standup não permite registrar impedimento". **Parcialmente falso:** o formulário de standup TEM campo `blockers` (textarea).
> Mas é texto solto no registro diário — não vira uma entidade Impedimento que aparece em `/teams/[teamId]/impediments` nem escala para o ART.
**Fix real:** Botão "Converter blocker em Impedimento rastreável" ao lado do campo blockers, OU detecção: se blockers preenchido, oferecer criar Impediment.
**Evidência:** `standup/components/standup-form.tsx:21,31,94-100` (campo existe) vs. impedimento é entidade separada.

#### F4 — WSJF mostra tema mas não filtra por tema ✏️🟠 (Beatriz)
A v1.0 disse "WSJF sem nada de tema". **Refinado:** cada épico exibe badge de tema colorido (`epic.themeTitle`, `themeColor`), mas não há dropdown para *filtrar* por tema.
> Beatriz vê o tema de cada um, mas não consegue isolar "só tema X" para a apresentação.
**Fix:** Dropdown "Filtrar por Tema" + URL param. Dados de tema já estão no épico — esforço baixo.
**Evidência:** `wsjf-dashboard.tsx:298-311` (exibe tema) — nenhum estado de filtro por tema.

---

### ✅ CONFIRMADOS — atrito real, causa raiz correta

#### C1 — Sem "Meu Trabalho" / home pessoal 🔴 (Ana, todos)
Home (`/`) = `HomeDashboard`: contadores de portfólio (épicos/ARTs/times), checklist de ativação, quick-links. **Nenhuma lista de tasks do usuário logado.**
> Ana entra e não vê o que é dela. Precisa navegar Times → seu time → Kanban e então filtrar (filtro que não existe — ver C2).
**Fix (R3):** Entry-point "Meu Trabalho" — tasks `WHERE assigneeId = currentUser`, agrupadas por sprint, com ação inline de status.
**Evidência:** `components/home-dashboard.tsx` (só agrega org, não usuário).

#### C2 — Kanban do time sem filtro por assignee 🟠 (Ana)
O board não tem filtro por responsável. Pior: ao criar card, `assigneeUserId` é fixado em `null` — nem dá para atribuir na criação.
> Ana não consegue isolar seus cards num board de 30. E cards nascem sem dono.
**Fix:** (a) Filtro por assignee no topo do board. (b) Campo de assignee no modal de criação.
**Evidência:** `teams/[teamId]/kanban/components/kanban-board.tsx:113` `assigneeUserId: null` no create; selects existentes são só priority + status.

#### C3 — Anomalias é read-only, sem fechamento de loop 🟠 (Beatriz)
Tela tem só filtro de severidade + cards. Zero CTA: nada de investigar / escalar / snooze.
> Beatriz vê a anomalia e... sai. Insight sem ação.
**Fix (R5):** 3 ações por anomalia: Investigar (cria task no time), Escalar p/ Governance (deep-link pré-preenchido), Snooze (arquiva N dias).
**Evidência:** `portfolio/budgets/anomalies/components/anomaly-list.tsx` — só `useState<Severity>` + `AnomalyCard`.

#### C4 — Search é lookup, não command palette 🟡 (Ana, Lucas, Beatriz)
`Search` = form simples → `GET /search`. Sem ⌘K, sem cmdk, sem ações inline.
> Power users (Lucas/Beatriz) não têm atalho de elite. Cada operação = navegação por menu.
**Fix (R9):** Command Palette (`cmdk`) com navegação + ações + criação rápida.
**Evidência:** `components/search.tsx` — `<form action="/search">`, nada mais.

#### C5 — Copilot markdown quebrado + sem exportação 🟠 (Lucas, Beatriz)
Bug de render de `**negrito**` (reportado em sessão anterior). Sem botão "copiar resposta".
> Sínteses do Copilot são para enviar a Business Owner / CFO. Markdown cru e sem copy quebram esse uso.
**Fix (R8):** Corrigir render markdown + botão "Copiar (markdown / texto limpo)".
**Evidência:** `components/copilot/copilot-markdown.tsx`, `copilot-thread-item.tsx` (modificados na branch — confirmar fix aplicado).

---

### 🟡 Atritos de taxonomia/nomenclatura (confirmados, baixo esforço)

| Atrito | Sev | Evidência |
|--------|-----|-----------|
| "Dependências" agrupado em "Workflows" — modelo mental errado (é conceito de ART/Time) | 🟡 | `sidebar.tsx` navMain → Workflows → Dependências |
| "Visão Geral" ambíguo (são Lean Budgets) | 🟡 | `sidebar.tsx` Portfolio → "Visão Geral" → `/portfolio/budgets` |
| Times não ordenados por uso recente (lista estática, slice 0-8) | 🟡 | `sidebar.tsx` `teams.slice(0,8)` |
| Tab "Sinergia" no Flow pode estar morta (synergy-matrix/tab deletados na branch) | 🟡 | git status: `D synergy-matrix.tsx`, `D synergy-tab.tsx` vs link em `flow/page.tsx:129` |

---

## 4. Padrões Confirmados

### Padrão 1 — "Insight sem ação" (dead ends)
Anomalias (C3) e, em menor grau, Strategy Map: o usuário chega ao dado mas não há CTA que avance o fluxo. **Maior padrão real do produto.**

### Padrão 2 — "Org-centric, não user-centric"
Home, navegação e Kanban são organizados por estrutura SAFe (Portfolio→ART→Time), nunca pelo usuário. Ana (e ~60% dos usuários: devs/POs) não tem ponto de entrada pessoal (C1, C2).

### Padrão 3 — "Funciona, mas não é descoberto"
O hub do ART, o scope-ART do Flow — existem mas exigem caminho específico. O atrito é de *discoverability*, não de ausência (F1, F2). Sidebar contextual resolve.

### Padrão 4 — "Standup operacional incompleto"
Captura blockers como texto, mas não os promove a impedimentos rastreáveis (F3). Loop quebra entre o ritual e o tracking.

---

## 5. Recomendações Re-priorizadas (pós-validação)

### 🔴 Crítico
- **C1 / R3 — "Meu Trabalho":** maior impacto, maior alcance (todo dev/PO). Não existe hoje.

### 🟠 Alto
- **C2 — Filtro assignee + atribuição no Kanban do time:** desbloqueia o uso diário do dev.
- **C3 / R5 — Action trail nas Anomalias:** fecha o maior dead-end do produto.
- **F4 — Filtro por tema no WSJF:** dados já existem, esforço baixo, desbloqueia LPM.
- **C5 / R8 — Copilot markdown + copy:** sínteses precisam sair do sistema.
- **F1 — Desacoplar nav do ART do gate de PI Plan:** ART novo fica navegável.

### 🟡 Médio
- **F2 — Sidebar contextual (ART/Time ativo):** discoverability do hub que já existe.
- **C4 / R9 — Command Palette ⌘K:** multiplicador para power users.
- Taxonomia: mover "Dependências" p/ ART; renomear "Visão Geral" → "Lean Budgets"; ordenar times por uso.
- Mobile-first no Standup (timer sticky, swipe) + responsivo no burndown.

---

## 6. Quick Wins (1-2 dias, validados)

1. **Renomear "Visão Geral" → "Lean Budgets"** — 1 string em `sidebar.tsx`.
2. **Mover "Dependências"** de Workflows → ART Board — config da sidebar.
3. **Filtro por tema no WSJF** — dropdown + URL param; dados já no épico.
4. **Botão "Copiar" no Copilot** — clipboard API + 1 componente.
5. **Desacoplar links do ART do gate `piPlans.length > 0`** — mover Impedimentos/Times para fora do condicional.
6. **Filtro por assignee no Kanban do time** — `useState` + filter no array já carregado.

---

## 7. North Star

**COSMOS deve ser cockpit, não CRM.** Em <5s o usuário sabe: o que está crítico, o que precisa de decisão, o que é dele hoje. O atrito #1 confirmado é *insight sem ação* (Padrão 1) e *falta de ponto de entrada pessoal* (Padrão 2). Atacar C1 + C3 muda a percepção do produto mais do que qualquer redesenho visual.

---

## Anexo — Perfis detalhados das personas

**Lucas Ferreira (RTE):** 38a, 12a em ágil, 4 ARTs / 18 times, uso diário multi-sessão, 2 monitores. Quer detectar impedimentos cross-team antes de virarem problema.

**Beatriz Carvalho (LPM):** 45a, ex-PMO, alta capacidade analítica, baixa tolerância a cliques. Justifica gasto de portfólio para CFO; vive de dashboards e exports.

**Rafael Souza (Scrum Master):** 31a, PSM II, COSMOS como hub do time, acessa no celular no standup. Irritado com mobile que não funciona.

**Ana Lima (Dev Sênior):** 28a, 1ª experiência SAFe, alta proficiência técnica, baixa paciência. Quer ver/mover suas tasks rápido e sair.

---

*v1.1 — cada atrito conferido no arquivo-fonte. 4 achados da v1.0 retratados, 4 refinados, 5 confirmados. Próximo passo: validar C1/C3 com usuários reais antes de implementar.*
