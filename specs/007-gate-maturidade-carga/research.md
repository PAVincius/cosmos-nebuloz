# Research: Gate de maturidade + teste de carga (k6)

## 1. Onde vive o checklist do gate

**Decisão**: `docs/qualidade/gate-maturidade-carga.md`, mesmo padrão de `docs/qualidade/checklist-avaliacao-engenharia.md` (documento de processo, não código).

**Rationale**: Já existe precedente de checklist de qualidade como documento versionado, revisado por humano — não há necessidade de inventar um mecanismo novo (CI check, etc.) pra um gate que é aplicado poucas vezes (uma por produto, na hora de decidir se ele entra em carga).

**Alternatives considered**: Gate como check automatizado de CI — rejeitado por escopo (intent não pede automação, e os 3 critérios — SC formal, dogfood sem P0/P1, compliance — não são todos verificáveis por máquina hoje; dogfood e compliance dependem de julgamento humano).

## 2. SC-011 do Meridian é novo, distinto do SC-010

**Decisão**: SC-010 (`meridian-prd.md:163`, `apps/app/e2e/meridian-load.spec.ts`) mede **volume de dados** (200 assessments/2.000 gaps, um usuário, tempo de resposta da carteira). SC-011 mede **concorrência** (muitos usuários simultâneos, cenário PI Planning). São testes diferentes, com scripts diferentes — SC-011 não substitui nem se funde com SC-010.

**Rationale**: Confundir os dois faria o gate de carga parecer satisfeito por um teste que nunca testou concorrência — exatamente o erro que a spec existe pra evitar ("k6 responde 'aguenta muita gente ao mesmo tempo', não 'aguenta muito dado'").

## 3. Onde mora o script k6

**Decisão**: `k6/meridian-pi-planning.js` na raiz do monorepo (novo diretório) — k6 roda como binário próprio, fora do runtime Node/Vitest/Playwright do monorepo, então não faz sentido colocar em `apps/app/e2e/` (que é Playwright).

**Rationale**: Mantém a fronteira clara entre "teste de jornada" (Playwright, dentro do app) e "teste de carga" (k6, fora do runtime do app) — evita o script k6 ser varrido por tooling de TS/lint que não entende o formato dele.

**Alternatives considered**: `scripts/k6/` — equivalente, mas `k6/` na raiz é mais descobrível e não mistura com `packages/database/scripts` (seeds) nem `apps/app/scripts`.

## 4. Como o k6 exercita Server Actions

**Decisão (Maestro, 2026-09-26)**: k6 HTTP puro, chamando as Server Actions pelo cabeçalho `Next-Action: <id>` (o mesmo mecanismo que o client do Next.js usa). Os IDs de action mudam a cada build — o script resolve isso no setup do teste, lendo `.next/server/server-reference-manifest.json` do build alvo (não hardcoda IDs). Sessão via cookie (login uma vez no setup, reaproveita o cookie nas requisições de carga).

**Rejeitado**:
- **Route handlers dedicados** que espelham a mutação da Server Action — abriria uma superfície nova em produção só para teste, o que é risco de segurança (mais uma rota autenticável a manter e a auditar, sem função de produto).
- **Módulo browser do k6** (`k6/browser`) como forma principal de medir concorrência — fiel, mas pesado demais pra simular centenas de usuários simultâneos (cada VU sobe um browser real). Fica reservado a um smoke leve (poucas VUs, validação de que o fluxo funciona de ponta a ponta), não à medição de concorrência do SC-011.

## 5. Cenário de referência

**Decisão**: PI Planning de um cliente ICP — RTE conduzindo, 3+ ARTs — mesmo cenário já usado como referência de negócio em `memoria-empresa.md`/`project_cosmos_strategy` (lead primário TOTVS). O seed de apoio (se precisar) segue o padrão de `scripts/seed-meridian-load.ts`: tenant dedicado, nunca produção, idempotente.

**Rationale**: Reaproveita um cenário de negócio já validado como representativo, em vez de inventar um cenário sintético sem lastro.
