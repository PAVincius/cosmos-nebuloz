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

  **Resolvido em 2026-09-24** — CEO autorizou e copiou os `.env.local` de dev (raiz, `apps/app`, `apps/api`, `apps/web`, `apps/backoffice`, `packages/database/.env`) pro clone; `pnpm dev` sobe e `app:dev` responde em `:3012`.

---

**P1** | `/meridian-responder/<token>`, botão "Anexar evidência" | M3 do roteiro: anexar evidência a uma resposta. `attachEvidence` (`apps/app/app/(meridian)/actions/respondent.ts:280`) sobe pro bucket `meridian-evidence` via `storageClient` (`packages/storage/src/index.ts:7-10`), que lê `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`. Nenhum dos `.env.local` copiados (app/api/web/backoffice/raiz/database) define essas chaves — confirmado por grep antes de rodar o E2E, então o client cai no placeholder hardcoded `http://localhost:54321`, que não está de pé neste ambiente (`lsof -i :54321` vazio, sem docker-compose/CLI de Supabase local no repo). Upload falha por conexão recusada; o toast de erro (`Falha ao anexar evidência: …`) aparece e some, sem deixar o arquivo anexado.

  Confirmado **antes** de rodar o E2E que o alvo não é o projeto de produção `aosdvvluokrbgpyqwoor` (não é nenhum projeto real — é o placeholder local) — não se aplica a instrução de pular por risco de produção, mas o resultado prático é o mesmo: sem storage funcional, a etapa de evidência do M3 não tem como ser provada localmente. Ajustei `meridian-dogfood.spec.ts` pra não travar nisso (espera o toast assentar, sucesso ou erro, e segue pro envio) — SC-006 fica provado pra "responder a bateria e enviar", não pra "evidência efetivamente armazenada".

  **Dono**: CEO/infra (apontar um Supabase local — `supabase start` ou docker — e as duas env vars, ou confirmar que evidência só é provada em `app.nebuloz.ai`).

---

**P2** | `apps/app/app/(meridian)/actions/collection.ts:76` | `assignRespondent` copia `tokenExpiresAt` de `assessment.deadline` no momento da atribuição, em vez de um TTL próprio e curto. Se o consultor estender o prazo do assessment depois de já ter emitido tokens, os tokens já emitidos ganham vida extra em silêncio, sem reemissão — o respondente segue com o mesmo link válido por mais tempo do que foi comunicado a ele. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | `apps/app/app/(meridian)/actions/respondent.ts:96` (`loadRespondent`, chamada por `getBattery`:115, `saveDraft`:183, `submitBattery`:245, `attachEvidence`:286) | Lookup de token por `tokenHash` sem rate-limit — `/meridian-responder/<token>` é rota sem sessão, então nada impede tentativas repetidas de adivinhar um hash válido além do próprio espaço de 32 bytes do token. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | `apps/app/app/(meridian)/actions/respondent.ts:317` (`attachEvidence`, chama `ensureBucket`) | `ensureBucket(MERIDIAN_EVIDENCE_BUCKET)` roda a cada upload de evidência em vez de uma vez na provisão — idempotente, não corrompe nada, mas é uma chamada de rede redundante por request que devia ter acontecido só no provisionamento do bucket. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---

**P2** | `packages/storage/src/index.ts:21` (`ensureBucket`) | Bucket de evidência criado sem política de lifecycle (retenção/expiração de objetos) — evidência anexada por um respondente sem conta fica armazenada indefinidamente, sem uma regra declarada de por quanto tempo. Achado do security review do Vigia sobre `4cf68a24`.

  **Dono**: Bussola. **Estado**: backlog.

---
