# Rastreio de gasto por canal — lançamento (créditos LinkedIn Ads + orgânico)

**Pedido:** CEO, via Chief of Staff, 2026-09-26. Contexto: lançamento público
da Nebuloz usa créditos de LinkedIn Ads + esforço orgânico em
Instagram/LinkedIn. O CAC hoje é só hipótese (`cac-modelo.md`, R$ 20.250/cliente
— [`cac-modelo.md:112`](../comercial/cac-modelo.md)), calculado sem quebra por
canal. Este documento monta o rastreio desde o dia 1 do lançamento para que,
quando o gasto real existir, ele entre no CAC carregado por canal — não só no
total.

Todo número aqui é hipótese, marcado como tal. Orçamento real do lançamento
**não foi informado pelo CEO** — os campos de limite ficam em aberto.

---

## 0. Lacuna real no produto — decisão antes de rastrear

O funil já tem canal como entidade real, não campo livre: modelo
`CanalDeLead` (`slug`, `nome`, `cacMedioCentavos` — nulo até medir), ligado a
`Lead.canalId`
([`platform-ops.prisma:230-247`](../../packages/database/prisma/schema/platform-ops.prisma)).
Isso substituiu `origem` (texto livre, sem lista fechada —
[`mapa-de-processo.md:27`](../comercial/mapa-de-processo.md),
[`insumos-de-posicionamento.md:384-385`](../comercial/insumos-de-posicionamento.md)).

Os cinco canais semeados hoje são genéricos —
**indicação, evento, inbound, outbound, parceiro**
([`funil-nebuloz.ts:72-78`](../../packages/provisioning/src/funil-nebuloz.ts)) —
nenhum é "LinkedIn Ads" nem "Instagram orgânico". Não existe hoje canal para
atribuir o lead do lançamento a um dos dois.

**Decisão do CEO:** criar dois `CanalDeLead` novos —
`linkedin-ads` e `instagram-organico` (ou mapear o lançamento em `inbound`
com quebra manual por UTM, ver §3). Peço definição antes do dia 1, porque
lead sem canal correto vira `origem` texto livre de novo — o problema que o
funil v2 resolveu.

---

## 1. Gasto por canal — o que entra em cada linha

Segue o plano de contas (`plano-de-contas.md` §4, conta
[4.5 — Mídia paga](plano-de-contas.md) e
[4.2 — Pessoal de marketing](plano-de-contas.md)):

| Canal | O que é gasto | Conta do plano | Como medir |
|---|---|---|---|
| LinkedIn Ads (créditos) | Consumo de crédito de campanha, em R$, mesmo sendo crédito e não desembolso — custo de oportunidade real | 4.5 Mídia paga | Painel do LinkedIn Ads Manager, gasto do período |
| Orgânico Instagram | Horas de quem cria/posta/responde × custo-hora carregado da pessoa | 4.2 Pessoal de marketing | Horas do período × custo-hora (mesma lógica de `cac-modelo.md` §1, "custo de pessoas") |
| Orgânico LinkedIn | Horas de quem posta/comenta/prospecta no perfil pessoal ou da empresa × custo-hora | 4.2 Pessoal de marketing | Idem |
| Ferramentas de apoio ao lançamento (se houver: agendador de post, design) | Assinatura do período | 4.4 Ferramentas de vendas e marketing | Nota fiscal / assinatura |

### 1.1 Tabela de entrada — semana a semana

| Semana | LinkedIn Ads (R$, crédito consumido) | Horas orgânico Instagram | Horas orgânico LinkedIn | Custo-hora carregado (R$/h) | Gasto orgânico (R$) | Total do canal (R$) |
|---|---|---|---|---|---|---|
| 1 | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | horas × custo-hora | LinkedIn Ads + orgânico |
| 2 | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | | |
| 3 | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | | |
| 4 | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ | | |

Custo-hora carregado: mesma definição de `cac-modelo.md` §1 — salário +
encargos ÷ horas úteis do mês da pessoa que posta/interage, não uma tarifa de
mercado.

---

## 2. Métricas de funil por canal

O funil real do produto tem quatro estágios entre lead e cliente
(`LEAD → DISCOVERY → EVALUATION → PROPOSAL`, depois `ACEITA`), tela `funil`
(`apps/backoffice/app/(staff)/funil/page.tsx`, citado em
[`cac-modelo.md:79`](../comercial/cac-modelo.md)). O lançamento adiciona duas
etapas **antes** do lead existir no funil — impressão e clique — que o
back-office não mede hoje; entram por fora, do painel de cada rede.

| Etapa | Onde mede | Canal LinkedIn Ads | Canal Instagram orgânico | Canal LinkedIn orgânico |
|---|---|---|---|---|
| Impressão | Painel da rede (Ads Manager / Insights) | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Clique | Painel da rede + UTM (§3) | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Lead | `Lead` criado com `canalId` = canal, tela `funil` | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Reunião (Discovery) | `Lead.estagio = DISCOVERY` | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Oportunidade (Proposal enviada) | `Lead.estagio = PROPOSAL` / `Proposal` vinculado | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |
| Cliente | `Proposal.status = ACEITA` | ⟨preencher⟩ | ⟨preencher⟩ | ⟨preencher⟩ |

Taxas de conversão entre etapas seguem a mesma lógica de
[`cac-modelo.md` §2](../comercial/cac-modelo.md) — cada transição é
numerador/denominador do mesmo período, por canal em vez de agregado.

**Limitação atual:** impressão e clique não têm captura automática — o funil
do produto só existe a partir de `LEAD`. Impressão/clique ficam em
preenchimento manual do painel de cada rede até (se) existir uma ferramenta
de analytics conectada — hoje não existe (PostHog avaliado e descartado por
licença AGPL, decisão registrada em
`.claude/completions/2026-09-06-growth-readiness.md`).

---

## 3. Convenção de UTM

Sem isso, todo lead do lançamento cai em "inbound" genérico e a quebra por
canal do §1/§2 não fecha. Convenção proposta — **hipótese, decisão do CEO/CoS
confirmar antes do dia 1**:

```
utm_source   = linkedin | instagram
utm_medium   = paid-ads | organic-post | organic-comment | organic-dm
utm_campaign = lancamento-2026-09 (um valor fixo por onda de lançamento)
utm_content  = identifica o criativo/post específico (ex.: video-diagnostico-01)
```

Regra de atribuição: primeiro clique define o canal do lead (first-touch),
porque é o CAC de **aquisição** — quem trouxe a pessoa pela primeira vez —
que este documento alimenta, não o canal do último toque antes da conversão.

**Onde isso vira dado real:** o link com UTM leva ao formulário de contato
(`insumos-de-posicionamento.md:198` cita LinkedIn como canal de contato já
existente). Quem cadastra o lead manualmente na tela `funil` (cadastro é
manual hoje —
[`mapa-de-processo.md:27`](../comercial/mapa-de-processo.md)) lê o UTM da
URL de origem (se o formulário registrar) ou pergunta a origem no primeiro
contato, e seleciona o `CanalDeLead` correspondente (`linkedin-ads` ou
`instagram-organico`, §0) — não digita texto livre.

---

## 4. Como isso alimenta o CAC carregado

`cac-modelo.md` calcula CAC agregado:

```
CAC = ( pessoas vendas/marketing + ferramentas + mídia + entrega de aquisição )
      ÷ clientes ganhos
```

Por canal, a mesma fórmula roda isolada, usando só as linhas de gasto do
canal (§1) e os clientes ganhos atribuídos a ele (§2, `canalId`):

```
CAC(canal) = ( gasto do canal no período, de §1 )
             ÷ ( clientes ganhos com Lead.canalId = canal, no mesmo período )
```

Isso é exatamente o que o campo `CanalDeLead.cacMedioCentavos` existe para
guardar — hoje nulo em todos os canais semeados
([`funil-nebuloz.ts:72-78`](../../packages/provisioning/src/funil-nebuloz.ts)),
"CAC —" na tela até ter dado real
([`platform-ops.prisma:236-238`](../../packages/database/prisma/schema/platform-ops.prisma)).
O rastreio deste documento é o que preenche esse campo pela primeira vez,
canal a canal, em vez de um CAC único que mistura LinkedIn Ads com orgânico.

A alocação por produto de `cac-modelo.md` §4 (CAC do Meridian ratear entre
Meridian/Charter pelo ACV) continua valendo **dentro** de cada canal — não é
substituída, é uma segunda quebra sobre a primeira.

---

## 5. Limite de gasto e gatilho de parar/escalar

**Hipótese — orçamento real do lançamento não foi informado pelo CEO.**
Campos abaixo ficam vazios até definição:

| Parâmetro | Valor |
|---|---|
| Mídia LinkedIn Ads — provisório (CEO, 2026-09-26) | R$ 200/dia ≈ R$ 6.000/mês (30 dias) |
| Orçamento total do lançamento (créditos LinkedIn Ads) | ⟨CEO preenche⟩ |
| Limite semanal de queima de crédito | R$ 200/dia × 7 ≈ R$ 1.400/semana, enquanto o provisório valer |
| Horas/semana orçadas para orgânico (Instagram + LinkedIn) | ⟨CEO preenche⟩ |

"Provisório" — o CEO ainda não fixou o valor definitivo; R$ 200/dia é o que
roda enquanto não há revisão. O §6 usa esse número para o teste LTV/CAC.

**Gatilho de escalar (hipótese, para validar com o CEO):** se
`CAC(canal)` medido em §4 ficar **abaixo** do CAC agregado atual de
R$ 20.250 (hipótese,
[`cac-modelo.md:112`](../comercial/cac-modelo.md)) depois de pelo menos
2 clientes ganhos atribuídos ao canal — amostra mínima para não decidir por
ruído — esse canal justifica mais orçamento.

**Gatilho de parar (hipótese):** se o orçamento semanal (linha acima, uma vez
definida) for consumido sem gerar nenhum lead atribuído ao canal em 2 semanas
consecutivas, ou se o `CAC(canal)` medido ultrapassar 1,5× o CAC agregado
hipotético (≈ R$ 30.375) depois de amostra mínima de 2 clientes, pausar
o canal e revisar criativo/segmentação antes de religar.

Os dois multiplicadores (2 clientes de amostra mínima, 1,5× de limite) são
hipótese minha, sem fonte — servem de ponto de partida para o CEO ajustar, não
são número testado.

---

## 6. Teste LTV/CAC > 3 — com mídia a R$ 200/dia

**Decisão do CEO, 2026-09-26 (superada por §6.4 abaixo):** lançar Meridian,
Charter e Cosmos ao mesmo tempo, com restrição de **LTV/CAC > 3** por produto e
mídia LinkedIn provisória de R$ 200/dia.

**Atualização 2026-09-26, mesma data — Ordem (CoS):** decisão de lançamento
mudou para **escalonado** — suíte anunciada inteira, só Meridian vendável
(`docs/produto/prontidao-lancamento.md:69-75`, commit `994dd36b`). As contas
6.1–6.3 abaixo já eram, na prática, 100% custo do Meridian (discovery e
entrega do diagnóstico são atividades do Meridian, não do Charter/Cosmos) —
não precisam refazer o CAC em si. O que muda é a leitura do teste LTV/CAC:
sem Charter/Cosmos vendáveis, não existe expansão no mesmo cliente no mês 1
para segurar a meta. §6.4 refaz o teste nessa base.

### 6.1 CAC recalculado — R$ 200/dia no lugar dos R$ 2.000/mês de mídia

`cac-modelo.md` §3 monta o CAC hipotético com mídia de R$ 2.000/mês
([`cac-modelo.md:107`](../comercial/cac-modelo.md)). Substituindo só essa
linha por R$ 200/dia (≈ R$ 6.000/mês, §5), mantendo as demais linhas
hipotéticas do exemplo original:

| Parcela | Valor (hipótese, exceto mídia) |
|---|---|
| Salários e encargos, vendas + marketing | R$ 25.000 |
| Ferramentas | R$ 1.500 |
| Mídia (R$ 200/dia × 30) | **R$ 6.000** |
| Discovery (10 leads/mês × 4h × R$ 150/h) | R$ 6.000 |
| Entrega do diagnóstico (2 diagnósticos/mês × 20h × R$ 150/h) | R$ 6.000 |
| **Total do mês** | **R$ 44.500** |
| Clientes ganhos no mês (hipótese) | 2 |
| **CAC (hipótese, recalculado)** | **R$ 22.250/cliente** |

Como todos os produtos lançam pela mesma campanha, este CAC agregado é o
número de partida por produto abaixo — não uma média isolada por canal
(§4 trata a quebra por canal; aqui a pergunta é outra: quanto tempo de
retenção cada produto precisa para pagar esse CAC 3×).

**LTV mínimo exigido (restrição do CEO):**

```
LTV_min = 3 × CAC = 3 × R$ 22.250 = R$ 66.750
```

### 6.2 LTV por produto e retenção mínima em meses

Preços reais do catálogo onde existem; margem bruta é **hipótese** — o DRE
não tem margem real ainda (`dre-modelo.md`, linha "Margem bruta %" —
⟨preencher⟩ em todas as colunas). Uso 80% para receita recorrente de
plataforma/módulo (custo marginal baixo) e 50% para o serviço de diagnóstico
(entrega é hora de gente, `cac-modelo.md` §0) — **ambos números chutados por
mim, sem fonte, para o CEO corrigir.**

```
LTV(produto) = receita recorrente mensal × margem bruta hipótese × meses de retenção
              + (para Meridian) ticket do diagnóstico × margem de serviço hipótese, uma vez
```

| Produto | Receita mensal | Fonte | Margem hipótese | Retenção mínima p/ LTV/CAC > 3 |
|---|---|---|---|---|
| Meridian (diagnóstico + assinatura) | Diagnóstico R$ 15.000 (hipótese, uma vez) + R$ 1.200/mês assinatura | Assinatura real — `PrecoDeModulo` MERIDIAN, 120000 centavos ([`2026-08-preco-meridian.sql:44`](../../packages/database/scripts/2026-08-preco-meridian.sql)); ticket hipótese de [`cac-modelo.md:115`](../comercial/cac-modelo.md) | 50% (serviço) / 80% (assinatura) | **≈ 62 meses** (≈ 5,1 anos) só na assinatura, depois de abater o diagnóstico |
| Charter | R$ 1.800/mês (R$ 21.600/ano) | Real — `PrecoDeModulo` CHARTER, 180000 centavos ([`2026-09-catalogo-nebuloz.sql:80`](../../packages/database/scripts/2026-09-catalogo-nebuloz.sql)) | 80% | **≈ 47 meses** (≈ 3,9 anos) |
| Cosmos Scale (25 assentos, termo anual) | R$ 3.278/mês líquido | Real — fórmula testada, `precoAssentoCentavos = 14.900`, `minimoAssentos = 25`, desconto anual 12% ([`2026-09-catalogo-nebuloz.sql:69`](../../packages/database/scripts/2026-09-catalogo-nebuloz.sql), [`cac-modelo.md:123-131`](../comercial/cac-modelo.md)) | 80% | **≈ 26 meses** (≈ 2,1 anos) |

Conta do Meridian: `(15.000 × 0,50) = 7.500` de margem do diagnóstico abatem
direto do LTV mínimo; sobra `66.750 − 7.500 = 59.250` para a assinatura
cobrir a `960`/mês de margem (`1.200 × 0,80`) → `59.250 ÷ 960 ≈ 61,7` meses.

**Leitura, não só número:** Meridian sozinho precisa de ~5 anos de retenção
para justificar o CAC agregado — impossível de esperar de um produto de
entrada com ciclo curto. Isso confirma o que `cac-modelo.md` §4 já registra:
o Meridian paga o custo de aquisição, e é Charter/Cosmos que sustentam o
retorno. Se o CAC de R$ 22.250 for alocado pela regra do §4 (proporção de
ACV no ano 1, não 100% em cada produto), a retenção mínima de cada produto
cai — mas alocar exige saber, por cliente real, quais produtos ele compra
juntos no ano 1, o que ainda não existe (lançamento é dia 1).

### 6.3 O que isso implica em retenção real

Sem dado de churn ainda (`dre-modelo.md` não tem margem real, muito menos
retenção), estes meses são o alvo a bater, não uma previsão. Se a retenção
histórica de consultoria B2B parecida ficar abaixo de ~2 anos (âncora de
mercado, não medida da Nebuloz), Cosmos Scale isolado já não fecha
LTV/CAC > 3 — e Meridian/Charter isolados precisam de contrato plurianual ou
de um produto que puxe o outro (a mesma lógica de rateio do §4) para fechar
a conta.

---

## 6.4 Teste LTV/CAC > 3 refeito — só Meridian vendável (2026-09-26)

**Por que o CAC não muda de valor, só de leitura.** As linhas de custo do
§6.1 (discovery, entrega do diagnóstico) já eram atividade do Meridian —
`cac-modelo.md` §3, de onde vieram, é o exemplo do CAC do Meridian, não um
CAC de suíte. `Clientes ganhos no mês (hipótese) = 2` sempre significou 2
diagnósticos vendidos. **CAC continua R$ 22.250/cliente** — só que agora é
explícito que é 100% Meridian, não uma fatia de um CAC agregado de 3
produtos.

**Sem diluição da mídia paga pelo resto da suíte:** `lancamento-oferta.md`
§4 e §0.3 já registram que o LinkedIn Ads paga (o R$ 200/dia) mira **só**
o CTA de diagnóstico do Meridian; o resto da suíte aparece só em conteúdo
orgânico/e-book com CTA de lista de espera, sem gasto de mídia paga por
trás. Ou seja: a mídia não gera lead qualificado de Charter/Cosmos que
"desperdiça" parte do R$ 200/dia — o R$ 200/dia é 100% Meridian por
desenho da oferta, não por hipótese minha.

**Teste LTV/CAC > 3, só com receita do Meridian** (usando `lancamento-gasto-por-canal.md`
§6.2, linha Meridian, e a mesma margem hipótese 50%/80% de lá):

```
LTV_min = 3 × CAC = 3 × R$ 22.250 = R$ 66.750
LTV(Meridian) = 7.500 (margem do diagnóstico, uma vez)
              + 960/mês (margem da assinatura) × meses de retenção
```

Retenção mínima para bater a meta: **≈ 62 meses (≈ 5,1 anos)** — o mesmo
número que §6.2 já tinha calculado, porque a conta sempre foi Meridian
isolado. **A diferença agora é que não há Charter/Cosmos vendável no mês 1
para diluir isso por expansão** — a leitura de §6.3 ("Meridian sozinho não
fecha, é Charter/Cosmos que sustentam o retorno") deixa de ser um
comentário lateral e vira a situação real do lançamento: **o teste
LTV/CAC > 3 falha, com folga, usando só a receita disponível hoje.**

**Sensibilidade — a mídia não é a alavanca.** Zerando o R$ 200/dia de mídia
(R$ 6.000/mês) e mantendo tudo o mais igual:

```
Total sem mídia = R$ 44.500 − R$ 6.000 = R$ 38.500
CAC sem mídia   = R$ 38.500 ÷ 2 = R$ 19.250/cliente
```

Ainda exige ≈ 53 meses de retenção (`(3×19.250 − 7.500) ÷ 960`) — **zerar a
mídia paga inteira reduz o CAC em só ~13% e não muda a conclusão.** O motivo:
a linha "salários e encargos, vendas + marketing" (R$ 25.000/mês, hipótese)
sozinha, dividida por 2 clientes ganhos/mês, já é R$ 12.500/cliente — mais
da metade do CAC. **O problema é volume (2 clientes ganhos/mês) dividindo
custo fixo, não o gasto de mídia.**

**Quanto precisaria de volume para bater a meta a uma retenção mais
plausível** (2 anos, âncora de mercado citada em §6.3, não medida da
Nebuloz):

```
LTV(24 meses) = 7.500 + 960 × 24 = R$ 30.540
CAC_max = LTV ÷ 3 = R$ 10.180/cliente
Clientes ganhos necessários (mantendo R$ 44.500 de custo total) =
  44.500 ÷ 10.180 ≈ 4,4 → 5 diagnósticos/mês
```

Ou seja: para a meta fechar com retenção de 2 anos (e sem mudar preço nem
custo), o Meridian precisaria vender **~5 diagnósticos/mês, não 2** — mais
que dobrar o ritmo de vendas assumido, não cortar mídia.

**Recomendação (CFO, não decisão):**
1. **Manter o R$ 200/dia de mídia.** Cortar mídia não resolve o teste (só
   13% de melhora no CAC) e reduz o volume de leads justamente no momento em
   que o gargalo é volume, não custo de aquisição.
2. **Não tratar LTV/CAC > 3 como gate do Meridian isolado no lançamento.**
   A meta foi desenhada (`lancamento-oferta.md:13-20`) supondo expansão para
   o resto da suíte no mesmo cliente — que não existe enquanto Charter/Cosmos
   estão em lista de espera. Sugiro ao CEO reclassificar a meta como **gate
   da suíte**, medido depois que o primeiro produto seguinte (Scaffold, pela
   esteira de `prontidao-lancamento.md`) sair da lista de espera e o cliente
   puder expandir — não como critério para pausar o Meridian hoje.
3. **Se o CEO quiser manter o gate valendo já**, a alavanca real é volume de
   diagnósticos vendidos por mês (meta ~5, não 2) ou reduzir a linha de
   salário alocada a vendas/marketing (hoje R$ 25.000/mês hipótese, sem
   fonte de folha real) — não o orçamento de mídia.

Todos os números desta seção herdam as mesmas hipóteses de §6.1–6.3
(margem 50%/80%, 2 clientes ganhos/mês, R$ 25.000 de salário) — nenhum é
dado real novo.

---

## Decisões que o CEO precisa tomar

1. Criar `CanalDeLead` `linkedin-ads` e `instagram-organico` (ou decidir outro
   mapeamento) antes do dia 1 — sem isso, lead do lançamento cai em canal
   genérico e a quebra não existe (§0).
2. Confirmar a convenção de UTM do §3 (source/medium/campaign/content) com
   quem publica os anúncios e posts, e decidir first-touch vs. last-touch de
   atribuição (proponho first-touch, §3).
3. Informar orçamento do lançamento (créditos LinkedIn Ads + horas/semana de
   orgânico) para preencher §5 — sem isso não há limite nem gatilho reais,
   só hipótese.
4. Validar ou ajustar os gatilhos de parar/escalar do §5 (amostra mínima de
   2 clientes, limite de 1,5× o CAC — ambos hipótese minha).
5. Corrigir as margens hipóteses do §6.2 (50% serviço, 80% assinatura) —
   mudam a retenção mínima calculada em todos os três produtos.
6. Decidir se aceita ~5 anos de retenção mínima do Meridian isolado (§6.2)
   ou se adota alocação de CAC por produto (`cac-modelo.md` §4) desde o
   lançamento, o que exige registrar quais produtos cada cliente compra
   junto no ano 1.
7. Fixar (ou confirmar como definitivo) o valor de R$ 200/dia de mídia —
   está marcado como provisório desde 2026-09-26.
8. (novo, §6.4) Decidir se LTV/CAC > 3 vale como gate do Meridian isolado
   já no lançamento escalonado (hoje falha, ~62 meses de retenção exigida)
   ou como gate da suíte, medido só quando o cliente puder expandir para o
   próximo produto liberado.

## Riscos

- Cadastro de lead é manual (`mapa-de-processo.md:27`) — sem disciplina de
  quem atende, UTM se perde e o canal vira "inbound" genérico de novo.
- Sem ferramenta de analytics conectada, impressão/clique dependem de
  export manual do painel de cada rede — atraso ou esquecimento quebra o
  funil completo do §2 (fica sem numerador para taxa de clique).
- Créditos de LinkedIn Ads não são desembolso de caixa — não aparecem no
  `caixa-13-semanas.md` como saída, mas são custo real para o CAC; risco de
  quem olha só caixa achar o canal "de graça".
