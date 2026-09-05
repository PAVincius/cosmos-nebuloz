# Plano de contas — base mínima

Base para o [DRE mensal](dre-modelo.md) e o [caixa de 13 semanas](caixa-13-semanas.md)
lerem, e para o [modelo de CAC](../comercial/cac-modelo.md) ter de onde tirar
as contas de despesa comercial. Códigos numéricos simples, sem a
granularidade de um plano contábil fiscal — isso é responsabilidade do
contador; aqui é o mínimo para gestão.

Uma frente de receita por produto, porque é assim que a Nebuloz decide onde
investir: os cinco produtos do [`INDEX-MESTRE`](../superpowers/plans/INDEX-MESTRE.md)
(Meridian, Charter, Scaffold, Cosmos, Signal), com assinatura e serviço
separados dentro de cada um — a mesma separação que `precificarProposta` já
faz entre recorrente e uma-vez.

---

## 1 — Receita

| Conta | Nome | Definição |
|---|---|---|
| 1.1 | Receita de assinatura — Meridian | Mensalidade do módulo Meridian contínuo (pós-diagnóstico), `PrecoDeModulo` |
| 1.2 | Receita de assinatura — Charter | Mensalidade do módulo Charter |
| 1.3 | Receita de assinatura — Cosmos | Mensalidade do assento de plataforma (Starter/Scale/Enterprise) |
| 1.4 | Receita de assinatura — Signal | Mensalidade do módulo Signal, quando existir cobrança de fato |
| 1.5 | Receita de serviço — Meridian (diagnóstico) | Ticket do diagnóstico de entrada, `unidadeDeCobranca = 'PROJETO'` |
| 1.6 | Receita de serviço — Scaffold | Pacotes S/M/L de implementação, uma vez por engajamento |
| 1.7 | Receita de serviço — Charter (setup) | Onboarding e configuração inicial do Charter, quando cobrado à parte |
| 1.8 | Receita de outros serviços | Add-ons de projeto do catálogo (onboarding assistido, BPMN, etc.) que não pertencem a um produto específico |

Scaffold não tem linha de assinatura (1.x) porque não é produto recorrente —
ver `scaffold-prd.md` §6. Toda receita de Scaffold cai em 1.6.

## 2 — Deduções da receita

| Conta | Nome | Definição |
|---|---|---|
| 2.1 | Impostos sobre serviço/receita | Tributos que incidem sobre a nota fiscal emitida |
| 2.2 | Cancelamentos e estornos | Receita reconhecida e depois revertida por cancelamento de contrato |

## 3 — Custo de entrega (CMV de serviço)

Custo direto de entregar o que foi vendido — cresce com o volume entregue,
diferente de despesa fixa de estrutura.

| Conta | Nome | Definição |
|---|---|---|
| 3.1 | Pessoal de entrega — Meridian | Horas de quem faz diagnóstico e acompanhamento contínuo |
| 3.2 | Pessoal de entrega — Scaffold | Horas de quem executa os pacotes de implementação |
| 3.3 | Pessoal de entrega — Charter/outros | Horas de setup e suporte de entrega dos demais produtos |
| 3.4 | Terceiros e subcontratados de entrega | Especialista externo alocado em engajamento |
| 3.5 | Ferramentas de entrega | Software usado só na execução do serviço (ex.: ferramenta de assessment) |

## 4 — Despesas comerciais (centro de custo: comercial)

As contas que o [CAC](../comercial/cac-modelo.md) §2 lê diretamente.

| Conta | Nome | Definição |
|---|---|---|
| 4.1 | Pessoal de vendas | Salário e encargos de quem vende |
| 4.2 | Pessoal de marketing | Salário e encargos de quem faz marketing |
| 4.3 | Comissões | Comissão variável paga sobre proposta `ACEITA` |
| 4.4 | Ferramentas de vendas e marketing | CRM, automação, gravação de call, enriquecimento de lead |
| 4.5 | Mídia paga | Anúncio, evento, patrocínio, conteúdo pago |
| 4.6 | Discovery não faturado | Horas de discovery (convertido e não convertido) valoradas a custo-hora |

## 5 — Despesas de produto/engenharia (centro de custo: produto/engenharia)

| Conta | Nome | Definição |
|---|---|---|
| 5.1 | Pessoal de engenharia e produto | Salário e encargos de quem constrói e mantém a plataforma |
| 5.2 | Infraestrutura | Hospedagem, banco de dados, serviços gerenciados |
| 5.3 | Ferramentas de engenharia | Licenças de desenvolvimento, observabilidade, CI |

## 6 — Despesas gerais e administrativas (centro de custo: G&A)

| Conta | Nome | Definição |
|---|---|---|
| 6.1 | Pessoal de liderança e administrativo | Salário e encargos de quem não está em comercial, entrega ou engenharia |
| 6.2 | Jurídico e contábil | Honorários de escritório jurídico e contábil |
| 6.3 | Escritório e outras despesas | Aluguel, assinaturas administrativas, despesas não classificadas acima |

---

## Centros de custo — resumo

| Centro de custo | Contas |
|---|---|
| Produto/engenharia | 5.1–5.3 |
| Comercial | 4.1–4.6 |
| Entrega | 3.1–3.5 |
| G&A | 6.1–6.3 |

O DRE agrupa despesa por centro de custo (linhas 5–6 acima) e por frente de
receita quando calcula margem bruta (linhas 1 e 3 casadas por produto).
