# Condições de pagamento — proposta B2B enterprise

**Pedido:** CEO, via Chief of Staff, 2026-09-26. Contexto original: lançamento
de Meridian + Charter + Cosmos ao mesmo tempo
([`lancamento-gasto-por-canal.md` §6](lancamento-gasto-por-canal.md)). A
oferta precisa trazer número de parcelas com juros, meios de pagamento e uma
estimativa de ticket médio por mix — hoje isso não existe em lugar nenhum do
produto.

**Atualização 2026-09-26, mesma data — Ordem (CoS):** decisão de lançamento
mudou para **escalonado**: só o Meridian é vendável agora, Charter/Cosmos vão
para lista de espera até passarem no gate de maturidade
(`docs/produto/prontidao-lancamento.md:69-75`, commit `994dd36b`;
[`lancamento-gasto-por-canal.md` §6.4](lancamento-gasto-por-canal.md)). §1 e
§2 abaixo (condições de pagamento em si) não mudam — aplicam-se ao ticket do
Meridian normalmente. §3 (ticket médio por mix) muda: os cenários "Meridian +
Charter" e "Meridian + Cosmos Scale" não são vendáveis no dia 1, porque o
cliente não pode comprar o que está em lista de espera. Ver nota em §3.

**O que é real vs. hipótese:** o desconto por prazo (anual/bienal) já existe
e roda em produção, em `precificarProposta`
([`precificar.ts:95-100`](../../apps/backoffice/lib/comercial/precificar.ts)).
Parcelamento com juros, custo de antecipação e a quebra por condição de
pagamento **não existem no código nem no catálogo** — é proposta nova deste
documento, hipótese ponta a ponta, para o CEO decidir antes de ir para
contrato.

---

## 1. O que já é real hoje

`TermoDeContrato` desconta o **bruto mensal recorrente** (assentos Cosmos +
módulos Meridian/Charter/Signal + add-ons recorrentes + serviços RETAINER),
antes de qualquer desconto comercial negociado
([`precificar.ts:83-97`](../../apps/backoffice/lib/comercial/precificar.ts)):

| Termo | Meses | Desconto | Fonte |
|---|---|---|---|
| Mensal | 1 | 0% | [`2026-09-catalogo-nebuloz.sql:88`](../../packages/database/scripts/2026-09-catalogo-nebuloz.sql) |
| Anual | 12 | 12% | [`2026-09-catalogo-nebuloz.sql:89`](../../packages/database/scripts/2026-09-catalogo-nebuloz.sql) |
| Bienal | 24 | 20% | [`2026-09-catalogo-nebuloz.sql:90`](../../packages/database/scripts/2026-09-catalogo-nebuloz.sql) |

**O que fica de fora do desconto de prazo:** `umaVezCentavos` — setup e
serviços de projeto, `unidadeDeCobranca = PROJETO`/`SPRINT`/`HORA` — entre
eles o ticket do diagnóstico Meridian
([`precificar.ts:41-42,104,117-119`](../../apps/backoffice/lib/comercial/precificar.ts)).
Isso já restringe o que dá para prometer na oferta: **desconto por prazo só
se aplica à parte recorrente**, nunca ao ticket de entrada.

---

## 2. Condições de pagamento propostas

Três trilhas — hipótese de política comercial, sem fonte no produto:

### 2.1 Anual à vista, com desconto

- Usa o desconto de prazo já real (12% ao ano, §1) — não precisa de feature
  nova, só de política comercial de **exigir** pagamento à vista para
  liberar o desconto (hoje o desconto de prazo aplica-se ao termo do
  contrato, não ao momento do pagamento — são coisas diferentes que a
  oferta não pode confundir).
- Aplica-se à parte recorrente (assinatura Meridian/Charter, assentos
  Cosmos). O diagnóstico (ticket único) não entra — cobra-se à parte,
  condição própria (§2.2/§2.3).

### 2.2 Faturado 30/60 (net 30/60)

- Hipótese: sem desconto adicional (nem custo de juros para nós, é prazo
  de recebimento, não crédito rotativo).
- Risco de caixa: `caixa-13-semanas.md` precisa refletir o atraso entre
  faturamento e entrada — este documento não altera aquele modelo, só
  registra que a política de 30/60 dias precisa entrar como premissa lá
  quando o CEO confirmar.

### 2.3 Parcelado, com juros

- Hipótese: parcelamento em até 6× (proposta minha, sem fonte — B2B
  enterprise raramente parcela mais que isso sem financiamento formal).
- Taxa de juros ao cliente: hipótese **2,5% a.m.** — não é número de
  mercado pesquisado, é placeholder para o CEO substituir por cotação real
  (adquirente de cartão ou antecipação de recebíveis).
- **Custo de antecipação para nós:** se a Nebuloz precisar do caixa à vista
  mesmo vendendo parcelado (antecipar recebíveis via adquirente/fintech),
  a taxa de antecipação de mercado no Brasil fica tipicamente na faixa de
  **1,5–4% a.m.**, dependendo do risco do sacado e da adquirente — **âncora
  de mercado, não cotação da Nebuloz**, o CEO precisa cotar com o banco/
  adquirente real antes de prometer prazo ao cliente. Se a taxa cobrada do
  cliente (2,5% a.m., acima) for menor que o custo real de antecipação, a
  Nebuloz subsidia o parcelamento — motivo para não fixar a taxa ao cliente
  sem cotar antes.

| Condição | Desconto/custo | Aplica a | Fonte |
|---|---|---|---|
| Anual à vista | 12% (real) | Recorrente | `precificar.ts` |
| Bienal à vista | 20% (real) | Recorrente | `precificar.ts` |
| Faturado 30/60 | 0% (hipótese) | Recorrente + ticket único | proposta, sem fonte |
| Parcelado até 6× | +2,5% a.m. ao cliente (hipótese) / custo de antecipação 1,5–4% a.m. para nós (âncora de mercado) | Ticket único (diagnóstico), setup | proposta, sem fonte |

---

## 3. Ticket médio estimado por mix

**Atualização 2026-09-26 (lançamento escalonado):** com só o Meridian
vendável, os cenários "Meridian + Charter" e "Meridian + Cosmos Scale" abaixo
**não são vendáveis no dia 1** — o cliente não compra o que está em lista de
espera (`lancamento-gasto-por-canal.md` §6.4). O ticket médio real do
lançamento, enquanto durar a fase só-Meridian, é:

```
Ticket médio (fase Meridian isolado) = R$ 15.000 (hipótese, cac-modelo.md:115)
```

A tabela original (pesos 50/30/20) fica registrada abaixo como o cenário
**pós-abertura de gate** — volta a valer produto a produto conforme
Charter e depois Cosmos saírem da lista de espera
(`docs/produto/regra-maturidade-e-carga.md`), não como estimativa da fase
atual. Preços reais onde existem (catálogo); pesos do mix são **hipótese
pura** — não existe dado de vendas real ainda. CEO precisa corrigir os pesos
assim que houver os primeiros 5–10 clientes reais **e** os produtos
correspondentes estiverem liberados para venda.

| Cenário de venda | Peso (hipótese, pós-gate) | Ticket (real onde marcado) |
|---|---|---|
| Só Meridian (diagnóstico) | 50% | R$ 15.000 (hipótese, [`cac-modelo.md:115`](../comercial/cac-modelo.md)) |
| Meridian + Charter | 30% | R$ 15.000 + R$ 1.800/mês × 12 (real, [`2026-09-catalogo-nebuloz.sql:80`](../../packages/database/scripts/2026-09-catalogo-nebuloz.sql)) = R$ 15.000 + R$ 21.600 ano 1 |
| Meridian + Cosmos Scale (anual) | 20% | R$ 15.000 + R$ 3.278/mês × 12 (real, [`cac-modelo.md:129-131`](../comercial/cac-modelo.md)) = R$ 15.000 + R$ 39.336 ano 1 |

```
Ticket médio ano 1, pós-gate = 0,50 × 15.000 + 0,30 × 36.600 + 0,20 × 54.336
                              = 7.500 + 10.980 + 10.867
                              ≈ R$ 29.347 (hipótese — pesos sem fonte, e só
                              vale quando Charter/Cosmos estiverem liberados)
```

Por condição de pagamento (hipótese, distribuição também chutada):

| Condição | Peso (hipótese) | Efeito no ticket médio |
|---|---|---|
| Anual à vista (−12%) | 40% | reduz ticket médio recorrente em 12% na fatia |
| Faturado 30/60 (0%) | 40% | sem efeito no valor, efeito só no caixa |
| Parcelado 6× (+2,5% a.m. ao cliente) | 20% | aumenta o valor nominal recebido, mas custa antecipação (§2.3) se a Nebuloz precisar do caixa antes |

**Estes dois blocos de peso (mix de produto, mix de condição de pagamento)
são o número mais frágil deste documento — zero dado real por trás.**
Servem para ter uma conta ponta a ponta pronta; o CEO precisa substituir
assim que houver 5–10 vendas reais para não decidir política de desconto em
cima de chute duplo.

---

## 4. Gatilho de terceirizar suporte/pós-venda

Não existe hoje medição de horas de CEO/sócio em suporte — hipótese de
política, não medida. Proposta de estrutura, para o CEO calibrar os números:

**Capacidade hipotética disponível para suporte/pós-venda:**

```
Capacidade = (horas semanais de CEO + horas semanais de sócio) × % alocável a suporte
```

Hipótese de ponto de partida: 2 fundadores × 40h/semana = 80h/semana de
capacidade total; hipótese de 20% alocável a suporte/pós-venda sem
prejudicar venda e produto → **16h/semana** de orçamento de suporte.
Números inteiramente chutados — o CEO sabe a agenda real, não eu.

**Gatilho numérico (hipótese, para validar):**

- **Gatilho de volume:** com custo-hora de suporte carregado hipótese de
  2h/cliente/mês (mesma lógica de custo-hora de `cac-modelo.md` §1, aplicada
  ao pós-venda em vez de aquisição), a capacidade de 16h/semana (≈ 69h/mês,
  4,33 semanas) sustenta:

  ```
  Capacidade em clientes = 69h ÷ 2h/cliente ≈ 34 clientes ativos
  ```

  Terceirizar quando o número de clientes ativos com módulo contratado
  (`TenantModule.status IN ('ACTIVE','TRIAL')`) ultrapassar **~30 clientes**
  — margem de segurança abaixo do teto calculado de 34, para não decidir em
  cima da hora.

- **Gatilho de esforço sustentado:** independente do número de clientes, se
  as horas reais de suporte de CEO+sócio ultrapassarem 16h/semana por
  **3 semanas consecutivas**, terceirizar — sinal de que a carga já passou
  do orçamento antes mesmo de bater o teto de clientes (cliente grande
  pesando mais que a média).

Nenhuma dessas horas foi medida ainda — é o primeiro gatilho, para o CEO
ajustar assim que tiver 2–3 meses de suporte real rodando.

---

## Decisões que o CEO precisa tomar

1. Confirmar as três condições de pagamento (anual à vista, faturado 30/60,
   parcelado até 6×) e se todas valem para todos os produtos ou só para
   recorrente (§1 já restringe o desconto de prazo a recorrente).
2. Cotar taxa real de antecipação de recebíveis com adquirente/banco antes
   de fixar juros ao cliente — hoje é âncora de mercado (1,5–4% a.m.), não
   cotação (§2.3). Sem isso, risco de subsidiar o cliente parcelado.
3. Fixar (ou rejeitar) a taxa de 2,5% a.m. ao cliente parcelado — hipótese
   minha, sem fonte.
4. Corrigir os pesos de mix do §3 (produto e condição de pagamento) assim
   que houver vendas reais — hoje é 100% hipótese, dupla.
5. Validar os números do gatilho de terceirização do §4 (80h/semana de
   capacidade total, 20% alocável, 2h/cliente/mês de suporte, teto de
   ~30 clientes) — nenhum medido, todos chute de ponto de partida.
6. (novo, §3) Confirmar que o ticket médio da fase só-Meridian é R$ 15.000
   isolado, não o mix ponderado de 50/30/20 — esse mix só volta a valer
   quando Charter/Cosmos saírem da lista de espera.

## Riscos

- Prometer parcelamento ao cliente sem ter cotado o custo real de
  antecipação pode fazer a Nebuloz financiar o cliente na prática, sem
  saber — a diferença entre 2,5% a.m. cobrado e o custo real de
  antecipação vira margem negativa silenciosa.
- Desconto de prazo (12%/20%) é real e já roda; confundir "desconto por
  termo de 12/24 meses" com "desconto por pagamento à vista" na oferta cria
  uma promessa que o sistema não cobra do jeito que o vendedor prometeu.
- O ticket médio do §3 mistura dois níveis de chute (mix de produto e mix
  de condição de pagamento) — não deve virar meta de vendas nem entrar no
  `caixa-13-semanas.md` como projeção sem o CEO revisar os pesos primeiro.
