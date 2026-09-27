# Pacotes e precificação: validação contra LTV/CAC

**Proposta, não catálogo.** Nada aqui foi semeado no banco. Este documento pega
a proposta de quatro pacotes (Ideação, Validação, Growth, Scale), corrige o que
não fechava e fixa preço, franquia de IA e regras de avulso. A trava é
**LTV/CAC ≥ 3** e **payback ≤ 12 meses**. As duas são verificadas no pior caso
que o vendedor consegue fechar sem aprovação. Complementa
[`icp-e-precificacao.md`](icp-e-precificacao.md) e usa a fórmula de
[`cac-modelo.md`](cac-modelo.md).

---

## 0. A decisão em uma tela

| | Ideação | Validação | Growth | Scale |
|---|---|---|---|---|
| **Preço por assento/mês** | R$ 199 | R$ 195 | R$ 169 | R$ 189 (referência) |
| **Mínimo faturável** | 20 | 30 | 60 | 150 |
| **Teto** | 25 | 50 | 100 | faixas de 50 (150, 200, 250…) |
| **Mensalidade de tabela** | R$ 3.980 – 4.975 | R$ 5.850 – 9.750 | R$ 10.140 – 16.900 | a partir de R$ 28.350 |
| **Produtos** | os 5 | os 5 | os 5 | os 5 |
| **Créditos de IA/assento/mês** | 60 | 75 | 90 | 120 (referência) |
| **Franquia no teto (proporção)** | 1.500 (1×) | 3.750 (2,5×) | 9.000 (6×) | 18.000+ (sob proposta) |
| **Crédito extra** | R$ 0,30 (cheio) | R$ 0,255 (−15%) | R$ 0,21 (−30%) | negociado, piso R$ 0,20 |
| **Suporte** | e-mail e base, 2 dias úteis | chat 8×5, 1 dia útil | SLA 99,9%, 8×5 com canal dedicado, CSM compartilhado | CSM dedicado, SLA negociado |
| **Recursos a mais** | — | BPMN | BPMN e integrações | tudo, mais SSO, papéis custom e onboarding assistido |
| **LTV/CAC no pior caso** | 5,4× | 7,5× | 6,4× | 8,5× |
| **Payback no pior caso** | 7,4 meses | 7,4 meses | 9,4 meses | 7,1 meses |

"Pior caso" é o mínimo de assentos, contrato anual (−12%) e o desconto comercial
máximo sem aprovação (−15%). Mais detalhe na §6.

Fora dos pacotes, como porta de entrada: o **Diagnóstico** (SV-01, R$ 48.000 por
projeto, já em produção). O abatimento dele fica limitado (§5).

O preço no teto de cada pacote ficou praticamente igual ao da proposta
original (R$ 4.990 / 9.900 / 16.900). O que muda é o piso, explicado na §1.

---

## 1. O que a proposta recebida tinha de errado

**1. A linha do Scale não fecha.** "A partir de R$ 58.950 avulso" corresponde a
250 assentos Enterprise (250 × R$ 219 + R$ 4.200), não a 101. Com 101 assentos
o avulso dá R$ 26.319. Comparar o Scale contra 250 assentos infla o desconto
aparente.

**2. O desconto do pacote estava subestimado.** O "mesmo conteúdo avulso" não
somou os add-ons que o pacote inclui: BPMN na Validação, BPMN e SLA no Growth.
Com eles, o desconto real é de −20% a −21% nos três primeiros pacotes, e não
−22% / −15% / −12%. A curva não caía. Era plana, e é assim que deve ser:

| Pacote (assentos) | Mesmo conteúdo avulso | Pacote (teto) | Desconto |
|---|---:|---:|---:|
| Ideação (25) | R$ 6.425 | R$ 4.975 | −22,6% |
| Validação (50) | R$ 12.350 (+ BPMN) | R$ 9.750 | −21,1% |
| Growth (100) | R$ 21.300 (+ BPMN + SLA) | R$ 16.900 | −20,7% |
| Scale (150) | R$ 40.150 (+ SSO + SLA + BPMN) | R$ 28.350 | −29,4% |

**3. Mínimo igual ao teto cria um degrau que ensina a compartilhar login.** Com
o plano Validação travado em 50 = 50, o cliente de 26 pessoas paga por 50. O
26º assento custaria R$ 4.910. Isso empurra o cliente a dividir usuário, e
num produto de governança (Charter, trilha de auditoria) login compartilhado
destrói justamente o que se vende. A saída é preço por assento com **mínimo
abaixo do teto**. O motor já faz isso (`precificarProposta`: `max(assentos,
mínimo) × preço`), sem código novo. O degrau Validação→Growth cai de +71% na proposta
original (R$ 9.900 → 16.900) para +4% (R$ 9.750 → 10.140).

**4. O Growth prometia "integrações e MCP".** Não há MCP no código do app
(busca em `apps/app/app` e `apps/app/lib`). Preço de recurso que ninguém entrega
é promessa, não catálogo. Isso vale aqui como valeu para o Scaffold em
`2026-08-comercial.sql`. Tirei o MCP da tabela até ele existir.

**5. "Créditos que valem em todos os produtos" só valem em dois.** Só o
Copilot do Cosmos e o rascunho de política do Charter chamam modelo.
Meridian, Scaffold e Signal não usam IA (`PRODUCT.md`, seção Capabilities). A
franquia é real, mas o custo dela está todo em Cosmos e Charter. Isso muda a
conta do avulso (§4) e não muda a do pacote.

**6. O pacote vende cinco produtos, e nenhum está pronto para cliente externo**
([`prontidao-lancamento.md`](../produto/prontidao-lancamento.md)). O Meridian
está mais perto; Signal e Charter não têm critério de saída. A tabela abaixo
pode entrar no catálogo como referência. Vendê-la antes de pelo menos Cosmos
e Charter estarem prontos é cobrar pelo que a UI não entrega, o risco que o
[Signal PRD](../produto/signal-prd.md) §7 já registra para um produto só.

---

## 2. Três trilhas de oferta

A escada não vira pacote obrigatório. O site diz "cada um se sustenta sozinho;
a escada é a ordem recomendada, não um pacote"
(`insumos-de-posicionamento.md`), e o pacote precisa conviver com isso.

| Trilha | Quem compra | Como cobra | Onde vive no catálogo |
|---|---|---|---|
| **Diagnóstico** | Quem está decidindo por onde começar (ICP do Meridian) | Projeto, preço fechado | `Service` SV-01 + plano `diagnostico` (R$ 0, já em produção) |
| **Produto avulso** | Quem quer um ou dois produtos | Assento do plano + mensalidade do módulo + franquia do produto | `PlanoComercial` starter/scale/enterprise + `PrecoDeModulo` (já existe) |
| **Pacote** | Quem quer três produtos ou mais | Assento do pacote, cinco produtos inclusos, franquia da conta | `PlanoComercial` novo por pacote + "produtos inclusos" (a construir, §8) |

**A regra que separa avulso de pacote:** com três produtos ou mais, o pacote
sai sempre mais barato. Com dois, depende de quais. Conferido nos três tetos:

| Assentos | Cosmos + Charter avulso | Cosmos + Charter + Meridian avulso | Pacote |
|---:|---:|---:|---:|
| 25 | R$ 4.025 | R$ 5.225 | R$ 4.975 (Ideação) |
| 50 | R$ 9.250 | R$ 10.450 | R$ 9.750 (Validação) |
| 100 | R$ 16.700 | R$ 17.900 | R$ 16.900 (Growth) |

Com isso o vendedor não precisa decidir no feeling. O avulso não compete com o
pacote, é o degrau anterior a ele.

---

## 3. Créditos de IA

### 3.1 A unidade

**1 crédito ≈ US$ 0,01 de custo de modelo**, cerca de uma ação curta. O
roteador usa `claude-haiku-4-5` (US$ 1 de entrada e US$ 5 de saída por milhão de
tokens) e cai para Gemini ou GPT-4o-mini se não houver chave. Tabela de débito
sugerida, a partir dos limites de token que o código já usa:

| Ação | Onde | Estimativa de custo | Débito |
|---|---|---|---:|
| Análise INVEST de épico | `api/epics/[epicId]/analyze-invest` (800 tokens de saída) | ~US$ 0,007 | 1 |
| Rascunho de hipótese | `actions/epics/draft-hypothesis.ts` (300 de saída) | ~US$ 0,004 | 1 |
| Mensagem no Copilot | `api/copilot/chat` (até 5 passos, pensamento de 1.024) | US$ 0,02–0,07 | 3 |
| Rebalanceamento WSJF | `actions/wsjf/rebalance.ts` (3.000 de saída) | ~US$ 0,025 | 3 |
| Seção de política no Charter | `policy-generate.ts` (uma chamada por seção) | ~US$ 0,012 | 1 |
| Política completa (9 seções) | idem | ~US$ 0,11 | 9 |

**Custo de planejamento: R$ 0,10 por crédito**, cerca de 1,8× a estimativa
em Haiku. A folga cobre embeddings, retentativa, Langfuse e uma troca
parcial para um modelo maior. A Caixa troca esse número pelo custo medido
quando existir medição (§8, item 3). O teste de estresse da §6 usa R$ 0,20.

### 3.2 Franquia

Por assento e por pacote, agregada na conta, zerando todo mês. É o formato que
`AssinaturaDoTenant.creditosMesIncluidos` já descreve ("assentos vezes créditos
por assento do degrau"). As proporções 1× / 2,5× / 6× da proposta viram 60 / 75
/ 90 créditos por assento. No teto de cada pacote isso dá exatamente 1.500 /
3.750 / 9.000.

Como dimensionar: 60 créditos são cerca de 20 mensagens de Copilot por pessoa
por mês. Como a franquia é da conta, os RTEs que usam muito gastam a sobra
de quem usa pouco. A regra de `base-financeira-design.md`, "o usuário
mediano nunca encosta", vale aqui. O custo da franquia inteira consumida é
de R$ 150 (Ideação no teto) a R$ 900 (Growth no teto), de 3% a 5% da
mensalidade.

### 3.3 Excedente

| Pacote | Preço do crédito extra | Margem sobre o custo de planejamento |
|---|---:|---:|
| Ideação | R$ 0,30 | 67% |
| Validação | R$ 0,255 | 61% |
| Growth | R$ 0,21 | 52% |
| Scale | negociado, **piso R$ 0,20** | ≥ 50% |

**Regra:** o crédito extra nunca sai abaixo de 2× o custo de planejamento. O
piso do Scale existe por causa dessa regra.

`tetoExcedenteCentavos` nasce nulo, e o excedente é medido mas não cobrado
até o cliente definir um teto. Isso permite vender a franquia **antes** de
existir medição automática, porque nada é faturado por consumo enquanto o teto
for nulo.

---

## 4. Produto avulso

É o catálogo que já existe: assento do plano mais a mensalidade do módulo. Mudam
duas coisas.

**Franquia por produto.** Só quem usa IA recebe franquia:

| Produto avulso | Mensalidade | Franquia | Por quê |
|---|---|---|---|
| Cosmos | incluído no assento | 40 créditos/assento | Copilot, INVEST, WSJF |
| Charter | R$ 1.800 | 200 créditos/conta | cerca de 20 políticas completas; hoje a cota é de 30 gerações de seção (`policy-generate.ts:25`) |
| Meridian contínuo | R$ 1.200 | 0 | pontuação determinística, sem modelo |
| Signal | R$ 1.200 | 0 | sem modelo |
| Scaffold | projeto (§4.1) | 0 | sem modelo |

Excedente do avulso a preço cheio, R$ 0,30.

**Piso de venda consultiva: R$ 2.750/mês de tabela.** Abaixo disso a conta não
fecha com vendedor no meio:

| Avulso, no pior caso | Tabela | LTV/CAC | Payback |
|---|---:|---:|---:|
| Cosmos · Starter 10 | R$ 890 | **0,2×** | 261 meses |
| Meridian contínuo · Starter 10 | R$ 2.090 | **2,3×** | 17 meses |
| Charter · Starter 10 | R$ 2.690 | 3,4× | 11,8 meses |
| Cosmos · Scale 25 | R$ 3.725 | 5,1× | 7,9 meses |
| Charter · Scale 25 | R$ 5.525 | 8,3× | 4,8 meses |

Leitura:

- **O Starter com só Cosmos não pode ser vendido por vendedor.** Com CAC
  de venda consultiva ele nunca se paga. Ou vira autosserviço, com CAC perto de
  zero e sem checkout hoje, ou sai da mesa do vendedor. Isso não custa nada ao
  ICP: o Cosmos pede três ARTs ou 100+ pessoas de engenharia, e o
  Starter (até 25) é anti-ICP.
- **O Meridian contínuo avulso reprova, e está certo.** Ele é SKU de expansão,
  vendido na renovação de quem já fez o Diagnóstico
  (`icp-e-precificacao.md` §2). O CAC de expansão é uma fração do de
  aquisição. Vendido como entrada, reprova.

### 4.1 Scaffold avulso

O preço continua preso ao custo carregado ([Scaffold PRD](../produto/scaffold-prd.md)
§6). Fixo a fórmula e deixo referências para substituir:

```
preço do pacote Scaffold = horas × custo-hora carregado ÷ (1 − margem-alvo)
margem-alvo de serviço ≥ 50%
```

| Pacote | Premissa (PRD §4) | Horas | Custo (R$ 150/h) | Referência |
|---|---|---:|---:|---:|
| S · Correção pontual | 1 especialista, 1–2 semanas | 60 | R$ 9.000 | R$ 18.000 |
| M · Implantação | especialista + líder parcial, 4–6 semanas | 400 | R$ 60.000 | R$ 120.000 |
| L · Programa | time pequeno + líder, 8–12 semanas | 1.200 | R$ 180.000 | R$ 360.000 |

A razão com o Diagnóstico (R$ 48.000) fica em 0,4× / 2,5× / 7,5×. O S é menor
que o Diagnóstico de propósito: é a correção de uma lacuna que o Diagnóstico
achou, não uma alternativa a ele. O M e o L ficam acima, e o cliente compra
em sequência, não um ou outro.

---

## 5. Diagnóstico e abatimento

O SV-01 já tem preço em produção: **R$ 48.000 por projeto, 4 semanas, consultor
sênior + arquiteto de dados** (`2026-09-catalogo-nebuloz.sql:21-23`). O
`icp-e-precificacao.md` §3 ainda fala como se o número estivesse em aberto. Não
está. O que está em aberto é se ele respeita as três amarras daquela seção.

**Sozinho ele se paga.** Com entrega estimada em 100 horas (R$ 15.000), a
contribuição é de R$ 28.848 contra um CAC de R$ 15.188, ou seja 1,9×. Não passa
de 3× sozinho, e nem precisa: a função dele é converter, e ele não dá
prejuízo nem quando não converte.

**Abater 100% do Diagnóstico no primeiro pacote, não.** Três razões:

1. **O primeiro ano sai de graça.** O ano 1 da Ideação no mínimo, no pior
   caso, soma R$ 35.724. Um crédito de R$ 48.000 cobre 134% dele. O
   primeiro pagamento real cai na renovação, que é o momento de maior risco
   de churn. Cliente que nunca pagou não sabe quanto vale.
2. **São verbas diferentes.** O Diagnóstico sai de verba de consultoria e o
   pacote de verba de software (§4 do ICP). Abater uma fatura na outra
   complica a contabilidade do comprador, que é justamente quem o ticket
   fixo queria poupar.
3. **Distorce o MRR.** O abatimento lançado como desconto de mensalidade entra
   em `valorMensalCentavos` e na série de MRR, e a renovação vira
   "expansão" que não existiu.

**Recomendação:** crédito de conversão de **até 25% do Diagnóstico (R$ 12.000)**,
só em contrato anual assinado em até 90 dias, e aplicado sobre **serviço de
implantação** (onboarding assistido, SV-03, Scaffold). Nunca sobre a
mensalidade. O LTV/CAC do caminho Diagnóstico → Ideação sobe de 4,4× (abatimento
integral) para 6,5×, e o MRR continua dizendo a verdade.

---

## 6. Validação econômica

### 6.1 Premissas

| Premissa | Valor | Natureza |
|---|---|---|
| Desconto anual | 12% | **real**, `TermoDeContrato` |
| Desconto comercial sem aprovação | 15% | **real**, `LIMITE_DESCONTO_SEM_APROVACAO` |
| Tributos sobre receita | 8,65% (PIS/COFINS cumulativo + ISS 5%) | hipótese, depende do regime |
| Custo-hora carregado | R$ 150 | hipótese, `cac-modelo.md` §3 |
| CSM carregado | R$ 20.000/mês | hipótese |
| Infraestrutura por conta | R$ 200 + R$ 3/assento | hipótese, sem fatura de Vercel, Neon, Liveblocks ou Sentry no repositório |
| Custo do crédito | R$ 0,10 | hipótese (§3.1) |
| Franquia consumida | 100% | conservador, o pior caso |
| Suporte | 2 / 5 / 6 / 8 h por mês | hipótese |
| CSM por conta | Growth 1/15 · Scale 1/4 | hipótese |
| Churn mensal | 2,5% / 1,8% / 1,2% / 0,8% | hipótese, benchmark de SaaS B2B por porte; **não existe churn medido** |
| Vida máxima | 60 meses | teto conservador |
| CAC | R$ 20.250 × 0,75 / 1,0 / 1,75 / 3,5 | hipótese; a base é o exemplo de `cac-modelo.md` §3 |
| Onboarding assistido no Scale | R$ 5.000 somados ao CAC | hipótese |

```
recebido  = assentos × preço × (1 − 12%) × (1 − desconto comercial)
margem    = recebido × (1 − tributos) − (infra + créditos + suporte + CSM)
LTV       = margem × min(1 ÷ churn, 60)
payback   = CAC ÷ margem
churn máx = margem ÷ (3 × CAC)          ← o churn em que LTV/CAC cai a 3
CAC máx   = LTV ÷ 3
```

### 6.2 Pior caso: mínimo de assentos, anual, −15% comercial

| Pacote (assentos) | Tabela | Recebido | COGS | Margem | LTV | CAC | LTV/CAC | Payback | Churn máx. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ideação (20) | 3.980 | 2.977 | 680 | 69% | 81.581 | 15.188 | **5,4×** | 7,4 m | 4,5%/m |
| Validação (30) | 5.850 | 4.376 | 1.265 | 62% | 151.794 | 20.250 | **7,5×** | 7,4 m | 4,5%/m |
| Growth (60) | 10.140 | 7.585 | 3.153 | 50% | 226.519 | 35.438 | **6,4×** | 9,4 m | 3,6%/m |
| Scale (150) | 28.350 | 21.206 | 8.650 | 51% | 643.290 | 75.875 | **8,5×** | 7,1 m | 4,7%/m |

### 6.3 Estresse: pior caso + churn 1,5× + crédito a R$ 0,20

| Pacote (assentos) | Margem | LTV/CAC | Payback | Churn máx. |
|---|---:|---:|---:|---:|
| Ideação (20) | 64% | **3,4×** | 7,9 m | 4,2%/m |
| Validação (30) | 57% | **4,6×** | 8,1 m | 4,1%/m |
| Growth (60) | 43% | **5,1×** | 11,0 m | 3,0%/m |
| Scale (150) | 42% | **7,1×** | 8,5 m | 3,9%/m |

### 6.4 Por que os mínimos são esses

Cada mínimo é o maior de dois pisos:

- **Piso econômico**: o menor número de assentos que passa, no pior caso e no
  estresse, em LTV/CAC ≥ 3 e payback ≤ 12 meses. Com as premissas acima:
  Ideação 19, Validação 23, Growth 58, Scale 125.
- **Piso de escada**: o mínimo de um pacote, vezes o preço dele, não pode sair
  mais barato que o teto do anterior. Se sair, o cliente de 26 pessoas paga
  menos que o de 25. Validação ≥ 26 (R$ 4.975 ÷ 195), Growth ≥ 58
  (R$ 9.750 ÷ 169), Scale ≥ 90.

Resultado, arredondado: 20 / 30 / 60 / 150. O Scale fica acima dos dois pisos
porque segue as faixas de 50 da proposta: a primeira faixa, de 101 a 150,
fatura 150. O piso econômico dele é 125, o que dá ao vendedor espaço para abrir
a primeira faixa em 125 numa conta que peça.

O custo fixo de cada pacote é o que puxa o piso econômico para cima. No
Growth, o CSM compartilhado custa cerca de R$ 1.300 por conta, estejam 60 ou
100 pessoas usando. No Scale, o CSM dedicado custa R$ 5.000. Na Ideação,
o risco é de churn: ela cobra por cinco produtos num momento em que o próprio
ICP diz que Cosmos (três ARTs) e Signal (linha de base) ainda não servem. Com
15 assentos o estresse dava 2,3×. Com 20, aguenta churn de até 4,5% ao mês.

### 6.5 O que a trava não prova

LTV/CAC ≥ 3 passa com folga porque **CAC e churn são hipóteses**. Nenhum dos
dois foi medido: não há cliente pagante no banco de produção (`PRODUCT.md`,
Evidence on Hand). A tabela passa a significar algo quando for lida ao
contrário, como teto:

| Pacote | **CAC máximo** (pior caso, 3×) | **Churn máximo** |
|---|---:|---:|
| Ideação | R$ 27.194 | 4,5%/mês |
| Validação | R$ 50.598 | 4,5%/mês |
| Growth | R$ 75.506 | 3,6%/mês |
| Scale | R$ 214.430 | 4,7%/mês |

Quando o [`cac-modelo.md`](cac-modelo.md) tiver número real, basta comparar com
esta coluna. CAC acima dela reprova o pacote nesse preço. A proposta original,
com mínimo igual ao teto, passava com mais folga (7,1× / 14,5× / 13,4×),
porque cobrava a faixa cheia de todo mundo. A folga que abri para o cliente
pequeno tem esse preço, e ele cabe na trava.

---

## 7. As três decisões da proposta

**1. Diagnóstico fora dos pacotes.** Mantido. O abatimento, não: vai a até
25%, sobre serviço, nunca sobre mensalidade (§5).

**2. Todos os produtos em todo pacote.** Mantido. É mais simples de vender, e
o custo marginal de incluir Meridian, Signal e Scaffold é quase zero, porque
nenhum chama modelo. Duas ressalvas:

- **Scaffold no pacote é o software**: trilhas, portões e caso de negócio. A
  entrega assistida continua projeto (§4.1).
- **Signal entra sem ser âncora de valor** até estar pronto. A copy do pacote
  não pode vender o que o Signal ainda não entrega.

**3. Limite de assentos.** Nenhuma das duas opções da proposta. Preço por
assento com mínimo abaixo do teto (§1, item 3). Ao passar do teto, o admin é
convidado a subir de pacote, com tolerância de 10% por 60 dias para o convite
de sexta-feira não travar o time. Vender assento extra dentro do pacote até a
faixa seguinte recriaria o avulso dentro do pacote.

---

## 8. O que muda no sistema, em ordem

1. **Produtos inclusos no plano.** `PlanoComercial` ganha a lista de módulos
   inclusos, e `precificarProposta` zera o `PrecoDeModulo` deles. Sem isso o
   pacote soma R$ 4.200 de módulos por cima. `proposta-escopo` exige ao menos
   um módulo (`modulos: z.array(...).min(1)`), e o pacote deve marcar os cinco
   sozinho.
2. **Crédito no catálogo.** `PlanoComercial` ganha `creditosPorAssento` e
   `precoCreditoExtraCentavos`. A proposta congela os dois, e
   `AssinaturaDoTenant` já tem os campos de destino.
3. **Medição.** Hoje não existe: `CopilotMessage.tokens` existe e ninguém
   escreve, e `CreditoDoMes` é digitado à mão. Não bloqueia vender a
   franquia (§3.3), mas bloqueia cobrar excedente e trocar o custo de
   planejamento pelo real. O mínimo é um registro por chamada com tenant,
   produto, ação e créditos debitados.
4. **Duas tabelas de plano.** As cotas de IA leem `Tenant.plan` (ORBIT,
   GALAXY, NEBULA, UNIVERSE), e o preço lê `PlanoComercial`. Um cliente
   Growth com `Tenant.plan = ORBIT` tem 20 mensagens de Copilot por PI, qualquer
   que seja a franquia vendida. O provisionamento precisa derivar a cota do
   pacote, ou a franquia vira ficção. É a decisão em aberto "qual nome de
   plano o cliente vê" (`PRODUCT.md`), agora com consequência de cobrança.
5. **Checagem de assento no convite.** Não existe: os convites em
   `settings-members.ts` e `settings/workspace.ts` não olham limite, e
   `ASSENTOS_ACIMA_DO_PLANO` só avisa na proposta. Até existir, o teto é
   combinado, e a conferência é mensal pelo back-office. A "Fase 3 do modelo de
   contas" citada na proposta não está no repositório.
6. **Faixas do Scale.** Sem código. A proposta entra com o número de assentos
   do teto da faixa (150, 200, 250…).

Os itens 1 e 2 são o que falta para cotar pacote no motor. Os itens 3 a 5 são
o que falta para o que foi vendido valer depois da assinatura.

---

## 9. O que só a Caixa preenche

Em ordem de impacto no resultado:

1. **CAC real por porte de conta.** Compare com a coluna "CAC máximo" da §6.5.
2. **Churn**: vem só com o tempo. Até lá, a coluna "churn máximo" é o alarme.
   Franquia usada abaixo de 30% (`usoDaFranquia`) é o sinal precoce.
3. **Custo do crédito medido** (depende do item 3 da §8).
4. **Regime tributário**: 8,65% é lucro presumido cumulativo; outro regime muda
   a margem em pontos percentuais, não o veredito.
5. **Custo de infraestrutura por conta**: a fatura de Vercel, Neon, Liveblocks e
   Sentry dividida pelas contas ativas.
6. **Horas reais de entrega do Diagnóstico**: 100 horas é hipótese.
   `cac-modelo.md` usa 20 horas, o que não cabe em "4 semanas, dois papéis".
