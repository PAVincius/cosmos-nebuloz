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
  resumo: string;
  /**
   * Ausente — não `undefined` explícito, a chave inteira some do objeto — em
   * TODO requisito deste arquivo, não só nos REFERENCIA. Para ISO/IEC 42001
   * (REFERENCIA) é a regra: norma proprietária só entra por citação e
   * formulação própria (ver licenca-copyright.test.ts). Para os três corpora
   * LIVRE, texto também fica ausente aqui de propósito, e não por limitação
   * de licença: nenhuma citação abaixo foi conferida palavra-por-palavra
   * contra a fonte oficial, e um campo "texto" que não é de fato verbatim é
   * pior do que não ter texto nenhum. citacao + resumo já bastam para o
   * tenant mapear evidência; texto pode ser adicionado depois, requisito a
   * requisito, pela própria tela de conformidade, quando alguém conferir a
   * redação exata contra a publicação oficial.
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
];
