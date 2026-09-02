## Objetivo da Trilha

AI Governance responde a uma pergunta central: quem decide, com base em quê, e como a organização define "IA responsável". Este template é autônomo e serve como playbook comercial e técnico para conduzir um cliente da triagem até a entrega de um programa de governança de IA operacional, estruturado sobre o NIST AI Risk Management Framework (AI RMF) e o ISO/IEC 42001.[^1][^2][^3]

## Mapeamento Completo por Etapa do NIST AI RMF

O AI RMF organiza o trabalho em quatro funções — Govern, Map, Measure, Manage — sendo Govern transversal às demais três. A tabela abaixo detalha cada subcategoria com ação prática e ferramenta/software de apoio.[^4][^5]

| Função | Subcategoria (exemplos) | Ação concreta | Software/técnica de apoio |
|---|---|---|---|
| Govern | GOVERN 1: políticas, processos e procedimentos transparentes[^6] | Redigir e publicar Política de IA corporativa; formar comitê de risco de IA | Plataformas GRC de IA (ex.: OneTrust AI Governance, Credo AI) para workflow de aprovação e versionamento de política[^7][^8] |
| Govern | GOVERN 2: responsabilidade e treinamento de equipes[^6] | Definir RACI por sistema de IA; treinar squads em uso responsável | Módulo de atribuição de ownership dentro do inventário de IA[^7] |
| Govern | GOVERN 6: gestão de risco de terceiros e cadeia de suprimentos de IA[^6] | Avaliar modelos/fornecedores de terceiros antes da integração | Questionários de fornecedor automatizados (vendor risk assessment) integrados ao inventário[^9] |
| Map | MAP 1: propósito, contexto e usuários do sistema documentados[^2] | Preencher ficha de contexto para cada novo caso de uso de IA antes do desenvolvimento | Templates de intake/registro de caso de uso dentro da plataforma de governança[^8] |
| Map | MAP 2 e 5: categorização do sistema e mapeamento de impactos[^6] | Classificar cada sistema por tipo (LLM, classificador, agente) e nível de risco; documentar impactos em pessoas/sociedade | Motor de tiering de risco com templates EU AI Act/NIST/ISO 42001[^7][^10] |
| Measure | MEASURE 1-2: métricas e avaliação de características de confiança (fairness, robustez, privacidade)[^6][^11] | Definir KPIs de qualidade, viés e explicabilidade por sistema; testar antes do go-live | Ferramentas de avaliação/observabilidade de modelo com dashboards de drift e bias[^10] |
| Measure | MEASURE 3: rastreamento de risco ao longo do tempo[^6] | Monitorar continuamente sinais de drift e qualidade em produção | Telemetria contínua integrada a MLOps/model registries[^12][^10] |
| Manage | MANAGE 1: priorização e tratamento de riscos mapeados[^6] | Documentar decisão de mitigar/transferir/aceitar risco para cada achado | Registro de risco (risk register) com trilha de decisão auditável[^8] |
| Manage | MANAGE 3: gestão de risco de ferramentas/fornecedores de terceiros[^6] | Reavaliar fornecedores periodicamente; revogar acesso quando risco muda | Workflows de reavaliação periódica automatizada (Third-Party Risk Agent)[^10] |
| Manage | MANAGE 4: planos de resposta e comunicação de incidentes[^6] | Criar e testar plano de resposta a incidentes de governança (ex.: uso indevido de IA por colaborador) | Playbook de incidente integrado ao módulo de compliance[^10] |

## Fase 1 — Triagem (Discovery)

- Existe inventário vivo de sistemas de IA (internos, SaaS embutidos, agentes, modelos de terceiros, "shadow AI")?[^13][^8]
- Há comitê ou responsável formal por decisões de IA, com poder de aprovar/vetar casos de uso?[^6]
- Existe política de uso de IA documentada, comunicada e assinada por liderança?[^14]
- Os fornecedores/modelos de terceiros passam por avaliação de proveniência, integridade de dados e risco antes da adoção?[^11]

## Fase 2 — Ações Concretas e Entregáveis

| Ação | Entregável | Prazo típico |
|---|---|---|
| Formar comitê de governança de IA com RACI | Carta de governança + matriz RACI | 2-4 semanas |
| Publicar política corporativa de uso de IA | Documento de Política de IA | 3-6 semanas |
| Construir inventário de sistemas de IA (modelos, agentes, MCPs, fornecedores) | AI Asset Registry | 4-8 semanas |
| Classificar sistemas por risco (baixo/médio/alto) | Matriz de classificação de risco | 2-4 semanas |
| Definir métricas de confiabilidade (viés, drift, robustez) | Painel de métricas trustworthy AI | 6-10 semanas |
| Certificar alinhamento a ISO/IEC 42001 (opcional) | Statement of Applicability | 3-6 meses |

## Exemplos de Software e Integrações de Mercado

O mercado de plataformas de AI governance se divide entre GRC incumbentes que adicionaram módulo de IA e plataformas nativas de AI governance, ambos com foco em inventário, avaliação de risco por framework e geração de evidências auditáveis.

| Categoria | Exemplo de ferramenta | Integrações típicas |
|---|---|---|
| GRC incumbente com módulo de IA | OneTrust AI Governance — inventário automático, templates EU AI Act/NIST/ISO 42001, monitoramento de drift/bias[^7][^10] | Databricks Unity Catalog, ServiceNow, Salesforce, Jira, Slack via REST API[^9][^10] |
| Plataforma nativa de AI governance | Credo AI — REST API multi-tenant (casos de uso, modelos, fornecedores, questionários, políticas, riscos), SDK Python/TypeScript, MCP server para agentes[^8][^15] | Model registries, pipelines de CI/CD, agentes via MCP |
| Model risk / lifecycle management | ModelOp Center — inventário único (ML, GenAI, Agentic AI, fornecedor), workflows de intake-a-retirada, relatórios auditor-grade[^16] | Integrações com ferramentas de teste/performance/fairness já existentes |

Para o consultor com stack em Python/Next.js e MCPs, a integração mais direta é expor o AI Asset Registry via API própria (ou MCP server) e consumir plataformas de terceiros (OneTrust, Credo AI) apenas para o motor de assessment regulatório e relatórios de evidência, evitando duplicar o registro-fonte de verdade.

## Pacote Setorial: AI Governance no Setor Financeiro

Bancos e seguradoras já operam sob um regime de governança de modelo mais antigo — SR 11-7 (EUA) — que precisa ser estendido, não substituído, para cobrir IA generativa e agentes.

| Requisito setorial | Ação de governança específica | Framework de origem |
|---|---|---|
| Inventário de modelos e tiering por materialidade | Tratar LLMs/agentes como "modelos" sujeitos a Model Risk Management (MRM); classificar por criticidade | SR 11-7 (Fed/OCC)[^17][^18] |
| Validação independente com "effective challenge" | Submeter modelos de IA a validação por parte independente da equipe de desenvolvimento, com testes de explicabilidade e robustez | SR 11-7 pilar de validação[^17] |
| Governança de dados de treino/teste | Avaliar representatividade e viés dos dados usados em modelos de crédito/score, com documentação de proveniência | EU AI Act Art. 10 (Anexo III, 5(b))[^19][^20] |
| Comitê de governança conectado à gestão de risco ICT | Integrar a governança de IA à estrutura DORA já existente, evitando processos duplicados | DORA (EU)[^20][^21] |
| Ficha de ownership Provider vs Deployer | Determinar para cada sistema se a instituição é fornecedora (construiu) ou implantadora (comprou/licenciou), pois as obrigações diferem | EU AI Act Art. 26/Anexo III[^20][^22] |

Instituições financeiras devem herdar o comitê de governança de IA da estrutura de MRM já existente (comitê de risco de modelo), acrescentando papéis específicos de IA generativa/agentic — como avaliação de explicabilidade de LLMs opacos e limites de autonomia de agentes.[^17][^23]

## Critério de "Pronto"

O programa de AI Governance está maduro quando: (1) o inventário está atualizado e é a fonte única de verdade sobre sistemas de IA; (2) toda política publicada tem dono e data de revisão; (3) o comitê registra decisões auditáveis; e (4) nenhum novo sistema entra em produção sem passar pelo gate de avaliação de risco.

---

## References

1. [Artificial Intelligence Risk Management Framework (AI RMF 1.0)](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)

2. [[PDF] Artificial Intelligence Risk Management Framework: Generative ...](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

3. [ISO 42001:2023 — Artificial Intelligence Management Systems](https://iso-library.com/standard/42001/) - The first certifiable AI management system standard (AIMS), specifying requirements for the… ISO 420...

4. [Understanding the NIST AI RMF (AI Risk Management ...](https://www.dastra.eu/en/blog/understanding-the-nist-ai-risk-management-framework/59940) - The AI RMF Core is organized into four high-level functions: GOVERN, MAP, MEASURE, and MANAGE. These...

5. [NIST AI RMF Explained: Functions, Playbook & Compliance](https://www.alation.com/blog/nist-ai-rmf/) - Learn how the NIST AI Risk Management Framework helps organizations identify, assess, and mitigate A...

6. [Core Functions: Govern, Map, Measure, Manage](https://www.ispartnersllc.com/hubs/nist-ai-rmf/core-functions/) - The AI RMF is built around four essential functions: Govern, Map, Measure, and Manage. These core fu...

7. [AI Governance Software | Solutions - OneTrust](https://www.onetrust.com/solutions/ai-governance/) - Manage AI risk, automate compliance, and enforce policy-driven controls across the AI lifecycle. One...

8. [Credo AI — API Provider, Schemas](https://apis.io/providers/credo-ai/) - Credo AI publishes 39 APIs on the APIs.io network, including Alerts API, Audit Logs API, Comment Thr...

9. [OneTrust AI - AI Governance and Privacy Compliance Platform](https://www.aistarmap.com/en-US/aitool/onetrust-ai) - OneTrust AI-Ready Governance Platform unifies AI governance, privacy compliance, data governance and...

10. [OneTrust AI Governance Features & Enterprise Use Cases](https://blog.exceeds.ai/onetrust-ai-governance-features-2026/)

11. [NIST AI Risk Management Framework (AI RMF) Explained](https://orca.security/resources/blog/nist-ai-risk-management-framework-ai-rmf/) - Part 2 presents the Core, which is structured around four primary functions: Govern; Map; Measure an...

12. [OneTrust Introduces AI Governance Solution to Inventory, Assess ...](https://www.onetrust.com/news/onetrust-introduces-ai-governance-solution/) - OneTrust AI Governance is a solution designed to help organizations inventory, assess, and monitor t...

13. [NIST AI Risk Management Framework (AI RMF)](https://www.paloaltonetworks.com/cyberpedia/nist-ai-risk-management-framework) - At its core, the NIST AI RMF is built on four functions: Govern, Map, Measure, and Manage. ... In te...

14. [ISO/IEC 42001:2023 — AI Management System](https://docs.modulos.ai/frameworks/iso-42001/index) - Practical guide to ISO/IEC 42001:2023 — the world's first international AI management system (AIMS) ...

15. [Getting Started with the Credo AI API](https://knowledge.credo.ai/getting-started-api) - The Credo AI API provides robust access to a wide range of resources for managing AI use cases, mode...

16. [Best AI Model Governance Software • November 2025](https://www.f6s.com/software/category/ai-model-governance) - Find the best AI Model Governance software of 2025. Get discounts on top-rated systems and tools bas...

17. [Finance Team's Guide to AI Model Risk Management, SR 11-7](https://www.kognitos.com/blog/finance-team-guide-ai-model-risk-management-sr-11-7-2026/) - SR 11-7 was written for static models. AI is dynamic and probabilistic. Here is a 6-step guide to ma...

18. [[PDF] Model Risk Management for Generative AI In Financial Institutions](https://arxiv.org/pdf/2503.15668.pdf)

19. [[PDF] AI Act: key measures and implications for financial services | Eurofi](https://www.eurofi.net/wp-content/uploads/2024/12/ii.2-ai-act-key-measures-and-implications-for-financial-services.pdf)

20. [EU AI Act in the Financial Sector: Banks, Insurers, and Credit ...](https://www.regulation-ai.eu/en/financial-sector/) - Banks, insurers, asset managers, and payment institutions face EU AI Act obligations layered on top ...

21. [DORA AI Compliance for Banking: What the Operational ...](https://www.deepinspect.ai/blog/industries-finance) - DORA took effect January 2025 across the EU financial sector and overlaps with the EU AI Act on the ...

22. [Recent developments on the interplay between AI and ...](https://www.twobirds.com/en/insights/2026/recent-developments-on-the-interplay-between-ai-and-financial-institutions)

23. [Managing Artificial Intelligence-Specific Cybersecurity Risks in the Financial Services Sector](https://home.treasury.gov/system/files/136/Managing-Artificial-Intelligence-Specific-Cybersecurity-Risks-In-The-Financial-Services-Sector.pdf)

