## Objetivo da Trilha

AI Security responde à pergunta "o que pode nos atacar?" — protegendo modelos, dados e infraestrutura contra uma superfície de ameaça que a segurança tradicional nunca precisou modelar: prompt injection, data poisoning, roubo de modelo e extração de dados sensíveis. Este template é autônomo e cobre triagem, ações por camada de ataque, mapeamento ao ciclo Measure/Manage do NIST AI RMF, exemplos de ferramentas e um pacote setorial financeiro.[^1][^2]

## Mapeamento ao NIST AI RMF (foco Measure/Manage) e ao NIST Cyber AI Profile

Segurança de IA se apoia principalmente nas funções Measure e Manage do AI RMF, complementadas pelo NIST Cyber AI Profile, que estende o CSF 2.0 para cobrir a superfície de ataque específica de IA.[^3][^1]

| Função/Perfil | Foco | Ação concreta | Ferramenta/técnica de apoio |
|---|---|---|---|
| Map (contexto de ameaça) | Identificar dependências de terceiros e superfícies expostas (MCP, RAG, tool-calling)[^4] | Mapear todos os pontos onde o sistema processa input não confiável | Diagrama de fluxo de dados/threat model por sistema |
| Measure — testes de robustez | Avaliar validade, segurança e robustez contra ataques adversariais[^4][^5] | Rodar red teaming automatizado contra OWASP Top 10 for LLM Applications antes do deploy | Scanners de vulnerabilidade (probes de jailbreak, encoding attacks)[^6][^7][^8] |
| Measure — monitoramento contínuo | Rastrear riscos existentes e emergentes em produção[^9] | Implementar guardrails de runtime para bloquear/alertar sobre injeção e exfiltração | Gateways de segurança para tráfego LLM (proxy/plugin de guardrails)[^10][^11] |
| Manage — resposta a incidentes | Planos documentados de resposta, recuperação e comunicação[^9] | Alinhar SLA interno de resposta ao prazo regulatório de notificação | Playbook de incidente + procedimento de notificação (CRA)[^12][^13] |
| Cyber AI Profile (CSF 2.0 + IA) | Priorizar controles AI-específicos sobre a base CSF 2.0[^1] | Adaptar controles de Identify/Protect/Detect/Respond/Recover para incluir ativos de IA | Extensão do programa de segurança da informação existente |

## Fase 1 — Triagem (Discovery)

- Os agentes/LLMs processam conteúdo não confiável (documentos, e-mails, páginas web, saídas de ferramentas/MCP)?[^2]
- Existe teste adversarial (red teaming) formal antes de ir a produção?[^1][^2]
- Há monitoramento de runtime para detectar jailbreak, exfiltração de dados ou uso indevido de ferramentas?[^10]
- O produto/empresa está no escopo do EU Cyber Resilience Act (CRA)?[^12][^13]
- Existe inventário de servidores MCP, skills e integrações de agentes expostos?[^2]

## Fase 2 — Ações Concretas por Camada de Ataque

| Camada de risco | Ação concreta | Entregável | Prazo típico |
|---|---|---|---|
| Prompt injection direta/indireta | Rodar red teaming automatizado contra OWASP Top 10 for LLM Applications antes do deploy[^6][^8] | Relatório de red teaming + backlog de mitigação | 3-6 semanas por release |
| Exfiltração de dados/PII | Implementar guardrails de runtime (filtros de saída, detecção de PII, canary tokens)[^10][^14] | Camada de proteção runtime ativa | 4-8 semanas |
| Roubo/extração de modelo | Testar contra scanners de vulnerabilidade (jailbreak, encoding attacks)[^7][^2] | Relatório de varredura de vulnerabilidade | Contínuo/trimestral |
| Ataques a agentes/MCP | Testar servidores MCP, skills e infraestrutura de agentes contra abuso de ferramentas[^2] | Relatório de segurança de agentes/MCP | 4-6 semanas |
| Resposta a incidentes/CRA | Alinhar processo ao NIST Cyber AI Profile e, se aplicável, ao prazo de 24h/72h do CRA[^12][^13] | Playbook de resposta a incidentes de IA | 4-8 semanas |

## Exemplos de Software e Integrações de Mercado

O ecossistema de AI Security se divide em três camadas: (1) red teaming/teste adversarial pré-produção, (2) proteção em runtime (guardrails), e (3) observabilidade contínua.

| Camada | Exemplo de ferramenta | Integrações típicas |
|---|---|---|
| Red teaming/teste adversarial | NVIDIA garak (scanner open-source, 37+ probes: prompt injection, jailbreak, data leakage)[^2][^7]; Microsoft PyRIT (orquestração multi-turno)[^2][^14]; Promptfoo (CLI CI-native, 50+ tipos de vulnerabilidade)[^15][^16] | CI/CD (GitHub Actions, pipelines de deploy), CLI standalone |
| Proteção em runtime (guardrails) | Lakera Guard — API de baixa latência que inspeta input/output de LLM e flagra prompt injection, jailbreak, PII, links maliciosos[^11][^17][^18] | Plugin nativo para LangChain (lakera-chainguard)[^19], plugin de gateway Apache APISIX[^20][^21], integração via REST API em qualquer stack |
| Observabilidade/AI TRiSM | Categoria Gartner AI TRiSM — inspeção de runtime, governança de informação, proteção de dados de IA[^10] | Correlação com SIEM existente, telemetria de modelo |
| Agentes/MCP específicos | AI-Infra-Guard (self-hosted, testa agentes, servidores MCP, skills e infraestrutura exposta)[^2] | Deploy self-hosted em ambientes regulados |

Para o stack do consultor (Python/FastMCP/LangGraph), a integração mais natural é acoplar um scanner como Promptfoo ou garak ao pipeline de CI/CD antes de cada deploy de agente, e um guardrail de runtime (ex.: Lakera Guard, ou guardrail open-source equivalente) como middleware antes da chamada ao LLM em produção, com log centralizado para auditoria.

## Pacote Setorial: AI Security no Setor Financeiro

Instituições financeiras enfrentam uma superfície de ataque combinada — fraude tradicional turbinada por IA generativa e novos vetores específicos de LLM/agentes.

| Vetor de ameaça específico do setor | Ação de segurança | Framework/fonte |
|---|---|---|
| Envenenamento de dados de modelos de crédito/fraude | Validar integridade e proveniência de dados de treino/atualização de modelos de decisão | Financial AI Security & Robustness Taxonomy[^22] |
| Prompt injection em assistentes financeiros baseados em LLM | Red teaming específico para fluxos de atendimento/consultoria com LLM antes do deploy | Tesouro dos EUA — riscos de cibersegurança específicos de IA no setor financeiro[^23] |
| Deepfake em verificação KYC/eKYC | Reforçar camadas de verificação biométrica com detecção de deepfake e liveness | Financial AI Security & Robustness Taxonomy[^22] |
| Extração de modelo via consultas iterativas | Rate limiting e monitoramento de padrões de consulta anômalos em modelos de decisão | Tesouro dos EUA — Managing AI-Specific Cybersecurity Risks[^23] |
| Engenharia social turbinada por GenAI (phishing/BEC direcionado) | Treinamento de colaboradores e controles de detecção de anomalia comportamental | Tesouro dos EUA — Managing AI-Specific Cybersecurity Risks[^23] |
| Notificação de vulnerabilidade explorada em produto digital | Preparar processo de reporte em até 24h (alerta inicial) e 72h (relatório completo) a partir de 11/set/2026 | EU Cyber Resilience Act[^12][^13] |

Bancos que usam LLMs "copiloto" enfrentam um desafio adicional de auditabilidade: esses modelos são notavelmente opacos, o que dificulta observabilidade de segurança e exige controles técnicos complementares de logging e explicabilidade.[^23]

## Critério de "Pronto"

O programa de AI Security está maduro quando: (1) todo agente/LLM em produção passou por red teaming documentado antes do go-live; (2) guardrails de runtime estão ativos e logados; (3) existe processo testado de resposta a incidente capaz de cumprir a janela regulatória de notificação (ex.: 24h/72h do CRA); e (4) servidores MCP e integrações de agentes têm inventário e teste de abuso de ferramentas recorrente.

---

## References

1. [Best AI Red Teaming and Adversarial Testing Tools in 2026](https://generalanalysis.com/guides/best-ai-red-teaming-tools) - A practical 2026 comparison of AI red teaming and adversarial testing tools across automated red tea...

2. [LLM Red Teaming: Tools, Attacks & Methodology (2026)](https://appsecsanta.com/ai-security-tools/llm-red-teaming) - LLM red teaming guide covering attack categories, manual techniques, and five open-source tools: Gar...

3. [[PDF] Artificial Intelligence Risk Management Framework: Generative ...](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)

4. [NIST AI Risk Management Framework (AI RMF) Explained](https://orca.security/resources/blog/nist-ai-risk-management-framework-ai-rmf/) - Part 2 presents the Core, which is structured around four primary functions: Govern; Map; Measure an...

5. [Understanding the NIST AI RMF (AI Risk Management ...](https://www.dastra.eu/en/blog/understanding-the-nist-ai-risk-management-framework/59940) - The AI RMF Core is organized into four high-level functions: GOVERN, MAP, MEASURE, and MANAGE. These...

6. [The OWASP Top 10 for LLM Applications (2025): Explained ...](https://securityboulevard.com/2026/03/the-owasp-top-10-for-llm-applications-2025-explained-simply/) - 6 min readThe OWASP Top 10 for LLM Applications is the most widely referenced framework for understa...

7. [Top 19 AI Red Teaming Tools (2026): Secure Your ML ...](https://www.marktechpost.com/2026/04/17/top-ai-red-teaming-tools/) - Discover the best AI red teaming tools and frameworks for 2026. Learn how to protect LLMs from promp...

8. [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/) - Discover the OWASP Top 10 for LLM Applications (2025) – essential guidance for securing large langua...

9. [Core Functions: Govern, Map, Measure, Manage](https://www.ispartnersllc.com/hubs/nist-ai-rmf/core-functions/) - The AI RMF is built around four essential functions: Govern, Map, Measure, and Manage. These core fu...

10. [AI Trust and AI Risk: Tackling Trust, Risk and Security in AI Models](https://www.gartner.com/en/articles/ai-trust-and-ai-risk) - AI TRiSM is a framework to proactively manage AI risks, like the six highlighted risks here, that AI...

11. [Guard API Endpoint | Check Point AI Security - Lakera Docs](https://docs.lakera.ai/docs/api/guard) - The /v2/guard API endpoint is the integration point for LLM based applications using Check Point AI ...

12. [Cyber Resilience Act - Reporting obligations](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting) - As of 11 September 2026, manufacturers are required to report actively exploited vulnerabilities and...

13. [The EU CRA Will Make You Report What It Hasn't Yet ...](https://thehackernews.com/expert-insights/2026/08/the-eu-will-make-you-report-what-it.html) - EU Cyber Resilience Act reporting starts Sept. 11, requiring exploited vulnerability notices 15 mont...

14. [1 Background](https://arxiv.org/html/2605.11868v1)

15. [9 Best AI Red Teaming Tools for LLMs in 2026 - TestMu AI](https://www.testmuai.com/blog/ai-red-teaming-tools/) - Compare the 9 best AI red teaming tools for LLMs in 2026, from open-source scanners to managed platf...

16. [Top 5 AI Red Team Tools (2026): Compared & Reviewed](https://aicompliancevendors.com/best/ai-red-team-tools) - Independent ranking of 5 AI red team and LLM security testing tools. Verified features, vulnerabilit...

17. [Screen content for threats | Check Point AI Security](https://docs.lakera.ai/api-reference/lakera-api/guard/screen-content) - The guard API endpoint is the integration point for GenAI applications using AI Guardrails.

18. [Lakera Guard — Documentation, OpenAPI](https://apis.io/apis/lakera/lakera-guard/) - Lakera Guard. Lakera Guard is a low-latency screening API that inspects text content sent to or from...

19. [chainguard/README.md at main · lakeraai/chainguard](https://github.com/lakeraai/chainguard/blob/main/README.md) - Guard your LangChain applications against prompt injection with Lakera ChainGuard. - lakeraai/chaing...

20. [ai-lakera-guard - Apache APISIX](https://apisix.apache.org/docs/apisix/plugins/ai-lakera-guard/) - The ai-lakera-guard Plugin integrates Apache APISIX with the Lakera Guard API (v2) to scan LLM reque...

21. [ai-lakera-guard | Apache APISIX](https://apisix.apache.org/docs/apisix/next/plugins/ai-lakera-guard/) - The ai-lakera-guard Plugin integrates Apache APISIX with the Lakera Guard API (v2) to scan LLM reque...

22. [A Survey on Trustworthy AI in Fintech](https://arxiv.org/pdf/2605.30650.pdf)

23. [Managing Artificial Intelligence-Specific Cybersecurity Risks in the Financial Services Sector](https://home.treasury.gov/system/files/136/Managing-Artificial-Intelligence-Specific-Cybersecurity-Risks-In-The-Financial-Services-Sector.pdf)

