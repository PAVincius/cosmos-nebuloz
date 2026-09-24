# Atrito — Meridian dogfood

Formato: `P0..P3 | tela | passo de reprodução | dono`.

---

**P0** | Carteira (`/meridian`) e detalhe do assessment (`/meridian/assessment/[id]`, aba Coleta) | M1/M2 do roteiro (`docs/qualidade/2026-09-23-plano-dogfood-esteira.md`): abrir um assessment do zero pela carteira e convidar respondente por eixo. Não existe botão nem formulário para nenhuma das duas ações em nenhuma tela do módulo. Confirmado por `grep -rl "createAssessment\|assignRespondent" apps/app/components apps/app/app` — as duas actions só aparecem nos próprios arquivos onde são definidas:
  - `apps/app/app/(meridian)/actions/assessments.ts:348` — `createAssessment`, nunca importada por nenhum componente.
  - `apps/app/app/(meridian)/actions/collection.ts:40` — `assignRespondent`, nunca importada por nenhum componente.
  - Por comparação, as actions da mesma família que a UI **usa** de fato: `registerOverride` (`overrides.ts:30`) em `components/meridian/screens/tab-scoring.tsx:240`, e `promoteGap` (`gaps.ts:391`) em `components/meridian/screens/gap-register.tsx:101`.

  Bloqueia não só o Ensaio local (E2E não consegue dirigir M1/M2 pelo navegador — precisou de workaround via seed, ver nota abaixo) mas o **M1 e M2 do roteiro em produção**: o CEO, ao operar como cliente em `app.nebuloz.ai`, não vai achar onde criar o AS-NBZ-002 nem onde convidar respondentes por eixo. Sem essas duas telas, a esteira de dogfood do Meridian não anda em produção — é bloqueador para o passo 3 (Execução em produção) do ciclo padrão.

  **Workaround usado só para viabilizar o E2E local**: `scripts/seed-meridian.ts` planta à mão (via Prisma, fora da UI) o assessment `AS-200 Solaris Digital` com 4 respondentes já atribuídos e um 5º com token fixo conhecido, comentado no próprio seed como decorrência deste atrito. Isso não é solução — é o E2E confirmando o problema.

  **Dono**: dev Meridian.

---

**P0** | Ambiente local (`pnpm dev`, todos os apps) | Qualquer passo do Ensaio (M1–M11 do roteiro): `pnpm dev` (`turbo dev --filter=!docs --continue`) sobe e cada app derruba na inicialização com `Invalid environment variables` — `app:dev` falta `BETTER_AUTH_SECRET` (`packages/auth/keys.ts:13`), `web:dev` falta `BASEHUB_TOKEN` (`packages/cms/keys.ts:13`), `api:dev` reproduz o mesmo erro de `BETTER_AUTH_SECRET`. Nenhum `.env.local` existe em nenhum app nem na raiz (`find . -iname ".env.local" -not -path "*/node_modules/*"` não retorna nada, até profundidade 5); não há `.envrc`, `op`/`doppler` CLI, nem script `env:pull` no repo para provisionar. Confirmado às 2026-09-24 08:5x, terminal reiniciado por hook travado (ver handoff da Morgana) — não é um problema de código, é o ambiente local desta sessão sem segredos configurados.

  Bloqueia 100% do Ensaio: sem `app:dev` respondendo em `:3012`, nenhum teste Playwright roda (`meridian-dogfood.spec.ts` não pôde ser executado nesta sessão — M1–M9 ficam sem veredito de execução, só a revisão estática do spec).

  **Dono**: CEO/infra (provisionar `.env.local` de `apps/app/.env.example` + `apps/web` + `apps/api`, ou apontar onde os segredos já vivem).

---
