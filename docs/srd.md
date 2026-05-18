# System Requirements Document (SRD) - COSMOS

## Epic 1 & 2: Foundation, Multi-Tenancy & Observability

### Functional Requirements
1. O sistema proverá registro, login e gerenciamento de sessões com `better-auth`.
2. Troca de Tenant forçando recarregamento de cache local.
3. Todo serviço e API route deve registrar spans no `OpenTelemetry` para garantir a observabilidade de latência enterprise.

### Non-Functional Requirements
- **Observability:** O backend Next.js deve emitir logs, traces e metrics (OTLP format) para um coletor (ex: Grafana/Jaeger). Nenhuma feature vai para produção sem a garantia do OpenTelemetry instalada e propagando `traceId`.
- **Isolamento de Segurança:** Nenhuma rota acessa dados fora do seu `tenantId`.

### Data Entities
- **Tenant:** `{ id, name, slug, createdAt }`
- **User:** `{ id, email, name, avatarUrl }`

### API Surface
- `GET /api/health` - Deve retornar métricas via OTLP.

---

## Epic 3: Portfolio Management & Real-time Collaboration

### Functional Requirements
1. Quadro Kanban de portfólio colaborativo "multi-player".
2. Vinculação de OKRs assíncrona.

### Non-Functional Requirements
- **Real-Time Sync:** O estado do Kanban (posição dos cartões) deve utilizar um CRDT (Conflict-free Replicated Data Type) através do `Yjs` ou `Liveblocks` para que edições conflitantes simultâneas se resolvam automaticamente.

### Data Entities
- **Epic:** `{ id, tenantId, title, statusId, order, yjsDocumentState }`

### API Surface
- `WS /api/yjs/sync` - Rota de websockets para propagação de documentos do Yjs.

---

## Epic 4: PI Planning, ART & Assistive AI

### Functional Requirements
1. Geração automatizada do evento PI Planning.
2. Votação de Confiança regida por XState.
3. Copilot Assistivo analisando riscos baseados no histórico usando similaridade vetorial.

### Non-Functional Requirements
- **IA Embedding:** Sempre que um risco é mitigado ou um PI falha em entrega, o sistema gera embeddings no PostgreSQL (`pgvector`) para futura pesquisa semântica.
- **State Machine:** A votação de "Confidence Vote" (de 1 a 5) só permite avanços baseados nas transições estritas definidas pela máquina de estado do `XState`.

### Data Entities
- **PI:** `{ id, tenantId, name, startDate, endDate, xStateCurrent }`
- **PI_Knowledge_Vector:** `{ id, tenantId, textContent, embedding: vector(1536) }` // Extensão pgvector

### API Surface
- `POST /api/trpc/ai.getRiskRecommendations` - Recebe os dados atuais da dependência e faz uma busca via cálculo de cosseno no `pgvector` para retornar recomendações de como tratar o risco.
- `POST /api/trpc/pi.sendVoteEvent` - Dispara um evento para a máquina XState validar a transição do Confidence Vote.

---

## Epic 5: Team Level Management & BPMN Enterprise

### Functional Requirements
1. O Product Owner insere os sliders de WSJF.
2. O Scrum Master configura o fluxo de aprovação e etapas em BPMN oficial.

### Non-Functional Requirements
- **BPMN Compliant:** Além do React Flow para quadros de dependência soltos, os fluxos de times devem suportar a renderização do `bpmn-js`, armazenando o XML oficial na base de dados.

### Data Entities
- **BpmnDefinition:** `{ id, tenantId, teamId, xmlContent, version }`
- **Feature:** `{ id, tenantId, title, bv, tc, rr, js, wsjfScore }`

### API Surface
- `POST /api/trpc/workflow.saveBpmn` - Salva a string XML gerada pelo `bpmn-js`.
