# SRD — Epic 009: Meeting Intelligence

> PRD: `docs/meeting/PRD.md`. Stories: `docs/stories/epic-009/`.
> Herda `docs/CONSTITUTION.md`.
>
> **Competência SAFe:** AGILE_PRODUCT_DELIVERY · **Nível:** ART

## Overview

Meeting Intelligence transforma o output falado das cerimônias SAFe em itens rastreáveis no Cosmos, eliminando a re-digitação manual do RTE. A estratégia integra ferramentas de transcrição existentes (Fireflies primeiro, Fathom depois, Otter por último) via webhook + API — sem construir bot próprio.

O fluxo: provider transcreve a reunião → dispara webhook → Cosmos busca transcript e summary → AI classifica os insights (action items, decisões, riscos) → RTE revisa um draft → entidades SAFe (Task, Risk/ROAM, DecisionLog) são criadas e vinculadas ao PI ativo.

Este epic é o **blocker do primeiro trial pago** (TOTVS). Toda a arquitetura reusa padrões existentes: o webhook receiver pattern (Artigo 7 da Constituição), o credential vault de Integration, e as copilot tools para o mapeamento via AI. Provider-agnostic por design — interface `MeetingProvider` com Fireflies como primeira implementação.

## Functional Requirements

### FR-901: Conectar provider de meeting
- **Description:** RTE conecta uma conta Fireflies por tenant: insere API key + configura a webhook URL do Cosmos. Credencial armazenada no credential vault (reusar pattern de `Integration`, type `FIREFLIES`). Suporta múltiplos providers por tenant no futuro (Fathom, Otter).
- **Actors:** RTE, Org Admin.
- **Priority:** Must Have
- **Dependencies:** entidade `Integration` + credential vault existentes; `MeetingIntegration` (story-046).
- **ACs:**
  - Given RTE em Settings → Integrations, When insere API key Fireflies válida e salva, Then um registro `MeetingIntegration` com `type=FIREFLIES`, `tenantId` e `status=ACTIVE` é criado e a API key é cifrada no vault.
  - Given uma API key inválida, When o RTE tenta salvar, Then recebe erro claro e nenhum registro é persistido.
  - Given uma integração já existente, When o RTE a desconecta, Then `status=PAUSED` e webhooks subsequentes vão para DLQ.

### FR-902: Receber webhook de transcrição
- **Description:** Endpoint `POST /api/webhooks/fireflies` segue o webhook receiver pattern (Artigo 7). Payload Fireflies: `{ meetingId, eventType: "Transcription completed", clientReferenceId }`. Assinatura HMAC-SHA256 no header `x-hub-signature`.
- **Actors:** Sistema (Fireflies).
- **Priority:** Must Have
- **Dependencies:** FR-901; Upstash rate limit; Redis idempotency; Inngest; `webhookDlq`.
- **ACs:**
  - Given um webhook recebido, When a assinatura HMAC-SHA256 não bate com `x-hub-signature`, Then responde 403 e registra audit log (fire-and-forget).
  - Given assinatura válida e `meetingId` novo, When processado, Then idempotency key (`fireflies:<meetingId>`, TTL 48h) é setada e um evento Inngest `integration/fireflies.webhook` é enfileirado com `tenantId` + `integrationId`.
  - Given `meetingId` já processado nas últimas 48h, When o webhook chega de novo, Then responde 200 sem reprocessar.
  - Given a integração está `PAUSED`, When o webhook chega, Then o payload bruto vai para `webhookDlq` e não é enfileirado.

### FR-903: Buscar transcript + summary via GraphQL
- **Description:** Worker Inngest consome `integration/fireflies.webhook`, consulta a GraphQL API do Fireflies pelo `meetingId` e busca `transcript { title, summary { overview, action_items, keywords, outline }, sentences }`. Normaliza para o shape interno `MeetingTranscript` + `summary`.
- **Actors:** Sistema (worker).
- **Priority:** Must Have
- **Dependencies:** FR-902; API key do vault; `MeetingTranscript` (story-046).
- **ACs:**
  - Given um evento enfileirado, When o worker roda, Then faz a query GraphQL autenticada com a API key do tenant e persiste um `MeetingTranscript` com `tenantId`, `meetingId`, `rawSummary`.
  - Given a query GraphQL falha (timeout/5xx), When o worker tenta, Then aplica retry com backoff (Inngest) e, esgotado, envia para DLQ com o erro.
  - Given o transcript já existe (`meetingId`), When o worker roda, Then atualiza idempotentemente sem duplicar.

### FR-904: Mapear insights → entidades SAFe (AI)
- **Description:** A partir do summary, uma camada de AI (reusar copilot tools / LLM) classifica: `action_items` → Task/Impediment; decisões → DecisionLog (governance); riscos → Risk (ROAM). Cada insight recebe `sourceType=MEETING`, `tenantId`, e link ao `PIPlan`/`PISession` ativo (resolvido via `clientReferenceId` ou janela de timestamp da cerimônia).
- **Actors:** Sistema (AI), RTE (consome o resultado).
- **Priority:** Must Have
- **Dependencies:** FR-903; copilot tools; entidades `Task`, `Risk`, `DecisionLog`, `PIPlan`; `MeetingInsight` (story-046).
- **ACs:**
  - Given um summary com `action_items`, When o mapper processa, Then cada item vira um `MeetingInsight` do tipo `ACTION` com `sourceType=MEETING`, `tenantId` e `piPlanId` resolvido.
  - Given o summary menciona um risco, When o mapper classifica, Then cria um `MeetingInsight` tipo `RISK` candidato a Risk/ROAM.
  - Given nenhum PI ativo é resolvível, When o mapper roda, Then os insights ficam `unlinked` e a UI sinaliza para vínculo manual.
  - Given o tenant da integração, When entidades são criadas, Then todas carregam o `tenantId` correto (zero cross-tenant).

### FR-905: Revisão humana antes de persistir
- **Description:** Antes de materializar Tasks/Risks/DecisionLog definitivos, o RTE vê um draft dos `MeetingInsight` extraídos numa review UI; pode aprovar, editar ou descartar cada um. Só os aprovados viram entidades de domínio. Mitiga ruído de AI.
- **Actors:** RTE.
- **Priority:** Should Have
- **Dependencies:** FR-904; UI.
- **ACs:**
  - Given insights extraídos, When o RTE abre a review, Then vê cada insight com tipo, texto, e destino proposto (Task/Risk/Decision).
  - Given o RTE aprova um insight, When confirma, Then a entidade de domínio correspondente é criada com `tenantId` e link ao PI, e o insight marca `status=APPLIED`.
  - Given o RTE descarta um insight, When confirma, Then `status=DISMISSED` e nenhuma entidade é criada.

### FR-906: Timeline de cerimônias
- **Description:** UI que lista as cerimônias (meetings) por PI/ART, com os insights capturados em cada uma e seu status (pending/applied/dismissed). Ponto de entrada para a review (FR-905).
- **Actors:** RTE, PM, SM.
- **Priority:** Should Have
- **Dependencies:** FR-903, FR-905.
- **ACs:**
  - Given meetings transcritas, When o RTE abre a timeline do PI, Then vê cada cerimônia com data, título e contagem de insights por status.
  - Given um meeting na timeline, When o RTE clica, Then abre a review de insights (FR-905).

## Cross-Cutting Concerns

- **Segurança:** sig HMAC-SHA256 (FR-902), API key cifrada no vault, tenant isolation em toda entidade, audit log de webhooks inválidos. Nível de risco: **Crítico** (webhook + credenciais externas).
- **Idempotency:** Redis SETNX `fireflies:<meetingId>` TTL 48h.
- **Performance:** processamento assíncrono via Inngest; webhook responde <500ms.
- **Observabilidade:** logs estruturados por etapa (receive/fetch/map/apply); Sentry em falhas de worker; DLQ para payloads não processados.

## Integration Touchpoints

- **Webhook pattern:** `apps/app/app/api/webhooks/{linear,github}/route.ts` (modelo).
- **Credential vault / Integration:** domínio Integrations existente.
- **Copilot tools:** `actions/safe-copilot/tools/` para o mapeamento AI (FR-904).
- **Entidades de destino:** `Task`, `Risk` (ROAM), `DecisionLog` (governance), `PIPlan`/`PISession`.
- **Provider-agnostic:** interface `MeetingProvider` (`verifySignature`, `fetchTranscript`, `normalizeSummary`) — Fireflies impl; Fathom/Otter como adapters (story-052).
