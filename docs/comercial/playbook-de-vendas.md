# Playbook de vendas

**Onda 2 do lançamento comercial.** O checklist pede "função comercial dedicada"
como contratação. Antes de contratar vem escrever o que a pessoa vai executar —
sem isso, a contratação demora o dobro para produzir e o fundador vira o
gargalo de novo, agora com custo fixo.

Este playbook é para venda liderada pelo fundador **e** para a primeira pessoa
comercial. Onde os dois divergem, está marcado.

Complementa [`icp-e-precificacao.md`](icp-e-precificacao.md), que define para
quem vender e por quanto. Aqui é como.

---

## 1. O roteiro de discovery já está escrito

A tentação é inventar um roteiro. Não invente: **as cinco perguntas do
diagnóstico já existem, e já estão publicadas.** São as mesmas em três lugares —
a seção `shape` da home, os cinco eixos do Meridian, e o que o produto de fato
avalia.

| Eixo | Pergunta | O que a resposta revela |
|---|---|---|
| Dados | Se um modelo precisasse do histórico dos seus clientes amanhã, ele conseguiria chegar nele? | Se há fonte com dono, ou planilha e caixa de entrada |
| Processo | Você saberia dizer qual processo automatizaria primeiro? | Se existe ordem, ou só candidatos |
| Pessoas | Quem usou uma ferramenta de IA para trabalho de verdade na semana passada? | Uso real versus uso declarado |
| Governança | Um funcionário pergunta "posso colar isto no ChatGPT?" — o que acontece? | Se a política existe ou se o padrão é o chute |
| Infraestrutura | Onde os seus dados têm permissão de morar? | Se residência é decisão ou acidente |

**Usar exatamente essas perguntas tem três efeitos.** O prospect que já visitou
o site reconhece a conversa e ela ganha coerência; a call vira uma amostra do
produto em vez de um interrogatório; e a resposta já é insumo do diagnóstico,
então nada do que foi dito na venda se perde na entrega.

### O que ouvir

A resposta que mais qualifica não é a pior nem a melhor — é a **discordância
interna**. Duas pessoas na mesma call dando respostas diferentes para "qual
processo primeiro" é o sinal mais forte de compra que existe, e é literalmente o
gatilho que o ICP registra: *compre sozinho quando a liderança discorda sobre
por onde começar*.

### Sinal de desqualificação

Encerre cedo, com elegância, quando: menos de 50 pessoas; sem engenharia
própria; ou já contratou Big Four para o mesmo escopo. Os três estão no
anti-ICP, e insistir neles gasta o recurso mais escasso da empresa, que é a
agenda de quem vende.

---

## 2. Tratamento de objeções

Cada uma com a resposta curta e o que **não** dizer.

**"Já usamos ChatGPT, estamos adiantados."**
É o sinal de compra mais comum disfarçado de objeção. Uso disperso sem política
escrita é exatamente o perfil do ICP. Resposta: "Ótimo — quantos times, e qual
é a regra escrita hoje sobre que dado pode entrar?" A pergunta responde sozinha.
Não diga que o uso deles não conta.

**"Está caro para um diagnóstico."**
A comparação certa não é com software, é com a fase de descoberta de um projeto
tradicional — que custa mais, demora mais e termina num PowerPoint. Resposta:
"Você fica com a nota, a lista de lacunas e o plano, continuando conosco ou
não." Não desconte na call. O teto sem aprovação é 15%, e passar disso é fila de
RevOps, não decisão de quem está na sala.

**"Vamos esperar a regulação assentar."**
Esperar é a decisão que o próprio diagnóstico mostra ser a mais cara. Resposta:
"A ausência de política já é uma política — hoje ela diz 'espera', e é por isso
que nada saiu do papel." É o argumento do Charter, e é o que mais converte em
empresa regulada.

**"Por que não Jira Align?"**
Só aparece na conversa de Cosmos, e a resposta é honesta: se já rodam SAFe com
Jira Align adotado e funcionando, o Cosmos não é a venda. O Cosmos ganha onde o
Jira Align foi avaliado e recusado por preço ou por adoção. Não ataque o
concorrente; pergunte o que fizeram com ele.

**"Vocês são pequenos demais."**
Não negue. Resposta: "Somos, e é por isso que o diagnóstico é de duas semanas e
não de dois meses." O tamanho é a razão do ciclo curto, que é a vantagem.
Ancore em entregável, não em tamanho de time.

**"Quero começar pelo Cosmos."**
Aconteceu na demanda e é armadilha. Vender a plataforma antes do diagnóstico
inverte o funil e produz o cliente que abandona no terceiro mês. Resposta: "Dá,
mas o Cosmos recompensa quem chega estruturado — deixa eu te mostrar o que o
diagnóstico responde antes." Se insistir, venda; registre como exceção.

---

## 3. Prova social — o que existe e o que não

Ser honesto aqui vale mais que qualquer slide.

**Existe:** MVP validado com três RTEs, e TOTVS mais dois leads no funil.
**Não existe:** caso de cliente publicado, número de ROI medido, logo no site.

Até o primeiro caso fechar, a prova social da Nebuloz é **o dogfooding**, e ele
é bom:

- A política de IA da própria Nebuloz gerada pelo próprio Charter, com
  fornecedores classificados e casos de uso decididos — inclusive um bloqueado.
  Anexo de proposta, não slide. Ver [`../runbooks/charter-nebuloz.md`](../runbooks/charter-nebuloz.md).
- O SAFe que o Cosmos vende, aplicado na operação interna, com as métricas de
  fluxo da própria squad.

**Um caso bloqueado no export do Charter vale mais que nove aprovados.** Mostra
que o instrumento tem dente. Não esconda.

---

## 4. RACI por produto

Pendência que o [PRD do Scaffold](../produto/scaffold-prd.md) §5 deixou aberta.
Preencher os nomes é decisão de quem dirige a empresa; a estrutura é esta:

| Papel | Meridian | Scaffold | Charter | Cosmos | Signal |
|---|---|---|---|---|---|
| Dono do roadmap | | | | | |
| Responsável pela entrega | | | | | |
| **Dono do SLA** | Ordem — repasse de pedido de titular em 5 dias úteis, envio por [delegação do CEO](../compliance/2026-09-29-delegacao-ceo-ordem-pedido-do-titular.md) (decisão do CEO, 2026-09-29); demais itens do SLA em branco | | | | |
| Auditor / revisor | | | | | |

Três regras que a estrutura precisa respeitar:

1. **Dono do SLA ≠ quem entrega.** É a separação que faz o SLA significar
   alguma coisa. Enquanto a mesma pessoa fizer as duas, não há SLA, há intenção.
2. **Quem audita o Charter não pode ser quem o vende.** É o mesmo argumento que
   o produto faz ao cliente — "sozinho, a mesma pessoa submete e decide, o
   primeiro auditor que perguntar reprova". Vale para dentro.
3. **O Signal não tem linha porque não tem decisão.** Ver
   [`INDEX-MESTRE`](../superpowers/plans/INDEX-MESTRE.md) §2: produto vendável
   ou capacidade do Cosmos. Sem isso, não há dono a nomear.

---

## 5. Contratar ou fazer parceria

O checklist diz "contratação ou parceria" sem escolher. Com o caixa no estágio
atual e o CAC ainda desconhecido, **parceria de canal custa menos e ensina
mais** — o parceiro traz a objeção real do mercado antes de a empresa gastar
salário para descobri-la.

O gatilho para virar contratação é numérico: quando o CAC carregado estiver
medido **e** o ciclo do Meridian se repetir três vezes com o mesmo roteiro. Até
lá, contratar é comprar uma hipótese.

---

## 6. Antes da primeira call

Quatro itens, e nenhum é opcional:

- [ ] **DPA dos fornecedores confirmado.** A primeira pergunta de um jurídico
      corporativo. Hoje o repositório tem dois documentos que discordam.
- [ ] **Charter da Nebuloz provisionado**, com export pronto para anexar.
- [ ] **Ticket do diagnóstico fechado.** Negociar preço na call é o pior lugar
      para decidi-lo.
- [ ] **Consentimento de gravação resolvido**, se a call for gravada por
      Fireflies — é o UC-07, único Crítico do inventário.

O quarto é o mais fácil de esquecer e o mais constrangedor de errar: gravar uma
reunião sem consentimento, na venda de uma empresa de governança de IA.
