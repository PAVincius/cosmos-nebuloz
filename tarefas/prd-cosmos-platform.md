# PRD: Plataforma COSMOS (SAFe 6.0 Full Management)

## 1. Introdução/Visão Geral
A plataforma **COSMOS** (*Collaborative Orchestration System for Managing Organizational Scaled-agility*) é um sistema de Software as a Service (SaaS) multi-tenant desenhado para orquestrar e gerenciar toda a hierarquia ágil de uma empresa utilizando o framework **SAFe 6.0 Full**.

**O Problema:** O mercado está saturado de boards genéricos e ferramentas de PI Planning estáticas. As integrações bidirecionais atuais não trazem inteligência operacional, e a colaboração se perde quando centenas de usuários acessam o mesmo quadro.
**A Solução Diferenciada:** O COSMOS combina visualização operacional rica (React Flow / BPMN), processo estritamente configurável via canvas low-code, sincronização multiplayer em tempo real (Liveblocks/Yjs) e uma camada de inteligência acionável (IA Assistiva via pgvector) para ser o copiloto definitivo do SAFe 6.0.

## 2. Diferenciais Competitivos e Objetivos
- **Real-Time Planning Room:** Transformar o PI Planning de um formulário estático para um canvas multiplayer, onde dependências e épicos são movidos com cursores ao vivo (Yjs/Liveblocks).
- **Enterprise BPMN & Workflows:** Utilizar `bpmn-js` para criar fluxos auditáveis e robustos, ligando elementos BPMN diretamente a Features e Riscos do SAFe.
- **Orquestração de Estados e Votos:** Controlar ciclos complexos de votação de confiança (Confidence Vote) e aprovações de portfólio de maneira previsível usando `XState`.
- **Inteligência Assistiva (Copilot):** Não um chatbot genérico, mas um motor (`pgvector`) que analisa o histórico para prever gargalos de fluxo, dependências circulares e incoerências de capacidade.
- **Observabilidade Classe Enterprise:** Integração mandatória com `OpenTelemetry` para garantir confiabilidade de métricas e rastreabilidade cross-service, exigido por grandes clientes (SLA/SLO).

## 3. Histórias de Usuário (Com Critérios de Interação / UI)

**Nível de Portfólio (LPM):**
- *Como Lean Portfolio Manager, quero criar e mover Épicos em um Kanban colaborativo.*
  - **Interação UI:** Arrastar e soltar sincronizado em tempo real (Yjs). Outros usuários veem o Épico "levitando" e o cursor da pessoa que está arrastando.
- *Como Lean Portfolio Manager, quero vincular Épicos aos OKRs da empresa.*
  - **Interação UI:** Busca rápida com Multi-select. A tag do OKR aparece quase instantaneamente.

**Nível de Release Train (RTE / STE):**
- *Como RTE, quero realizar a Votação de Confiança (Confidence Vote) do PI com regras estritas.*
  - **Interação UI:** O sistema abre um painel modal regido por máquina de estado (`XState`). Só avança para "Votação Encerrada" se X% do ART votar. Animações de contagem refletem os votos ao vivo via WebSockets.
- *Como RTE, quero receber alertas de risco sistêmico antes mesmo da execução.*
  - **Interação UI:** O Copilot de IA (`pgvector`) exibe um "Assistive Banner" amarelo no topo do board: "Nota: A equipe Alpha assumiu 3 features dependentes do Legacy, e no PI passado isso gerou 40% de atraso. Sugestão: Mitigar."

**Nível de Equipe (PO / Scrum Master):**
- *Como Scrum Master, quero desenhar fluxos de trabalho usando notação corporativa BPMN.*
  - **Interação UI:** O SM acessa o Workflow Canvas e usa `bpmn-js` para arrastar caixas BPMN. Ele liga uma caixa BPMN à entidade nativa "Feature", criando um processo auditável low-code.

## 4. Requisitos Funcionais

1. **Gestão de Tenants (Multi-tenancy):**
   - 1.1 O sistema deve ter a coluna obrigatória `tenantId`.
   - **Critério de Aceitação:** Troca de tenant via Workspace Switcher força recarregamento total com loader de esqueleto.

2. **Criação de Mapas de Fluxos Nativos (Workflow Builder):**
   - 2.1 A plataforma deve permitir criar fluxos operacionais (React Flow e `bpmn-js`).
   - **Critério de Aceitação:** Suporte a Custom Nodes do React Flow e renderização híbrida de BPMN para visualização de processo formal.

3. **Multiplayer Sync (Yjs/Liveblocks):**
   - 3.1 Painéis críticos (PI Planning, Portfolio Kanban) devem propagar mudanças sem refresh.
   - **Critério de Aceitação:** Se o Usuário A move um card, o Usuário B vê o card se movendo com uma animação de transição em < 200ms.

4. **Copilot Inteligente (pgvector):**
   - 4.1 A IA deve buscar contexto de PIs passados.
   - **Critério de Aceitação:** Criação de embeddings vetoriais (`pgvector`) toda vez que um PI fecha, para que a IA consulte essas similaridades nas próximas sessões.

5. **Setup de PI Planning (Matriz Visual):**
   - 5.1 Permitir criar Program Increments.
   - **Critério de Aceitação:** Sticky headers nos eixos X e Y para scroll horizontal infinito sem perder contexto de equipes e sprints.

## 5. Não Objetivos (Fora de Escopo)
- Chatbots conversacionais genéricos (A IA foca apenas em riscos de planejamento/SAFe).
- IDE ou controle git nativo dentro da ferramenta.

## 6. Considerações de Design
- Componentes Base em **shadcn/ui**.
- Componentes de presença (Avatares empilhados) para mostrar "Quem está online neste board" no topo da tela.

## 7. Considerações Técnicas
- **Arquitetura Base:** Monorepo Turborepo usando `Next-Forge v5.3.2`.
- **Extensões de Mercado:** `reactflow` / `bpmn-js` (canvas), `Liveblocks` ou `Yjs` (Colaboração Real-time), `XState` (Máquinas de Estado complexas), `OpenTelemetry` (Tracing).
- **Server State:** PostgreSQL (Prisma ORM) contendo a extensão do banco `pgvector` para a camada de recomendação baseada em contexto.

## 8. Métricas de Sucesso
- Performance Multiplayer: Latência de propagação de cursor < 50ms para suportar 50+ pessoas no PI Planning simultaneamente.
- Setup reduzido a menos de 2 horas.

## 9. Perguntas em Aberto
- O uso de Liveblocks aumenta o custo do SaaS. Devemos usar nossa própria infra via Yjs + WebSockets no backend?
- Para a IA assistiva, integraremos OpenAI via API direta ou usaremos LLMs locais/Azure para atender compliances corporativos pesados?
