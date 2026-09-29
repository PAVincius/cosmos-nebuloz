# Pesquisa de validação do registro de decisões (D-01 a D-18)

- **Pedido por:** CEO · **Feito por:** Radar (Pesquisa) · **Data:** 2026-09-28
- **Para:** Sócio (Cofundador), pre-mortem- **Base:** `docs/produto/registro-de-decisoes.md` (27/09), `PRODUCT.md`
- **Pre-mortem do Sócio:** [`docs/socio/2026-09-28-validacao-decisoes.md`](../socio/2026-09-28-validacao-decisoes.md). O parecer dele revisa §2.2 (a marca SAFe pode ser citada como referência ao método; só descrever o produto pela marca viola) e §3.3 a §3.5.
- **Trilhas brutas e verificações** (`trilha-A.md` a `trilha-E.md`): ficaram no scratchpad da sessão e não estão no repositório. O que foi confirmado e o que caiu estão resumidos aqui.

## Resumo
1. **Bem apoiadas pela evidência:** começar com um agente só (D-07.6), ferramenta rodando com a permissão do usuário (D-07.2), memória derivada com vetor como cache (D-12), bitemporal com cadeia de substituição (D-13), pgvector particionado antes de trocar de banco (D-16), peso aprende método e conteúdo vem por recuperação (D-09), dado de cliente não treina peso (D-10), portão de volume antes de hospedar modelo (D-11.3).
2. **Bloqueio novo, fora do registro:** o corpus de treino tem problema contratual, e não só de qualidade. A Usage Policy da Anthropic proíbe usar saída do modelo para treinar modelo sem autorização prévia, e o corpus foi gerado pelo `claude-haiku-4-5`. Além disso, a Scaled Agile proíbe usar "SAFe®" no título ou na descrição de serviços de terceiros, e isso atinge a copy dos produtos, não só o modelo.
3. **Frágeis, levar ao pre-mortem:** preço do Diagnóstico (R$ 48 mil) acima da única faixa brasileira achada; abatimento de 25% contra a prática de crédito integral do piloto pago; gatilho de 90 dias em D-02, que pode disparar sozinho num ciclo enterprise BR mais longo; preço por assento para governança, que o mercado cobra por escopo.
4. **Segurança:** a cerca de prompt (D-14.4) sozinha não segura ataque adaptivo. Falta controle estrutural: bloquear link e imagem vindos de conteúdo recuperado e evitar a "tríade letal".
5. **Confiabilidade:** cinco trilhas, cada uma checada por um verificador independente que abriu as fontes. Números derrubados na verificação ficaram fora ou aparecem riscados abaixo. Preço de concorrente é a parte mais fraca (agregadores, 403).

## Método
- **Cinco trilhas em paralelo:** A concorrência e preço; B GTM e crédito de IA; C copiloto e segurança; D memória; E modelo próprio e regulação.
- **Buscas:** só termos públicos. Nenhum número interno, código ou dado de cliente saiu, porque o parecer da Lacre sobre a conta de pesquisa ainda não existe. A comparação com os números da Nebuloz foi feita aqui, localmente.
- **Verificação:** cada trilha passou por um verificador separado, com veredito por afirmação: CONFIRMADA, PARCIAL, NÃO SUSTENTADA ou MELHOR FONTE. O bruto e as verificações ficam no scratchpad da sessão (`trilha-A.md` … `trilha-E.md`).
- **Acesso:** todas as fontes em 2026-09-28.
- **Legenda:** "Fonte diz" é o que está na página. "Concluo" é inferência do Radar.

---

## 1. Decisões que a evidência apoia

| Decisão | Fonte diz (verificado) | Concluo |
|---|---|---|
| **D-07.6** Um agente, multiagente só com avaliação | A Anthropic mede o multiagente em ~15× os tokens de um chat, e o agente único em ~4×; o formato "não serve bem" quando os agentes dividem contexto ou têm muitas dependências ([Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)). Em 260 configurações, a coordenação vai de +80,8% (tarefa decomponível) a −70,0% (planejamento sequencial) ([arXiv 2512.08296](https://arxiv.org/abs/2512.08296)). Com orçamento igual de tokens, o agente único iguala ou vence em multi-hop ([arXiv 2604.02460](https://arxiv.org/abs/2604.02460)). | Decisão certa. O critério de "provar necessidade" deve nomear o tipo de tarefa: paralelizável e decomponível. |
| **D-07.2** A ferramenta roda com o papel de quem pergunta | OWASP LLM06: "Execute extensions in user's context… with the minimum privileges"; autorizar a jusante, com "complete mediation" ([OWASP](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)). | Certa, mas não basta: ver §3.1 (EchoLeak e Slack AI vazaram com o acesso legítimo do usuário). |
| **D-12** Memória derivada, vetor como cache | A troca de modelo de embedding exige re-embedding do corpus, porque os espaços são incompatíveis (blogs, sem fonte primária). O pgvector recomenda partição por lista ou tabelas separadas para multi-tenant, porque um índice compartilhado degrada o recall dos outros tenants ([pgvector README](https://github.com/pgvector/pgvector)). | Coerente. Nenhum sistema de memória de mercado (Zep, Mem0, Letta) trata a memória como derivada de fonte com dono. É diferencial, sem precedente para copiar. |
| **D-13** Bitemporal, substituir em vez de apagar | O Zep/Graphiti implementa modelo bitemporal e invalidação de aresta ([arXiv 2501.13956](https://arxiv.org/abs/2501.13956)). O Mem0 faz o oposto e apaga a memória contradita (operação DELETE, [arXiv 2504.19413](https://arxiv.org/abs/2504.19413)). Documento obsoleto na recuperação inverte 30% das respostas do Llama e 37% das do Qwen; com "siga o documento", 66% e 75% ([arXiv 2609.31342](https://arxiv.org/abs/2609.31342), preprint de 25/09/2026). | Evidência forte para filtrar por vigência **antes** da geração, e não pedir ao modelo que ignore o obsoleto. O PG18 traz só tempo válido (`WITHOUT OVERLAPS`, `PERIOD`), então o tempo de transação é implementação própria. |
| **D-16** Postgres + índice HNSW antes de trocar de banco | O pgvector filtra **depois** do scan do índice. Desde a 0.8.0, o `iterative_scan` continua até `hnsw.max_scan_tuples` (20.000 por padrão) ([README](https://github.com/pgvector/pgvector)). O único benchmark "pgvector vs Qdrant" achado é de fornecedor (Timescale). | Certa. Detalhe técnico que falta no registro: HNSW com filtro de tenant precisa de `iterative_scan` ligado ou de partição, senão a busca devolve menos que k linhas. |
| **D-14.2** Isolamento que não dependa de lembrar o filtro | Doc oficial: "Superusers and roles with the BYPASSRLS attribute always bypass the row security system"; o dono da tabela também ignora, salvo com `FORCE ROW LEVEL SECURITY` ([PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). | Confirma o ADR-0012. É o item de menor custo e maior efeito: papel de app sem superuser, sem ser dono das tabelas, e com FORCE RLS. |
| **D-09** O peso aprende método; o conteúdo vem por recuperação | O RAG supera o fine-tuning não supervisionado em conhecimento novo: Mistral 7B com RAG 0,875, fine-tune 0,504, fine-tune com paráfrase 0,588 ([Ovadia et al., arXiv 2312.05934](https://arxiv.org/abs/2312.05934)). A LoRA "aprende menos e esquece menos" ([arXiv 2405.09673](https://arxiv.org/abs/2405.09673)). | Certa. Os estudos são de 2023-24, com modelos de 7B. |
| **D-10** Dado de cliente não treina peso compartilhado | O mercado vai para o outro lado. A Atlassian, desde 17/08/2026, deixa a contribuição de metadados sempre ligada nos planos Free, Standard e Premium; o dado de uso dentro do app pode ser desligado pelo admin ([Atlassian Trust](https://www.atlassian.com/trust/ai/data-contribution)). O Salesforce tem configuração ligada por padrão para modelos preditivos globais (Salesforce Ben, secundária). | Vira argumento de venda, desde que esteja escrito no contrato. Reforça o pedido de §8.2 do registro: o CEO confirmar D-10. |
| **D-04 / D-05** Crédito por custo, com cota | O mercado migrou para crédito: Agentforce a 20 créditos por ação = US$ 0,10 (anúncio de 15/05/2025); Copilot Studio a US$ 0,01 por crédito; GitHub Copilot com cobrança por uso em vigor para todos desde 01/06/2026 ([changelog](https://github.blog/changelog/2026-06-01-updates-to-github-copilot-billing-and-plans/)); Notion com créditos desde 04/05/2026. O Cursor trocou requisições por uso atrelado a custo de API em junho de 2025, pediu desculpas ("we didn't handle this pricing rollout well") e reembolsou o período de 16/06 a 04/07 ([Cursor](https://cursor.com/blog/june-2025-pricing)). | Unidade por custo é defensável. O risco documentado é a conta-surpresa, e a cota de 150% que para com mensagem (D-05) protege exatamente disso. Os grandes cobram por **ação**, não por custo; vale checar se o cliente entende "crédito = custo". |
| **D-11.3** Portão de volume | ESTIMATIVA: requisição de 1.500 tokens de entrada e 500 de saída no Haiku 4.5 (US$ 1 / US$ 5 por MTok, [preço oficial](https://platform.claude.com/docs/en/about-claude/pricing)) custa US$ 0,004. Uma L40S em pod 24/7 sai a US$ 1,09/h × 730 h ≈ US$ 796 por mês ([RunPod](https://www.runpod.io/pricing)), e o empate fica em ≈ 200 mil requisições por mês. Esse cálculo não inclui redundância nem engenharia, e o batch da API (US$ 0,50 / 2,50) dobra o empate. | Confirma a direção do registro: abaixo de centenas de milhares de chamadas por mês, a API ganha. O portão 3 tende a ser o mais difícil de passar. |

---

## 2. Bloqueios novos (não estão no registro)

### 2.1 O corpus de treino é contratualmente inutilizável como está (D-09, D-11)
- **Fonte diz:** a Usage Policy da Anthropic proíbe "Utilization of inputs and outputs to train an AI model (e.g., 'model scraping' or 'model distillation') without prior authorization from Anthropic". A política vale para quem acessa os serviços, API inclusive ([AUP](https://www.anthropic.com/legal/aup)). Os Commercial Terms D.4(a) proíbem "train competing AI models" ([termos](https://www.anthropic.com/legal/commercial-terms)). Google e OpenAI proíbem só modelo "que compita" ([Gemini API terms](https://ai.google.dev/gemini-api/terms); OpenAI OSA 3.3(e), em vigor desde 01/01/2026).
- **Registro diz:** parte do `train.jsonl` e o gerador de 10 mil pares usam `claude-haiku-4-5` (D-09). O registro trata isso como teto de qualidade e deixa "os termos do provedor" como item a conferir.
- **Concluo:** o item já tem resposta. Pela AUP, esse corpus não treina nada sem autorização da Anthropic, qualquer que seja a qualidade. Somado aos PDFs de "dumps" (ver 2.2), sobra pouco dado treinável. Isso muda o custo do D-09: o dataset precisa ser escrito ou revisado por gente, ou gerado por modelo aberto com licença que permita.
- **Precisa de:** parecer da Lacre e advogado sobre o alcance de "competing" e de "prior authorization".

### 2.2 Marca e conteúdo SAFe
- **Fonte diz:** "You may use the registered word marks SAFe® and Scaled Agile Framework® only to refer to Scaled Agile, Inc.'s SAFe methodology and offerings. You may not use those trademarks in the title of or to describe any other materials or services." Todo o conteúdo é protegido por copyright e o uso pede Permissions Form ([FAQ Scaled Agile, 26/06/2025](https://support.scaledagile.com/en/articles/9791354-general-content-usage-faqs-and-the-permission-request-form)). A cláusula 3 do Candidate Agreement proíbe usar "materials… containing actual Exam questions or answers" ([Candidate Agreement](https://scaledagile.com/candidate-agreement)). Fornecedor de ferramenta entra como "Platform Partner" ([Scaled Agile](https://support.scaledagile.com/en/articles/9767742-what-is-a-scaled-agile-partner)).
- **Concluo:** o risco não é só do modelo. O Cosmos se descreve pelas "quatro altitudes do SAFe" (`PRODUCT.md`), e o site e a docs pública (`docs/cliente`) usam o termo. A pergunta para a Lacre é se a Nebuloz precisa ser Platform Partner, ou reescrever a copy para citar a metodologia só de forma nominal. O "dumps" confirma o que o registro já dizia: sai do corpus.

---

## 3. Decisões frágeis: perguntas para o pre-mortem do Sócio

### 3.1 D-14.4 — a cerca de prompt não é controle de segurança
- **Fonte diz:** sob ataque adaptivo, o spotlighting subiu de 28% para 99% de sucesso, e o prompt sandwiching de 21% para 95%, em Gemini 2.5 Pro e Llama 3.3 70B. No GPT-5 Mini ficaram em 47% e 69%. As 12 defesas testadas foram contornadas, a maioria acima de 90% ([arXiv 2510.09023](https://arxiv.org/abs/2510.09023)). O CaMeL, defesa estrutural, resolve 77% das tarefas com segurança demonstrável, contra 84% sem defesa ([arXiv 2503.18813](https://arxiv.org/abs/2503.18813)). O Slack AI (20/08/2024) e o EchoLeak (CVE-2025-32711, M365 Copilot) vazaram dado pelo acesso legítimo do usuário, via link ou imagem renderizada.
- **Concluo:** manter a cerca como higiene e acrescentar três coisas:
  1. não renderizar link nem imagem vindos de conteúdo recuperado;
  2. não juntar, numa mesma sessão, dado privado, conteúdo não confiável e saída para fora (Rule of Two, da Meta);
  3. confirmar na tela toda escrita, o que o D-07 já prevê.
- **Pergunta:** o Copilot do Cosmos hoje renderiza markdown com link vindo da ferramenta?

### 3.2 D-07.5 — citação checada por NLI
- **Fonte diz:** o MiniCheck-FT5 chega a 74,7% de acurácia balanceada contra 75,3% do GPT-4 no LLM-AggreFact ([arXiv 2404.10774](https://arxiv.org/abs/2404.10774)). Em 2023, 51,5% das frases de buscadores generativos eram totalmente sustentadas pelas citações ([arXiv 2304.09848](https://arxiv.org/abs/2304.09848)).
- **Concluo:** a própria guarda Fonte já registrou que o NLI erra saída seca de ferramenta (`.maestri/guarda/README.md`). Para frase com número, a checagem deve comparar o valor citado com o valor do banco, por regra. O NLI fica como sinal auxiliar.

### 3.3 D-02 / D-06 — preço e abatimento do Diagnóstico
- **Fonte diz:** uma consultoria brasileira publica "Diagnóstico e priorização de casos de uso: R$ 10 mil a R$ 40 mil, 3 a 6 semanas" ([Waxi](https://www.waxi.com.br/blog/quanto-custa-consultoria-de-ia)). É blog, com faixa típica e escopo diferente. Existem autoavaliações gratuitas (Inteli, APIA; não verificado). Na prática de piloto pago relatada, o piloto custa 10-30% do ACV e 100% dele é creditado na conversão ([Monetizely](https://www.getmonetizely.com/articles/how-to-structure-enterprise-pilot-program-pricing-effective-proof-of-concept-strategies), blog de consultoria, sem dado empírico).
- **Registro diz:** SV-01 a R$ 48.000; o abatimento é de até 25% e incide só sobre implantação.
- **Perguntas:**
  1. O que justifica o Diagnóstico ficar acima do teto da única faixa brasileira achada? O Meridian (plataforma, override auditável, escala de confiança) precisa aparecer no preço, senão o comprador compara com consultoria.
  2. Um abatimento de 25% é suficiente quando o mercado fala em crédito integral? Ou crédito integral sobre a implantação troca margem por conversão de um jeito melhor?
- **Ressalva:** a evidência é fraca (blogs). Vale uma rodada de preço com dois ou três compradores do ICP.

### 3.4 D-02 — gatilho de "ciclo acima de 90 dias"
- **Fonte diz:** blogs brasileiros de vendas dão de 60 a 180 dias, e de 8 a 12 meses para software enterprise (terceira mão, via Ploomes citando a Tecla T). A a16z (Martin Casado, 12/03/2018) defende cobrar serviço em enterprise, com o alerta: "services dollars are not necessarily a signal for product-market fit" ([a16z](https://a16z.com/the-case-for-services-in-enterprise-software-startups/)). A margem mediana é de 30% em serviços contra 81% em assinatura (Benchmarkit 2025, via [Orb](https://www.withorb.com/blog/saas-growth-margin-statistics)).
- **Concluo:** se o ciclo real for de 6 a 12 meses, o gatilho de 90 dias dispara na primeira conta e não diferencia nada. Proposta: medir o ciclo do Diagnóstico isolado (ticket fixo, curto) separado do ciclo da assinatura, reportar a receita de serviço à parte e fixar um prazo para migrar para assinatura.

### 3.5 D-03 — assento como unidade para os cinco produtos
- **Fonte diz:** a Atlassian publica só a Strategy Collection (que inclui o Jira Align) a US$ 77.400 por ano na faixa de 1 a 50 usuários ([Atlassian](https://www.atlassian.com/software/jira-align/pricing)). Os US$ 129 por usuário são derivação de terceiro (77.400 ÷ 50 ÷ 12). A IBM publica watsonx.governance Risk & Compliance a partir de US$ 3.500 por mês ([IBM](https://www.ibm.com/products/watsonx-governance/pricing)). Plataformas de governança de IA cobram por escopo (modelos, casos de uso), com orçamento de "$25K–$200K+ annually" ([CloudZero](https://www.cloudzero.com/blog/ai-governance-tools)).
- ~~Governança mid-market US$ 30-90 mil / watsonx US$ 795 / Rally US$ 35 fixo~~: derrubados na verificação.
- **Concluo:** R$ 199 por assento equivale a US$ 35 com câmbio de R$ 5,69. Com dólar abaixo disso, o preço fica acima do teto das ferramentas ágeis de time (conta: 199 ÷ 35). O ponto mais sério é o comprador do Charter (Compliance e Riscos), que não é usuário de assento, enquanto o mercado dele cobra por escopo governado.
- **Pergunta:** o assento captura o valor do Charter, ou o Charter precisa de um componente por caso de uso?

### 3.6 D-01 — suíte anunciada inteira, com lista de espera
- **Fonte diz:** não achamos caso B2B de suíte lançada com produtos em lista de espera; a evidência sobre vaporware é genérica. O Planview lançou em 2026 o "Agent Resource Management", que chama de plano de governança de pessoas e agentes, com "proof of which outcomes your AI investments deliver" ([Business Wire, 16/06/2026](https://www.businesswire.com/news/home/20260616559069/en)).
- **Concluo:** "Nenhuma suíte cobre as cinco fases" não se prova. O verificador achou contraevidência parcial: o Planview cobre portfólio, valor e governança de IA, mas não prontidão nem caso de negócio. A lacuna defensável é **prontidão + caso de negócio assinado**, em português. A janela existe e está diminuindo.
- **Pergunta:** anunciar a suíte inteira compensa o risco de confiança, ou é melhor anunciar só o que está liberado e com data?

### 3.7 D-15 — apagamento em índice vetorial
- **Fonte diz:** o Vec2Text reconstrói 92% de textos de 32 tokens a partir do embedding ([arXiv 2310.06816](https://arxiv.org/abs/2310.06816)). Embeddings removidos só logicamente (soft-delete) em HNSW continuam reconstruíveis: 25,5% dos nomes exatos, com três implementações testadas ([arXiv 2606.18497](https://arxiv.org/abs/2606.18497)). Para o EDPB, um modelo treinado com dado pessoal "cannot, in all cases, be considered anonymous", e a avaliação é caso a caso (Opinion 28/2024, via resumos; PDF não lido). Não achei posição da ANPD sobre embeddings.
- **Concluo:** "apagar na origem e refazer" (D-12, D-15) precisa incluir remoção física do vetor e reconstrução ou `VACUUM` do índice, e não só marcar a linha como apagada. Tratar embedding de texto pessoal como dado pessoal, por cautela. Pergunta para a Lacre.

### 3.8 Regulação — prazos
- **Fonte diz:** o Art. 50 do AI Act está em vigor desde 02/08/2026. O Digital Omnibus (Reg. UE 2026/1744, em vigor em 27/07/2026, segundo fontes secundárias) adiou o alto risco do Anexo III para 02/12/2027 e manteve o Art. 50. No Brasil, a ficha oficial do PL 2338/2023 mostra "Aguardando Parecer do(a) Relator(a) na Comissão Especial" ([Câmara](https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2487262)).
- **Concluo:** o dever de informar "você está falando com uma IA" (Art. 50.1) vale para o copiloto de D-07 junto a cliente com operação na UE, não só para o modelo próprio de D-11. No Brasil, ainda não há obrigação nova.

---

## 4. Lacunas
- Não há preço oficial de Planview, ServiceNow, Rally ou Credo AI, nem preço em reais; os agregadores responderam 403.
- Não há dado institucional brasileiro de ciclo e CAC (Distrito, ABStartups, Endeavor).
- Não há número de adoção de SAFe no Brasil.
- Não há pesquisa do recorte do ICP (200 a 2.000 funcionários). O gasto de IA do IDC (US$ 3,4 bi em 2026) é gasto total, puxado por infraestrutura, e não serve como mercado endereçável.
- Não há posição da ANPD sobre embeddings nem sobre operador × controlador em treino.
- Não foram lidos na íntegra o PDF do EDPB, o EUR-Lex do Omnibus, a definição de "Permitted Exception" da OpenAI, a seção 3 dos Consumer Terms da Anthropic e a cláusula 5 do Candidate Agreement.
- Não há medição de acurácia de NLI em frases com número em português. Só um teste próprio responde isso.

## 5. Números derrubados na verificação (não usar)
- Faixa de governança de IA "US$ 30-90 mil mid-market / US$ 100-500 mil enterprise": a fonte diz US$ 25-200 mil+, sem divisão.
- watsonx.governance a US$ 795: não existe na fonte nem na IBM.
- GitHub Copilot "10-50× mais caro": sem fonte.
- "Metade dos pivôs consultoria→SaaS falha": citação sem estudo, e sobre pivô SaaS em geral.
- "LLM cai perto de 0% em cálculo multivariado / FinQANet 22,78%": não está no paper. O que ele diz é "accuracy falls up to 51% as reasoning depth increases" ([arXiv 2608.11047](https://arxiv.org/abs/2608.11047)).
- LoCoMo "Mem0 58,44%": na verdade é a nota que a Mem0 atribui ao Zep.
- Atlassian "opt-out só no Enterprise": simplificação de fonte concorrente (GitLab). A regra oficial está em §1, D-10.
