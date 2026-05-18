# Story: Assistive AI Copilot (pgvector)
**Epic:** epic-004
**Status:** pending
**WSJF Score:** 15.0

## Description
Como um Analista / RTE, quero que a plataforma analise os riscos inseridos durante o PI Planning usando IA e busque similaridades com riscos de PIs passados que falharam ou foram mitigados, para que eu receba recomendações em tempo real de como tratar aquele risco ("Assistive Copilot").

## Acceptance Criteria
- [ ] Implementar a geração de Embeddings usando a OpenAI API e salvar no Prisma no formato `Unsupported("vector(1536)")`.
- [ ] Criar a query raw no Prisma para calcular similaridade de cosseno (Cosine Similarity `<=>`) entre o vetor do risco atual e os vetores armazenados em `PIKnowledgeVector`.
- [ ] Exibir um componente lateral na UI de "AI Recommendations" quando um Risco for aberto.

## Technical Notes
- Utilizar `@repo/ai` se já existir no Next-Forge, ou instalar o SDK da `openai`.
- A query no banco exige a sintaxe SQL bruta do Prisma (`prisma.$queryRaw`) porque o Prisma Client nativo ainda tem limitações com a extensão pgvector.

## Test Plan
- Criar um registro no banco de um Risco Passado com embedding simulado. Buscar por um risco semanticamente similar e verificar se a API retorna o Risco Passado com "similarity score" alto.
