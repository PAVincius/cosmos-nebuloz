# Scaffold — PRD do serviço

**Onda 1 do lançamento comercial.** O checklist pede "MVP definido e documentado
(PRD/SRD/ADR) para Meridian e Scaffold". O Meridian está entregue —
`specs/001-meridian-diagnose/` completo, 27 modelos, migração aplicada, rotas no
ar. O Scaffold é a metade que falta, e é menor do que o checklist supõe.

**Scaffold é serviço de implementação, não SaaS.** Documentá-lo com o peso de um
PRD de plataforma seria inventar produto onde há entrega. O que segue é escopo,
entregáveis, SLA, papéis e preço por fase — e a única peça de engenharia que
falta, que é uma ligação, não um produto.

---

## 1. A tese: não falta produto, falta destino

`MeridianPromotionTarget` já tem quatro valores: `COSMOS`, `CHARTER`, `SIGNAL` e
**`SCAFFOLD`**. `MeridianGapPromotion.targetEntityId` carrega o comentário que
explica o estado atual:

> Nulo enquanto o produto de destino não existe no repositório.

O Meridian já sabe promover uma lacuna para o Scaffold. Ela simplesmente não
aterrissa em lugar nenhum. Do outro lado, a maquinaria de entrega existe inteira
em `platform-ops`:

| Entidade | O que já resolve |
|---|---|
| `Service` | Catálogo: trilha, unidade de cobrança, duração, entregáveis, papéis, pré-requisitos, `moduloVinculado`, `exigeLab` |
| `Engagement` | Execução: escopo, status (`PROPOSTO → ATIVO → PAUSADO → CONCLUIDO`), datas, valor, cliente |
| `StaffAllocation` | Quem entrega |
| `IpAsset` | O que da biblioteca de IP foi reusado |
| `ProposalItem` | Como o serviço vira linha de proposta |

**Scaffold V1 é a ligação entre os dois lados**, mais o catálogo de serviços que
lhe dá conteúdo. Não é um quarto produto no monorepo, e tratá-lo como tal seria
o erro mais caro possível — serviços não escalam como software, e construir
plataforma para entregá-los inverte a margem.

---

## 2. O que o Meridian entrega como insumo

Cada lacuna já chega dimensionada. Isso é o que permite o Scaffold ser vendido
sem uma segunda rodada de descoberta:

| Campo de `MeridianGap` | Serve para |
|---|---|
| `statement` | Escopo da entrega, em prosa que o cliente já leu e aprovou |
| `severity` (HIGH/MEDIUM/LOW) | Prioridade dentro do pacote |
| `effort` (S/M/L) | **Dimensionamento — é o que vira faixa de preço** |
| `costOfDelay` (0–100) | Ordem de execução quando o cliente quer escolher |
| `ownerLabel` | Contraparte do lado do cliente, já nomeada |
| `dependencies` | Pré-requisitos entre entregas |

E `MeridianPlanItem` acrescenta `quarter`, `seq` e `capacityNote` — o
sequenciamento e a premissa de capacidade que o sustenta.

**Consequência comercial:** a proposta de Scaffold não precisa ser escrita do
zero. Ela é a projeção de um conjunto de lacunas promovidas, com escopo, ordem e
tamanho já decididos no diagnóstico que o cliente pagou.

---

## 3. Escopo V1

### Dentro

1. **Catálogo de serviços Scaffold** — registros de `Service` com `trilha`,
   `unidadeDeCobranca = 'PROJETO'`, `duracao`, `entregaveis`, `papeis`,
   `preRequisitos` e `moduloVinculado` preenchidos. Um serviço por tipo de
   entrega recorrente, dimensionado pelas faixas de `effort`.
2. **Promoção que aterrissa** — promover uma lacuna com
   `targetProduct = 'SCAFFOLD'` cria ou vincula um `Engagement`, e grava o id em
   `targetEntityId`. É a única peça de engenharia do V1.
3. **Proposta derivada do plano** — selecionar lacunas promovidas e gerar
   `ProposalItem` a partir dos `Service` correspondentes, com o preço de
   referência do catálogo.
4. **SLA e RACI por serviço**, registrados nos campos que já existem.

### Fora do V1, explicitamente

- **Tela própria de gestão de entrega.** `Engagement` já tem status e alocação;
  gerir sprint de consultoria em produto é reconstruir o Cosmos por dentro do
  backoffice.
- **Time tracking e faturamento por hora.** `unidadeDeCobranca` prevê `HORA`,
  mas vender hora é o modelo que não escala — V1 vende pacote fechado.
- **Portal do cliente.** O cliente acompanha pelo Cosmos, se for cliente do
  Cosmos; se não for, acompanha por relatório.
- **Preço.** Ver §6 — depende do CAC carregado, igual ao ticket do Meridian.

---

## 4. Os pacotes

Derivados das faixas de `effort`, porque é o dimensionamento que o diagnóstico
já produziu. Duração e papéis são premissas a validar na primeira entrega — não
há histórico ainda, e fingir que há é o erro que estoura margem.

| Pacote | `effort` | Duração premissa | Papéis | Entregável |
|---|---|---|---|---|
| Correção pontual | S | 1–2 semanas | 1 especialista | A lacuna fechada, com evidência que o Meridian reavalia |
| Implantação | M | 4–6 semanas | 1 especialista + 1 líder técnico parcial | Capacidade em operação, com transferência de conhecimento |
| Programa | L | 8–12 semanas | Time pequeno + líder técnico | Conjunto de lacunas correlatas, entregue por fase |

**A reavaliação é o entregável que fecha o ciclo.** Uma entrega Scaffold termina
quando a lacuna correspondente sai de `PLANNED`/`PROMOTED` para `RESOLVED` no
Meridian — e a nota de maturidade sobe. Isso dá ao cliente uma medida
independente do fornecedor, e dá à Nebuloz o gancho natural da renovação.

---

## 5. SLA e papéis

| Item | Compromisso |
|---|---|
| Início após assinatura | 10 dias úteis |
| Relatório de progresso | Semanal, no formato do relatório do Meridian |
| Reavaliação da lacuna | Até 10 dias úteis após o fim da entrega |
| Prazo do pacote | Conforme a faixa, com replanejamento formal se a premissa de capacidade do `capacityNote` não se confirmar |

**RACI**, a registrar antes da primeira venda — a pendência de RH da Onda 2 toca
aqui:

- **Responsável pela entrega**: quem executa. Hoje não existe função dedicada.
- **Dono do SLA**: quem responde quando o prazo escorrega. **Não pode ser a
  mesma pessoa que entrega** — é a separação que a Onda 2 chama de "função
  comercial dedicada", vista do lado da operação.
- **Contraparte do cliente**: o `ownerLabel` da lacuna, já nomeado no
  diagnóstico.

---

## 6. Preço — a mesma trava do Meridian

Não fixo os números, e pela mesma razão registrada em
[`comercial/icp-e-precificacao.md`](../comercial/icp-e-precificacao.md): o preço
de serviço depende do custo carregado de entrega, que é a pendência financeira
desta mesma onda. **Precificar antes de conhecer o custo é chute, e em serviço o
chute vira margem negativa em vez de venda perdida.**

O que dá para fixar agora:

- **Unidade é `PROJETO`**, não `HORA` nem `RETAINER`. Cai em `umaVezCentavos`,
  fora da mensalidade e fora do desconto de prazo — o mesmo tratamento do
  diagnóstico.
- **A ancoragem é a razão pacote/diagnóstico.** Se o pacote S custar próximo do
  diagnóstico, o cliente compra um ou outro. A razão saudável mantém o
  diagnóstico como entrada barata e o pacote como a decisão seguinte.
- **`SCAFFOLD` fica fora de `PrecoDeModulo`.** Preço de módulo é assinatura, e
  Scaffold não recorre. O `PrecoDeModulo` com `SCAFFOLD` a zero, que o
  `2026-08-comercial.sql` já pula, deve continuar fora — pelo motivo que aquele
  script escreveu: preço de algo que ninguém entrega é promessa, não catálogo.

---

## 7. A única engenharia do V1

Promoção com destino. Hoje `MeridianGapPromotion` grava `targetEntityId` nulo
para `SCAFFOLD`; o V1 faz esse campo apontar para um `Engagement`.

O que a ligação precisa resolver, e que não é óbvio:

- **Uma lacuna ou várias por engajamento?** Várias — o pacote L é "conjunto de
  lacunas correlatas". Então a promoção precisa aceitar vincular a um
  `Engagement` existente, não só criar um novo.
- **`revokedAt` já existe** em `MeridianGapPromotion`. Revogar promoção com
  engajamento ativo deve falhar, pelo mesmo princípio que faz `Engagement`
  usar `Restrict` no cliente: decisão destrutiva com trabalho em curso obriga
  escolha explícita.
- **Tenant cruzado.** A lacuna vive no tenant do cliente avaliado; o
  `Engagement` vive no tenant de sistema, com `clienteTenantId` apontando de
  volta. É travessia cross-tenant, e ADR-0013 já definiu que ela passa por
  `platformDb` — não por `withTenantDb`.

Esse último ponto é o que faz a tarefa merecer ADR próprio.

---

## 8. Critérios de saída do V1

- Uma lacuna promovida para Scaffold aparece como `Engagement` com
  `targetEntityId` preenchido.
- Um conjunto de lacunas promovidas gera proposta com itens e preço vindos do
  catálogo, sem redigitação.
- Concluir o engajamento leva a lacuna a `RESOLVED` e a reavaliação move a nota
  de maturidade.
- Revogar promoção com engajamento ativo falha com mensagem que diz o porquê.

## 9. Pendências que este documento não fecha

- **Preço**, travado no CAC carregado (§6).
- **RACI**, travado na função comercial da Onda 2 (§5).
- **Duração e papéis dos três pacotes** são premissa sem histórico. A primeira
  entrega vale mais que qualquer estimativa — instrumentar para medir desde ela.
- **ADR da travessia cross-tenant** da promoção (§7).
