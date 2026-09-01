# ICP e precificação

**Onda 0 do lançamento comercial.** O checklist trata "ICP, precificação e CRM
básico" como uma pendência só. São três coisas em estágios muito diferentes: o
catálogo de preço está semeado e o motor de cálculo está testado; o ICP não
existe em lugar nenhum; e há um descasamento estrutural entre como o Meridian é
vendido no catálogo e o papel que ele tem na estratégia de entrada.

---

## 1. O que já está decidido

O catálogo vive em tabela, não em código — mudar preço não exige deploy
(`packages/database/scripts/2026-08-comercial.sql`, semeado em `tenantId =
'system'`).

**Planos** — preço por assento/mês, com mínimo faturável:

| Plano | Assento | Mín. assentos | Teto usuários | Piso mensal | Roles custom |
|---|---|---|---|---|---|
| Starter | R$ 89 | 10 | 25 | R$ 890 | não |
| Scale | R$ 149 | 25 | 100 | R$ 3.725 | não |
| Enterprise | R$ 219 | 50 | ilimitado | R$ 10.950 | sim |

**Módulos** — adicional mensal sobre o plano:

| Módulo | Mensal |
|---|---|
| Cosmos | incluído no assento |
| Charter | R$ 1.800 |
| Signal | R$ 1.200 |
| Meridian | R$ 1.200 |
| Scaffold | fora do catálogo — o produto não existe |

**Termos**: Mensal 0%, Anual 12%, Bienal 20%.
**Add-ons**: SSO dedicado R$ 900/mês (só Enterprise), BPMN R$ 700/mês, SLA
99,9% R$ 1.500/mês, Onboarding assistido R$ 6.500 one-time.

**Alçada de desconto**: `LIMITE_DESCONTO_SEM_APROVACAO = 15`. Acima disso
`validarProposta` bloqueia o envio e manda para a fila de RevOps em
`/aprovacoes`. Quatro dos cinco avisos comerciais só informam; só o desconto
trava, porque alçada que a UI pudesse ignorar não seria alçada.

Ordem do cálculo, normativa: desconto de prazo primeiro, comercial depois sobre
o já descontado. Serviços de projeto e setup ficam **fora** do desconto.

Nada disso é pendência. O que falta é o que vem abaixo.

---

## 2. O buraco: o produto de entrada não é vendável sozinho

A estratégia diz que o Meridian abre a conta — ciclo curto, ticket fixo, baixa
fricção — e que Charter e Cosmos são o LTV. **O catálogo faz o contrário.**

O Meridian é um módulo de assinatura a R$ 1.200/mês. Módulo é adicional sobre
plano, e `salvarEscopoAction` recusa proposta cujo `planoSlug` não esteja no
catálogo ativo — não é opcional, lança `StaffAuthError`. Como todo plano tem
mínimo de assentos, a proposta mais barata que inclui Meridian é:

```
Starter, 10 assentos (mínimo)   R$   890/mês
Meridian                        R$ 1.200/mês
                                ───────────
                                R$ 2.090/mês  ·  ACV R$ 25.080
```

Para comprar o diagnóstico, o cliente assina a plataforma. Isso inverte o funil:
o produto-isca passou a exigir a decisão que ele existia para adiar. Um CIO que
aceitaria um diagnóstico de quatro semanas precisa aprovar contrato recorrente
anual — outro comitê, outro prazo, outra verba.

Vale dizer o que **não** é o problema. Não é bug, e o preço de R$ 1.200/mês faz
sentido para o Meridian **recorrente**: reavaliação contínua de maturidade é
assinatura legítima, e é o que a nota de maturidade vira depois que o cliente
fica. O que falta é o SKU da primeira venda.

### Recomendação: dois SKUs para o Meridian

**SKU 1 — Diagnóstico (entrada).** Um `Service` com `unidadeDeCobranca =
'PROJETO'`. Cai em `umaVezCentavos`, fora da mensalidade e fora do desconto de
prazo, que é exatamente o tratamento de um ticket fixo. `moduloVinculado =
'MERIDIAN'` para registrar o que ele deixa configurado.

**SKU 2 — Meridian contínuo (expansão).** O `PrecoDeModulo` que já existe,
R$ 1.200/mês. Vendido na renovação, quando o diagnóstico vira acompanhamento.

Falta o veículo para cotar o SKU 1 sozinho. **Um registro de catálogo resolve,
sem uma linha de código**: um `PlanoComercial` com `precoAssentoCentavos = 0` e
`minimoAssentos = 0`.

```sql
INSERT INTO "PlanoComercial"
  ("id", "tenantId", "slug", "nome", "ordem",
   "precoAssentoCentavos", "minimoAssentos", "limiteUsuarios", "permiteRolesCustom")
VALUES
  (gen_random_uuid()::text, 'system', 'diagnostico', 'Sem plataforma — diagnóstico', 0,
   0, 0, 0, false)
ON CONFLICT ("tenantId", "slug") DO NOTHING;
```

Por que funciona sem tocar na fórmula: `assentosFaturados = Math.max(0, 0) = 0`,
`assentosCentavos = 0`, e `minimoAplicado` fica falso porque `0 < 0` é falso.
`limiteUsuarios = 0` é deliberado — se alguém adicionar assento a uma proposta
de diagnóstico, `ASSENTOS_ACIMA_DO_PLANO` avisa para subir de plano, que é
precisamente o momento de converter.

Antes de rodar isso em produção, confirmar que a tela de escopo aceita o plano
de piso zero sem tratar `0` como "não preenchido". É o único risco real da
mudança, e é de UI, não de cálculo.

---

## 3. O ticket do diagnóstico — decisão que é sua

Não invento este número. O que dá para fixar é a moldura, e o que falta para
fechá-la.

**Âncoras disponíveis.** Boutiques internacionais cobram USD 15–75 mil por
diagnósticos de 2 a 8 semanas; Big Four cobram USD 100–500 mil. O Charter
recorrente, já precificado, dá ACV de R$ 21.600 por ano. O onboarding assistido
de quatro semanas já está no catálogo a R$ 6.500 — é o serviço de duração
comparável mais próximo que vocês já venderam.

**As três amarras que o número precisa respeitar:**

1. **Abaixo da alçada de comitê do comprador.** É a razão de ser do ticket
   fixo. Se o diagnóstico exigir aprovação de conselho, ele perdeu a vantagem
   sobre vender Cosmos direto. Descobrir, nas primeiras conversas, qual é o teto
   de assinatura de um CIO nas contas-alvo — esse número define o teto do SKU 1
   melhor que qualquer benchmark.
2. **Acima do custo carregado de entrega.** Diagnóstico é trabalho de gente. Sem
   o CAC carregado — que é a pendência financeira da Onda 1 — não dá para saber
   se o ticket paga a entrega. **As duas pendências estão acopladas**: precificar
   antes de conhecer o custo é chutar.
3. **Baixo o suficiente para o Scaffold não competir com ele.** Se o diagnóstico
   custar perto da implementação, o cliente escolhe um dos dois em vez de
   comprar os dois em sequência.

**O que fecha a decisão**, em ordem de valor: o teto de alçada de duas ou três
contas-alvo; o custo carregado de uma entrega de quatro semanas; e uma proposta
perdida por preço, que ensina mais que as três primeiras ganhas.

Enquanto o número não fecha, o SKU pode entrar no catálogo com preço de
referência e ser ajustado por proposta — o catálogo governa o que ainda vai ser
vendido, e a proposta congela valor no envio. Não há risco de reescrever o
passado.

---

## 4. ICP por produto

Especificidade é o ponto. ICP que descreve "empresas de médio porte que querem
inovar" não qualifica nada e não desqualifica ninguém.

### Meridian — diagnóstico

| | |
|---|---|
| **Porte** | 200–2.000 funcionários, 50–400 em tecnologia |
| **Setor** | Empresa com engenharia própria: software house, serviços financeiros, saúde, varejo com TI interna. BR e LATAM. |
| **Quem assina** | CIO ou CTO. Acima de certo valor, CFO co-assina. Onde existe área de riscos, o Head de Compliance entra na conversa desde o começo. |
| **Verba** | Consultoria e assessment, não licença de software. Importa: sai de verba de projeto, com aprovação mais rápida que a de software recorrente. |
| **Dor** | "Usamos IA em vários times e ninguém sabe exatamente onde nem com que dado." |
| **Gatilho** | Auditoria marcada, exigência que desceu de um cliente grande, ou conselho pedindo um plano de IA com data. |
| **Sinal de qualificação** | Mais de uma iniciativa de IA em produção **e** nenhuma política escrita. Os dois juntos — só o primeiro é maturidade, só o segundo é ausência de uso. |
| **Anti-ICP** | Menos de 50 pessoas (não tem o problema ainda); sem engenharia própria (o diagnóstico não tem o que medir); quem já contratou Big Four para o mesmo escopo (a disputa vira preço, e não é onde se ganha). |

### Charter — governança contínua

| | |
|---|---|
| **Porte** | Igual ao Meridian, ou acima |
| **Setor** | Regulados — financeiro, saúde, seguros — **e** fornecedores de software que vendem para regulados, porque a exigência desce na cadeia. É o segmento mais mal atendido: tem a obrigação sem ter o time de compliance para absorvê-la. |
| **Quem assina** | Head de Compliance ou de Riscos. CIO co-assina. |
| **Verba** | Compliance, recorrente. Diferente da verba do Meridian — o que significa que a expansão não disputa o mesmo orçamento da entrada. |
| **Gatilho** | EU AI Act para quem exporta; exigência contratual de cliente; auditoria SOC 2 ou ISO em curso. |
| **Sinal de qualificação** | Já respondeu questionário de IA de algum cliente. Quem passou por isso uma vez sabe o custo de improvisar a resposta. |
| **Anti-ICP** | Sem obrigação regulatória e sem cliente que exija. Vai achar caro, e com razão. |

### Cosmos — execução de portfólio

| | |
|---|---|
| **Porte** | Três ARTs ou mais, ou 100+ pessoas em engenharia. Abaixo disso o Jira resolve, e dizer o contrário queima a conta. |
| **Setor** | Qualquer um que já tenha adotado SAFe ou esteja adotando |
| **Quem assina** | VP de Engenharia ou CTO. Em empresa grande, o PMO influencia mais que assina. |
| **Usuário real** | RTE e LPM. São eles que abandonam ou defendem a ferramenta, e o discurso de venda tem de falar com eles, não com quem assina. |
| **Gatilho** | Adoção de SAFe em curso; ou Jira Align avaliado e recusado por preço ou por adoção. |
| **Anti-ICP** | Sem framework definido; time único; Scrum puro sem camada de portfólio. |

### Scaffold — implementação

Não tem ICP próprio, e isso é a definição, não uma lacuna. **O ICP do Scaffold é
o cliente do Meridian cujo roadmap foi aprovado.** Vender Scaffold para quem não
fez diagnóstico é vender consultoria genérica, que é a categoria mais
concorrida e a de pior margem. Se aparecer demanda avulsa, é sinal de que o
Meridian não está gerando pipeline suficiente — trate como sintoma, não como
oportunidade.

---

## 5. Pendências que ficam

- **Confirmar que a tela de escopo aceita plano de piso zero** antes de semear
  o `diagnostico` em produção. Único risco da mudança.
- **Fechar o ticket do SKU 1**, que depende do CAC carregado (Onda 1) e do teto
  de alçada das contas-alvo.
- **Cadastrar o `Service` do diagnóstico** com entregáveis, duração e papéis —
  os campos existem e viram anexo de proposta.
- **Preço do Scaffold** fica fora enquanto o produto não existir. Preço de algo
  que ninguém entrega é promessa, não catálogo.
