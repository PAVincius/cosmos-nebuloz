// regulacao-corpora.ts — dado puro dos quatro corpora globais de regulação
// (EU AI Act, LGPD, NIST AI RMF 1.0, ISO/IEC 42001).
//
// Separado de seed-regulacao.mts de propósito: um arquivo `.ts` comum resolve
// sem extensão sob "moduleResolution": "Bundler" (packages/typescript-config/
// nextjs.json), igual a packages/rbac/src/matrix — então tanto o seed quanto
// o teste de guarda de copyright importam daqui sem precisar da extensão
// literal ".mts" no specifier, que o tsc rejeita fora de
// allowImportingTsExtensions (TS5097). Ganho colateral: o teste de copyright
// passa a inspecionar só dado, sem carregar Pool/PrismaClient do seed.
//
// Regulação é um conjunto de exigências publicado pela Nebuloz, estruturalmente
// idêntico à RFP de um cliente (design_handoff_charter/DATA-MODEL.md §1): o
// tenant mapeia sua evidência uma vez e responde às duas com o mesmo trabalho.

export type RequirementSeed = {
  codigo: string;
  citacao: string;
  /** Área da tabela de §Áreas do documento-fonte, quando o corpus tiver uma. */
  categoria?: string;
  resumo: string;
  /**
   * Ausente — não `undefined` explícito, a chave inteira some do objeto — nos
   * quatro corpora regulatórios (EU AI Act, LGPD, NIST AI RMF, ISO/IEC 42001).
   * Para ISO/IEC 42001 (REFERENCIA) é a regra: norma proprietária só entra por
   * citação e formulação própria (ver licenca-copyright.test.ts). Para os
   * outros três (LIVRE) texto também fica ausente, e não por limitação de
   * licença: nenhuma citação daqueles corpora foi conferida palavra por
   * palavra contra a fonte oficial, e um campo "texto" que não é de fato
   * verbatim é pior do que não ter texto nenhum. citacao + resumo já bastam
   * para o tenant mapear evidência; texto pode ser adicionado depois,
   * requisito a requisito, pela própria tela de conformidade, quando alguém
   * conferir a redação exata contra a publicação oficial.
   *
   * O corpus "Segurança em IA generativa — checklist Nebuloz" é diferente: a
   * fonte é docs/security/checklist-ia-generativa.md, documento da própria
   * Nebuloz neste repositório, não norma de terceiro. Ali texto é de fato
   * verbatim — copiado do documento-fonte — e reproduzir é legítimo e útil: o
   * comprador lê a exigência inteira no export, não só um resumo dela.
   */
  texto?: string;
};

export type CorpusSeed = {
  nome: string;
  origem: "REGULACAO";
  editor: "NEBULOZ";
  jurisdicao: string;
  licenca: "LIVRE" | "REFERENCIA";
  versao: string;
  notas: string;
  requisitos: RequirementSeed[];
};

export const CORPORA: CorpusSeed[] = [
  {
    nome: "EU AI Act — sistemas de alto risco",
    origem: "REGULACAO",
    editor: "NEBULOZ",
    jurisdicao: "UE",
    licenca: "LIVRE",
    versao: "2024/1689",
    notas:
      "Regulamento (UE) 2024/1689, Capítulo III Secção 2 — requisitos para sistemas de IA de alto risco, Arts. 9 a 15.",
    requisitos: [
      {
        codigo: "AIA-09",
        citacao: "Regulamento (UE) 2024/1689, Art. 9",
        resumo:
          "Exige que o fornecedor mantenha um processo contínuo de gestão de risco ao longo de todo o ciclo de vida do sistema de alto risco — identificação, estimativa, avaliação e mitigação dos riscos conhecidos e razoavelmente previsíveis à saúde, segurança e direitos fundamentais.",
      },
      {
        codigo: "AIA-10",
        citacao: "Regulamento (UE) 2024/1689, Art. 10",
        resumo:
          "Exige práticas de governança sobre os conjuntos de dados de treino, validação e teste — critérios de relevância, representatividade e exame de possíveis vieses capazes de afetar pessoas ou grupos.",
      },
      {
        codigo: "AIA-11",
        citacao: "Regulamento (UE) 2024/1689, Art. 11",
        resumo:
          "Exige documentação técnica elaborada antes da colocação no mercado e mantida atualizada, suficiente para demonstrar conformidade e permitir que a autoridade competente avalie o sistema.",
      },
      {
        codigo: "AIA-12",
        citacao: "Regulamento (UE) 2024/1689, Art. 12",
        resumo:
          "Exige capacidade técnica de registro automático de eventos (logs) durante o funcionamento do sistema, com nível de rastreabilidade adequado ao longo do ciclo de vida.",
      },
      {
        codigo: "AIA-13",
        citacao: "Regulamento (UE) 2024/1689, Art. 13",
        resumo:
          "Exige que o sistema seja suficientemente transparente e acompanhado de instruções de uso que permitam ao implementador interpretar a saída e operar o sistema de forma adequada.",
      },
      {
        codigo: "AIA-14",
        citacao: "Regulamento (UE) 2024/1689, Art. 14",
        resumo:
          "Exige que o sistema seja projetado para permitir supervisão humana efetiva durante o uso, incluindo meios para a pessoa supervisora intervir ou interromper o funcionamento.",
      },
      {
        codigo: "AIA-15",
        citacao: "Regulamento (UE) 2024/1689, Art. 15",
        resumo:
          "Exige níveis apropriados de exatidão, robustez e cibersegurança ao longo do ciclo de vida, incluindo resiliência a erros, falhas e tentativas de manipulação do sistema ou dos dados.",
      },
    ],
  },
  {
    nome: "LGPD — tratamento e decisão automatizada",
    origem: "REGULACAO",
    editor: "NEBULOZ",
    jurisdicao: "BR",
    licenca: "LIVRE",
    versao: "13.709/2018",
    notas:
      "Lei nº 13.709/2018 — princípios, direitos do titular, decisão automatizada e obrigações do controlador, Arts. 6º, 18, 20, 37 e 38.",
    requisitos: [
      {
        codigo: "LGPD-ART6",
        citacao: "LGPD (Lei 13.709/2018), Art. 6º",
        resumo:
          "Estabelece os princípios que devem orientar toda atividade de tratamento de dados pessoais — entre eles finalidade, adequação, necessidade, transparência, segurança e prestação de contas — como parâmetro para avaliar a conformidade de qualquer operação de tratamento.",
      },
      {
        codigo: "LGPD-ART18",
        citacao: "LGPD (Lei 13.709/2018), Art. 18",
        resumo:
          "Lista os direitos do titular perante o controlador — confirmação da existência de tratamento, acesso, correção, anonimização ou eliminação de dados desnecessários, portabilidade e revogação do consentimento, entre outros — exercíveis mediante requisição.",
      },
      {
        codigo: "LGPD-ART20",
        citacao: "LGPD (Lei 13.709/2018), Art. 20",
        resumo:
          "Garante ao titular o direito de solicitar revisão de decisões tomadas unicamente com base em tratamento automatizado de dados pessoais que afetem seus interesses, incluindo decisões que definam perfil pessoal, profissional, de consumo ou de crédito.",
      },
      {
        codigo: "LGPD-ART37",
        citacao: "LGPD (Lei 13.709/2018), Art. 37",
        resumo:
          "Exige que controlador e operador mantenham registro das operações de tratamento de dados pessoais realizadas, em especial quando o tratamento tiver por base o legítimo interesse.",
      },
      {
        codigo: "LGPD-ART38",
        citacao: "LGPD (Lei 13.709/2018), Art. 38",
        resumo:
          "Prevê que a autoridade nacional possa exigir do controlador relatório de impacto à proteção de dados pessoais, descrevendo os processos de tratamento capazes de gerar risco a liberdades civis e a direitos fundamentais.",
      },
    ],
  },
  {
    nome: "NIST AI RMF 1.0",
    origem: "REGULACAO",
    editor: "NEBULOZ",
    jurisdicao: "US",
    licenca: "LIVRE",
    versao: "1.0",
    notas:
      'NIST AI Risk Management Framework 1.0 (jan/2023) — as quatro funções centrais: GOVERN, MAP, MEASURE, MANAGE. Citação no nível de função, não de subcategoria: não temos confiança na numeração fina (ex. "MAP 2.3") para citar sem checagem.',
    requisitos: [
      {
        codigo: "NIST-GOVERN-1",
        citacao: "NIST AI RMF 1.0 — Função GOVERN",
        resumo:
          "Exige estruturas de governança, políticas e responsabilidades organizacionais para a gestão de risco de IA, com papéis definidos e prestação de contas ao longo de todo o ciclo de vida do sistema.",
      },
      {
        codigo: "NIST-GOVERN-2",
        citacao: "NIST AI RMF 1.0 — Função GOVERN",
        resumo:
          "Exige que os processos de gestão de risco de IA se integrem à governança corporativa já existente, com supervisão e mecanismo de engajamento de partes interessadas internas e externas.",
      },
      {
        codigo: "NIST-MAP-1",
        citacao: "NIST AI RMF 1.0 — Função MAP",
        resumo:
          "Exige o mapeamento do contexto de uso do sistema de IA — objetivo, partes impactadas e requisitos legais e regulatórios aplicáveis — como base para identificar os riscos específicos daquele caso de uso.",
      },
      {
        codigo: "NIST-MAP-2",
        citacao: "NIST AI RMF 1.0 — Função MAP",
        resumo:
          "Exige a categorização do sistema de IA e de seus componentes (dados, modelo, integração) para identificar benefícios e riscos potenciais antes e durante o desenvolvimento.",
      },
      {
        codigo: "NIST-MEASURE-1",
        citacao: "NIST AI RMF 1.0 — Função MEASURE",
        resumo:
          "Exige análise, avaliação e monitoramento contínuo dos riscos de IA identificados, por métodos quantitativos, qualitativos ou mistos, incluindo testes de desempenho e de dano potencial.",
      },
      {
        codigo: "NIST-MEASURE-2",
        citacao: "NIST AI RMF 1.0 — Função MEASURE",
        resumo:
          "Exige o rastreamento de métricas de risco ao longo do tempo, de forma a sustentar comparação entre versões do sistema e detectar degradação de desempenho.",
      },
      {
        codigo: "NIST-MANAGE-1",
        citacao: "NIST AI RMF 1.0 — Função MANAGE",
        resumo:
          "Exige que os riscos mapeados e medidos sejam priorizados e tratados com alocação de recursos proporcional à sua gravidade, incluindo mitigação ou aceitação formal do risco residual.",
      },
      {
        codigo: "NIST-MANAGE-2",
        citacao: "NIST AI RMF 1.0 — Função MANAGE",
        resumo:
          "Exige planos de resposta a incidentes e de recuperação para sistemas de IA implantados, incluindo comunicação a partes afetadas quando um risco se materializa.",
      },
    ],
  },
  {
    nome: "ISO/IEC 42001 — objetivos de controle",
    origem: "REGULACAO",
    editor: "NEBULOZ",
    jurisdicao: "INT",
    licenca: "REFERENCIA",
    versao: "2023",
    notas:
      "ISO/IEC 42001:2023 — norma proprietária. Segue a estrutura harmonizada Annex SL comum aos sistemas de gestão ISO (idêntica em número e tema à da ISO/IEC 27001, por exemplo), Cláusulas 4 a 10. Resumo é formulação própria; nenhuma cláusula é citada literalmente — ver licenca-copyright.test.ts.",
    requisitos: [
      {
        codigo: "ISO-CL04",
        citacao: "ISO/IEC 42001:2023, Cláusula 4",
        resumo:
          "Exige que a organização determine questões internas e externas relevantes ao seu propósito, identifique partes interessadas e suas expectativas quanto ao uso responsável de IA, e defina o escopo do sistema de gestão de IA a partir desse contexto.",
      },
      {
        codigo: "ISO-CL05",
        citacao: "ISO/IEC 42001:2023, Cláusula 5",
        resumo:
          "Exige comprometimento da alta direção com o sistema de gestão de IA, o estabelecimento de uma política de IA alinhada aos objetivos da organização, e a atribuição clara de papéis, responsabilidades e autoridades.",
      },
      {
        codigo: "ISO-CL06",
        citacao: "ISO/IEC 42001:2023, Cláusula 6",
        resumo:
          "Exige que a organização identifique riscos e oportunidades relacionados a IA — incluindo impactos potenciais sobre indivíduos e grupos — e estabeleça objetivos mensuráveis e planos concretos para alcançá-los.",
      },
      {
        codigo: "ISO-CL07",
        citacao: "ISO/IEC 42001:2023, Cláusula 7",
        resumo:
          "Exige recursos, competência, conscientização, comunicação e documentação suficientes para operar e manter o sistema de gestão de IA.",
      },
      {
        codigo: "ISO-CL08",
        citacao: "ISO/IEC 42001:2023, Cláusula 8",
        resumo:
          "Exige planejamento e controle operacional dos processos ligados ao ciclo de vida dos sistemas de IA, incluindo o relacionamento com fornecedores e terceiros envolvidos no desenvolvimento ou fornecimento de componentes de IA.",
      },
      {
        codigo: "ISO-CL09",
        citacao: "ISO/IEC 42001:2023, Cláusula 9",
        resumo:
          "Exige monitoramento, medição, análise e avaliação periódica do desempenho do sistema de gestão de IA, incluindo auditoria interna e análise crítica pela direção.",
      },
      {
        codigo: "ISO-CL10",
        citacao: "ISO/IEC 42001:2023, Cláusula 10",
        resumo:
          "Exige tratamento de não conformidades, ações corretivas e melhoria contínua do sistema de gestão de IA ao longo do tempo.",
      },
    ],
  },
  {
    nome: "Segurança em IA generativa — checklist Nebuloz",
    origem: "REGULACAO",
    editor: "NEBULOZ",
    jurisdicao: "INT",
    licenca: "LIVRE",
    versao: "1",
    notas:
      "Síntese sobre OWASP LLM Top 10 2025, checklist OWASP de governança de IA " +
      "e Secure AI Model Ops. Fonte: docs/security/checklist-ia-generativa.md — " +
      "mudou lá, versione aqui com publishSetVersion em vez de editar no lugar.",
    requisitos: [
      {
        codigo: "SEC-1-1",
        citacao: "§1",
        categoria: "arquitetura",
        resumo:
          "Inventariar todos os componentes de IA do sistema e definir as fronteiras de confiança entre frontend, backend, provedor de modelo e dados corporativos.",
        texto:
          "Mapear todos os componentes de IA (API de LLM, RAG, agentes, orquestradores, workers assíncronos, filas, vetores, storage de contexto) e definir trust boundaries entre frontend, backend, provedor de modelo e dados corporativos.",
      },
      {
        codigo: "SEC-1-2",
        citacao: "§1",
        categoria: "arquitetura",
        resumo:
          "Executar threat modeling específico de LLM com base no OWASP LLM Top 10 2025 e em STRIDE/MITRE ATLAS.",
        texto:
          "Rodar threat modeling específico de LLM usando OWASP LLM Top 10 2025 (LLM01–LLM10) e STRIDE/MITRE ATLAS.",
      },
      {
        codigo: "SEC-1-3",
        citacao: "§1",
        categoria: "arquitetura",
        resumo:
          "Classificar as integrações de agente e tool use por nível de risco, aplicando privilégio mínimo e defesa em profundidade.",
        texto:
          "Classificar as integrações de agente e tool use — ferramentas que escrevem em banco, chamam ERP, disparam email — e aplicar privilégio mínimo e defesa em profundidade.",
      },
      {
        codigo: "SEC-1-4",
        citacao: "§1",
        categoria: "arquitetura",
        resumo:
          "Documentar em diagrama onde vivem os prompts de sistema, seu versionamento e a proteção contra vazamento (LLM07).",
        texto:
          "Documentar em diagrama onde vivem os prompts de sistema, como são versionados e como são protegidos contra leakage (LLM07).",
      },
      {
        codigo: "SEC-2-1",
        citacao: "§2",
        categoria: "dados",
        resumo:
          "Classificar por sensibilidade todo dado que pode entrar em prompt, contexto de RAG ou log.",
        texto:
          "Classificar todo dado que pode entrar em prompt, contexto de RAG e log: PII, sensível, confidencial corporativo, público.",
      },
      {
        codigo: "SEC-2-2",
        citacao: "§2",
        categoria: "dados",
        resumo:
          "Definir e formalizar em contrato a política de uso de dado de entrada e saída pelo provedor de LLM, incluindo se ele serve para treinamento.",
        texto:
          "Definir política de data-in / data-out para o provedor de LLM: se dado de usuário pode ser usado para treinamento; refletir em contrato e ToS.",
      },
      {
        codigo: "SEC-2-3",
        citacao: "§2",
        categoria: "dados",
        resumo:
          "Filtrar a resposta do LLM (output scanning) para remover PII e segredo antes de ela chegar ao usuário ou a sistema downstream (LLM02).",
        texto:
          "Filtrar a saída (output scanning) para PII e segredo antes de a resposta chegar ao usuário ou a sistema downstream (LLM02).",
      },
      {
        codigo: "SEC-2-4",
        citacao: "§2",
        categoria: "dados",
        resumo:
          "Proibir segredo, credencial ou dado ultrassensível em prompt de sistema, preferindo RAG com controle de acesso.",
        texto:
          "Não colocar segredo, credencial, chave de API ou dado ultrassensível em prompt de sistema; usar RAG com controle de acesso em vez de fixar no contexto.",
      },
      {
        codigo: "SEC-2-5",
        citacao: "§2",
        categoria: "dados",
        resumo: "Anonimizar ou pseudonimizar dado usado em fine-tuning.",
        texto: "Anonimizar ou pseudonimizar dado usado em fine-tuning.",
      },
      {
        codigo: "SEC-3-1-1",
        citacao: "§3.1",
        categoria: "modelos",
        resumo:
          "Usar apenas modelo e weights de fonte confiável, com verificação de integridade, evitando formatos inseguros como pickle.",
        texto:
          "Usar apenas modelo e weights de fonte confiável, com verificação de integridade (hash, assinatura), evitando formato inseguro como pickle.",
      },
      {
        codigo: "SEC-3-1-2",
        citacao: "§3.1",
        categoria: "modelos",
        resumo:
          "Manter um ML-BOM com modelos, datasets, versões, origem, licenças e dependências, com artefato assinado.",
        texto:
          "Manter ML-BOM com modelos, datasets, versões, origem, licenças e dependências, com artefato assinado.",
      },
      {
        codigo: "SEC-3-1-3",
        citacao: "§3.1",
        categoria: "modelos",
        resumo:
          "Avaliar periodicamente vulnerabilidade conhecida em modelo e SDK de fornecedor, com patch em tempo hábil.",
        texto:
          "Avaliar periodicamente vulnerabilidade conhecida em modelo e SDK de fornecedor, aplicando patch em tempo hábil.",
      },
      {
        codigo: "SEC-3-2-1",
        citacao: "§3.2",
        categoria: "modelos",
        resumo:
          "Sanitizar e validar documento antes de indexar na base vetorial, removendo segredo e marcando por nível de sensibilidade.",
        texto:
          "Sanitizar e validar documento antes de indexar: remover segredo, normalizar, marcar por nível de sensibilidade.",
      },
      {
        codigo: "SEC-3-2-2",
        citacao: "§3.2",
        categoria: "modelos",
        resumo:
          "Isolar a base vetorial por tenant, ou ao menos por domínio lógico, contra vazamento cross-tenant.",
        texto:
          "Isolar base vetorial por tenant, ou ao menos por domínio lógico, contra leakage cross-tenant.",
      },
      {
        codigo: "SEC-3-2-3",
        citacao: "§3.2",
        categoria: "modelos",
        resumo:
          "Proteger o banco vetorial com autenticação forte, controle de acesso por papel/tenant e criptografia em repouso e em trânsito.",
        texto:
          "Proteger o banco vetorial com autenticação forte, controle de acesso por papel/tenant e criptografia em repouso e em trânsito.",
      },
      {
        codigo: "SEC-3-2-4",
        citacao: "§3.2",
        categoria: "modelos",
        resumo:
          "Aplicar controles contra fraqueza de embedding e vetor — teste de robustez, limite de similaridade, detecção de input adversarial (LLM08).",
        texto:
          "Controles contra LLM08: teste de robustez de embedding, limite de similaridade, detecção de input adversarial.",
      },
      {
        codigo: "SEC-3-3-1",
        citacao: "§3.3",
        categoria: "modelos",
        resumo:
          "Validar origem e integridade do dado usado em treino ou fine-tuning, com trilha de proveniência.",
        texto:
          "Validar origem e integridade de dado usado em treino ou fine-tuning, com trilha de proveniência (CycloneDX/ML-BOM).",
      },
      {
        codigo: "SEC-3-3-2",
        citacao: "§3.3",
        categoria: "modelos",
        resumo:
          "Monitorar mudança de comportamento do modelo após re-treino e testar gatilho de backdoor e resposta anômala (LLM04).",
        texto:
          "Monitorar mudança de comportamento do modelo após re-treino; testar gatilho de backdoor e resposta anômala (LLM04).",
      },
      {
        codigo: "SEC-4-1-1",
        citacao: "§4.1",
        categoria: "backend",
        resumo:
          "Colocar toda interação com LLM atrás de serviço interno, nunca expor a API do provedor ao frontend, com autenticação, autorização por tenant/papel e rate limiting.",
        texto:
          "Colocar toda interação com LLM atrás de serviço interno — nunca expor a API do provedor ao frontend — com autenticação, autorização por tenant/papel e rate limiting.",
      },
      {
        codigo: "SEC-4-1-2",
        citacao: "§4.1",
        categoria: "backend",
        resumo:
          "Validar rigorosamente a entrada nas rotas de IA — tamanho, formato, whitelist de campo, normalização — antes de enviar ao LLM (LLM01).",
        texto:
          "Validação rigorosa de entrada nas rotas de IA: limite de tamanho, formato esperado, whitelist de campo, normalização antes de enviar ao LLM (LLM01).",
      },
      {
        codigo: "SEC-4-1-3",
        citacao: "§4.1",
        categoria: "backend",
        resumo:
          "Usar template de prompt estruturado que separa instrução de sistema, instrução da aplicação e entrada do usuário, com hierarquia imutável.",
        texto:
          "Template de prompt estruturado separando instrução de sistema, instrução da aplicação e entrada do usuário, com hierarquia imutável.",
      },
      {
        codigo: "SEC-4-1-4",
        citacao: "§4.1",
        categoria: "backend",
        resumo:
          "Tratar a resposta do LLM como dado não confiável: validar, sanitizar e aplicar regra de negócio antes de persistir ou gerar efeito colateral (LLM05).",
        texto:
          "Tratar resposta do LLM como dado não confiável: validar, sanitizar (escaping para HTML/JS) e aplicar regra de negócio antes de persistir ou acionar efeito colateral (LLM05).",
      },
      {
        codigo: "SEC-4-2-1",
        citacao: "§4.2",
        categoria: "backend",
        resumo:
          "Aplicar hardening clássico de API: autenticação forte, política de senha, CSRF, rate limiting, prevenção de injection, ORM seguro.",
        texto:
          "Práticas clássicas OWASP para API: autenticação forte, política de senha, proteção CSRF onde cabe, rate limiting, prevenção de injection em SQL/NoSQL, ORM seguro.",
      },
      {
        codigo: "SEC-4-2-2",
        citacao: "§4.2",
        categoria: "backend",
        resumo:
          "Nunca armazenar segredo de modelo ou de provedor em código; usar secret manager ou variável de ambiente gerida pelo CI/CD.",
        texto:
          "Nunca armazenar segredo de modelo ou de provedor em código; usar secret manager ou variável de ambiente gerida pelo CI/CD.",
      },
      {
        codigo: "SEC-4-2-3",
        citacao: "§4.2",
        categoria: "backend",
        resumo:
          "Integrar SAST/DAST e auditoria de dependência no CI/CD, com gate mínimo antes de subir versão do serviço de IA.",
        texto:
          "Integrar SAST/DAST e auditoria de dependência no CI/CD, com gate mínimo antes de subir versão do serviço de IA.",
      },
      {
        codigo: "SEC-4-2-4",
        citacao: "§4.2",
        categoria: "backend",
        resumo:
          "Versionar modelo e prompt, com rollback rápido via canary/shadow para modelo problemático.",
        texto:
          "Versionar modelo e prompt, com rollback rápido (canary/shadow) para modelo problemático.",
      },
      {
        codigo: "SEC-5-1",
        citacao: "§5",
        categoria: "frontend",
        resumo:
          "Nunca interpolar resposta do LLM em `dangerouslySetInnerHTML` ou atributo de HTML sem escaping, já que o LLM pode gerar HTML/JS malicioso.",
        texto:
          "Não interpolar resposta do LLM em `dangerouslySetInnerHTML` nem em atributo de HTML; aplicar escaping, porque o LLM pode gerar HTML/JS malicioso.",
      },
      {
        codigo: "SEC-5-2",
        citacao: "§5",
        categoria: "frontend",
        resumo:
          "Nunca expor chave de API de LLM no código do frontend; toda chamada passa pelo backend.",
        texto:
          "Nunca expor chave de API de LLM no código do frontend; toda chamada passa pelo backend.",
      },
      {
        codigo: "SEC-5-3",
        citacao: "§5",
        categoria: "frontend",
        resumo:
          "Aplicar controle de entrada no cliente sem tratá-lo como única barreira de segurança.",
        texto:
          "Controle de entrada no cliente (limite de caractere, hint de conteúdo permitido), sem confiar nele como única barreira.",
      },
      {
        codigo: "SEC-5-4",
        citacao: "§5",
        categoria: "frontend",
        resumo:
          "Não usar dado sensível exibido na UI como contexto de prompt client-side sem consentimento explícito.",
        texto:
          "Não usar dado sensível exibido na UI como contexto de prompt client-side sem consentimento explícito.",
      },
      {
        codigo: "SEC-5-5",
        citacao: "§5",
        categoria: "frontend",
        resumo:
          "Proteger rota de streaming (SSE, WebSocket) com autenticação e autorização, sanitizando antes de injetar no DOM.",
        texto:
          "Proteger rota de streaming (SSE, WebSocket) com autenticação e autorização, e sanitizar antes de injetar no DOM.",
      },
      {
        codigo: "SEC-6-1",
        citacao: "§6",
        categoria: "backend",
        resumo:
          "Filtrar a entrada para detectar padrão de prompt injection — instrução para ignorar regras anteriores, exfiltrar dado interno, executar código.",
        texto:
          "Filtro de entrada para detectar padrão de prompt injection: ignorar regras anteriores, exfiltrar dado interno, executar código.",
      },
      {
        codigo: "SEC-6-2",
        citacao: "§6",
        categoria: "backend",
        resumo:
          "Validar a saída do LLM quanto a formato esperado, citação apenas de fonte autorizada e ausência de comando perigoso.",
        texto:
          "Validação de saída: formato esperado (JSON schema), citação apenas de fonte autorizada, ausência de comando perigoso.",
      },
      {
        codigo: "SEC-6-3",
        citacao: "§6",
        categoria: "backend",
        resumo:
          "Executar código ou tool call derivada de resposta de LLM em sandbox rigoroso — worker isolado, sem rede direta, com limite de CPU, memória e tempo.",
        texto:
          "Sandbox rigoroso para execução de código ou tool call derivada de resposta de LLM: worker isolado, sem rede direta, com limite de CPU, memória e tempo.",
      },
      {
        codigo: "SEC-6-4",
        citacao: "§6",
        categoria: "backend",
        resumo:
          "Exigir human-in-the-loop e aprovação explícita para operação de alto impacto disparada por agente (LLM06).",
        texto:
          "Human-in-the-loop e aprovação explícita para operação de alto impacto — dado financeiro, email em massa, infraestrutura (LLM06).",
      },
      {
        codigo: "SEC-6-5",
        citacao: "§6",
        categoria: "monitoramento",
        resumo:
          "Logar toda tool call de agente com contexto mínimo — quem, quando, qual ação, quais parâmetros — sem dado sensível em claro.",
        texto:
          "Logar toda tool call de agente com contexto mínimo — quem, quando, qual ação, quais parâmetros — sem dado sensível em claro.",
      },
      {
        codigo: "SEC-7-1",
        citacao: "§7",
        categoria: "runtime",
        resumo:
          "Aplicar quota por tenant, usuário e tipo de operação — tokens/mês, requisições/dia, concorrência máxima (LLM10).",
        texto:
          "Quota por tenant, usuário e tipo de operação: tokens/mês, requisições/dia, concorrência máxima (LLM10).",
      },
      {
        codigo: "SEC-7-2",
        citacao: "§7",
        categoria: "runtime",
        resumo:
          "Limitar timeout, tokens por request e profundidade de cadeia de agente, contra loop e denial-of-wallet.",
        texto:
          "Timeout, limite de token por request e limite de profundidade de cadeia de agente, contra loop e denial-of-wallet.",
      },
      {
        codigo: "SEC-7-3",
        citacao: "§7",
        categoria: "runtime",
        resumo:
          "Monitorar custo — tokens, chamadas, latência — quase em tempo real, com alerta para pico anômalo.",
        texto:
          "Monitorar custo — tokens, chamadas, latência — quase em tempo real, com alerta para pico anômalo.",
      },
      {
        codigo: "SEC-7-4",
        citacao: "§7",
        categoria: "runtime",
        resumo:
          "Prover circuit breaker e kill switch para desligar feature de IA ou tenant específico em caso de abuso ou bug de consumo.",
        texto:
          "Circuit breaker e kill switch para desligar feature de IA ou tenant específico em caso de abuso ou bug de consumo.",
      },
      {
        codigo: "SEC-8-1",
        citacao: "§8",
        categoria: "monitoramento",
        resumo:
          "Logar requisição de IA com metadado operacional — usuário, tenant, tipo de operação, modelo, custo — sem conteúdo sensível de prompt ou resposta em claro.",
        texto:
          "Logar requisição de IA com metadado — usuário, tenant, tipo de operação, modelo, custo aproximado — sem conteúdo sensível de prompt ou resposta em claro.",
      },
      {
        codigo: "SEC-8-2",
        citacao: "§8",
        categoria: "monitoramento",
        resumo:
          "Monitorar padrão anormal de uso — volume, tentativa repetida de quebrar instrução, indício de scraping ou exfiltração.",
        texto:
          "Monitorar padrão anormal: volume, tentativa repetida de quebrar instrução, consulta que sugere scraping ou exfiltração.",
      },
      {
        codigo: "SEC-8-3",
        citacao: "§8",
        categoria: "monitoramento",
        resumo: "Detectar drift e mudança estatística no output do modelo.",
        texto:
          "Detectar drift e mudança estatística no output: distribuição de classe de resposta, taxa de erro de validação.",
      },
      {
        codigo: "SEC-8-4",
        citacao: "§8",
        categoria: "monitoramento",
        resumo:
          "Incluir cenário de ataque de LLM — prompt injection, exfiltração, poisoning operacional — em teste de segurança, pentest e red teaming.",
        texto:
          "Incluir cenário de ataque de LLM — prompt injection, exfiltração, poisoning operacional — em teste de segurança, pentest e red teaming.",
      },
      {
        codigo: "SEC-9-1",
        citacao: "§9",
        categoria: "governança",
        resumo:
          "Manter inventário de todo serviço de IA em uso, com dono interno e dado processado.",
        texto:
          "Inventário de todo serviço de IA em uso, com dono interno e dado processado.",
      },
      {
        codigo: "SEC-9-2",
        citacao: "§9",
        categoria: "governança",
        resumo:
          "Definir política de uso aceitável de IA para usuário final e equipe interna, com limite de uso, conteúdo proibido e disclaimer sobre limitação do modelo.",
        texto:
          "Política de uso aceitável de IA para usuário final e equipe interna, com limite de uso, conteúdo proibido e disclaimer sobre limitação do modelo.",
      },
      {
        codigo: "SEC-9-3",
        citacao: "§9",
        categoria: "governança",
        resumo:
          "Integrar risco de LLM/GenAI à gestão de risco corporativa, mapeando o LLM Top 10 para os controles de processos existentes como ISO 27001 e SOC 2.",
        texto:
          "Integrar risco de LLM/GenAI à gestão de risco corporativa e aos processos existentes (ISO 27001, SOC 2), mapeando o LLM Top 10 para controles.",
      },
      {
        codigo: "SEC-9-4",
        citacao: "§9",
        categoria: "governança",
        resumo:
          "Exigir processo formal com revisão de segurança para mudança de modelo, novo plugin ou nova integração de agente antes da liberação.",
        texto:
          "Processo formal para mudança de modelo, novo plugin e nova integração de agente, com revisão de segurança antes da liberação.",
      },
      {
        codigo: "SEC-10-1-1",
        citacao: "§10.1",
        categoria: "backend",
        resumo: "Configurar linter e formatador voltados a código seguro.",
        texto: "Linter e formatador configurados para código seguro.",
      },
      {
        codigo: "SEC-10-1-2",
        citacao: "§10.1",
        categoria: "backend",
        resumo: "Integrar SAST para backend e frontend.",
        texto: "SAST integrado para backend e frontend.",
      },
      {
        codigo: "SEC-10-1-3",
        citacao: "§10.1",
        categoria: "backend",
        resumo:
          "Usar mock de LLM em teste, sem chamar modelo real em suíte automatizada.",
        texto:
          "Mock de LLM em teste, sem chamar modelo real em suíte automatizada.",
      },
      {
        codigo: "SEC-10-2-1",
        citacao: "§10.2",
        categoria: "monitoramento",
        resumo:
          "Testar segurança focada em LLM em staging — prompt injection, leakage de sistema, uso indevido de ferramenta.",
        texto:
          "Teste de segurança focado em LLM: prompt injection, leakage de sistema, misuse de ferramenta.",
      },
      {
        codigo: "SEC-10-2-2",
        citacao: "§10.2",
        categoria: "monitoramento",
        resumo:
          "Fazer shadow e canary release de modelo e prompt novos, com observabilidade plena.",
        texto:
          "Shadow e canary release de modelo e prompt novos, com observabilidade plena.",
      },
      {
        codigo: "SEC-10-3-1",
        citacao: "§10.3",
        categoria: "runtime",
        resumo:
          "Aplicar rate limiting por rota de IA e por tenant em produção.",
        texto: "Rate limiting por rota de IA e por tenant.",
      },
      {
        codigo: "SEC-10-3-2",
        citacao: "§10.3",
        categoria: "runtime",
        resumo: "Manter log e métrica de custo em dashboard interno.",
        texto: "Log e métrica de custo em dashboard interno.",
      },
      {
        codigo: "SEC-10-3-3",
        citacao: "§10.3",
        categoria: "monitoramento",
        resumo:
          "Manter runbook de incidente cobrindo vazamento de dado, abuso de agente, custo fora de controle e comportamento anômalo de modelo.",
        texto:
          "Runbook de incidente cobrindo vazamento de dado, abuso de agente, custo fora de controle e comportamento anômalo de modelo.",
      },
      {
        codigo: "SEC-11-1",
        citacao: "§11",
        categoria: "governança",
        resumo:
          "Percorrer todas as seções do checklist por aplicação de IA, marcando atende, não atende ou não se aplica.",
        texto:
          "Para cada aplicação com IA, percorrer todas as seções marcando atende, não atende ou não se aplica.",
      },
      {
        codigo: "SEC-11-2",
        citacao: "§11",
        categoria: "governança",
        resumo:
          "Abrir ação com dono, severidade e prazo para cada item que não atende, priorizada pelo que é mais crítico no contexto.",
        texto:
          "Para cada item que não atende, abrir ação com dono, severidade e prazo, priorizando o que é mais crítico no contexto.",
      },
      {
        codigo: "SEC-11-3",
        citacao: "§11",
        categoria: "governança",
        resumo:
          "Reexecutar a revisão a cada mudança relevante de modelo, arquitetura de RAG, integração de agente ou release grande.",
        texto:
          "Reexecutar a revisão a cada mudança relevante de modelo, arquitetura de RAG, integração de agente ou release grande.",
      },
    ],
  },
];
