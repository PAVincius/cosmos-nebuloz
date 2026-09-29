# Pre-mortem: pesquisa de validação do registro de decisões (D-01 a D-18)

- **Pedido por:** Radar (Pesquisa), a pedido do CEO · **Feito por:** Sócio (Cofundador) · **Data:** 2026-09-28
- **Base:** relatório do Radar (`2026-09-28-validacao-decisoes.md`, scratchpad da sessão dele, com `trilha-A..E.md`), `docs/produto/registro-de-decisoes.md` (27/09), `docs/comercial/pacotes-e-precificacao.md`, `experiments/slm-pipeline/scripts/`, AUP e Commercial Terms da Anthropic (lidos em 2026-09-28).
- **Formato:** "daqui a 12 meses isso deu errado; por quê?" Três causas, sinal precoce e custo de desfazer. Depois, parecer item a item do §2 e §3 do Radar.

Regra que segue: número sem fonte não existe. O que está sem fonte está marcado como hipótese.

---

## 1. Daqui a 12 meses deu errado. As três causas mais prováveis

### Causa 1 — Viramos consultoria e a assinatura nunca chegou (D-02, D-06)

**Por quê.** D-02 diz que o serviço sustenta o caixa até a assinatura. Mas ninguém sabe quanto caixa o serviço precisa sustentar: `docs/financeiro/caixa-13-semanas.md` está inteiro em `⟨preencher⟩` (linhas 18-34). O gatilho de "90 dias nas três primeiras contas" mede calendário, não caixa. A margem de serviço é 30% contra 81% de assinatura (Benchmarkit 2025 via Orb, relatório §3.4), então cada real de Diagnóstico exige gente de entrega, e gente de entrega contratada para serviço é o que mais custa desfazer. O a16z avisa exatamente isso: "services dollars are not necessarily a signal for product-market fit" (relatório §3.4).

**Sinal precoce.** Duas coisas, ambas antes de dezembro de 2026:
1. O caixa de 13 semanas continua em `⟨preencher⟩` na primeira revisão de outubro.
2. Três propostas de Diagnóstico enviadas sem nenhuma proposta de produto avulso (D-06) junto.

**Custo de desfazer.** Alto. Contrato de entrega de 4 semanas com "consultor sênior + arquiteto de dados" (`pacotes-e-precificacao.md` §5, `2026-09-catalogo-nebuloz.sql:21-23`) é gente. Desfazer é demissão ou ociosidade.

### Causa 2 — O modelo próprio consumiu engenharia e não pode ser usado (D-09, D-11)

**Por quê.** Três amarras, e nenhuma delas é de qualidade:
1. A AUP da Anthropic proíbe "Utilization of inputs and outputs to train an AI model (e.g., 'model scraping' or 'model distillation') without prior authorization from Anthropic". Confirmei o texto literal em 2026-09-28 na página `anthropic.com/legal/aup`, seção "Do Not Compromise Anthropic Products or Services". Os dois scripts de corpus chamam `claude-haiku-4-5-20251001` pela API (`etl_safe_corpus.py:140`, `generate_safe_10k.py:39`).
2. A AUP não diz "modelo concorrente". Diz "an AI model". O Commercial Terms D.4(a) diz "train competing AI models". São dois textos com alcance diferente, e o mais restritivo é o que vale até um advogado dizer o contrário.
3. O corpus substituto que o D-09 propõe ("o método escrito da Nebuloz, especificações e ADRs revisados por gente") também é saída de modelo. Esta empresa escreve especificação, ADR e registro de decisão com agentes Claude no Maestri. "Revisado por gente" não muda a origem. Se a cláusula alcança isso, não sobra corpus nenhum de dentro da casa.

**Sinal precoce.** Qualquer hora de GPU ou de engenharia gasta em treino antes de (a) o parecer da Lacre sobre o alcance de "prior authorization" e "competing" e (b) a suíte de avaliação do portão 1 de D-11 existir.

**Custo de desfazer.** Hoje, perto de zero: o repositório tem 127 pares (`data/processed/train.jsonl`, 94,5 KB) e nenhum treino. Fica alto no dia em que SV-09 ou SV-10 for vendido com esse peso dentro. O portão 2 de D-11 (registro no LAB) só protege se a ficha do dataset perguntar, item a item, "gerado por qual modelo, sob qual termo".

### Causa 3 — Um comprador de governança pediu prova de isolamento e não tínhamos (D-14, D-03)

**Por quê.** O comprador do Charter é Compliance e Riscos (relatório §3.5). É quem manda questionário de segurança antes de assinar. O que ele vai achar hoje: RLS declarada e inerte (ADR-0012), isolamento por `WHERE "tenantId"` numa consulta, vetor que sobrevive à revogação de consentimento e ao apagamento LGPD (registro D-14, conferido no código em 27/09). Vender governança com a própria memória sem isolamento testado é o tipo de contradição que um comprador de compliance encontra e conta para os outros.

**Sinal precoce.** O primeiro questionário de segurança ou DPA negociado com cliente. Se as quatro correções de D-14 ainda estiverem "tarefa separada" nesse dia, a causa se confirmou.

**Custo de desfazer.** Técnico: médio, e já está escopado (D-14 itens 1-4). Reputacional: alto, porque a promessa do Charter é "É permitido? Sob qual risco?".

### O risco que ninguém nomeou

A pesquisa foi feita com o bloqueio contratual olhando para o corpus de SAFe. O alcance real é maior: a Nebuloz é uma empresa cujo texto interno sai de modelo. Se a Lacre concluir que a cláusula da AUP alcança texto revisado por gente, o D-09 não perde um dataset; perde a tese de que "o ativo durável é o dataset". A pergunta para a Lacre precisa ser essa, não só "posso usar o Haiku para gerar pares".

---

## 2. Parecer sobre os bloqueios novos (§2 do Radar)

### 2.1 AUP da Anthropic × corpus do D-09 — **concordo, e amplio**

- **Concordo:** o corpus versionado não treina nada. Texto literal conferido (acima).
- **Amplio:** ver Causa 2, item 3. O corpus substituto tem a mesma origem.
- **Falta evidência:** a AUP diz "without prior authorization", logo existe caminho de pedir. Não sei o custo nem o prazo. Hipótese: para uma LoRA de SAFe sobre Mistral-7B, que não concorre com a Anthropic, a autorização é viável. Só a Lacre com advogado responde. Segunda hipótese, também para a Lacre: licença de modelo aberto pode trazer a mesma amarra (a licença comunitária do Llama proíbe usar saída para melhorar outro LLM; marco como lembrança, não conferi a versão vigente). Apache 2.0 (Mistral, Qwen) não tem isso.
- **O que mudaria na decisão:**
  1. D-09 ganha uma linha de estado: **"Bloqueada até parecer da Lacre sobre AUP"**. Não é proposta pendente de qualidade; é proposta pendente de licença.
  2. O portão 2 de D-11 (LAB, L-09) passa a exigir proveniência por item: modelo gerador e termo de uso. Sem isso, "dataset classificado" não classifica o que importa.
  3. Zero gasto em treino até os dois acima. Hoje isso custa nada, porque não há treino no repositório.

### 2.2 Marca SAFe na copy — **concordo em parte; discordo do tamanho**

- **Concordo:** o FAQ da Scaled Agile é literal (relatório §2.2), e os "dumps" saem do corpus, como o registro já dizia.
- **Discordo do tamanho:** a mesma frase do FAQ permite usar a marca "to refer to Scaled Agile, Inc.'s SAFe methodology". Uso nominativo é permitido. O que viola é usar SAFe como adjetivo de produto nosso. Nas 26 ocorrências que contei (`PRODUCT.md` 3, `apps/app/components/cosmos/PRODUCT.md` 11, `apps/app/components/charter/PRODUCT.md` 1, `docs/cliente/` 11), as amostras que li são dos dois tipos: "em empresa que adotou ou está adotando SAFe" é nominativo; "as quatro altitudes do SAFe sobre um banco de fatos" e "Portfólio, ART, time e analytics de SAFe" descrevem o Cosmos pela marca. Isso é o que o FAQ proíbe.
- **Falta evidência:** um inventário das 26 ocorrências classificado em nominativo × descritivo. É trabalho de uma hora do Norte ou da Ponte, não de advogado. E: se Scaled Agile aplica a regra contra fornecedor pequeno fora dos EUA. Hipótese: aplica, porque marca que não se defende se perde.
- **O que mudaria na decisão:** nenhuma decisão muda. Entra uma regra de copy em `PRODUCT.md` e no glossário: SAFe® só como referência ao método, com ®, nunca como adjetivo de produto Nebuloz; rodapé de marca no site e na docs pública. Custo de desfazer hoje: uma tarde, porque D-01 garante que nada foi vendido. Custo depois do site e do material impresso: cease-and-desist e reimpressão. A pergunta "Platform Partner ou não" vai para a Lacre, mas não trava nada.

---

## 3. Parecer sobre as decisões frágeis (§3 do Radar)

### 3.3 Preço do Diagnóstico (R$ 48.000) — **discordo da comparação; falta evidência de comprador**

- **Discordo:** comparar R$ 48.000 com "R$ 10 mil a R$ 40 mil, 3 a 6 semanas" de um blog de consultoria (Waxi) com escopo diferente não diz que o preço está alto. Diz que um blog cobra menos por outra coisa. O próprio Radar ressalva isso.
- **O que o registro esconde:** o preço nunca encontrou um comprador. Produção tem 7 tenants, TOTVS é lead e não cliente, nenhum trial registrado (`memoria-empresa.md`, estado do banco em 2026-09-22). O 1,9× sobre CAC de `pacotes-e-precificacao.md` §5 é hipótese sobre hipótese: CAC de R$ 15.188 e 100 horas a R$ 150 são ambos marcados "hipótese" no §6.1 do mesmo documento.
- **O que mudaria:** não mudar o preço por blog. Definir antes das três primeiras propostas o que conta como sinal: se em duas das três a objeção for "consultoria X cobra menos", o problema é copy (o Meridian não aparece no preço, como o Radar diz), não preço. Se a objeção for "não tenho R$ 48 mil nessa verba", o problema é o ticket, e a resposta é escopo menor com preço menor, não desconto. A faixa de 15% sem aprovação (`LIMITE_DESCONTO_SEM_APROVACAO`, real) é o espaço de teste; não abrir mais.

### 3.3 Abatimento de 25% × crédito integral — **concordo com o registro; a parte frágil é outra**

- **Concordo com o teto de 25%:** as razões 1 e 2 de `pacotes-e-precificacao.md` §5 são sólidas (ano 1 sairia de graça; verbas diferentes). A fonte do "crédito integral" é blog de consultoria sem dado empírico, o verificador do Radar marcou PARCIAL. Não troco uma conta feita por um blog.
- **Razão 3 é fraca:** "distorce o MRR" é consequência de lançar o crédito como desconto de mensalidade. Lançado como linha própria ("crédito de conversão"), não toca `valorMensalCentavos`. É escolha de modelagem, não argumento de preço.
- **A parte frágil:** o crédito só vale sobre "serviço de implantação". Quem compra Ideação sem implantação recebe um crédito que não consegue gastar. Hipótese: esse comprador lê o abatimento como upsell de outro serviço, não como desconto, e a porta de entrada perde o efeito de porta. Sinal precoce: primeira proposta em que o crédito não é usado. Mudança: manter 25% e manter fora da mensalidade, mas deixar o crédito valer sobre qualquer serviço do primeiro contrato anual, inclusive Scaffold por projeto.

### 3.4 Gatilho de 90 dias em D-02 — **concordo que dispara sozinho; discordo do remédio**

- **Concordo:** se o ciclo enterprise BR é de 6 a 12 meses (terceira mão, relatório §3.4), 90 dias dispara na primeira conta e não separa nada.
- **Discordo do remédio "medir ciclo do Diagnóstico separado":** é correto, mas mede a coisa errada. O que o gatilho quer proteger é o caixa, e o caixa não tem número (Causa 1). Um gatilho de calendário sem número de caixa é um gatilho que dispara e ninguém sabe o que fazer.
- **O que mudaria:** trocar "ciclo acima de 90 dias" por dois gatilhos:
  1. **Do produto:** o Diagnóstico é ticket fixo e curto. Se o ciclo dele passa de 90 dias, a oferta não é porta de entrada e precisa de escopo menor. Esse continua.
  2. **Do caixa:** "se na revisão semanal o saldo projetado da semana 13 cair abaixo de X" com X definido pelo Caixa depois de preencher o forecast. Enquanto o forecast estiver vazio, D-02 é decisão sem sensor.
  Custo de desfazer: zero, é um limiar.

### 3.5 Assento como unidade para o Charter — **concordo com a pergunta; discordo da resposta implícita**

- **Concordo:** o comprador do Charter não é usuário de assento, e o mercado dele cobra por escopo governado (CloudZero, relatório §3.5, com os números de faixa derrubados na verificação).
- **Discordo de "cobrar por escopo":** no pacote, os cinco produtos entram e o valor do Charter está no preço do assento do pacote, não no assento do Charter. O problema só existe no avulso, e o avulso já tem componente que não é assento: Charter avulso custa R$ 1.800 de mensalidade de módulo mais 200 créditos por conta (`pacotes-e-precificacao.md` §4, tabela de franquia). A mensalidade do módulo é o "por escopo" que o Radar pede. Se ela está baixa, o ajuste é nela, não na unidade.
- **Falta evidência:** se R$ 1.800 captura o valor para Compliance de uma empresa de 200 a 2.000 pessoas. Sem comprador, ninguém sabe. E o câmbio: "R$ 199 = US$ 35" só vale a R$ 5,69; a comparação com Jira Align (US$ 129 derivado de terceiro) é ordem de grandeza.
- **Risco que o assento cria e ninguém escreveu:** Charter e Signal valem mais quanto mais gente está dentro (trilha de auditoria, medição). Preço por assento ensina a reduzir assentos. O mínimo abaixo do teto (D-03) atenua; o sinal já está em D-03 (`usoDaFranquia` abaixo de 30%). Acrescento um: proporção de assentos ativos sobre assentos faturados abaixo de 60% na Ideação. Marco 60% como hipótese.

### 3.1 Cerca de prompt em D-14.4 — **concordo; a evidência é a mais forte do relatório**

- **Concordo:** 12 defesas de prompt contornadas sob ataque adaptativo, a maioria acima de 90% (arXiv 2510.09023). Cerca é higiene, não controle.
- **Estado do código, conferido hoje:** só `actions/epics/analyze-invest.ts` usa `prompt-fence`. O Copilot passa o conteúdo indexado por `sanitizeForPrompt` (`actions/safe-copilot/indexer.ts`), que é outra coisa. Na tela do Copilot (`components/cosmos/screens/copilot-parts.tsx`) não achei renderizador de markdown nem `href` vindo de mensagem; o único `href` é o download de blob (linha 350). Então a pergunta do Radar ("renderiza link vindo da ferramenta?") tem resposta provável **não, hoje**. Vale confirmar com o Dev Cosmos, porque D-07 leva o copiloto para cinco produtos e a próxima tela pode renderizar.
- **O que mudaria na decisão:** reescrever D-14.4 de "o texto passa pela cerca" para três regras estruturais, na ordem: (1) escrita confirmada na tela, que D-07 já prevê; (2) nunca renderizar link ou imagem vindos de conteúdo recuperado; (3) nunca juntar, na mesma sessão, dado privado, conteúdo não confiável e saída para fora. A cerca fica como item 4. Custo de desfazer: baixo agora, alto quando o copiloto estiver em cinco produtos.

---

## 4. Onde concordo em uma linha

- §1 do Radar (D-07.6, D-07.2, D-12, D-13, D-16, D-14.2, D-09 direção, D-10, D-04/05, D-11.3): concordo. Não invento objeção.
- Dois achados de §1 são de engenharia e não do CEO: filtrar por vigência **antes** da geração (D-13) e `iterative_scan` ou partição no HNSW com filtro de tenant (D-16). Vão para a Morgana, não para a decisão.
- §3.6 (suíte anunciada com lista de espera): a lacuna defensável é "prontidão + caso de negócio assinado, em português". Concordo. Anunciar a suíte inteira só custa confiança se a lista de espera não tiver data; com data, é roadmap.
- §3.7 (apagar vetor de verdade, não soft-delete): concordo. É correção de D-15, cabe no mesmo lote de D-14.
- §3.8 (Art. 50 vale para o copiloto de D-07 junto a cliente com operação na UE): concordo. E a própria AUP da Anthropic exige o mesmo aviso "you are interacting with AI" para chatbot voltado a consumidor, então a obrigação já existe por contrato antes de existir por lei.

---

## 5. O que eu pararia de fazer, e uma pergunta só para o CEO

**Pararia:** qualquer trabalho no modelo próprio além de escrever a suíte de avaliação (portão 1 de D-11). O resto está bloqueado por licença e por ausência de medição, e o custo de parar hoje é zero.

**Pergunta ao CEO:** o Diagnóstico existe para vender assinatura ou para pagar a folha? As duas respostas são legítimas, mas pedem gente diferente na entrega e um gatilho diferente em D-02. O registro assume a primeira e o caixa vazio sugere a segunda.

## 6. Decisões

Nenhuma decisão tomada neste documento. Objeções que mudarem decisão do CEO viram registro (`registrar.mjs --agente Socio`).

## 7. Encaminhamentos

| Para quem | O quê |
|---|---|
| Lacre | Alcance de "prior authorization" e "competing" na AUP e no Commercial Terms D.4(a), incluindo texto revisado por gente gerado com Claude; Platform Partner ou uso nominativo de SAFe® |
| Caixa | Preencher `caixa-13-semanas.md`; propor o X do gatilho de caixa em D-02 |
| Norte / Ponte | Inventário das 26 ocorrências de SAFe na copy, nominativo × descritivo; regra de copy em `PRODUCT.md` |
| Morgana | D-13 vigência antes da geração; D-16 `iterative_scan`; confirmar que a tela do Copilot não renderiza link de ferramenta |
