# Arquitetura do Sistema COSMOS (Enterprise V2)

## Visão Geral
Este documento reflete as decisões arquiteturais tomadas para suportar o ecossistema Next-Forge potencializado por diferenciais competitivos severos de mercado: **BPMN-js**, **Yjs (Colaboração Real-Time)**, **OpenTelemetry**, **XState** e **IA via pgvector**. Adicionalmente, incorpora o plano de execução baseado em Bounded Contexts e Modular Monolith.

---

## 1. Architecture Decisions (ADRs)

- **ADR-NF-001: Modular Monolith:** O backend e frontend coabitam o repositório (`apps/web` e `apps/api`), mas com domínios estritamente separados. A lógica central roda em Server Actions no `web`, enquanto webhooks, CRONs e jobs assíncronos pesados (como integrações Jira/OpenAI) rodam no `apps/api`.
- **ADR-NF-002: Multi-tenancy Strict Isolation:** Toda entidade transacional no banco de dados DEVE conter `tenantId` (ou `organizationId`). A camada de acesso a dados validará a posse do tenant em nível global.
- **ADR-NF-003: Outbox Pattern para Eventos de Domínio:** Em vez de depender de integrações síncronas sujeitas a falhas, o sistema utilizará um pacote `domain-events` que salva eventos na própria transação do Prisma e os despacha assincronamente (preparando o terreno para um futuro Message Broker como NATS JetStream, caso a escala exija).

---

## 2. Package Boundaries (Turborepo)

- **`apps/web`**: Frontend Next.js 15 (App Router). Contém lógica híbrida de React Flow, injeta os visualizadores do `bpmn-js` e coordena a presença multiplayer via provedores WebSockets.
- **`apps/api`**: Dedicado a background jobs, processamento assíncrono de IA (`pgvector`) e webhooks.
- **`packages/database`**: Detentor do Prisma Client e Schemas, dividido em **Bounded Contexts**. O banco PostgreSQL deverá ter a extensão `vector` ativada nativamente.
- **`packages/safe-engine`**: (NOVO) Contém a lógica de negócios pura do framework SAFe 6.0 (Cálculo de WSJF, estruturação de ARTs, hierarquia de Portfólio).
- **`packages/domain-events`**: (NOVO) Implementa o Outbox Pattern para comunicação baseada em eventos (ex: disparar evento `FEATURE_CREATED`).
- **`packages/integrations`**: (NOVO) Clientes isolados para integrações externas (Jira, Azure DevOps).
- **`packages/api`**: (tRPC) Roteamento e contratos de tipo entre `web` e lógicas complexas.
- **`packages/observability`**: Pacote dedicado ao wrapper do OpenTelemetry, garantindo que a emissão de métricas e traces seja padronizada.

---

## 3. Prisma Schema (Bounded Contexts & Vectors)

Para evitar um *Schema Monolith* insustentável, a base será logicamente separada em contextos:

- `tenant.prisma`: Gerenciamento de Tenants, Usuários e Sessões.
- `art-core.prisma`: Épicos, Features, Histórias, ARTs e Times.
- `planning.prisma`: Program Increments (PI), Sprints e Dependências.
- `metrics.prisma`: Logs de auditoria, eventos de domínio e histórico.

```prisma
// packages/database/schema.prisma (Exemplo Resumido)

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions", "prismaSchemaFolder"] // Suporte a múltiplos arquivos
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [vector] // Extensão de IA obrigatória
}

// ----------------------------------------------------------------------
// Inteligência Assistiva (AI Copilot via pgvector)
// ----------------------------------------------------------------------

model PIKnowledgeVector {
  id          String   @id @default(cuid())
  tenantId    String
  textContent String   // Texto bruto (Ex: Resumo de falhas do PI)
  embedding   Unsupported("vector(1536)")? 

  tenant      Tenant @relation(fields: [tenantId], references: [id])
  @@index([tenantId])
}

// ----------------------------------------------------------------------
// Enterprise Workflows (BPMN Compliance)
// ----------------------------------------------------------------------

model BpmnDefinition {
  id          String @id @default(cuid())
  tenantId    String
  teamId      String
  xmlContent  String // Conteúdo nativo para o bpmn-js processar
  version     Int    @default(1)

  tenant      Tenant @relation(fields: [tenantId], references: [id])
  @@index([tenantId, teamId])
}

// ----------------------------------------------------------------------
// Real-Time & State Machines
// ----------------------------------------------------------------------

model ConfidenceVoteSession {
  id           String @id @default(cuid())
  tenantId     String
  piId         String
  xStateStatus String // Controlado pela máquina XState
  
  @@index([tenantId])
}
```

---

## 4. Plano de Execução Técnica em Fases

**Fase 0: Fundação (Sprint 0)**
- Setup do Monorepo Turborepo e `next-forge`.
- Configuração do banco de dados (Prisma multi-file) e extensões (`pgvector`).
- Setup de Autenticação/Tenants.

**Fase 1: MVP Core SAFe (PI 1)**
- Gestão de ARTs e Times (CRUDs básicos).
- Backlog de Features e cálculo automatizado de WSJF (`safe-engine`).
- PI Planning estático (sem Yjs).

**Fase 2: Interatividade e Integrações (PI 2)**
- Implementação de Multiplayer (Yjs/Liveblocks).
- Construção de fluxos BPMN nativos (`bpmn-js`).
- Integrações Bidirecionais (`packages/integrations` via Outbox Pattern no `domain-events`).

**Fase 3: Enterprise & IA (PI 3)**
- Motor de Máquina de Estados para Ceremonias (`XState`).
- Assistive Copilot ativado consultando `pgvector`.
- Lançamento corporativo da instrumentação (`OpenTelemetry`).
