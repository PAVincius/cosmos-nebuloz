# CAC totalmente carregado — modelo para preencher

**Onda 1 do lançamento comercial.** [`icp-e-precificacao.md`](icp-e-precificacao.md)
§3 trava o ticket do diagnóstico neste número, e [`scaffold-prd.md`](../produto/scaffold-prd.md)
§6 trava o preço do pacote S no mesmo lugar: "precificar antes de conhecer o
custo é chute, e em serviço o chute vira margem negativa". Este documento não
chuta o número — dá a fórmula, as linhas para preencher e um exemplo com
números marcados como hipótese, para você substituir pelos reais.

---

## 0. Por que "totalmente carregado"

Um CAC ingênuo soma só o que tem nota fiscal fácil de achar — mídia paga e
talvez o CRM — e divide por clientes ganhos. Fica de fora, sistematicamente:

- **Tempo de quem vende.** Salário e encargos de quem faz call, monta
  proposta e negocia não aparecem em fatura nenhuma, mas são custo de
  aquisição tanto quanto um anúncio.
- **Ferramentas** que não são "de vendas" no nome mas sustentam o funil —
  CRM, automação de e-mail, gravação de call, o próprio back-office.
- **Custo de entrega do diagnóstico**, quando ele é vendido barato ou de
  graça como isca de entrada. Se o Meridian custa horas de especialista para
  entregar e o ticket não cobre essas horas, a diferença é custo de aquisição
  do Charter e do Cosmos que vêm depois — não custo do Meridian.
- **Tempo de discovery que não converte.** Toda hora gasta em `DISCOVERY`
  com um lead que vira `Perdido` (`mapa-de-processo.md` §2) é custo pago
  pelos clientes que converteram, não pelo lead perdido.

**Por que isso vira margem negativa em serviço, e não em SaaS puro:** em SaaS
o custo marginal de atender mais um cliente é baixo, então CAC subestimado
atrasa o payback mas raramente inverte o sinal da margem. Em serviço —
diagnóstico, Scaffold, setup — o custo de entrega é quase todo variável (hora
de gente). Sem o CAC carregado na conta de quanto cobrar, o preço pode ficar
abaixo do custo de vender **mais** entregar, e cada venda nova soma prejuízo
em vez de margem — o acoplamento que `icp-e-precificacao.md` §3 registra
entre o ticket do diagnóstico e esta pendência.

---

## 1. A fórmula

```
CAC = ( custo de pessoas em vendas e marketing
      + ferramentas
      + mídia
      + custo de entrega de atividades de aquisição )
      ÷ clientes ganhos no período
```

Cada parcela, com unidade:

- **Custo de pessoas em vendas e marketing** — salário + encargos + comissão
  de quem vende e de quem faz marketing, no período. Unidade: R$/mês.
- **Ferramentas** — assinaturas de CRM, automação, gravação de call,
  enriquecimento de lead. Unidade: R$/mês.
- **Mídia** — anúncio pago, patrocínio de evento, conteúdo pago. Unidade:
  R$/mês.
- **Custo de entrega de atividades de aquisição** — horas de quem entrega o
  diagnóstico (ou outra isca) × custo-hora carregado dessa pessoa, incluindo
  o discovery que não converteu. Unidade: R$/mês.
- **Clientes ganhos no período** — número de `Proposal` que viraram `ACEITA`
  no mesmo período. Unidade: clientes/mês.

O período tem de ser o mesmo nas cinco parcelas — misturar custo mensal com
clientes do trimestre infla ou reduz o CAC por acidente de janela, não sinal.

---

## 2. Tabela de entrada

| Parcela | Como medir | Fonte | Valor mensal |
|---|---|---|---|
| Salários e encargos — vendas | Folha de quem vende × % do tempo em vendas | Folha de pagamento / RH | ⟨preencher⟩ |
| Salários e encargos — marketing | Folha de quem faz marketing × % do tempo | Folha de pagamento / RH | ⟨preencher⟩ |
| Comissões pagas no período | Soma de comissão sobre propostas `ACEITA` | Contrato de comissão | ⟨preencher⟩ |
| Ferramentas de vendas e marketing | Soma das assinaturas ativas (CRM, automação, gravação) | Notas fiscais / assinaturas SaaS | ⟨preencher⟩ |
| Mídia paga | Gasto do período em anúncio, evento, patrocínio | Extrato de mídia | ⟨preencher⟩ |
| Horas de discovery, convertidas e não | Nº de leads em `DISCOVERY` no período × horas médias por lead × custo-hora carregado de quem faz | Tela `funil` (`apps/backoffice/app/(staff)/funil/page.tsx`) + folha | ⟨preencher⟩ |
| Custo de entrega do diagnóstico vendido no período | Horas de entrega × custo-hora carregado + ferramentas usadas na entrega | Tela `delivery` / `Engagement` do Meridian + folha | ⟨preencher⟩ |
| Clientes ganhos no período | Contagem de `Proposal.status = ACEITA` no período | Tela `propostas` | ⟨preencher⟩ |

**Sobre a linha de discovery:** o número certo pondera pela conversão do
funil, não pelas horas brutas. O funil tem quatro transições
(`LEAD → DISCOVERY → EVALUATION → proposta → ACEITA`, `mapa-de-processo.md`
§§1–4); a taxa de conversão ponta a ponta (`ACEITA` ÷ `LEAD` do período) diz
quantos leads trabalhados sustentam um cliente ganho. Preencher:

| Transição | Taxa de conversão do período |
|---|---|
| `LEAD → DISCOVERY` | ⟨preencher⟩ |
| `DISCOVERY → EVALUATION` | ⟨preencher⟩ |
| `EVALUATION → proposta enviada` | ⟨preencher⟩ |
| `proposta enviada → ACEITA` | ⟨preencher⟩ |

---

## 3. Exemplo calculado — **hipótese, não decisão**

Todo número abaixo é hipótese, só para mostrar a conta ponta a ponta. Nenhum
vem de dado real da Nebuloz.

| Parcela | Valor (hipótese) |
|---|---|
| Salários e encargos, vendas + marketing | R$ 25.000 |
| Ferramentas | R$ 1.500 |
| Mídia | R$ 2.000 |
| Discovery (10 leads/mês × 4h × R$ 150/h custo-hora) | R$ 6.000 |
| Entrega do diagnóstico (2 diagnósticos/mês × 20h × R$ 150/h) | R$ 6.000 |
| **Total do mês (hipótese)** | **R$ 40.500** |
| Clientes ganhos no mês (hipótese) | 2 |
| **CAC (hipótese)** | **R$ 20.250 / cliente** |

**O que isso faz com o ticket do diagnóstico.** Se o ticket do diagnóstico
fosse fixado, por hipótese, em R$ 15.000 — abaixo do CAC de R$ 20.250 — cada
diagnóstico vendido isoladamente dá prejuízo de aquisição; ele só se paga se
o cliente expandir depois para Charter ou Cosmos. É a leitura que
`icp-e-precificacao.md` §3 já antecipa: o ticket precisa ficar acima do custo
carregado de entrega, e este exemplo mostra o formato da conta que decide
isso — não o número.

**Payback contra o plano Scale — real onde é real, hipótese onde é hipótese.**
O preço por assento e o mínimo de assentos do plano Scale são reais, do
catálogo semeado e do teste `precificar.test.ts` (`precoAssentoCentavos =
14_900`, `minimoAssentos = 25`). Com termo anual (desconto de prazo de 12%,
sem desconto comercial), a fórmula testada dá:

```
bruto mensal   = 25 × R$ 149            = R$ 3.725
líquido mensal = round(R$ 3.725 × 0,88) = R$ 3.278   (real, pela fórmula)
ACV            = R$ 3.278 × 12          = R$ 39.336  (real, pela fórmula)
```

Payback = CAC ÷ receita mensal recorrente:

```
Payback = R$ 20.250 (CAC, hipótese) ÷ R$ 3.278/mês (real) ≈ 6,2 meses
```

Isso ignora margem bruta — payback real é mais longo, porque parte da
receita mensal cobre custo de entrega contínua, não só recupera CAC. É
simplificação para ilustrar a mecânica, não o número final.

**Pacote S do Scaffold.** Sem preço fixado (`scaffold-prd.md` §6), não dá
para calcular payback dele ainda. O que dá para fixar é a regra: se o preço
do pacote S ficar perto do ticket do diagnóstico, o cliente escolhe um ou
outro em vez de comprar os dois em sequência — a mesma âmora que
`icp-e-precificacao.md` §3 item 3 registra. A razão saudável entre os dois
só aparece depois que ambos tiverem CAC e custo de entrega medidos.

---

## 4. CAC por produto

O Meridian é a porta de entrada — ciclo curto, ticket fixo — e puxa Charter,
Cosmos e, via Scaffold, a correção das lacunas que ele encontra. Alocar todo
o CAC do Meridian só a ele mesmo subestima o CAC de quem vem depois (o
Charter parece "gratuito" de adquirir) e superestima o do Meridian isolado.

**Regra simples de alocação:** ratear o CAC totalmente carregado do Meridian
pelos produtos que o cliente contrata no primeiro ano, na proporção do ACV de
cada um.

```
CAC alocado a um produto = CAC do Meridian × (ACV do produto ÷ ACV total do cliente no ano 1)
```

Exemplo com os números hipotéticos acima: cliente compra o diagnóstico
(hipótese R$ 15.000, ACV do ano 1 tratado como o próprio ticket, por ser
projeto único) e o Charter recorrente (ACV real de catálogo, R$ 21.600/ano).
ACV total do ano 1 = R$ 36.600. O CAC de R$ 20.250 se rateia:

- Meridian: R$ 20.250 × (15.000 ÷ 36.600) ≈ R$ 8.299
- Charter: R$ 20.250 × (21.600 ÷ 36.600) ≈ R$ 11.951

O Charter carrega a maior parte do CAC de aquisição mesmo sem gastar em
vendê-lo diretamente — é o ponto: o Meridian paga o custo de entrada, e o
retorno vem do que ele puxa.

---

## 5. O que só você preenche

Em ordem de impacto no resultado — as primeiras mudam o CAC mais por real
que mudam por estimativa errada:

1. **Clientes ganhos no período.** É o denominador; um erro aqui multiplica
   ou divide o CAC inteiro.
2. **Custo de entrega do diagnóstico vendido no período.** É a parcela mais
   fácil de esquecer, e a que mais destrava ou trava o ticket de entrada.
3. **Custo-hora carregado de quem faz discovery e entrega.** Alimenta duas
   linhas da tabela; errar aqui erra as duas.
4. **Taxa de conversão do funil (`LEAD → ACEITA`)**, para saber quanto do
   tempo de discovery é custo de quem converteu versus de quem não converteu.
5. **Salários e encargos de vendas e marketing.** Grande em valor absoluto,
   mas estável mês a mês — menos risco de erro de medição do que as linhas
   acima.
6. **Ferramentas e mídia.** Menor parcela do total hoje, dado que a Nebuloz
   ainda não roda mídia paga em escala — mas preencher assim que existir
   gasto real.
