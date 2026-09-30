# Registro de decisões

- **Pedido por:** CEO · **Data:** 2026-09-27
- **Consolida:** preço, produtos futuros, modelo próprio para desenvolvimento
  com IA e memória empresarial de longo prazo.
- Uma entrada por decisão, com estado, dono no Maestri e o sinal que faria
  revê-la. Os números de preço moram em
  [`pacotes-e-precificacao.md`](../comercial/pacotes-e-precificacao.md). Aqui
  ficam a decisão e o porquê.

## Como ler

| Estado | Significa |
|---|---|
| **Decidida** | O CEO decidiu. A entrada cita quando e onde. |
| **Direção** | O CEO definiu o rumo. As condições da entrada são proposta até ele aprová-las. |
| **Proposta** | Recomendação com evidência. Aguarda o CEO. |

Três regras valem para o registro inteiro:

- **Entrada errada não se apaga.** Risca e diz por quê, como em
  `.maestri/memoria/`. O histórico de uma decisão revista é parte da decisão.
- **Decisão de arquitetura aceita vira ADR.** Um ADR por decisão, em
  `docs/adr/`, e a entrada daqui passa a apontar para ele. É o ADR que chega
  aos especialistas do Maestri: `scripts/knowledge/exportar.mts` lê `docs/adr`
  e `.claude/completions`, não este arquivo.
- **Preço, gasto e contratação passam pelo pre-mortem do Sócio** antes de
  chegar ao CEO (papel Cofundador em `.maestri/setup-canvas.sh`). Nenhuma
  entrada de preço daqui teve pre-mortem ainda.

## Resumo

| ID | Decisão | Estado | Dono no Maestri |
|---|---|---|---|
| D-01 | Nenhum produto é vendido antes de passar pela esteira de validação; o lançamento é produto a produto | **Decidida** | Morgana, Crivo |
| D-02 | A primeira receita é serviço; a assinatura entra produto a produto | **Decidida**, por consequência de D-01 | Ordem → Caixa, Ponte |
| D-03 | Quatro pacotes por assento, com mínimo abaixo do teto | Proposta | Caixa, Ponte · pre-mortem do Sócio |
| D-04 | Crédito de IA é unidade de custo, não de mensagem | Proposta | Caixa |
| D-05 | Cota técnica de 150% da franquia enquanto o excedente não é cobrado | Proposta | Caixa, Dev Cosmos |
| D-06 | Avulso vendido por vendedor tem piso; o Diagnóstico abate até 25%, sobre serviço | Proposta | Ponte |
| D-07 | Um copiloto com escopo por produto, não cinco chatbots | **Direção** | Norte → Regua |
| D-08 | Raio X: um documento por cliente, feito de relatórios congelados, com page index como sumário | **Direção**; page index **Decidida** | Norte → Regua |
| D-09 | O peso aprende método; documentação atual e memória entram por recuperação | Proposta | Norte, Dev Plataforma |
| D-10 | Dado de cliente nunca treina peso compartilhado | Proposta | Lacre |
| D-11 | Modelo próprio só atende cliente depois de quatro portões | Proposta | Morgana, Caixa, Lacre |
| D-12 | A memória é índice derivado de registros com dono, nunca fonte | **Direção** | Dev Plataforma → ADR |
| D-13 | Item de memória é tipado, datado, com origem, e substituído em vez de apagado | Proposta | Dev Plataforma |
| D-14 | A memória herda a permissão da origem e tem isolamento testado | Proposta | Vigia, Dev Plataforma |
| D-15 | Retenção e apagamento da memória seguem o contrato e a LGPD | Proposta | Lacre |
| D-16 | Décadas em três camadas, no Postgres até medir o limite | Proposta | Dev Plataforma, Pilar |
| D-17 | Memória igual em todos os pacotes: mesmo horizonte, mesmas fontes | **Decidida** | Ponte, Caixa |
| D-18 | A Nebuloz é o primeiro tenant da memória | Em andamento (agentes) | Morgana |
| D-19 | Meridian A3: "Ver evidência" exibido também em Coleta e no gap, escopo mínimo ([escopo](meridian-escopo-dogfood-a3-a5.md)) | **Decidida** (CEO, 2026-09-29) | Norte → Regua → Bussola |
| D-20 | Meridian A5: tela de dependência/ciclo e ajuste de gap fica para depois, com gatilho ([escopo](meridian-escopo-dogfood-a3-a5.md)) | **Decidida** (CEO, 2026-09-29) | Norte → Regua, Crivo |
| D-21 | Meridian: benchmark travado por tenant; só staff Nebuloz liga, no back-office, com aditivo ([PRD §10](meridian-prd.md)) | **Decidida** (CEO, 2026-09-29) | Norte → Regua (spec 012) → Bussola |
| D-22 | Meridian: benchmark travado também esconde a leitura; contribui e lê juntos; interno habilitado lê; staff no back-office fora da regra ([PRD §10](meridian-prd.md)) | **Decidida** (CEO, 2026-09-29) | Norte → Regua (emenda 012) → Bussola |
| D-23 | Scaffold: trilha de framework com o mínimo de schema. Entregável referencia a cláusula no catálogo do Charter (sem FK); perfil de organização dispensa entregável com motivo; `archetype` do template opcional; oferta fica no `Service` do back-office. ~~Trilha escolhida: AI Governance, com perfis e catálogo completado no mesmo PR~~ Substituída pela D-24: AI Governance vira trilha de apoio; neste PR entram só F1 (com códigos existentes) e F3 ([mapeamento](trilhas/framework-no-scaffold.md)) | Proposta (provisória, 2026-09-30) | Norte → Regua → Andaime |
| D-24 | Scaffold: trilha principal **Fundação de Prontidão de IA** (`ai-readiness-foundation`), derivada das faixas e arquétipos do Meridian. Piloto sem chão com limiar 40; gates v1 manuais (derivado depois, com gatilho); SG-04 mantido, com baseline de scores na ASSESS; D-23 F1 (sem ampliar catálogo) e F3 entram, F2 não; overlay de entregável, com REMOVE de obrigatório só pelo consultor ([§7](trilhas/framework-no-scaffold.md)) | Proposta (provisória, 2026-09-30; trilha escolhida pelo CEO) | Norte → Regua → Andaime |

---

## 1. Sequência

### D-01 — Nenhum produto é vendido antes de passar pela esteira de validação

**Estado:** Decidida pelo CEO em 2026-09-27 ("a gente tem que terminar todos
os softwares e fazer todas as validações"). **Dono:** Morgana, com o Crivo (QA).

A esteira é a do Maestri. A spec sai com critério de aceite (Regua) e vai ao
dev. Depois passa pelo QA (Crivo). Passa pelo Security Reviewer quando toca
action, auth ou dado de tenant, e pelo parecer da Compliance (Lacre) quando
coleta dado pessoal. Então vira PR, e a Infra aplica em produção
(`.maestri/setup-canvas.sh`, papel da Morgana). Produto sem critério de sucesso
não passa. Charter, Cosmos e Signal ainda não têm critério de sucesso
(`prontidao-lancamento.md` §1).

**A consequência muda o plano de receita.** O Meridian é o mais perto de
pronto, e mesmo ele tem uso externo bloqueado até as condições 2 a 5 do
parecer de compliance (`docs/compliance/2026-09-24-parecer-meridian-respondente.md`
§4). Nenhum pacote de cinco produtos é vendável antes de os cinco passarem.

**Lançamento produto a produto** (decidido pelo CEO em 2026-09-27). Cada
produto é liberado quando passa pela esteira, na ordem do dogfood:
Meridian → Scaffold → Charter → Cosmos → Signal (`prontidao-lancamento.md` §3).
A suíte é anunciada inteira, e os produtos ainda não liberados ficam em lista de
espera.

### D-02 — A primeira receita é serviço; a assinatura entra produto a produto

**Estado:** Decidida em 2026-09-27, por consequência de D-01: se o lançamento é produto a produto, os primeiros liberados são serviço. **Dono:** Ordem, dividindo entre Caixa e Ponte.

Na ordem do dogfood, os dois primeiros liberados são o Diagnóstico (SV-01,
R$ 48.000 por projeto) e o Scaffold. Os dois são vendidos por projeto. A
assinatura só aparece quando Charter e Cosmos passarem.

- **Caixa:** até lá, o CAC se paga com margem de serviço, não com MRR. Com as
  hipóteses do documento de preço, o Diagnóstico sozinho cobre 1,9× o próprio
  CAC (`pacotes-e-precificacao.md` §5). É o único item da suíte que se paga sem
  recorrência.
- **Pacotes:** a tabela de D-03 entra no catálogo como referência e vira oferta
  quando os cinco produtos passarem (D-01). Antes disso, a assinatura possível é
  o produto avulso já liberado (D-06).
- **Alternativa rejeitada:** vender pacote com produto em lista de espera
  dentro. É cobrar por promessa, o risco que o [Signal PRD](./signal-prd.md) §7
  já registra para um produto só.
- **Revisitar se:** o ciclo de venda do Diagnóstico passar de 90 dias nas três
  primeiras contas. Aí o serviço não sustenta o caixa até a assinatura chegar.

---

## 2. Precificação

Números, premissas e contas em
[`pacotes-e-precificacao.md`](../comercial/pacotes-e-precificacao.md). Aqui, só
o que se decide.

### D-03 — Quatro pacotes por assento, com mínimo abaixo do teto

**Estado:** Proposta. **Dono:** Caixa confere os números; Ponte cuida do
empacotamento e da copy. Falta o pre-mortem do Sócio.

Ideação, Validação, Growth e Scale custam R$ 199, 195, 169 e 189 por assento.
Os mínimos são 20, 30, 60 e 150 assentos, e os tetos 25, 50, 100 e faixas de 50.
Os cinco produtos entram em todos. No pior caso da alçada, LTV/CAC fica entre
5,4× e 8,5×.

- **Por que mínimo abaixo do teto:** com mínimo igual ao teto, o 26º assento
  custa R$ 4.910. Isso ensina o cliente a dividir login, num produto cujo valor
  é a trilha de auditoria. O motor já calcula `max(assentos, mínimo) × preço`,
  sem código novo.
- **Alternativa rejeitada:** mínimo igual ao teto, como na proposta original. O
  degrau entre Validação e Growth era de +71%; aqui é de +4%.
- **Sinais de que errou:**
  - CAC real acima da coluna "CAC máximo" (§6.5 do documento de preço).
  - Uso da franquia abaixo de 30% na Ideação (`usoDaFranquia`), o primeiro aviso
    de churn.
  - Mais de um terço das propostas caindo na fila de aprovação de desconto.

### D-04 — Crédito de IA é unidade de custo, não de mensagem

**Estado:** Proposta. **Dono:** Caixa.

1 crédito vale cerca de US$ 0,01 de custo de modelo, com custo de planejamento
de R$ 0,10. Cada ação debita o que custa: INVEST 1, mensagem no Copilot 3,
política completa 9.

- **Por que importa para D-07:** um copiloto multiagente em cinco produtos muda
  quantas chamadas cabem numa mensagem. Com crédito por mensagem, cada agente a
  mais seria margem perdida sem ninguém ver. Com crédito por custo, a
  arquitetura muda e o preço não.
- **Folga medida:** o custo de IA por assento pode subir 2,5× (Growth, o mais
  apertado, por causa do CSM) a 7,4× (Ideação) antes de o payback passar de
  12 meses no pior caso.
- **Revisitar quando** a medição existir (§8, item 3, do documento de preço) e o
  custo real por crédito se afastar mais de 50% dos R$ 0,10.

### D-05 — Cota técnica de 150% da franquia enquanto o excedente não é cobrado

**Estado:** Proposta. **Dono:** Caixa; implementação com o Dev Cosmos.

`tetoExcedenteCentavos` nasce nulo: o excedente é medido e não é faturado
(`AssinaturaDoTenant`, `empresa.prisma`). Isso ajuda a vender e prejudica o
custo, porque consumo não faturado é custo absorvido. Com copiloto em todos os
produtos, esse consumo cresce sem limite.

- **A cota:** com teto de excedente nulo, a conta usa até 150% da franquia no
  mês. Passou disso, a IA para com uma mensagem que nomeia a regra e diz a quem
  pedir, na voz da suíte (`PRODUCT.md`). O admin do cliente é convidado a
  definir um teto ou subir de pacote.
- **Custo:** 150% cabe na folga de D-04 em todos os pacotes.
- **Hoje:** a cota que existe conta chamadas por `Tenant.plan`, de ORBIT a
  UNIVERSE, e não créditos (`apps/app/app/actions/safe-copilot/quota.ts`). Ela
  fica até a medição existir e depois é substituída. A rota do Copilot não
  limita tokens de saída (não há `maxOutputTokens` em
  `api/copilot/chat/route.ts`). Um teto por resposta entra junto com a cota,
  porque a cota por interação não enxerga uma resposta longa.

### D-06 — Avulso com piso; Diagnóstico com abatimento limitado

**Estado:** Proposta. **Dono:** Ponte.

- **Piso do avulso:** produto avulso vendido por vendedor custa no mínimo
  R$ 2.750 por mês de tabela. O Cosmos sozinho no Starter (R$ 890) dá 0,2× e
  fica para autosserviço, que ainda não existe.
- **Franquia do avulso:** só produto que chama modelo recebe franquia. Com
  D-07, quando o copiloto chegar a um produto, o avulso desse produto ganha
  franquia.
- **Diagnóstico:** fica fora dos pacotes e abate até 25% (R$ 12.000). O
  abatimento vale só em contrato anual assinado em até 90 dias e incide sobre
  serviço de implantação, nunca sobre a mensalidade.

---

## 3. Produtos futuros e as relações entre eles

### D-07 — Um copiloto com escopo por produto, não cinco chatbots

**Estado:** Direção do CEO (2026-09-27). Ele quer um assistente de IA em
todos os produtos, especialista em desenvolvimento de software e no modelo da
Nebuloz, multiagente, com versões de escopo próprio no Meridian, no Signal e no
Scaffold. As condições abaixo são proposta. **Dono:** Norte decide o quê; Regua
escreve a spec.

1. **Um núcleo, ferramentas por produto.** O que muda de um produto para outro
   é o conjunto de ferramentas e o dado que elas leem. O mapa de fronteiras
   decide o que cada escopo lê: o que o produto possui e o que o mapa lista na
   coluna "Lê". Escrita, quando houver, passa pela server action do próprio
   produto (`safeAction`, RBAC, `logAudit`), nunca direto no banco.
2. **A permissão é a do Charter, não a do copiloto.** O mapa proíbe um segundo
   modelo de permissão (entidade 2). A ferramenta roda com o papel de quem
   pergunta, e o copiloto não mostra o que a pessoa não veria na tela.
3. **No Meridian, o copiloto explica e não pontua.** O score é determinístico
   por projeto (`apps/app/components/meridian/PRODUCT.md`). É isso que torna o
   diagnóstico defensável diante do comitê do cliente, e um modelo perto da nota
   quebraria a reprodutibilidade.
4. **No Signal, o copiloto cita e não calcula.** O número "que o seu CFO
   aceita" sai da fórmula versionada (entidade 12). O copiloto cita o relatório
   congelado, com a data e a escala de confiança do Meridian: medido, estimado ou
   declarado (entidade 5).
5. **Toda afirmação sobre o histórico do cliente cita a origem.** É a guarda
   Fonte do Maestri levada ao produto (`.maestri/guarda/README.md`). Uma frase
   com número, ou com "foi decidido", que não tenha registro por trás volta antes
   de chegar ao usuário.
6. **Multiagente só depois que uma avaliação provar que um agente não basta.**
   Começa com um agente e as ferramentas de escopo. Cada agente a mais multiplica
   chamadas, latência e pontos de erro. O crédito por custo (D-04) protege o
   preço, não a qualidade.

**Onde o Copilot de hoje está.** Ele existe só no Cosmos, com 14 ferramentas
(`apps/app/app/actions/safe-copilot/tools.ts`), e ainda fere três das condições
acima:

- **Condição 2 (permissão):** só a escrita confere papel (`podeEscreverFeature`).
  Toda leitura vê o tenant inteiro, e o `mode` enviado pelo navegador decide que
  contexto carregar (`api/copilot/chat/route.ts`).
- **Condição 1 (escrita pelo produto):** `createFeature` e `moveFeature` pedem
  confirmação só no texto do prompt e não passam pela auditoria. O Charter da
  própria Nebuloz declara o Copilot como revisão humana completa (UC-02,
  `hitl: "FULL_REVIEW"`, `packages/provisioning/src/charter-nebuloz.ts`). Então a
  condição 1 ganha um item: escrita do copiloto pede confirmação na tela, não no
  prompt.
- **Condição 5 (origem citada):** `extractCitations` existe e só os testes o
  usam (`context/citation-formatter.ts`).

Levar o Copilot a outros produtos começa por fechar esses três pontos no Cosmos.
Copiar o Copilot como está copia os buracos.

**Ordem de chegada:** segue D-01. Primeiro o Cosmos, onde o Copilot já existe.
Depois o Meridian, porque explicar o diagnóstico ao cliente dá valor imediato.
Em seguida Charter, Scaffold e Signal.

**Alternativa rejeitada:** um chatbot por produto. Seriam cinco prompts, cinco
avaliações e cinco lugares para errar a permissão.

### D-08 — Raio X: um documento por cliente, feito de relatórios congelados

**Estado:** Direção do CEO (2026-09-27). Ele quer um documento único, em PDF,
com o andamento da empresa do cliente, que cresce com os produtos contratados.
As condições abaixo são proposta. **Dono:** Norte → Regua.

1. **O raio X lê; não é dono de nada.** Cada capítulo é a saída congelada do
   produto dono, e o raio X não calcula número novo. É a regra do mapa: quem não
   é dono lê ou anexa, nunca edita. O mapa já trata assim o recorte executivo:
   "Corte executivo é lente de leitura" (`mapa-de-fronteiras.md` §4.1).

   | Capítulo | Vem de | Existe hoje |
   |---|---|---|
   | Prontidão | Meridian: avaliação e gap register (entidades 4 e 6) | Não. O documento de entrega ao patrocinador está ausente, "sem PDF nem export" ([Meridian PRD](./meridian-prd.md), M-22) |
   | Promessa | Scaffold: caso de negócio e baseline assinados (entidade 7) | Só o dado (`ScaffoldBusinessCaseVersion`), e nenhuma action cria o caso ([mapa](./mapa-de-fronteiras.md), entidade 7) |
   | Execução | Cosmos: portfólio, PI e decisões (`DecisionLogEntry`) | Parcial. O resumo executivo agendado grava HTML numa coluna chamada `pdfUrl` (`lib/inngest/scheduled-report-runner.ts`), e a tela executiva imprime pelo navegador |
   | Valor | Signal: relatório congelado do comitê (`SignalReportSnapshot`) | Congela e exporta JSON, "sem PDF" ([Signal PRD](./signal-prd.md), S-18) |
   | Governança | Charter: export de conformidade | Sim. É o único PDF da suíte (`lib/charter/compliance-pdf.tsx`, `@react-pdf/renderer`) |

   O raio X V0 reusa o gerador do Charter e começa pelos dois capítulos que já
   congelam: Governança e Valor.

2. **Congelado e datado.** Cada emissão é uma versão com data e hash, e emitir
   deixa registro na auditoria, como o export do Charter já faz (ADR-0011). O
   andamento aparece na comparação entre duas emissões.
3. **Capítulo de produto não contratado** mostra a pergunta que ele responderia
   ("Valeu a pena?"), sem dado inventado. É o convite a contratar, não uma
   simulação.
4. **Sem preço próprio.** No pacote, o raio X vem completo; no avulso, só com os
   capítulos contratados. É o argumento visível do pacote.
5. **Onde nasce:** no app, lendo o tenant do próprio cliente. Não nasce no
   back-office, porque leitura entre clientes é só do back-office, pela porta
   única (ADR-0013).

**Page index é o sumário do raio X** (decidido pelo CEO em 2026-09-27). É a
primeira página do documento. Para cada capítulo, ela diz:
- o produto de origem;
- a data da emissão congelada;
- se o capítulo está contratado.

Quem lê o sumário sabe, sem abrir o resto, o que o cliente tem e de quando é
cada número. A técnica PageIndex de recuperação sem vetor não entra aqui: fica
para quando o copiloto precisar navegar documentos longos (D-07).

---

## 4. Modelo próprio para desenvolvimento com IA

Direção do CEO: um fine-tune grande em desenvolvimento de software e
desenvolvimento ágil, com IA em todo o processo de codificação, repertório em
sistemas escaláveis e suporte à documentação atual.

### D-09 — O peso aprende método; documentação atual e memória entram por recuperação

**Estado:** Proposta. **Dono:** Norte decide o quê; Dev Plataforma decide como.

- **Vai para o peso** o que muda devagar:
  - o método: SAFe e o ciclo idea → intent → spec → plan → tasks de `specs/`;
  - o julgamento: INVEST, WSJF e portões;
  - o formato de saída e o vocabulário (`docs/design/MICROCOPY-GLOSSARY.md`).
- **Vai por recuperação** o que muda rápido: documentação de biblioteca e de
  framework, e tudo que é do cliente. Um modelo treinado hoje fica desatualizado
  na próxima versão do framework. "Suporte a todas as documentações atuais" é
  recuperação, não treino.
- **"Grande" vem depois da medição.** Começa com LoRA pequena, por tarefa, onde
  a avaliação mostrar que o modelo de API falha. O plano já existe
  (`docs/superpowers/plans/2026-05-26-slm-finetuning-pipeline.md`: LoRA via MLX
  sobre Mistral-7B). No repositório, porém, só está a parte de dados:
  `experiments/slm-pipeline/scripts/` tem ETL, grafo e geração de corpus, sem o
  treino. O Maestri já roda modelos locais (Qwen3-4B no Vigilante, NLI na
  Fonte), então a operação local é conhecida.
- **O dado decide o teto.** O corpus versionado são 127 pares de perguntas e
  respostas sobre SAFe 6.0 (`data/processed/train.jsonl`), saídos do
  `etl_safe_corpus.py`. Parte vem extraída direto de PDFs de preparação para a
  prova. A outra parte, o `claude-haiku-4-5` escreveu a partir de páginas sobre
  SAFe. O gerador de 10 mil pares sintéticos
  (`generate_safe_10k.py`) usa o mesmo modelo e não tem saída versionada. Um
  modelo treinado na saída de outro não fica mais especialista que a fonte; ele
  comprime e especializa. Para ter repertório de
  verdade, o dado precisa vir de algo melhor que o modelo de base: o método
  escrito da Nebuloz, especificações e ADRs revisados por gente, e exemplos
  corrigidos por especialista. Antes do primeiro treino, o LAB registra de onde
  veio o corpus e sob qual licença (§4 do LAB: "sem classificação, um dataset
  não vira treino"). Nesse registro entram os termos do provedor sobre usar a
  saída do modelo para treinar outro modelo e o uso da marca SAFe. Quem confere
  é a Lacre.
- **Uma fonte sai hoje.** `etl_safe_corpus.py` extrai por expressão regular as
  perguntas de três PDFs de preparação para a prova SAFe Agilist. Um deles se
  chama `scaled-agile-safe-agilist-dumps-by-mathews.pdf`, e "dumps" costuma
  nomear questões de prova vazadas. Nenhum modelo da Nebuloz treina com isso:
  é conteúdo de terceiro, copiado literal e sem licença. Além disso, o
  repertório seria o de decorar prova, não o de construir sistema. O
  `train.jsonl` versionado passa por essa triagem antes de qualquer treino.
- **Por quê:** o modelo de API melhora a cada poucos meses, e um fine-tune
  grande deprecia junto. O ativo durável é o dataset e a avaliação registrados
  no LAB, não o peso.
- **Alternativa rejeitada:** fine-tune grande antes de existir avaliação. Sem
  avaliação, não há como saber se o modelo novo é melhor do que o que já atende.

### D-10 — Dado de cliente nunca treina peso compartilhado

**Estado:** Proposta. **Dono:** Lacre dá o parecer; o CEO decide.

- **O contrato já promete isso.** A minuta do DPA diz que a Nebuloz não usa os
  dados do cliente "para treinar modelos de inteligência artificial"
  (`docs/compliance/dpa-modelo.md`). O que a entrada decide é manter a promessa
  quando o modelo próprio existir.
- **Papel legal:** a Nebuloz é operadora e o cliente é controlador. Usar
  conteúdo de cliente "para treinar, ajustar ou demonstrar" faz da Nebuloz
  controladora, com base legal, aviso ao titular e linha no RoPA próprios
  (`docs/compliance/operadora-controladora.md`).
- **O LAB depende disso:** ele existe para responder "esse modelo viu dado de
  cliente?" (`lab-prd.md` §1). A resposta tem de ser "não" por construção, não
  por reconstrução.
- **O Maestri já segue a regra:** a memória dele diz "nunca segredo, chave ou
  dado de cliente" (`.maestri/memoria/*.md`).
- **O que continua possível:** modelo de um cliente só, treinado no dado dele,
  sob contrato próprio. É o SV-09 (SLM Domain Fine-tune, R$ 165.000), com
  registro no LAB e apagamento no fim do contrato.
- **Consequência comercial:** não se vende "nosso modelo aprende com todos os
  clientes". Vende-se "o seu copiloto lembra da sua empresa", que é memória
  (D-12), não treino.

### D-11 — Modelo próprio só atende cliente depois de quatro portões

**Estado:** Proposta. **Dono:** Morgana cuida dos portões 1 e 2, Caixa do 3,
Lacre do 4.

1. **Avaliação:** o modelo próprio empata ou vence o modelo de API numa suíte de
   avaliação da tarefa, medida e não declarada (o formato do SV-10).
2. **Registro no LAB:** dataset classificado, treino, avaliação e model card. O
   LAB determina que "uma versão sem avaliação não recebe ficha"
   (`lab-prd.md` §4). Hoje o LAB é só especificação, sem nenhum model no schema.
   Os requisitos que importam aqui:
   - linhagem derivada (L-06, P0);
   - ficha gerada do registro (L-08);
   - nenhum treino sobre dataset sem classificação (L-09).
3. **Volume:** hospedagem própria é custo fixo; API é custo variável. O ponto de
   empate é o custo fixo mensal dividido por R$ 0,10 por crédito. Uma hospedagem
   de R$ 15.000 por mês (hipótese) só empata a partir de 150 mil créditos por mês,
   cerca de 40 contas Validação usando a franquia inteira. Abaixo disso, a API
   sai mais barata.
4. **Parecer da Compliance:** transparência do AI Act (Art. 50, vigente desde
   2 de agosto de 2026, `lab-prd.md` §1) e o que o cliente precisa saber sobre o
   modelo que o atende.

**Pré-requisito dos portões 1 e 3:** a medição de créditos (documento de preço,
§8, item 3). Sem ela, não há volume nem custo real para comparar.

**Catálogo a corrigir.** O SV-11 (Private Model Hosting, R$ 34.000 por mês,
inativo) promete "isolamento e residência de dado". O ADR-0016 registra que
residência não é atendível hoje. Então o SV-11 não volta ao catálogo com esse
texto.

---

## 5. Sistema escalável: memória empresarial de longo prazo

Direção do CEO: o sistema escalável é um sistema de memória gerenciável,
especializado em memória de longo prazo, de anos e décadas, para gerir a memória
da empresa cliente. De dentro de qualquer produto, o copiloto acessa as
principais decisões do cliente e o histórico do que foi decidido.

### D-12 — A memória é índice derivado de registros com dono, nunca fonte de verdade

**Estado:** Direção do CEO; o desenho é proposta. Vira ADR-0018 quando for
aceito. **Dono:** Dev Plataforma.

- **O que ela indexa:** o que os produtos já registram:
  - decisões de portfólio (`DecisionLogEntry`, `schema/governance.prisma:121`);
  - decisões de caso do Charter, com justificativa obrigatória
    (`CharterDecision`), e versões de política com resumo e retrato
    (`CharterPolicyVersion`);
  - avaliação, gap register e override com justificativa do Meridian
    (`MeridianOverride`);
  - caso de negócio versionado (`ScaffoldBusinessCaseVersion`, ADR-0015) e
    override de portão do Scaffold (`ScaffoldGateOverride`);
  - decisão de valor do Signal, quando existir (entidade 14);
  - a trilha de auditoria (`AuditLog`, entidade 16).
- **Por que derivada:**
  1. O mapa dá um dono a cada entidade. Uma memória que guardasse fato próprio
     seria o segundo dono de tudo.
  2. Em décadas, o modelo de embedding muda muitas vezes (hoje são as 1.536
     dimensões do `text-embedding-3-small`). O vetor é cache. O ativo é o
     registro tipado, datado e com origem, de onde o índice se refaz.
  3. Apagar na origem apaga na memória no próximo refazer, que é o que a LGPD
     pede (D-15).
- **O que já existe:** `PIKnowledgeVector` (pgvector, com `tenantId`,
  `sourceType` e `sourceId`) e a busca híbrida vetor + texto em português com
  fusão por posição (`packages/database/vector-search.ts`). É o ponto de
  partida, não um sistema novo.
- **O que ele indexa hoje:**
  - épico, quando título ou descrição mudam;
  - risco, só em dois dos caminhos de criação;
  - insight de reunião aplicado;
  - documento enviado ao Copilot.

  Feature, objetivo de PI e OKR só entram por `syncTenantKnowledge`, que nada
  chama, e o cron de reindexação é um esboço fora do `vercel.json`.
- **O que ele não indexa:** nenhuma das decisões listadas acima. A tela de
  Decisões do Cosmos já se apresenta como "memória de longo prazo do programa"
  (`design/components/screen-governance.jsx`), e é por ela que a memória
  começa.
- **Proposta para o mapa:** entrar como entidade 17, "Memória do cliente", sem
  produto dono. O índice fica com a plataforma; a política de retenção e de
  acesso, com o Charter.

### D-13 — Item de memória é tipado, datado, com origem, e substituído em vez de apagado

**Estado:** Proposta. **Dono:** Dev Plataforma.

| Campo | Por quê |
|---|---|
| Tipo: decisão, compromisso, lição, fato, preferência | "O que foi decidido" e "o que aprendemos" pedem respostas diferentes |
| Data do fato e vigência (de/até) | Daqui a dez anos, o que valia em 2027 já não vale; a vigência mostra isso sem apagar nada |
| Tempo de transação (quando o sistema acreditou nesta versão) | Separa "o que valia em março" de "o que sabíamos em março"; sem ele, uma correção reescreve o passado |
| Origem: produto, entidade, id | Permite citar (D-07) e refazer o índice (D-12) |
| Autor e papel | Quem decidiu é parte da decisão |
| Confiança: medido, estimado, declarado | É a escala do Meridian (entidade 5); o mapa proíbe inventar outra |
| Substitui / substituído por | A cadeia que impede o copiloto de citar uma decisão revogada três anos depois |

É o formato que o Maestri já usa na memória da própria Nebuloz:
- "Corrigido em 2026-09-06 — a nota antiga estava errada" (`memoria-empresa.md`);
- "Lição que se mostrou errada: risque ... e diga por quê, em vez de apagar"
  (`.maestri/memoria/*.md`).

O produto herda esse formato em vez de inventar outro.

**Implementação:** o formato está implementado e testado em
[`apps/memoria`](../../apps/memoria/README.md), a memória dos agentes. Lá
estão:
- versões imutáveis com os dois tempos;
- invalidação que mantém a decisão revogada consultável;
- confiança só na escala do Meridian;
- apagamento por origem que tira a memória de todos os armazéns.

O pacote STEC trazido pelo CEO em 2026-09-27 foi a base. O que se cortou dele,
e por quê, está no README.

### D-14 — A memória herda a permissão da origem e tem isolamento testado

**Estado:** Proposta. **Dono:** Vigia revisa; Dev Plataforma implementa.

A memória junta num só lugar o que um cliente tem de mais sensível: anos de
decisão. Hoje o isolamento é só o filtro `WHERE "tenantId" = ...` na consulta
(`vector-search.ts`), e a RLS está declarada mas inerte (ADR-0012). Antes do
primeiro tenant externo, a memória precisa de quatro coisas:

1. **Teste de vazamento no CI:** uma busca como tenant A devolve zero linhas do
   tenant B, com dado de B plantado para o teste.
2. **Isolamento que não dependa de lembrar o filtro:** papel de banco sem
   superuser no caminho da busca, com a RLS valendo, ou partição física por
   tenant.
3. **Permissão da origem:** um item vindo de caso restrito do Charter não
   aparece para quem não pode abrir aquele caso. A memória não é um segundo
   modelo de permissão (entidade 2).
4. **Texto de memória como entrada não confiável:** o texto passa pela cerca de
   prompt (`apps/app/lib/prompt-fence.ts`). Uma decisão antiga que diga "ignore
   as instruções" não pode dirigir o copiloto (OWASP LLM01). Hoje só a análise
   INVEST usa a cerca; o resultado das ferramentas do Copilot volta sem ela.

**O índice de hoje tem falhas que a memória não pode herdar** (conferidas no
código em 2026-09-27):

- **Revogação de consentimento:** revogar o consentimento de uma reunião troca
  o texto do insight aplicado por "[conteúdo removido — consentimento
  revogado]", mas o vetor e o texto original ficam no índice. O Copilot ainda
  os recupera (`actions/meeting/consent.ts`).
- **Apagamento LGPD:** o pedido de titular (Art. 18) não tem passo para o
  índice (`lib/inngest/lgpd-dsr.ts`).
- **Exclusão de entidade:** apagar um risco deixa o vetor (`actions/risks/index.ts`).
- **Documento enviado:** o documento guarda a sessão só no `metadata`. Por isso
  fica visível para o tenant inteiro, e `deleteSessionVectors`, que ninguém
  chama, nunca o apagaria.
- **Consulta fora do `withTenantDb`:** o Copilot consulta com `database`. Se o
  ADR-0012 for corrigido, as leituras dele passam a voltar vazias.

A correção dos quatro primeiros itens ficou registrada como tarefa separada. É
o pré-requisito da memória V0 (§7).

### D-15 — Retenção e apagamento seguem o contrato e a LGPD

**Estado:** Proposta. **Dono:** Lacre.

- **Retenção:** segue a política do contrato, que é do Charter (entidade 3). Na
  saída do cliente, a memória é exportada, e o índice e o arquivo são apagados
  no prazo do DPA.
- **Titular:** um pedido atendido com apagamento na origem tira o dado da
  memória no próximo refazer (D-12). Item de memória não guarda dado pessoal que
  a origem não guardava.
- **Reunião:** transcrição só entra depois do portão de consentimento
  (`docs/compliance/aviso-de-gravacao.md`). Revogar o consentimento tira a
  reunião da memória, o que hoje não acontece (D-14).
- **Embedding:** todo texto indexado e toda pergunta vão ao `text-embedding-3-small`
  da OpenAI, e nenhum documento de compliance cobre esse fluxo. O provedor de
  embedding entra na lista de subprocessadores e no DPA
  (`docs/compliance/dpa-fornecedores.md`) antes de a memória crescer.
- **Observabilidade:** `LANGFUSE_CAPTURE_CONTENT` nunca liga com dado de
  cliente enquanto o DPA do Langfuse não estiver assinado
  (`dpa-fornecedores.md`).
- **Prazo:** o RoPA fixa a retenção do dado do Copilot em "duração do
  contrato". O DPA promete apagar em 30 dias depois do fim, e esse apagamento
  hoje é manual. A memória precisa de um apagamento que rode sozinho.
- **Parecer:** a Lacre dá parecer antes do primeiro tenant externo.

### D-16 — Décadas em três camadas, no Postgres até medir o limite

**Estado:** Proposta. **Dono:** Dev Plataforma desenha; Pilar opera.

| Camada | O que guarda | Onde |
|---|---|---|
| Quente | O horizonte consultável, que é o contrato inteiro (D-17): texto, vetor e busca em português | Postgres + pgvector, particionado por tenant e ano |
| Morna | Resumo por período (PI, trimestre, ano), cada frase com link à origem | Postgres |
| Fria | Arquivo imutável por tenant e ano, com hash, que pode ser reindexado | Armazenamento de objeto |

- **O resumo não reescreve o que fica.** É o princípio do `fast-jev-compaction`
  do Maestri: descartar o que venceu e manter o resto literal. Resumo sem link à
  origem não entra.
- **O gargalo não é espaço.** Um tenant ativo gera centenas de MB por ano
  (hipótese: 50 mil trechos × ~8 KB). O difícil, em décadas, é a qualidade da
  busca: decisão revogada, vocabulário que muda, empresa que se reorganiza. O
  investimento vai para a cadeia de substituição (D-13) e para a avaliação de
  recuperação, não para um banco vetorial maior.
- **O primeiro passo de escala é um índice.** Hoje o `PIKnowledgeVector` não
  tem índice vetorial (nem HNSW nem IVFFlat, em nenhuma migration), e cada
  busca compara com todos os trechos do tenant. Um índice HNSW por partição vem
  antes de qualquer troca de banco, com latência medida antes e depois.
- **O laboratório já mede isso.** Em `apps/memoria`, Qdrant, Neo4j
  e MinIO rodam como projeções do Postgres, com `rebuild` que as refaz. A
  primeira lição veio de graça: o Qdrant 1.19 não abriu os dados do 1.12. Como
  era projeção, bastou apagar o volume e reconstruir. Se fosse fonte de verdade,
  teria exigido migração versão por versão.
- **Alternativa rejeitada, por ora:** banco vetorial dedicado, LanceDB ou
  GraphRAG em produção. Eles ficam no plano do laboratório
  (`2026-05-26-slm-finetuning-pipeline.md`) até uma medição de latência e de
  acerto no Postgres pedir a troca.

### D-17 — Horizonte de memória consultável é o mesmo em todos os pacotes

**Estado:** Decidida pelo CEO em 2026-09-27. **Dono:** Ponte e Caixa.

O copiloto consulta a memória do contrato inteiro, em qualquer pacote. O
arquivo frio fica guardado durante o contrato e sai no export (D-15).

- **Por quê:** um horizonte menor nos pacotes de entrada faria o cliente da
  Ideação perder o próprio primeiro ano ao entrar no segundo. Isso soa como
  refém, e memória é justamente o que o produto promete guardar.
- **Custo:** guardar custa pouco (D-16), então o horizonte igual não muda a
  conta do documento de preço.
- **Consequência:** a memória não diferencia pacote. A diferença continua sendo
  assento, franquia de crédito, suporte e recursos (D-03).
- **Sem diferença por fonte** (decidido pelo CEO em 2026-09-27): todo pacote
  indexa as mesmas fontes, reunião transcrita inclusive, desde que ela tenha
  passado pelo portão de consentimento (D-15).
- **Efeito no preço:** memória acumulada é custo de troca, e custo de troca
  reduz churn. O modelo de preço não conta com isso até existir churn medido.

~~Proposta anterior: 12 meses na Ideação, 24 na Validação, 36 no Growth e o
contrato inteiro no Scale.~~ Descartada pelo CEO em 2026-09-27, pelo risco de
refém descrito acima.

### D-18 — A Nebuloz é o primeiro tenant da memória

**Estado:** Em andamento desde 2026-09-27, do lado dos agentes. **Dono:** Morgana.

**O que já roda:** [`apps/memoria`](../../apps/memoria/README.md) atende os agentes do Maestri por MCP, com o tenant
`nebuloz`. A importação trouxe 36 itens com origem: as lições das áreas, as 17 ADRs e as 18 decisões deste registro.
Um agente do Claude Code achou a D-12 e a lição de produção pela busca, e gravou uma lição nova com origem e
confiança. O copiloto do produto ainda não usa a memória.

O Maestri já opera a memória da Nebuloz. Ele tem:
- memória por área, com curador;
- o registro de vereditos (`aprendizado.jsonl`);
- ADRs e completions roteadas por produto;
- a guarda Fonte e o Vigilante.

O tenant `nebuloz` já roda o Charter em dogfood. A memória do produto entra
primeiro ali, no formato de D-13.

**Critério de saída do dogfood:** o copiloto responde "o que decidimos sobre X,
quando, e o que mudou depois", com a origem citada, num conjunto fixo de
perguntas escrito antes do teste.

---

## 6. Ponytail: o que cortar

| Cortar | No lugar | Por quê |
|---|---|---|
| Multiagente no primeiro corte | Um agente com ferramentas por produto | Multiagente só com avaliação que prove a necessidade (D-07) |
| Fine-tune grande | LoRA pequena por tarefa, depois da avaliação | D-09, D-11 |
| Banco vetorial novo | O pgvector que já está em produção | D-16 |
| LanceDB e GraphRAG em produção | Ficam no laboratório | D-16 |
| Resumo que reescreve a memória | Descartar o vencido e manter o resto literal | D-16 |
| Cinco chatbots | Um núcleo, com escopo por ferramenta | D-07 |
| Raio X que calcula | Raio X que junta relatórios congelados | D-08 |
| Duas tabelas de plano | Uma só (documento de preço, §8, item 4) | A cota de IA e a franquia precisam ler o mesmo plano |

**Fica:**
- a busca híbrida que existe: funciona e já filtra por tenant;
- o experimento de SLM (`experiments/slm-pipeline`): é onde se mede antes de
  decidir;
- a cota por chamada até a medição existir: é a única trava de custo hoje.

---

## 7. Ordem de execução

1. **Terminar e validar produto a produto** pela esteira (D-01). O primeiro é
   o Meridian, que depende das condições 2 a 5 de compliance.
2. **Medir créditos por chamada.** Destrava D-04, D-05 e D-11.
3. **Corrigir o ciclo de vida do índice.** Revogação, pedido LGPD e exclusão
   passam a apagar o vetor (D-14), e o Copilot do Cosmos fecha permissão,
   confirmação de escrita e citação (D-07).
4. **Memória V0 no tenant `nebuloz`,** sobre o `PIKnowledgeVector` ampliado com
   o formato de D-13 (D-12, D-18). A memória dos agentes (`apps/memoria`) já
   roda à parte, por decisão do CEO de 2026-09-27; o que ela ensinar entra
   aqui. A do produto segue este item e o gate do `intent.md`.
5. **Copiloto com escopo,** na ordem de D-07.
6. **Raio X V0** com os capítulos que já têm relatório congelado (D-08).
7. **Suíte de avaliação e LAB.** Só então o fine-tune (D-09, D-11).

Cada frente nova (copiloto, raio X, memória, modelo próprio) começa por um
`intent.md` aprovado em `specs/`, via `/speckit-intent`. O gate
`before_specify` bloqueia a spec sem ele
(`.claude/completions/2026-08-28-add-intent-stage.md`).

---

## 8. Aguarda o CEO

1. **D-03:** aprovar ou mudar os números, depois de o Caixa conferir e o Sócio
   fazer o pre-mortem.
2. **D-10:** confirmar que dado de cliente não treina modelo compartilhado. Isso
   muda o que o comercial pode prometer.
3. ~~**D-19 e D-20:** confirmar o escopo do Meridian A3 (entra agora) e A5
   (depois, com gatilho).~~ Confirmadas pelo CEO em 2026-09-29 (via Morgana).
