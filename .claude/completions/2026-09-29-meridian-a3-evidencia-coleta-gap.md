# Meridian A3 — ver evidência em Coleta e no gap

Spec: `specs/010-evidencia-coleta-gap/spec.md` (PR #305, 40451f51). Decisão D-19.

- **Action nova** `listAssessmentEvidence` (`actions/report.ts`): evidências do assessment inteiro (id, rótulo, `eliminated` pela retenção). Filtra por tenant; **sem `evidence.read` devolve só o total e nenhuma linha** (id e nome de arquivo nem saem do servidor — FR-006). Não grava trilha; a leitura do arquivo segue por `requestEvidenceUrl` (audita antes da URL, mesma permissão, sem mudança — FR-004/007).
- **Rótulo num ponto só:** `lib/meridian/evidence-label.ts` (`evidenceLabel`, hoje o nome do arquivo). Pendência: parecer do Lacre sobre nome de arquivo como rótulo em Coleta; trocar só ali.
- **UI:** `EvidenceButton` extraído de `tab-scoring.tsx` para `evidence-button.tsx` (mesmo comportamento; prop `label`). `EvidenceList` (`evidence-list.tsx`) entra em `tab-coleta.tsx` no lugar da contagem e em `gap-register.tsx` abaixo da frase de confiança. Sem lista (carregando, erro, sem permissão) cai para a contagem, sem botão; eliminada pela retenção aparece marcada, sem botão; sem evidência diz que não há.
- `GapRow` ganhou `assessmentId` (a lista do gap busca por assessment de origem; uma leitura por detalhe aberto, não por linha da lista — não pesa no SC-010).
- Sem prévia, sem download em lote, sem nome de arquivo em trilha nova (FR-008/009/010). Painel de divergência do Scoring não muda.

Testes: `evidence-list.test.ts` (action, 7), `evidence-list.test.tsx` (componente, 6), `evidence-label.test.ts`; `__tests__/meridian` + `__tests__/screens` 439/439; tsc e biome sem erro.

**Não feito:** E2E do M8 provando `evidence.read` a partir de Coleta e do gap (não roda neste worktree, sem banco/bucket local) — fica para o Crivo. O caso 403 tem teste de action (`requestEvidenceUrl` recusa antes de banco, trilha e bucket).

**Parecer do Lacre (condição 3):** nome como texto escapado, com truncamento só visual (`TruncatedName`: ellipsis, DOM com o nome inteiro) e `title` com o nome completo, no botão e no marcador de eliminada. Testes: nome longo e nome com HTML viram texto, nunca elemento. Condições 1 e 2: sem `evidence.read` o servidor devolve só a contagem; o nome não entra em target/diff/metadata de auditoria nem em URL, log ou export.
