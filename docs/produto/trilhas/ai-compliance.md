## Objetivo da Trilha

AI Compliance responde à pergunta "podemos provar isso a um auditor ou regulador?" — garantindo que sistemas de IA atendam requisitos legais com prazos reais e produzindo evidências auditáveis: trilhas de auditoria, avaliações de conformidade e obrigações transfronteiriças de dados. Este template é autônomo e cobre triagem, ações por obrigação regulatória, mapeamento ao ciclo Govern/Map do NIST AI RMF, exemplos de ferramentas e um pacote setorial financeiro.[^1][^2]

## Mapeamento ao NIST AI RMF (foco Govern/Map) e à Certificação ISO/IEC 42001

Compliance de IA se apoia em documentar decisões (Govern) e caracterizar o sistema para fins regulatórios (Map), convertendo isso em evidência auditável via ISO/IEC 42001.[^3][^4]

| Função/Norma | Foco | Ação concreta | Ferramenta/documento de apoio |
|---|---|---|---|
| Govern 1.1 | Requisitos legais e regulatórios entendidos, gerenciados e documentados[^5] | Mapear quais regulações se aplicam a cada sistema (EU AI Act, GDPR, setoriais) | Matriz de aplicabilidade regulatória por sistema |
| Map 1.1 | Propósitos, contexto legal e configurações de uso documentados[^5] | Documentar caso de uso, base legal e classificação de risco de cada sistema | Ficha de registro de sistema de IA (AI system record) |
| ISO 42001 Cláusula 6 | Avaliação de risco de IA e impacto em indivíduos/sociedade[^4][^6] | Conduzir AI System Impact Assessment (AISIA) para sistemas de alto risco | Template de AISIA |
| ISO 42001 Anexo A | 38 controles de referência organizados em 9 objetivos[^4][^7] | Selecionar controles aplicáveis e justificar exclusões | Statement of Applicability (SoA) |
| ISO 42001 Cláusula 9 | Monitoramento, auditoria interna e revisão gerencial[^4] | Agendar auditorias internas semestrais e revisão de não conformidades | Relatório de auditoria interna |

## Fase 1 — Triagem (Discovery)

- A empresa oferece ou usa modelos de propósito geral (GPAI) ou sistemas de alto risco sob o EU AI Act?[^2][^1]
- Existem obrigações de transparência (Artigo 50) para sistemas que interagem com pessoas ou geram conteúdo sintético?[^8]
- Há documentação técnica, avaliação de conformidade e registro em base de dados da UE para sistemas de alto risco?[^2]
- Existe trilha de auditoria (logs, decisões documentadas, versionamento de modelo) recuperável para um auditor externo?[^4]

## Fase 2 — Ações Concretas por Obrigação Regulatória

| Obrigação | Ação concreta | Entregável | Prazo/gatilho |
|---|---|---|---|
| GPAI (EU AI Act, Cap. V) | Reunir documentação técnica de treinamento, política de direitos autorais e sumário de dados de treino[^2] | Dossiê técnico de conformidade GPAI | Obrigações em vigor desde 2/ago/2025; multas ativas desde 2/ago/2026[^1][^9] |
| Transparência (Art. 50) | Implementar marcação legível por máquina para conteúdo sintético e disclosure de interação com IA | Procedimento de rotulagem/transparência | Em vigor desde 2/ago/2026, com período de transição até 2/dez/2026 para sistemas já no mercado[^1][^8] |
| Sistemas de alto risco (Anexo III/I) | Preparar avaliação de conformidade, registro na base de dados da UE e supervisão humana | Relatório de Avaliação de Conformidade | Anexo III: 2/dez/2027; Anexo I: 2/ago/2028[^1][^10] |
| Governança de evidências | Certificar (ou alinhar a) ISO/IEC 42001 com Statement of Applicability | SoA + evidências de auditoria | 3-6 meses para preparação; certificação com auditoria em 2 estágios[^4] |
| Dados transfronteiriços | Mapear fluxos de dados internacionais usados por modelos/agentes | Mapa de fluxo de dados internacional | Contínuo |

## Exemplos de Software e Integrações de Mercado

O mercado de AI Compliance se apoia nas mesmas plataformas de GRC/governança, mas com foco em automação de evidências e mapeamento regulatório contínuo.

| Categoria | Exemplo de ferramenta | Integrações típicas |
|---|---|---|
| Automação de compliance regulatório | OneTrust AI Governance — templates prontos EU AI Act/NIST/ISO 42001, geração automática de avaliações de conformidade e documentação[^11][^12][^13] | Databricks Unity Catalog, ServiceNow, Jira, Salesforce via REST API[^14] |
| Registro de evidências e trilha de auditoria | Credo AI — Audit Logs API, Policy Controls API, geração de relatórios de conformidade por caso de uso[^15] | SDK Python/TypeScript, MCP server para agentes[^15] |
| Model risk/lifecycle com relatórios auditor-grade | ModelOp Center — captura de artefatos e evidências, relatórios auditor-grade e model cards automatizados[^16] | Integração com registries de modelo e pipelines MLOps |
| Compliance especializado em IA regulatória (fintech) | PRISM (Block Convey) — automação de compliance para fintech/insurtech, fairness e explicabilidade[^16] | Foco em setor financeiro/segurador |

Para o consultor, a via mais eficiente é usar o próprio AI Asset Registry (construído na trilha de Governance) como fonte de verdade e conectar módulos de compliance (OneTrust, Credo AI) apenas para gerar o pacote de evidência regulatório e o Statement of Applicability, evitando duplicidade de cadastro entre trilhas.

## Pacote Setorial: AI Compliance no Setor Financeiro

O setor financeiro acumula camadas regulatórias sobre IA — EU AI Act, DORA, SR 11-7 (EUA), GDPR — que exigem evidências específicas, não apenas políticas.

| Obrigação setorial | Ação de compliance específica | Framework de origem |
|---|---|---|
| Classificação de alto risco para crédito/score | Classificar todo sistema de credit scoring/creditworthiness como alto risco (Anexo III, 5(b)), exceto detecção pura de fraude | EU AI Act Anexo III[^17][^18][^10] |
| Classificação de alto risco para seguros de vida/saúde | Classificar modelos de pricing de risco de seguro de vida/saúde como alto risco (Anexo III, 5(c)) | EU AI Act Anexo III[^17][^19] |
| Registro em base de dados da UE | Registrar sistemas de alto risco antes do deployment, com documentação técnica completa (Anexo IV) | EU AI Act Art. 71[^20][^21] |
| Registro de decisão por 6 meses mínimo | Manter logs detalhados (período de uso, bases de dados consultadas, dados de entrada, verificação humana) por ao menos 6 meses | EU AI Act Art. 12/19[^21] |
| Avaliação de impacto em direitos fundamentais | Conduzir Fundamental Rights Impact Assessment (FRIA) para sistemas de alto risco usados por instituições financeiras | EU AI Act Art. 27[^17][^10] |
| Integração com resiliência operacional digital | Conectar obrigações de compliance de IA à estrutura DORA já existente (gestão de risco ICT, terceiros) | DORA[^21][^20] |
| Validação independente de modelo (MRM) | Estender o programa de model risk management (SR 11-7) para cobrir GenAI/LLMs com evidência de validação independente | SR 11-7 (Fed/OCC)[^22][^23][^24] |
| Determinar papel Provider vs Deployer | Documentar formalmente se a instituição é fornecedora (desenvolveu) ou implantadora (comprou/licenciou) para cada sistema, pois as obrigações diferem | EU AI Act Art. 26[^20][^25] |

O calendário-chave do setor financeiro combina deadlines gerais do EU AI Act com deadlines específicos: obrigações de alto risco para crédito e seguro (Anexo III) foram diferidas para 2 de dezembro de 2027 pelo Digital Omnibus, enquanto as multas de GPAI já estão ativas desde 2 de agosto de 2026. Penalidades por não conformidade em sistemas de alto risco chegam a €15 milhões ou 3% do faturamento global, separadas das penalidades já existentes de DORA e GDPR.[^17][^18][^10][^1]

## Critério de "Pronto"

O programa de AI Compliance está maduro quando: (1) todo sistema de IA tem classificação de risco documentada e papel (provider/deployer) definido; (2) documentação técnica e avaliações de conformidade estão prontas para inspeção; (3) trilha de auditoria (logs, decisões, versionamento) é recuperável a qualquer momento; e (4) o calendário de deadlines regulatórios (setoriais e gerais) está monitorado ativamente com donos designados.

---

## References

1. [EU AI Act August 2026: GPAI Enforcement and Article 50 ...](https://kla.digital/blog/eu-ai-act-august-2026-what-still-applies)

2. [EU AI Act Summary: Complete Guide 2026 & PDF Available](https://euaiactguide.com/eu-ai-act-summary-2026/) - Comprehensive and easy to understand ultimate EU AI Act Summary. We cover all vital compliance point...

3. [Artificial Intelligence Risk Management Framework (AI RMF 1.0)](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)

4. [ISO 42001 Explained: The AI Management System Standard](https://systemprompt.io/guides/iso-42001-ai-management-system) - ISO 42001 is the AI management system standard. Understand its clauses, the 38 Annex A controls, the...

5. [[PDF] Artificial Intelligence Risk Management Framework: Generative ...](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

6. [ISO/IEC 42001:2023 - AI Management System - VerifyWise](https://verifywise.ai/ai-governance-library/standards-and-certifications/iso-42001-ai-management-system)

7. [ISO/IEC 42001 (AI Management) - CyberSigma Consulting Services](https://cybersigmacs.com/knowledge-center/iso-42001/) - CyberSigma is a CERT-In empanelled cybersecurity auditor and PCI QSA company delivering audits, VAPT...

8. [Innovation Law Insights - 6 August 2026](https://www.dlapiper.com/en/insights/publications/innovation-law-insights/2026/innovation-law-insights-6-august-2026) - Innovation and law: This Week's News

9. [EU AI Act 2026: GPAI Enforcement & 3% Fines Begin - Beam AI](https://beam.ai/agentic-insights/eu-ai-act-enforcement-august-2-2026-gpai-fines) - On Aug 2, 2026, EU AI Act enforcement powers over GPAI providers go live: 3% fines, evaluations, and...

10. [AI Act for Financial Services Compliance - legalithm.com](https://www.legalithm.com/en/blog/ai-act-financial-services-banking-insurance-compliance) - EU AI Act compliance guide for banking, insurance, and fintech. Credit scoring, insurance pricing, f...

11. [AI Governance Software | Solutions - OneTrust](https://www.onetrust.com/solutions/ai-governance/) - Manage AI risk, automate compliance, and enforce policy-driven controls across the AI lifecycle. One...

12. [OneTrust AI Governance Features & Enterprise Use Cases](https://blog.exceeds.ai/onetrust-ai-governance-features-2026/)

13. [OneTrust Introduces AI Governance Solution to Inventory, Assess ...](https://www.onetrust.com/news/onetrust-introduces-ai-governance-solution/) - OneTrust AI Governance is a solution designed to help organizations inventory, assess, and monitor t...

14. [OneTrust AI - AI Governance and Privacy Compliance Platform](https://www.aistarmap.com/en-US/aitool/onetrust-ai) - OneTrust AI-Ready Governance Platform unifies AI governance, privacy compliance, data governance and...

15. [Credo AI — API Provider, Schemas](https://apis.io/providers/credo-ai/) - Credo AI publishes 39 APIs on the APIs.io network, including Alerts API, Audit Logs API, Comment Thr...

16. [Best AI Model Governance Software • November 2025](https://www.f6s.com/software/category/ai-model-governance) - Find the best AI Model Governance software of 2025. Get discounts on top-rated systems and tools bas...

17. [EU AI Act for Financial Services (2027) — banks, lending, credit ...](https://www.regulatoryai.eu/ai-financial-services/) - Credit scoring is high-risk (Annex III 5(b)); life & health insurance pricing is 5(c); fraud detecti...

18. [EU AI Act: Financial Services AI Compliance - Regumatrix](https://regumatrix.eu/compliance/financial-services) - Credit scoring and financial decision AI is high-risk under the EU AI Act. What fintechs, banks, and...

19. [[PDF] AI Act: key measures and implications for financial services | Eurofi](https://www.eurofi.net/wp-content/uploads/2024/12/ii.2-ai-act-key-measures-and-implications-for-financial-services.pdf)

20. [EU AI Act in the Financial Sector: Banks, Insurers, and Credit ...](https://www.regulation-ai.eu/en/financial-sector/) - Banks, insurers, asset managers, and payment institutions face EU AI Act obligations layered on top ...

21. [DORA AI Compliance for Banking: What the Operational ...](https://www.deepinspect.ai/blog/industries-finance) - DORA took effect January 2025 across the EU financial sector and overlaps with the EU AI Act on the ...

22. [SR 11-7 in the Age of Agentic AI: Where the Framework ...](https://www.garp.org/risk-intelligence/operational/sr-11-7-age-agentic-ai-260227) - Amid rapid tech change, U.S. model risk guidance remains a key anchor, making clarity on its scope a...

23. [AI Compliance Requirements for Financial Services Firms - Kiteworks](https://www.kiteworks.com/regulatory-compliance/ai-compliance-financial-services-firms/) - Financial services firms deploying AI face one of the most demanding regulatory environments in any ...

24. [Finance Team's Guide to AI Model Risk Management, SR 11-7](https://www.kognitos.com/blog/finance-team-guide-ai-model-risk-management-sr-11-7-2026/) - SR 11-7 was written for static models. AI is dynamic and probabilistic. Here is a 6-step guide to ma...

25. [Recent developments on the interplay between AI and ...](https://www.twobirds.com/en/insights/2026/recent-developments-on-the-interplay-between-ai-and-financial-institutions)

