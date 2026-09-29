# Lançamento — oferta e conteúdo (rascunho)

**Status:** rascunho de trabalho. Nada aqui vai para fora sem revisão e envio do CEO.
Número sem fonte = hipótese, marcado como tal. Fontes citadas por arquivo:linha.
Revisado pela Ponte em 2026-09-27 contra `icp-e-precificacao.md`,
`pacotes-e-precificacao.md`, `cac-modelo.md` e `playbook-de-vendas.md`:
preço do Diagnóstico, prova social, promessa e números de linha corrigidos.

---

## 0. Decisões e descasamentos que o CEO precisa resolver antes de publicar

1. **Orçamento de mídia definido: ~R$ 200/dia em LinkedIn Ads.** Prazo total do
   flight (quantos dias/semanas de crédito) ainda sem resposta — falta para
   fechar calendário e ritmo de troca de variação.
2. **Meta de eficiência definida: LTV/CAC > 3.** O cálculo já está feito em
   `pacotes-e-precificacao.md` §6, com margem e pior caso de desconto (CAC
   hipótese de R$ 15.188, `pacotes-e-precificacao.md:313`; o exemplo de
   `cac-modelo.md:112` usa R$ 20.250, também hipótese). O Diagnóstico
   sozinho dá 1,9× (`pacotes-e-precificacao.md:252-255`): se paga, mas não
   fecha 3×. Os pacotes ficam entre 5,4× e 8,5×
   (`pacotes-e-precificacao.md:28`). Conclusão igual à anterior, agora com
   a conta de margem: a oferta **precisa** encadear para o resto da suíte,
   não só vender o diagnóstico isolado.
3. **Produto do lançamento: decidido — lançamento escalonado.** A suíte é
   anunciada inteira, mas liberada produto a produto, na ordem da esteira de
   dogfood (Meridian → Scaffold → Charter → Cosmos → Signal). Só o **Meridian**
   é vendável agora, como "Diagnóstico sob agendamento"; os outros quatro
   produtos vão para **lista de espera** até passarem no gate de maturidade
   (`docs/produto/regra-maturidade-e-carga.md`). Isso substitui a decisão
   anterior repassada pela Ordem ("todos ao mesmo tempo, prospecção em
   paralelo para todos"). Fonte: `docs/produto/prontidao-lancamento.md:69-74`
   (commit `994dd36b`). A oferta de entrada (Meridian, diagnóstico) e o
   mecanismo de garantia da seção 1 seguem valendo. O que muda: prospecção
   paga (LinkedIn Ads, CTA de diagnóstico) mira só o Meridian; o resto da
   suíte aparece na comunicação com CTA de lista de espera, não de venda —
   ver seção 5-A.
4. **Material do curso de criação de oferta** — ainda não incorporado. Estrutura
   promessa/prova/mecanismo/garantia abaixo é o modelo padrão de oferta B2B;
   ajustar quando o material chegar.
5. **ICP ativo agora: só o do Meridian.** Com lançamento escalonado, a
   prospecção paga (segmentação de anúncio, CTA de diagnóstico) mira só o
   comprador do Meridian — CIO/CTO (`icp-e-precificacao.md:164-173`). O
   descasamento notado antes (pedido citava "RTE com 3+ ARTs", que é o ICP do
   **Cosmos** — `icp-e-precificacao.md:187-196` — não o do Meridian) fica
   resolvido: não há prospecção ativa de Cosmos agora. Os ICPs dos demais
   produtos (Cosmos → VP Engenharia/CTO, usuário RTE/LPM; Charter → Head de
   Compliance) ficam registrados para quando cada um passar no gate de
   maturidade e entrar na esteira de vendas — não segmentam anúncio nem CTA
   hoje. A seção 5 (**Formato do lançamento**) trata como a suíte inteira
   aparece na comunicação sem prometer venda do que está em lista de espera.
6. **Preço do diagnóstico está fechado: R$ 48.000 por projeto, 4 semanas,
   consultor sênior + arquiteto de dados** (SV-01,
   `packages/database/scripts/2026-09-catalogo-nebuloz.sql:21-23`;
   `pacotes-e-precificacao.md:247-250`). A versão anterior deste rascunho
   dizia "não fechado", com base em `icp-e-precificacao.md` §3, que está
   desatualizado nesse ponto. O CAC segue hipótese. Nenhuma peça abaixo cita
   valor em reais por escolha de venda consultiva, não por falta de preço: o
   CTA é uma call curta e gratuita que qualifica antes de cotar o SV-01.
   Abatimento em pacote posterior: até 25% (R$ 12.000), só sobre serviço de
   implantação (`pacotes-e-precificacao.md:271-273`, D-06, proposta).

---

## 1. Oferta

**Promessa.** "Em 4 semanas, saia com a nota de maturidade de IA da sua
empresa por dimensão, os casos de uso priorizados e um roadmap de 12 meses —
não mais um relatório de auditoria, um plano executável." Os entregáveis são
os do SV-01: score em 6 dimensões, casos de uso priorizados por WSJF, lacunas
de dado, roadmap de 12 meses
(`packages/database/scripts/2026-09-catalogo-nebuloz.sql:23`). A versão
anterior prometia "os riscos que ninguém documentou", que não está entre os
entregáveis do SV-01. Inventário de risco é Charter.

**Prova.**
- O MVP validado com três RTEs (`playbook-de-vendas.md:99`) é prova do
  **Cosmos**, não do diagnóstico. Não usar em peça do Meridian. Caso de
  cliente publicado, ROI medido e logo no site não existem
  (`playbook-de-vendas.md:100`). Nenhum nome de empresa (TOTVS é lead, não
  cliente) sem aprovação do CEO.
- Prova disponível para o Meridian: o dogfooding, com a Nebuloz aplicando a
  suíte na própria operação (`playbook-de-vendas.md:102-109`). Os exemplos
  de lá são de Charter e Cosmos; a peça do Meridian precisa de um exemplo
  próprio de dogfooding, ainda não registrado.
- Especificidade do sinal de qualificação já documentado: "mais de uma
  iniciativa de IA em produção **e** nenhuma política escrita" é reconhecível
  para o comprador — vira prova de que o problema foi entendido, não inventado
  (`icp-e-precificacao.md:172`).

**Mecanismo.** Diagnóstico de 4 semanas, ticket de projeto (fora de assinatura),
conduzido por consultor sênior e arquiteto de dados, termina em plano de ação
com prioridades — não em apresentação genérica. Contraste explícito: mais
barato que Big Four (USD 100–500 mil, `icp-e-precificacao.md:126`), mais
objetivo que um assessment interno sem ferramenta. "Mais rápido que Big Four"
é hipótese: o doc só dá prazo das boutiques (2 a 8 semanas).

**Garantia / risco reverso.** Duas opções — **decisão do CEO, nenhuma das
duas está aprovada**:
- (A) "Se ao final das 4 semanas você não tiver um plano de ação que possa
  levar ao comitê, devolvemos o valor do diagnóstico." Exposição: até
  R$ 48.000 por projeto (item 0.6).
- (B) "Primeira sessão de discovery (90 min) sem custo — só avançamos para o
  diagnóstico pago se os dois lados concordarem que faz sentido."
  (B) é mais seguro para o primeiro lançamento — não compromete reembolso
  antes de o custo de entrega estar medido (`cac-modelo.md` — CAC ainda
  hipótese). Recomendo (B) para a primeira onda.

**CTA.** "Agende uma sessão de diagnóstico gratuita de 30 min" — não "compre o
diagnóstico". Sem escassez falsa (sem contador, sem "só 5 vagas"); a única
urgência real e citável é o gatilho do próprio ICP — auditoria marcada,
exigência de cliente grande, conselho pedindo plano de IA com data
(`icp-e-precificacao.md:171`). A garantia (B) fala em discovery de 90 min e o
CTA em sessão de 30 min: são dois passos (qualificação, depois discovery) ou
um só? Decisão do CEO antes de publicar.

---

## 2. Anúncios LinkedIn (3 variações)

Todas miram CIO/CTO de empresas com engenharia própria, 200–2.000
funcionários, BR/LATAM (`icp-e-precificacao.md:160-162`). Ajustar segmentação
de cargo/setor no Campaign Manager quando o orçamento for definido.

**Variação 1 — dor nomeada**
> **Headline:** Sua empresa usa IA em vários times. Alguém sabe onde, com que
> dado, e com que risco?
> **Corpo:** Se a resposta for "mais ou menos", você não está sozinho — é o
> padrão em empresas com engenharia própria que cresceram rápido com IA sem
> política escrita. Em 4 semanas, medimos a maturidade de IA da empresa em
> 6 dimensões, priorizamos os casos de uso e entregamos um roadmap para levar
> ao comitê. Comece com uma sessão de diagnóstico gratuita de 30 min.
> [Agendar sessão de diagnóstico]

**Variação 2 — gatilho de auditoria/compliance**
> **Headline:** Auditoria de IA chegando e ninguém tem o mapa pronto?
> **Corpo:** Auditoria marcada, exigência de cliente grande, ou o conselho
> pedindo um plano com data — o ponto comum é que ninguém documentou onde a IA
> já está em produção. Nosso diagnóstico de 4 semanas entrega a nota de
> maturidade e o roadmap priorizado antes que a auditoria vire crise. Sessão
> de diagnóstico gratuita de 30 min, sem compromisso.
> *(EU AI Act saiu: é gatilho do Charter, `icp-e-precificacao.md:183`; os do
> Meridian estão em `icp-e-precificacao.md:171`.)*
> [Agendar sessão de diagnóstico]

**Variação 3 — contraste de custo/velocidade**
> **Headline:** Diagnóstico de maturidade de IA sem o preço de uma Big Four.
> **Corpo:** Big Four cobra de USD 100 mil a 500 mil por um assessment de IA
> (`icp-e-precificacao.md:126`).
> Fizemos um diagnóstico de 4 semanas, com ferramenta própria, para empresas
> com engenharia interna que precisam de um plano executável — não de um
> relatório de 200 páginas. Primeira conversa é uma sessão de diagnóstico
> gratuita de 30 min.
> [Agendar sessão de diagnóstico]

---

## 3. Posts orgânicos (3)

**Post 1 — LinkedIn, formato "bastidor de fundador"**
> Estou lançando a Nebuloz depois de meses construindo com times de
> engenharia reais. O primeiro produto que estamos abrindo é um diagnóstico:
> medir a maturidade de IA de uma empresa que já tem IA em produção — e
> quase nada documentado — e sair com um roadmap priorizado. Não é discurso de inovação; é o que toda empresa
> com mais de uma frente de IA em produção descobre tarde demais. Se você é
> CIO, CTO ou lidera uma ART e reconhece esse cenário, comenta ou manda
> mensagem — quero conversar com os primeiros diagnósticos.
> *(Hipótese de formato: post pessoal do fundador, sem card de design — maior
> alcance orgânico no LinkedIn hoje. Confirmar com material do curso.)*

**Post 2 — Instagram, prova/processo (carrossel)**
> Slide 1: "O que ninguém documenta sobre IA na engenharia."
> Slide 2: "Times usam Copilot, ChatGPT, agentes internos — cada um por sua
> conta."
> Slide 3: "Ninguém sabe, no nível da empresa, onde isso está e que dado
> passa por ali."
> Slide 4: "Foi isso que fomos construir: um diagnóstico de 4 semanas que
> mede a maturidade de IA e sai com plano de ação."
> Slide 5: CTA — "Sessão de diagnóstico gratuita, link na bio."
> *(Papel: marca/prova, não geração direta de lead qualificado — Instagram
> não segmenta por cargo como o LinkedIn.)*

**Post 3 — Instagram/LinkedIn cruzado, marco de lançamento**
> Hoje a Nebuloz sai do modo silencioso. Construímos para RTEs, CTOs e times
> de engenharia que cresceram demais para coordenar SAFe em planilha e IA em
> caixa-preta. Primeira frente aberta: diagnóstico de maturidade de IA. Se
> você reconhece o problema, o link está nos comentários/bio.
> *(Uso duplo: assina o lançamento sem vender preço, serve tanto para marca
> quanto para atrair RTEs que influenciam a compra do Meridian mesmo não
> sendo quem assina — ver item 0.5.)*

---

## 4. Papel de cada canal

- **LinkedIn Ads** — geração de lead qualificado. Segmentação por cargo
  (CIO/CTO, e Head de Compliance como segunda onda) e setor com engenharia
  própria. CTA sempre para a sessão de diagnóstico, nunca para conteúdo do
  curso ou página institucional solta.
- **Instagram orgânico** — marca e prova social. Não carrega CTA de venda
  direta com a mesma força; a função é ganhar reconhecimento e aquecer quem
  vai ver o anúncio de LinkedIn depois (ou que chegou por indicação). RTE
  como personagem/prova cabe melhor aqui do que no anúncio pago.
- **LinkedIn orgânico (pessoal do fundador)** — ponte entre os dois: alcança
  a mesma audiência do anúncio pago, mas em registro de bastidor/autoridade,
  não de oferta. Fortalece a campanha paga sem competir com ela.

---

## 5. Formato do lançamento — evento × e-book × e-book + preview

Decisão do CEO sobre **formato** ainda aberta — o que mudou é o modelo de
lançamento em si (item 0.3): escalonado, não simultâneo. Comparação para o
comprador que a campanha efetivamente prospecta agora — CIO/CTO (Meridian,
único produto vendável) — mais o risco de como a suíte inteira (Meridian,
Scaffold, Charter, Cosmos, Signal) aparece na mesma peça sem parecer toda à
venda.

**Risco comum aos três formatos: confundir "disponível" com "lista de
espera".** A suíte é anunciada inteira (decisão do CEO), na mesma escada de
antes, na ordem da esteira de dogfood: Meridian (diagnóstico, entrada, ticket
fixo, **vendável**) → Scaffold (implementação do roadmap do diagnóstico,
**lista de espera**) → Charter (governança/risco, onde o Head de Compliance
entra, **lista de espera**) → Cosmos (operação contínua, onde o RTE entra,
**lista de espera**) → Signal (medição, expansão — só faz sentido depois de
um dos anteriores, `icp-e-precificacao.md:216-219`; **lista de espera**). O
antídoto não é esconder o resto da suíte — é fazer **todo formato marcar,
degrau a degrau, qual produto tem CTA de agendar diagnóstico (só Meridian) e
qual tem CTA de lista de espera (os outros quatro)**. Nenhuma peça deveria
sugerir que Scaffold, Charter, Cosmos ou Signal já estão disponíveis para
compra.

| | (a) Evento | (b) E-book | (c) E-book + preview Meridian |
|---|---|---|---|
| **Custo/esforço** | Alto — produção, pauta, follow-up pós-evento; maior tempo de preparo (2–4 semanas) antes do primeiro lead. | Baixo-médio — texto + landing page + automação de e-mail. Menor dependência de terceiros. | Alto — soma o custo do e-book ao de construir uma versão free/preview funcional do diagnóstico, que **hoje não existe**. O catálogo tem o Meridian contínuo (assinatura, R$ 1.200/mês) e o Diagnóstico SV-01 (projeto, R$ 48.000), sem versão gratuita (`pacotes-e-precificacao.md:101`, `:247`). O escopo de um preview ("1 respondente, sem evidência, sem IA") está pendente de aprovação do CEO (`docs/produto/prontidao-lancamento.md:76`). Construí-lo é trabalho de produto/engenharia, fora da minha mesa. |
| **Tempo até lead qualificado** | Médio-longo: inscrição no evento não é qualificação; precisa de um passo de follow-up depois. | Rápido para o download, mas o lead entra frio — qualificação vem da nutrição por e-mail/sessão de diagnóstico depois. | Mais lento para lançar (depende do preview ficar pronto), mas quando lança, quem termina o preview já se autoqualificou vendo valor — melhor sinal de conversão pra sessão paga. |
| **Como carrega os vários produtos sem diluir** | Bom espaço para contar a escada inteira em sequência (é a favor do formato), mas só funciona com um enredo único ("mapa de maturidade de IA" com os produtos como capítulos) — sem isso, vira 5 pitches em 60 minutos e o risco de diluição é o mais alto dos três. | O melhor veículo para a mensagem única: um documento estruturado como "5 frentes de maturidade" onde cada produto responde a uma frente é, por natureza, uma escada só — difícil de virar 5 mensagens soltas porque é o mesmo texto contando uma história. | Ancora bem a entrada (Meridian vira tangível, não promessa), e o e-book que acompanha aponta o resto da escada como próximo passo — mas só funciona se o preview realmente entregar valor sozinho; um preview raso mina a prova em vez de reforçar. |
| **Meta LTV/CAC > 3** | Custo de produção do evento entra no CAC de todos os produtos junto (rateio como em `cac-modelo.md` §4) sem gerar lead tão rápido — pressiona o CAC para cima antes do primeiro cliente. | Menor custo fixo por lead — mais fácil manter o CAC baixo enquanto o volume ainda é pequeno. | Custo de engenharia do preview não está na fórmula de CAC hoje (`cac-modelo.md` §1 só cobre vendas/marketing/entrega) — precisaria decidir se entra como CAC ou como custo de produto antes de calcular o LTV/CAC real deste formato. |

**Recomendação.** (b) e-book como âncora do lançamento agora — menor custo,
mais rápido de colocar no ar dentro do orçamento de R$ 200/dia, e o formato
que mais naturalmente impõe a mensagem única em vez de 5 pitches soltos.
(c) fica como evolução de médio prazo, condicionada a existir um preview real
do Meridian — não é decisão de marketing, é decisão de produto, então não
travar o lançamento nisso. (a) evento entra depois, como reforço de meio de
funil para quem já baixou o e-book, não como abertura — abrir com evento é o
formato de maior custo e maior risco de diluição justamente no momento em
que a mensagem única mais importa.

---

## 5-A. CTA e mensagem — lista de espera (Scaffold, Charter, Cosmos, Signal)

**CTA.** "Entrar na lista de espera do [produto]" — nunca "agendar" ou
"comprar". Distinto, visualmente mais leve, do CTA de diagnóstico do
Meridian ("Agendar sessão de diagnóstico gratuita").

**Mensagem-padrão** (adaptar por produto, mesma lógica em todos): "[Produto]
é o próximo degrau depois do diagnóstico Meridian. Ainda está em validação
com os primeiros times — entra na lista de espera para ser avisado assim que
abrir."

Por produto:
- **Scaffold** — "Depois do diagnóstico, o Scaffold cobre a implementação do
  que o plano do Meridian priorizou. Em validação — lista de espera."
- **Charter** — "Governança e risco de IA, para quando o Compliance precisar
  de rastro formal. Em validação — lista de espera."
- **Cosmos** — "Operação contínua para RTE e VP de Engenharia. Em
  validação — lista de espera."
- **Signal** — "Medição de resultado da IA em produção — faz sentido depois
  de operar com um dos anteriores. Em validação — lista de espera."

**Onde aparece.** No e-book (seção 5) como "próximos degraus da suíte", e na
página de agendamento do diagnóstico Meridian como bloco secundário abaixo do
CTA principal — nunca com o mesmo peso visual do CTA de diagnóstico. Não
aparece em anúncio pago (LinkedIn Ads): anúncio é só para o CTA de
diagnóstico do Meridian, conforme item 4.

**Em aberto para o CEO:** onde captar o e-mail da lista de espera (formulário
próprio vs. mesmo formulário de agendamento com uma pergunta "quer entrar na
lista de espera de outro produto?") e quem faz o follow-up quando o produto
sair do gate de maturidade — não decidido aqui.

---

## 6. Pendências

- Fechar decisão do item 0.3 (lançamento escalonado — confirmado) quanto ao
  **formato** de lançamento (seção 5).
- Validar a copy da lista de espera (seção 5-A) com o CEO antes de publicar.
- Fechar decisão da garantia (item 1 — recomendo opção B).
- Incorporar material do curso de criação de oferta quando disponível —
  pode mudar mecanismo/formato dos anúncios e do e-book.
- Validar com o CEO a leitura do item 0.5 (ICP ativo = só Meridian) antes de
  segmentar os anúncios por cargo.
- Se (c) avançar: abrir pedido ao Maestro para viabilidade de um preview
  funcional do Meridian — está fora da minha mesa.
- Prazo total do flight de mídia (item 0.1) ainda sem resposta do CEO.
- Sessão de 30 min (CTA) × discovery de 90 min (garantia B): um passo ou
  dois? (seção 1).
- `icp-e-precificacao.md` §3 ainda trata o ticket do diagnóstico como aberto;
  alinhar ao SV-01 de R$ 48.000 (`pacotes-e-precificacao.md:247-250`).
