# Pesquisa de mercado por eixo do Meridian — candidatos a template do Scaffold

O Meridian produz lacunas. O Scaffold precisa ter o que oferecer contra cada uma. Este documento pesquisa, célula a célula, o que o mercado já vende para fechar cada tipo de lacuna que a bateria consegue produzir, e sai com uma lista de candidatos a template.

---

## 0. Método

**Por que eixo × lacuna.** O Meridian não emite lacuna arbitrária: cada `MeridianGap` nasce de um eixo, e o eixo só tem as perguntas da bateria v3.2 — três por eixo, quinze ao todo, em `packages/provisioning/src/meridian.ts`. O espaço de lacunas do produto é, portanto, finito e derivável da bateria. Os tipos da §1 foram lidos das quinze perguntas, uma a uma; nenhum foi inventado para caber num template que já existe.

**Fontes.** Preferi o texto da norma e o site do fornecedor a artigo de opinião; onde só havia comparativo de blog, registrei o fornecedor pelo próprio site e deixei a afirmação de mercado sem número. Cada link traz o ano. **Não afirmo preço de concorrente**: esta categoria vende por "fale com vendas", e onde procurei e não achei está escrito "não publicado".

**O que "candidato a template" significa.** Uma proposta de recorte: nome, fases, entregável por fase, `exigeLab` e faixa de `effort`. **Não é template construído** — construir é escrever `ScaffoldStepTemplate` com `statement` e `expectedArtefact`, `ScaffoldGateCriterion` por fase e publicar uma `ScaffoldTemplateVersion` com `authorLabel = "método Nebuloz"`. Isso é outro ciclo, e depende da decisão §2 do [MAPEAMENTO](trilhas/MAPEAMENTO.md) (arquétipo × assunto), ainda em aberto.

**Faixas de `effort`** conforme [scaffold-prd.md §4](scaffold-prd.md): S = 1–2 semanas, M = 4–6, L = 8–12.

---

## 1. Os tipos de lacuna

Quinze perguntas, quinze tipos. A bateria é de uma pergunta por assunto, e isso é vantagem: não há tipo de lacuna sem pergunta que o produza, nem pergunta que produza duas coisas.

| Eixo | Tipo de lacuna | Pergunta |
|---|---|---|
| `DATA` | Fontes críticas sem catálogo e sem dono | Q-D01 (peso 2) |
| `DATA` | Qualidade de dados não medida | Q-D02 |
| `DATA` | Dado fora do ambiente governado | Q-D03 (invertida) |
| `PROCESS` | Processos candidatos sem baseline de tempo e custo | Q-P01 |
| `PROCESS` | Priorização de casos de uso sem critério econômico | Q-P02 |
| `PROCESS` | Exceções não registradas nem revisadas | Q-P03 |
| `PEOPLE` | Capacitação sem trilha por persona nem medição | Q-E01 |
| `PEOPLE` | Papéis de dado não formalizados no cargo | Q-E02 |
| `PEOPLE` | Conhecimento concentrado em poucos campeões | Q-E03 |
| `GOVERNANCE` | Política de IA ausente, sem versão ou não comunicada | Q-G01 |
| `GOVERNANCE` | Comitê de IA inoperante | Q-G02 (peso 2) |
| `GOVERNANCE` | Dado sensível sem classificação e controle efetivos | Q-G03 |
| `INFRASTRUCTURE` | Sem ambiente segregado para experimentar com dado sensível | Q-I01 |
| `INFRASTRUCTURE` | Ciclo de vida de modelo sem versionamento nem rollback | Q-I02 |
| `INFRASTRUCTURE` | Custo de inferência não observável por caso de uso | Q-I03 |

---

## 2. `DATA`

### 2.1 Fontes críticas sem catálogo e sem dono (Q-D01)

**Mercado.** Catálogo e governança de metadados como produto — [Collibra](https://www.collibra.com/) (2026), [Alation](https://www.alation.com/) (2026), [Atlan](https://atlan.com/) (2026), [Microsoft Purview](https://learn.microsoft.com/en-us/purview/) (2026) — sempre com implantação por parceiro, porque licença não produz dono. A dor vendida é a que Q-D01 mede: existe metadado, não existe responsável nomeado.

**Norma.** [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) (2023), MAP-1 e GOVERN-1; [ISO/IEC 42001:2023](https://www.iso.org/standard/42001) (2023), Anexo A na parte de recursos de dado; [DAMA-DMBOK](https://www.dama.org/cpages/body-of-knowledge) (2017) para stewardship.

**Entregáveis e duração.** Inventário das fontes críticas, matriz de ownership (dono de negócio e steward técnico), glossário mínimo, catálogo carregado. Fornecedores cloud-native divulgam mediana de ~3 meses contra 6–12 dos legados ([Atlan](https://atlan.com/collibra-alternatives/), 2026) — número do concorrente sobre o rival. Um recorte de fontes críticas cabe em 4–6 semanas.

**Candidato.** *Catálogo mínimo das fontes críticas* — `ASSESS` (fontes críticas com uso declarado) → `PILOT` (catálogo carregado para 10–15 fontes, dono e steward nomeados) → `SCALE` (rotina de manutenção e critério de entrada) → `EMBED` (revisão trimestral de ownership). `exigeLab`: não. `effort`: **M**. Geral.

### 2.2 Qualidade de dados não medida (Q-D02)

**Mercado.** Observabilidade de dados — [Monte Carlo](https://www.montecarlodata.com/) (2026), [Soda](https://www.soda.io/) (2026), [Great Expectations](https://greatexpectations.io/) (2026, open source) — pelo mesmo eixo da pergunta: frescor, volume, esquema, distribuição. Preço de lista não publicado pelos comerciais.

**Norma.** NIST AI RMF (2023), MEASURE-1 e 2 (métricas antes do go-live) e MEASURE-3 (rastreamento no tempo). [ISO/IEC 23894:2023](https://www.iso.org/standard/77304.html) (2023) para risco de dado de entrada.

**Entregáveis e duração.** SLO por produto de dado (frescor, completude, unicidade), monitores instrumentados no pipeline, alerta com dono, relatório de linha de base. 4–6 semanas para um domínio; mais se o pipeline não tiver orquestrador.

**Candidato.** *Qualidade observável nas fontes que alimentam IA* — `ASSESS` (fontes que alimentam casos de IA e suas dimensões críticas) → `PILOT` (SLO e monitores num domínio, alerta roteado) → `SCALE` (demais fontes críticas e política de quebra de SLO) → `EMBED` (SLO no rito de operação). `exigeLab`: **sim**. `effort`: **M**. Geral.

### 2.3 Dado fora do ambiente governado (Q-D03)

**Mercado.** Duas ofertas que a pergunta junta. Para planilha e export local, migração para produto de dado governado, vendida por boutique. Para dado que vaza por ferramenta de IA não sancionada, a categoria de descoberta de *shadow AI* — [Harmonic Security](https://www.harmonic.security/solutions/shadow-ai-detection) (2026), [Netskope](https://www.netskope.com/) (2026), [Zscaler](https://www.zscaler.com/) (2026) — que inspeciona o prompt, não só o tráfego.

**Norma.** ISO/IEC 42001:2023, Anexo A (recursos de dado e uso de terceiros). [LGPD, Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) (2018), art. 46 e art. 37 — export local é tratamento sem registro.

**Entregáveis e duração.** Diagnóstico de onde o dado vive fora, plano de recolhimento por fonte, política de uso com lista de ferramentas sancionadas, controle técnico de bloqueio ou alerta. 4–6 semanas para o diagnóstico e o primeiro corte; recolher tudo é programa.

**Candidato.** *Recolhimento do dado sombra* — `ASSESS` (censo de planilhas críticas e de IA não sancionada) → `PILOT` (bloqueio ou alerta nas rotas de maior risco; substituição das três planilhas mais críticas) → `SCALE` (fila priorizada por sensibilidade) → `EMBED` (revisão do censo). `exigeLab`: **sim**. `effort`: **M**. Geral, com variante para regulados.

---

## 3. `PROCESS`

### 3.1 Processos candidatos sem baseline (Q-P01)

**Mercado.** Process mining com promessa de baseline quantificado — [Celonis](https://www.celonis.com/) (2026) domina, vendido com implantação de parceiro (a [Accenture publica o caso de compras](https://www.accenture.com/us-en/case-studies/about/turning-process-friction-into-flow), 2026). Alternativa mais barata e mais comprada no porte médio: levantamento manual de tempo e custo por consultoria de operações.

**Norma.** NIST AI RMF (2023), MAP-1 (propósito e contexto documentados antes do desenvolvimento) e MAP-3 (benefícios e custos caracterizados). Não há norma regulatória aqui — é disciplina, não obrigação.

**Entregáveis e duração.** Ficha por processo com volume, tempo de ciclo, custo unitário e retrabalho; mapa de variantes; e o número que o "depois" vai contestar. 2–4 semanas para três a cinco processos levantados à mão.

**Candidato.** *Baseline antes do piloto* — `ASSESS` (seleção dos processos e definição das métricas) → `PILOT` (baseline medido e assinado pelo dono do processo) → `EMBED` (recoleta na mesma métrica após a intervenção). `exigeLab`: não. `effort`: **S**. Geral. É o pré-requisito natural do Signal — sem ele, não há "antes".

### 3.2 Priorização sem critério econômico (Q-P02)

**Mercado.** "AI use case portfolio" e "value assessment" das Big Four e de boutiques: matriz de valor × viabilidade com números. A Deloitte publica o [roteiro de governança de IA para conselho](https://www.deloitte.com/us/en/programs/center-for-board-effectiveness/articles/board-of-directors-governance-framework-artificial-intelligence.html) (2026). É a entrega mais commoditizada da matriz, e a de pior diferenciação.

**Norma.** NIST AI RMF (2023), GOVERN-1.3 (nível de risco aceitável) e MAP-3. Nenhuma obrigação direta.

**Entregáveis e duração.** Modelo de pontuação com pesos acordados, carteira classificada, e a decisão de o que **não** fazer — o entregável que dá valor e o que os clientes mais evitam assinar. 1–2 semanas quando o baseline da §3.1 existe; sem ele o número é chute.

**Candidato.** *Carteira de casos de uso com critério comparável* — `ASSESS` (casos candidatos e verba disponível) → `PILOT` (modelo de pontuação calibrado e carteira classificada, com os recusados nomeados) → `EMBED` (o critério vira gate do funil de ideias). `exigeLab`: não. `effort`: **S**. Geral. Depende de 3.1.

### 3.3 Exceções não registradas nem revisadas (Q-P03)

**Mercado.** Pouca coisa como produto isolado. Vende-se dentro de GRC — [OneTrust AI Governance](https://www.onetrust.com/products/ai-governance/) (2026) e [Credo AI](https://www.credo.ai/) (2026) trazem registro de risco com trilha de decisão auditável — ou dentro de ITSM. **É a célula com menos oferta dedicada da matriz**, e por isso a de melhor margem potencial.

**Norma.** ISO/IEC 42001:2023, cláusula 9 (monitoramento, auditoria interna, revisão gerencial) e cláusula 10 (não conformidade e ação corretiva) — exceção não registrada é a não conformidade que a 10 descreve. NIST AI RMF, MANAGE-1 (decisão de mitigar, transferir ou aceitar documentada).

**Entregáveis e duração.** Taxonomia de exceção, registro com dono e prazo, rito de revisão com quórum, e o primeiro ciclo executado — 4–6 semanas, porque um ciclo precisa caber dentro da entrega.

**Candidato.** *Gestão de exceção com revisão executada* — `ASSESS` (taxonomia e onde as exceções hoje são silenciadas) → `PILOT` (registro em operação num processo e um ciclo de revisão com ata) → `SCALE` (demais processos com IA) → `EMBED` (revisão no calendário do comitê). `exigeLab`: não. `effort`: **M**. Geral.

---

## 4. `PEOPLE`

### 4.1 Capacitação sem trilha por persona nem medição (Q-E01)

**Mercado.** Virou obrigação na UE em fev/2025 e o mercado reagiu: catálogos de letramento por papel, da Comissão Europeia ([AI talent, skills and literacy](https://digital-strategy.ec.europa.eu/en/policies/ai-talent-skills-and-literacy), 2026) a cursos comerciais como [DeepLearning.AI](https://www.deeplearning.ai/) (2026) e às trilhas das Big Four. No Brasil vende-se por hora-aula, sem medição de aplicação — que é o que a pergunta cobra.

**Norma.** [EU AI Act, Regulamento (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) (2024), **art. 4**: provedores e implantadores devem assegurar letramento suficiente, calibrado ao papel; em aplicação desde 2/fev/2025. ISO/IEC 42001:2023, cláusulas 7.2 e 7.3. NIST AI RMF, GOVERN-2.

**Entregáveis e duração.** Mapa de personas, matriz de competência, trilha com carga e avaliação, e evidência de participação — evidência, não lista de presença, porque é o que o art. 4 faz um auditor pedir. 4–6 semanas até a primeira turma concluída.

**Candidato.** *Letramento em IA por persona, com evidência* — `ASSESS` (personas, exposição a IA, lacuna de competência) → `PILOT` (trilha desenhada e primeira turma concluída com avaliação) → `SCALE` (demais personas e entrada no onboarding) → `EMBED` (recorrência e reavaliação anual). `exigeLab`: não. `effort`: **M**. Geral, com variante para quem exporta para a UE.

### 4.2 Papéis de dado não formalizados no cargo (Q-E02)

**Mercado.** Não existe como SKU. Vende-se embutido: no módulo de ownership de uma implantação de catálogo (§2.1) ou em consultoria de operating model de governança das Big Four — a Deloitte tem guia com composição de comitê e pontos de integração ([resenha de terceiro](https://verifywise.ai/ai-governance-library/organizational-roles-and-processes/ai-governance-operating-model-deloitte), 2026; o material primário é comercial). Formalizar em descrição de cargo é trabalho de RH, e nenhum fornecedor de IA o assume.

**Norma.** ISO/IEC 42001:2023, cláusula 5.3 (papéis, responsabilidades e autoridades atribuídos e comunicados). NIST AI RMF, GOVERN-2.1. DAMA-DMBOK (2017) para steward e owner.

**Entregáveis e duração.** RACI por domínio de dado, texto de responsabilidade para a descrição de cargo, e o aceite formal de RH — o aceite é o entregável, o resto é rascunho. 1–2 semanas de trabalho técnico, com o prazo real ditado pelo ciclo de RH do cliente.

**Candidato.** *Formalização dos papéis de dado* — `ASSESS` (quem exerce o papel hoje sem nome no cargo) → `PILOT` (RACI acordado e texto de cargo aprovado por RH nos domínios críticos) → `EMBED` (papel na avaliação de desempenho). `exigeLab`: não. `effort`: **S**. Geral. **Risco**: o relógio é do RH do cliente, não do Scaffold.

### 4.3 Conhecimento concentrado em poucos campeões (Q-E03)

**Mercado.** Programas de "AI Center of Excellence" e comunidade de prática, vendidos pelas Big Four dentro de transformação ([comparativo de frameworks](https://consulting-huber.com/ai-consulting-frameworks-compared.html), 2026, secundário). Não achei fornecedor que venda **redução de concentração** com métrica — vende-se estrutura, e mede-se participação.

**Norma.** ISO/IEC 42001:2023, cláusulas 7.2 e 7.4 (competência e comunicação); NIST AI RMF, GOVERN-4 (cultura de risco disseminada). Sem obrigação regulatória — é risco operacional.

**Entregáveis e duração.** Mapa de concentração (quem é ponto único de falha), guilda com rito e dono, biblioteca de padrões, rotação deliberada em ao menos um caso. É o ciclo mais longo da matriz: 8–12 semanas, porque disseminação não acontece em sprint.

**Candidato.** *Descentralização do conhecimento de IA* — `ASSESS` (mapa de concentração por sistema e por pessoa) → `PILOT` (guilda em operação e dois casos documentados por quem não era campeão) → `SCALE` (rotação e biblioteca de padrões) → `EMBED` (métrica de dispersão no rito trimestral). `exigeLab`: não. `effort`: **L**. Geral.

---

## 5. `GOVERNANCE`

### 5.1 Política de IA ausente, sem versão ou não comunicada (Q-G01)

**Mercado.** A célula mais concorrida. Plataformas com biblioteca de política e workflow de aprovação — [Credo AI](https://www.credo.ai/) (2026), [Holistic AI](https://www.holisticai.com/) (2026), [OneTrust AI Governance](https://www.onetrust.com/products/ai-governance/) (2026), [IBM watsonx.governance](https://www.ibm.com/products/watsonx-governance) (2026) — mais a redação por consultoria. Preço não publicado por nenhuma das quatro.

**Norma.** NIST AI RMF, **GOVERN-1** (políticas, processos e procedimentos transparentes). ISO/IEC 42001:2023, cláusula 5.2 (política de IA) — requisito certificável, não recomendação. EU AI Act, art. 26, para quem opera sistema de alto risco.

**Entregáveis e duração.** Política aprovada e versionada, procedimento de exceção, plano de comunicação executado, evidência de ciência. 4–6 semanas — o gargalo é aprovação jurídica, não redação.

**Candidato.** *Política de IA aprovada, versionada e comunicada* — `ASSESS` (o que já existe disperso e quem aprova) → `PILOT` (política redigida, aprovada e publicada com versão) → `SCALE` (comunicação com evidência e procedimento de exceção) → `EMBED` (revisão anual com dono). `exigeLab`: não. `effort`: **M**. Geral. **Já coberto** por [ai-governance](trilhas/ai-governance.md), Fase 2.

### 5.2 Comitê de IA inoperante (Q-G02, peso 2)

**Mercado.** Desenho de operating model e de comitê é a entrega-assinatura das Big Four em governança de IA (Deloitte, [roteiro para conselho](https://www.deloitte.com/us/en/programs/center-for-board-effectiveness/articles/board-of-directors-governance-framework-artificial-intelligence.html), 2026). As plataformas de GRC vendem o *workflow* do comitê, não o comitê. A pergunta é dura de propósito: não pergunta se ele existe, pergunta se **revisou algum caso** — e é aí que a maioria falha.

**Norma.** ISO/IEC 42001:2023, cláusulas 5.1 (liderança) e 9.3 (revisão pela direção). NIST AI RMF, GOVERN-3 e MANAGE-1. EU AI Act, arts. 26 e 27 (avaliação de impacto sobre direitos fundamentais) para alto risco, que exige instância que decida.

**Entregáveis e duração.** Regimento com alçada e quórum, calendário, pauta com fila de casos, e **atas de pelo menos duas reuniões com decisão registrada**. 4–6 semanas, porque duas reuniões precisam caber na entrega — é o que separa governança de PDF.

**Candidato.** *Comitê de IA em operação* — `ASSESS` (quem decide hoje na prática e onde as decisões morrem) → `PILOT` (regimento aprovado e duas reuniões com ata e decisão) → `SCALE` (fila de casos integrada ao registro de risco) → `EMBED` (cadência no calendário corporativo). `exigeLab`: não. `effort`: **M**. Geral. **Já coberto** por [ai-governance](trilhas/ai-governance.md).

### 5.3 Dado sensível sem classificação nem controle efetivo (Q-G03)

**Mercado.** Controle de acesso por atributo e mascaramento — [Immuta](https://www.immuta.com/) (2026), [Privacera](https://privacera.com/) (2026), [Microsoft Purview](https://learn.microsoft.com/en-us/purview/) (2026) — com descoberta e classificação automática. Venda de plataforma mais implantação; classificação sem controle aplicado é exatamente o "não na prática" da pergunta.

**Norma.** LGPD (2018), art. 5º, II, art. 46 e art. 6º, VII. A ANPD incluiu IA e tecnologias emergentes entre os eixos do Mapa de Temas Prioritários 2026–2027 (2025) — achado sem URL primário confirmado, ver §9. ISO/IEC 42001:2023, Anexo A. EU AI Act, art. 10 (governança de dados de treino) para alto risco.

**Entregáveis e duração.** Esquema de classificação, varredura executada, políticas de acesso e mascaramento aplicadas em produção, relatório de acesso auditável. 8–12 semanas com mais de um repositório — a integração com cada plataforma de dado consome o prazo.

**Candidato.** *Classificação e controle aplicados ao dado sensível* — `ASSESS` (esquema de classificação e varredura) → `PILOT` (política de acesso e mascaramento num repositório, com evidência de bloqueio real) → `SCALE` (demais repositórios e relatório de acesso) → `EMBED` (recertificação de acesso). `exigeLab`: **sim**. `effort`: **L**. Geral, com variante para financeiro e saúde. **Parcial** em [ai-security](trilhas/ai-security.md) e [ai-compliance](trilhas/ai-compliance.md).

---

## 6. `INFRASTRUCTURE`

### 6.1 Sem ambiente segregado para experimentar com dado sensível (Q-I01)

**Mercado.** Implantação de zona segregada sobre a nuvem que o cliente já tem, com computação confidencial quando o dado exige ([Azure confidential computing](https://learn.microsoft.com/en-us/azure/confidential-computing/), 2026). Na ponta pública, o próprio conceito de sandbox supervisionado: a ANPD [abriu edital de sandbox regulatório de IA](https://www.gov.br/anpd/pt-br/assuntos/noticias/publicado-edital-para-participacao-em-sandbox-regulatorio-em-inteligencia-artificial) (2025) e [divulgou o resultado definitivo, com três participantes e vigência até dez/2026](https://www.gov.br/anpd/pt-br/assuntos/noticias/apos-recursos-anpd-divulga-resultado-definitivo-do-projeto-sandbox-regulatorio) (2026).

**Norma.** EU AI Act (2024), **arts. 57–61** (sandboxes regulatórios e teste em condições reais). LGPD, art. 46. ISO/IEC 42001:2023, Anexo A. O PL 2338/2023 prevê ambiente regulatório experimental e [segue na Câmara após aprovação no Senado em 10/dez/2024](https://www25.senado.leg.br/web/atividade/materias/-/materia/157233) (2024).

**Entregáveis e duração.** Desenho do ambiente, isolamento de rede e identidade, política de entrada e saída de dado (o que pode sair do sandbox é o que sempre falta), anonimização ou sintetização, e um experimento real rodando. 4–6 semanas quando a nuvem já existe.

**Candidato.** *Ambiente segregado para experimentação* — `ASSESS` (o que hoje se experimenta com dado de produção e por quê) → `PILOT` (ambiente provisionado com política de entrada/saída e um experimento executado) → `SCALE` (padrão de provisionamento e catálogo de dado sintético) → `EMBED` (revisão de acesso e expurgo). `exigeLab`: **sim**. `effort`: **M**. Geral.

### 6.2 Ciclo de vida de modelo sem versionamento nem rollback (Q-I02)

**Mercado.** Registry de modelo com governança — [MLflow Model Registry](https://mlflow.org/docs/latest/ml/model-registry/) (2026, open source) e a versão gerenciada no [Unity Catalog da Databricks](https://docs.databricks.com/aws/en/machine-learning/manage-model-lifecycle/) (2026), com controle de acesso, linhagem e promoção entre ambientes. Do lado de validação regulada, [ModelOp](https://www.modelop.com/ai-governance/ai-regulations-standards/sr-11-7) (2026) e [ValidMind](https://validmind.com/) (2026) vendem o dossiê de modelo.

**Norma.** NIST AI RMF, MANAGE-2 e MANAGE-4 (planos de resposta e de desativação — rollback é plano de resposta). ISO/IEC 42001:2023, Anexo A (ciclo de vida do sistema de IA). Para financeiro, ver §7.

**Entregáveis e duração.** Registry em operação, convenção de versionamento, esteira de promoção com aprovação, procedimento de rollback **testado** (não descrito) e dossiê por modelo. 8–12 semanas — é reengenharia de esteira, não configuração de ferramenta.

**Candidato.** *Ciclo de vida de modelo com rollback testado* — `ASSESS` (inventário dos modelos em produção e como cada um foi parar lá) → `PILOT` (registry e esteira para uma família de modelos, com um rollback executado em ensaio) → `SCALE` (demais modelos e dossiê padrão) → `EMBED` (gate de promoção obrigatório). `exigeLab`: **sim**. `effort`: **L**. Geral, com variante financeira pesada (§7).

### 6.3 Custo de inferência não observável por caso de uso (Q-I03)

**Mercado.** FinOps aplicado a IA. A [FinOps Foundation mantém o grupo FinOps for AI](https://www.finops.org/wg/finops-for-ai-overview/) (2026), com o ciclo Inform–Optimize–Operate adaptado a token e GPU, e a especificação aberta [FOCUS](https://focus.finops.org/) (2026) para normalizar faturas. Ferramentas: [CloudZero](https://www.cloudzero.com/) (2026), com alocação por unidade de negócio, e [Vantage](https://www.vantage.sh/) (2026). Preço não publicado.

**Norma.** Nenhuma se aplica — é a única célula da matriz sem obrigação por trás. O que sustenta a venda é o argumento do CFO, não o do auditor, e é onde o Signal encosta.

**Entregáveis e duração.** Gateway ou middleware que carimba cada chamada com caso de uso, time e modelo; painel de custo por caso de uso; showback antes de chargeback; unidade econômica definida (custo por 100 mil tokens, por transação atendida). 4–6 semanas, menos com gateway existente.

**Candidato.** *Custo de inferência por caso de uso* — `ASSESS` (onde a inferência é chamada e o que a fatura já distingue) → `PILOT` (instrumentação com carimbo e painel de showback) → `SCALE` (demais casos e unidade econômica) → `EMBED` (custo no rito de orçamento). `exigeLab`: **sim**. `effort`: **M**. Geral. É o gancho comercial mais limpo para o Signal.

---

## 7. Pacotes setoriais

**Financeiro** é o bloco denso, e é o ICP que [icp-e-precificacao.md §4](../comercial/icp-e-precificacao.md) prioriza para o Charter. Três exigências se somam sobre as células 5.3, 6.1 e 6.2:

- **Model risk management.** A [SR 11-7](https://www.federalreserve.gov/boarddocs/srletters/2011/sr1107.htm) (Federal Reserve, 2011) exige validação independente, inventário de modelos e monitoramento contínuo, e os supervisores vêm aplicando os mesmos princípios a IA e IA generativa. O equivalente britânico é a [SS1/23 do Bank of England](https://www.bankofengland.co.uk/prudential-regulation/publication/2023/may/model-risk-management-principles-for-banks-ss) (2023). Isso converte o candidato 6.2 de "registry com rollback" em "dossiê de modelo validado por segunda linha" — outro entregável, outro papel.
- **Resiliência operacional.** [DORA, Regulamento (UE) 2022/2554](https://eur-lex.europa.eu/eli/reg/2022/2554/oj) (2022) acrescenta gestão de risco de TIC, teste de resiliência, reporte de incidente com prazo e gestão de terceiros críticos — que recai sobre provedor de modelo como terceiro.
- **Alto risco no EU AI Act.** [Regulamento (UE) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) (2024), Anexo III, pontos 5(b) e 5(c): avaliação de solvabilidade de pessoa singular e precificação de seguro de vida e saúde são de alto risco. Puxa art. 27 (FRIA), art. 43 (avaliação de conformidade) e art. 49 (registo na base de dados da UE) — nada disso é necessário fora desses casos.

**Saúde** aparece só pela borda: Anexo III, ponto 5(a), e a interação com regime de dispositivo médico. Não levantei fonte suficiente para desenhar pacote; fica na §9.

**Onde o pacote setorial mora.** O [MAPEAMENTO §6](trilhas/MAPEAMENTO.md) deixa a decisão aberta com três saídas. Como o pacote financeiro **muda entregável de fases inteiras** de três candidatos, e não acrescenta um passo solto, recomendo a primeira: **overlay de método**, tornando `ScaffoldTemplateOverlay.tenantId` anulável, com `tenantId` nulo significando "da Nebuloz, aplicável a qualquer tenant". Três razões:

1. A máquina de `ops` (`ADD`/`REMOVE`/`REPLACE` sobre `baseVersionId`) já tem a forma do problema: o pacote financeiro é um conjunto de operações sobre o template geral, não um template paralelo.
2. `ScaffoldOverlayConflict` já levanta conflito quando a versão base avança. Versão setorial separada não levanta — diverge em silêncio, que é o defeito que o próprio schema descreve como fork.
3. Custa uma migration de uma coluna, contra duplicar os passos comuns em cinco trilhas.

O custo a assumir é real: passam a existir **duas camadas de overlay** (método setorial, depois cliente), e a ordem de aplicação e a detecção de conflito precisam ser definidas antes, não descobertas em produção. Se isso for caro demais para o V1, a saída barata do MAPEAMENTO — pacote setorial como material de venda, fora do produto — continua legítima. O que não recomendo é a versão de template por setor.

---

## 8. Lista de candidatos

| # | Template candidato | Eixo | Lacuna | `effort` | Geral/setorial | Cobertura hoje |
|---|---|---|---|---|---|---|
| 1 | Catálogo mínimo das fontes críticas | `DATA` | Q-D01 | M | Geral | Novo |
| 2 | Qualidade observável nas fontes que alimentam IA | `DATA` | Q-D02 | M | Geral | Novo |
| 3 | Recolhimento do dado sombra | `DATA` | Q-D03 | M | Geral + setorial | Parcial — ai-security |
| 4 | Baseline antes do piloto | `PROCESS` | Q-P01 | S | Geral | Novo |
| 5 | Carteira de casos de uso com critério comparável | `PROCESS` | Q-P02 | S | Geral | Novo |
| 6 | Gestão de exceção com revisão executada | `PROCESS` | Q-P03 | M | Geral | Novo |
| 7 | Letramento em IA por persona, com evidência | `PEOPLE` | Q-E01 | M | Geral | Parcial — ai-governance |
| 8 | Formalização dos papéis de dado | `PEOPLE` | Q-E02 | S | Geral | Parcial — ai-governance |
| 9 | Descentralização do conhecimento de IA | `PEOPLE` | Q-E03 | L | Geral | Novo |
| 10 | Política de IA aprovada, versionada e comunicada | `GOVERNANCE` | Q-G01 | M | Geral | **Coberto** — ai-governance |
| 11 | Comitê de IA em operação | `GOVERNANCE` | Q-G02 | M | Geral | **Coberto** — ai-governance |
| 12 | Classificação e controle aplicados ao dado sensível | `GOVERNANCE` | Q-G03 | L | Geral + setorial | Parcial — ai-security, ai-compliance |
| 13 | Ambiente segregado para experimentação | `INFRASTRUCTURE` | Q-I01 | M | Geral | Parcial — ai-security |
| 14 | Ciclo de vida de modelo com rollback testado | `INFRASTRUCTURE` | Q-I02 | L | Geral + setorial | Novo |
| 15 | Custo de inferência por caso de uso | `INFRASTRUCTURE` | Q-I03 | M | Geral | Novo |

Oito novos, cinco parciais, dois cobertos. `exigeLab` em seis (2, 3, 12, 13, 14, 15) — todos os que tocam ambiente ou pipeline. **O desequilíbrio é o achado comercial**: as trilhas existentes cobrem `GOVERNANCE` bem e `DATA`, `PROCESS` e `INFRASTRUCTURE` mal, e são esses três eixos que produzem as lacunas de `effort` L, as entregas de maior ticket.

---

## 9. Lacunas da pesquisa

- **Preço de qualquer concorrente.** Credo AI, Holistic AI, OneTrust, watsonx.governance, Collibra, Monte Carlo, Immuta e CloudZero operam com "fale com vendas". Nenhum número deste documento é preço. Precisa de quem já negociou.
- **Duração real de entrega.** Os prazos das §§2–6 são premissa derivada do escopo do entregável, não histórico. Onde citei número de fornecedor ([Atlan](https://atlan.com/collibra-alternatives/), 2026), é o concorrente falando do rival. O [scaffold-prd §4](scaffold-prd.md) já avisa que duração é premissa a validar na primeira entrega.
- **NIST Cyber AI Profile.** A trilha [ai-security](trilhas/ai-security.md) o cita e não encontrei URL primário estável no nist.gov. Ficou fora das células; quem tiver o link precisa colocá-lo na §5.3 e na §6.1.
- **Mapa de Temas Prioritários da ANPD 2026–2027.** Aparece em análises de escritórios brasileiros e não localizei a publicação no gov.br para citar como primária. A §5.3 o usa com ressalva; confirmar antes de levar a proposta.
- **Regulação bancária e securitária brasileira.** Resolução CMN 4.557/2017 (risco operacional) e as circulares da SUSEP não foram confirmadas com link primário. O pacote financeiro da §7 apoia-se em SR 11-7, SS1/23 e DORA — fontes estrangeiras. Para vender a regulado brasileiro, insuficiente.
- **Pacote setorial de saúde.** Só a borda (Anexo III, 5(a)). A interseção com dispositivo médico (MDR na UE, RDC da Anvisa no Brasil) não foi pesquisada.
- **Células 3.3 e 4.3.** São as duas com menos oferta identificável. Isso pode significar margem alta ou demanda inexistente, e a pesquisa não distingue os dois casos. Precisa de conversa com cliente, não de mais busca.
- **Quem executa.** O [scaffold-prd §5](scaffold-prd.md) registra que não há função dedicada de entrega. Seis dos quinze candidatos exigem LAB e três são `effort` L. Nenhum é vendável antes de essa pendência de RH fechar.
