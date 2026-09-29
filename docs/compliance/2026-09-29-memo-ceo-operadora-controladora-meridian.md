# Memo ao CEO — Nebuloz é operadora ou controladora no Meridian?

- **Data:** 2026-09-29
- **De:** Compliance / DPO. **Para:** CEO. **Pedido por:** Morgana.
- **Destrava:** condição 1 de `docs/qualidade/prontidao/meridian.md` (Meridian para cliente externo) e condição 4 do parecer de 2026-09-24 (`2026-09-24-parecer-meridian-respondente.md` §4).
- **Natureza:** memo para decisão. A decisão é sua; a validação jurídica das cláusulas é de quem responde juridicamente pela Nebuloz. Isto não é aconselhamento jurídico.

> **Atualização, 2026-09-29 (mesmo dia):** o CEO decidiu que a Nebuloz é operadora no Meridian, que conteúdo de cliente não serve a demonstração, ajuste de prompt ou avaliação de modelo, e que o canal é `privacy@nebuloz.com` (ver "Decisões", ao fim; fonte: relato da Morgana). **Depois, no mesmo dia, o CEO também decidiu:** operadora só no Meridian (opção C, reunião em decisão separada), benchmark desligado com trava no produto, e Ordem como Dono do SLA. **O que resta ao CEO:** encarregado, C8, e a delegação escrita do envio a Ordem. O texto abaixo é o memo original e está mantido como registro.

## O que você precisa decidir

**Uma escolha: A, B ou C** (abaixo). Recomendo **A**. É a decisão que trava o DPA. Junto dela, duas respostas de sim/não que entram no primeiro contrato: benchmark desligado e (opcional) a cláusula C8. As demais perguntas (§4) são de dado ou de nomeação e destravam o canal do titular.

## 1. Onde estamos (fatos conferidos)

- **As cláusulas C1 a C7 já estão no `dpa-modelo.md`.** O commit `99978cd0` (em `github/main`) as incorporou como v1.1: C1 em §1.1, C2 em §3.1, C3 em §9.1, C4 em §9.2, C5 em §5.1, C6 em §10 e §10.1, C7 em §8.1. Conferi o texto contra `operadora-controladora.md` §3: o conteúdo é o mesmo (5 dias úteis para repasse, 30 dias para eliminação, 30 dias de aviso de subprocessador); só mudou a numeração e C4 deixou de dizer "cláusula anterior". A parte de "incorporar ao modelo" da condição 1 **já está feita**. O que falta é (a) a sua escolha, (b) a revisão jurídica e (c) o modelo virar contrato com o cliente.
- **O DPA ainda não pode ser assinado como está.** Tem lacunas de fato marcadas `[[DADO NECESSÁRIO]]`: razão social, CNPJ e endereço da Nebuloz; a salvaguarda contratual de cada subprocessador (18 confirmações); o canal e a pessoa de contato para incidente; o foro; o endereço do canal público do titular. Nenhuma é decisão de enquadramento; são dados que só a Nebuloz tem.
- **O canal público prometido em §9.1 não está no ar.** O texto pronto está em `operadora-controladora.md` §4. A página `/legal/privacy` existe (`apps/web/app/[locale]/legal/privacy/page.tsx`), mas não achei nela nem no dicionário de tradução o texto "Se seus dados chegaram até nós por uma organização" nem o endereço `privacy@nebuloz.com`. Conferi só o repositório, não o site publicado.
- **O que a Nebuloz coleta de quem não tem conta, no Meridian:** nome, cargo e e-mail do respondente, respostas e evidências anexadas (`MeridianRespondent`, `MeridianResponse`, `MeridianEvidence`, em `meridian.prisma`). O respondente entra por link com token (`apps/app/app/meridian-responder/[token]/page.tsx`); quem decide convidar, para quê e em que eixo é o cliente.
- **Um ponto de honestidade do produto.** A eliminação de titular hoje só alcança respondente que também seja `User` da plataforma, casado por e-mail (`lgpd-ropa-e-lacunas.md` §5, última ressalva). Para o respondente externo puro, não há execução técnica pedida por ele. Isso vale em qualquer das opções; é o assunto da condição 11 (ver `2026-09-29-requisito-canal-eliminacao-respondente-externo.md`).

## 2. As opções

### A. Operadora nos dois fluxos (respondente do Meridian e participante de reunião) — **recomendada**

**O que significa.** O cliente é controlador e decide finalidade, quem convidar, prazo e o que fazer com o resultado. A Nebuloz trata por instrução dele (art. 5º, VI e VII, e art. 39 da LGPD). Pedido de titular sem conta que chegue à Nebuloz é repassado ao cliente em 5 dias úteis, e o titular é avisado de para quem foi (art. 18, § 4º, I). A Nebuloz é controladora só em três situações que já existem: uso próprio (tenant da própria Nebuloz), benchmark do Meridian (`benchmarkOptIn`, default `false`) e produto próprio.

**Consequências.**
- *A favor:* é o que o produto já faz (o cliente convoca, liga a integração, escolhe o modo de consentimento, libera; tudo em `AuditLog`). Casa com D-10 e com o DPA v1.1. A base legal é a do cliente, que conhece a relação com os funcionários que convida. Não obriga a Nebuloz a ter relação direta com milhares de respondentes.
- *Contra, sem rodeio:* **ser operadora não protege.** O art. 42, § 1º, I faz o operador responder solidariamente quando descumpre a lei ou as instruções lícitas do controlador, e nesse caso ele "equipara-se ao controlador". Se o conteúdo de reunião vazar para um provedor de IA sem consentimento, ou se a Nebuloz tratar fora da instrução, ela responde como controladora. O default deny do consentimento de reunião é controle de risco dela, não só do cliente.
- *Contra, operacional:* o titular externo depende de o cliente agir. Sem cláusula adicional, se o cliente ficar em silêncio, a Nebuloz não executa. Há remédio contratual: uma instrução prévia (ver §4, item 6).
- *Risco de enquadramento:* a Nebuloz escolhe os meios técnicos (provedor, modelo, prompt, o que se extrai da fala). Meio técnico não desloca a titularidade das decisões sobre finalidade, dados, titulares e retenção, mas o guia da ANPD sobre agentes de tratamento distingue meios essenciais (do controlador) de não essenciais (do operador), e o jurídico deve confirmar que o desenho de reunião cabe do lado certo. É hipótese minha de leitura, não conferida em fonte nesta sessão. Isso pesa mais em reunião do que no Meridian.

### B. Controladora nos dois fluxos

**O que significa.** A Nebuloz assume a relação com o respondente e com o participante como agente que decide o tratamento. O titular exerce o art. 18 direto contra ela.

**Consequências.**
- *A favor:* resolve "sem depender do cliente" por construção; a Nebuloz decide e executa o pedido sozinha.
- *Contra:* base legal, aviso ao titular, linha no RoPA e encarregado próprios **para cada finalidade**, e a Nebuloz responde sozinha, sem repartir com o cliente, por dado que um cliente escolheu coletar. Contradiz o produto (o cliente decide a finalidade), o DPA v1.1 e D-10. O cliente corporativo tende a estranhar um fornecedor que se declara dono do dado dos seus funcionários; espera-se atrito comercial (hipótese, sem dado de venda). Exige reescrever o DPA em vez de validá-lo. Não recomendo.

### C. Operadora só no Meridian agora; reunião fica fora do contrato até decidir

**O que significa.** Você decide só o que o Meridian precisa. O DPA é enxugado para citar apenas o respondente; a inteligência de reunião não é vendida a cliente externo até haver decisão e parecer próprio.

**Consequências.**
- *A favor:* menor superfície de decisão hoje, e a parte de reunião é a mais discutível (ver risco de enquadramento em A). Não atrasa o Meridian.
- *Contra:* trabalho extra no DPA (§1.1, §2, §9 e §10.1 hoje falam dos dois fluxos); dois regimes convivendo; adia a mesma pergunta em vez de resolvê-la. O modelo de reunião já tem portão de consentimento pronto (`consentimento-de-gravacao.md`), então adiar não ganha segurança, só tempo de jurídico.
- *Quando escolher:* se o jurídico resistir ao enquadramento de operadora para reunião. É o plano de recuo, não o ponto de partida.

## 3. Recomendação

**A**, com duas travas que já existem e devem ficar escritas na sua decisão:
1. `benchmarkOptIn` fica desligado **por cláusula** (DPA §2.1) e por controle no produto (ver §5, ponto a). O default `false` sozinho não basta: o consultor do cliente liga a opção por uma caixa de seleção (`apps/app/components/meridian/screens/assessments.tsx:211`), e o scoring passa a contribuir com o conjunto comparativo (`scoring.ts:200`). Ligado, a Nebuloz é controladora sem linha no RoPA nem aviso próprio ao respondente.
2. Conteúdo de cliente não é usado para treinar, ajustar ou demonstrar, como diz o DPA §2 e D-10. Um "sim" aqui também cruza a linha para controladora.

Se o jurídico devolver "reunião não cabe em operadora", você cai em C sem refazer o Meridian.

## 4. O que fica em aberto depois da sua escolha

| # | Pergunta | Bloqueia o Meridian externo? | Por que importa |
|---|---|---|---|
| 1 | A, B ou C? | **Sim** | Trava o DPA e o texto do contrato |
| 2 | O endereço do canal público é `privacy@nebuloz.com` ou outro? | Não, mas o DPA §9.1 cita o canal | Único dado que falta para publicar o texto de `operadora-controladora.md` §4 |
| 3 | Quem é o encarregado, e o nome vai publicado com o canal? | Não | Art. 5º, VIII; pendência do RoPA §6 |
| 4 | Confirma que benchmark (`benchmarkOptIn`) e uso de conteúdo para treino/demonstração seguem "não" no primeiro contrato (cláusula DPA §2.1)? | **Sim, para o contrato** | Mantém a Nebuloz operadora; ver §3 e §5 (a) |
| 5 | Jurídico: 5 dias úteis, 30 dias, 30 dias e o texto público bastam? (`operadora-controladora.md` §5, 6 a 8) | Sim, para assinar contrato | O modelo é rascunho até revisão |
| 6 | Autoriza a cláusula C8 abaixo (instrução prévia de eliminação de respondente)? | Não; **recomendada** | Faz "sem depender do cliente" valer sem a Nebuloz decidir o mérito |
| 7 | Quem é o Dono do SLA do repasse e quem envia? (§5 c; recomendo Ordem, com delegação escrita) | Não, mas sem nome o prazo cai no CEO | Regra do playbook §4: Dono do SLA ≠ quem entrega |

**Cláusula C8 proposta (não incorporada ao DPA; só entra com o seu "sim" e a revisão jurídica).**

> O Cliente instrui a Nebuloz, desde já e por escrito, a executar o pedido de eliminação de dados de titular sem conta que a Nebuloz lhe tenha encaminhado nos termos da cláusula 9.1, caso o Cliente não se manifeste em **10 (dez) dias úteis** do encaminhamento. A instrução não se aplica a dado que o Cliente informe, no mesmo prazo, ter de reter por obrigação legal ou por exercício regular de direitos, caso em que o Cliente responde ao titular. A Nebuloz registra a execução e a informa ao Cliente.

O prazo de 10 dias úteis é meu palpite, calibrado para caber dentro dos 15 dias úteis que a policy promete ao titular (`lgpd-ropa-e-lacunas.md` §1). O jurídico valida.

## 5. As três contestações do Sócio (`docs/socio/2026-09-29-lancamento-meridian.md`, R2 e R5)

Aceito as três; uma delas com correção de fato.

**a) `benchmarkOptIn` é armadilha: aceito.** Proposta que diga "compare com o mercado" faz o cliente ligar a opção, e a Nebuloz vira controladora no dia 1 sem RoPA. O que entra:
- **Cláusula:** DPA §2.1 (benchmark desligado; ativar exige aditivo com finalidade, base legal e aviso próprios).
- **Comercial:** a proposta e o material do Meridian não prometem comparação com mercado enquanto a função estiver desligada. Isso é texto de venda, dono do playbook de vendas.
- **Produto (o que a cláusula não resolve sozinha):** desabilitar ou esconder a caixa de seleção para tenant externo até haver decisão e RoPA. Código não é da minha mesa; peço a Norte (decide) e Bussola (implementa). Sem isso, um consultor do cliente descumpre a cláusula com um clique.
- **Quando ligar de verdade:** só com linha própria no RoPA (finalidade 5 ou nova), aviso ao respondente e a coorte mínima de 5 já existente (SC-005).

**b) A eliminação em 30 dias promete job que não roda: aceito em parte.** O que o Sócio acerta: a retenção de 90 dias da evidência (`eliminateExpiredMeridianEvidence`) e a execução de eliminação de titular (`processErasureRequest`) são funções Inngest, e em produção estão paradas (relato; `docs/runbooks/inngest-producao.md`). O que corrijo: a eliminação **ao fim do contrato**, em 30 dias (DPA §10), nunca foi automática. `lgpd-ropa-e-lacunas.md` §2.4 e a policy 05 v1.1 dizem que é procedimento manual com dono, e o DPA §10.1 já não promete mecanismo. Então o prazo de 30 dias é exequível hoje, por Pilar, sem Inngest. O que precisa ser condicionado é o que **é** automático. Resolvi assim, no DPA §10.2: os prazos (5 e 30 dias) valem desde a assinatura por procedimento manual; os mecanismos automáticos só são compromisso **depois de a Nebuloz comunicar por escrito a verificação em produção**. Duas consequências para o CEO:
- A condição 2 do relatório de prontidão (Inngest em produção, `GET /api/inngest` 200, um run real) é a que dá a data de verificação de §10.2. Ver o run é passo de produção e pede seu "vai".
- O aviso ao respondente que cita os 90 dias (commit `23bc6815`, fora de `github/main`) **não deve ir para a tela antes** de o job estar verificado; prometer 90 dias ao titular com a rotina parada é a informação falsa de art. 9º que o Sócio descreve em R1. Isso inverte a condição 4 do relatório (que pede levá-lo à main): recomendo levar **junto** com a verificação do Inngest, não antes.

**c) Sem Dono do SLA, o repasse em 5 dias úteis cai no CEO.** Concordo, e o risco é maior do que parece: o repasse é **envio externo** (a Nebuloz escreve ao cliente e ao titular), e eu, por regra da função, redijo e não envio. Quem pode ser dono, pela regra do playbook de vendas §4 (Dono do SLA ≠ quem entrega):

| Candidato | Por que pode | Restrição |
|---|---|---|
| **Ordem (Chief of Staff)** — recomendo | Não entrega o Meridian, então respeita a regra 1; dono de prazo é a função natural | Precisa de delegação escrita do CEO para enviar; Ordem confirma se cabe no papel dela |
| Lacre (DPO, eu) | Já recebo `privacy@`, classifico o pedido e redijo o repasse em até 1 dia útil | Não envio externo; e como auditora do canal não devo ser também dona do prazo |
| CEO | Envia hoje | É o gargalo que o Sócio aponta em R4; só como reserva |

Proposta de divisão, a preencher no RACI (`playbook-de-vendas.md` §4, coluna Meridian): **Dono do SLA do repasse = Ordem**; **Lacre redige** o repasse e o aviso ao titular no mesmo dia em que o pedido chega; **quem envia** é quem o CEO delegar por escrito (Ordem, se aceitar); **Lacre audita** o cumprimento do prazo. Detalhe no playbook `2026-09-29-playbook-pedido-do-titular.md`. Decisão de nomes é sua.

**R5 (canal e playbook).** O texto da §4 de `/legal/privacy` está pronto para publicar, com só dois campos faltando (e-mail e encarregado), em `2026-09-29-texto-publico-canal-do-titular.md`. O playbook de uma página está em `2026-09-29-playbook-pedido-do-titular.md`.

**Aditivo com data.** Se o DPA revisado por advogado não couber em 2 semanas (Sócio: "não cabe"), o contrato do primeiro cliente leva o aditivo provisório de `dpa-aditivo-provisorio.md`, com data de vigência e de substituição. Ele não é substituto de revisão jurídica: é o mínimo escrito que não promete o que não existe, com o DPA revisado a entrar como aditivo posterior.

## Decisões

Fonte das três primeiras: relato da Morgana, 2026-09-29; não vi a resposta original. A numeração do CEO segue a de `operadora-controladora.md` §5, não a da tabela do §4 deste memo.

- **2026-09-29 — Decisão do CEO — enquadramento:** a Nebuloz é **operadora no Meridian** (pergunta 1). Corresponde à opção A para o Meridian. A resposta não citou o participante de reunião: **fica a confirmar** se A vale para reunião ou se o caminho é C (reunião fora do contrato até decidir). Isso muda o DPA §1.1, §2 e §9, e é a única pergunta que o CEO ainda precisa responder para fechar a condição 1.
- **2026-09-29 — Decisão do CEO — uso de conteúdo:** **não** usar conteúdo de cliente para demonstração, ajuste de prompt nem avaliação de modelo (pergunta 3). Fecha a trava 2 da §3.
- **2026-09-29 — Decisão do CEO — canal:** `privacy@nebuloz.com` (pergunta 4). Falta confirmar que a caixa existe e tem dono.
- **Em aberto com o CEO:** benchmark desligado no primeiro contrato (pergunta 2, item 4 da §4); encarregado (pergunta 5, item 3 da §4); C8; Dono do SLA e quem envia.
- **Jurídico — revisão do `dpa-modelo.md`:** _aguardando_

- **2026-09-29 — Decisão do CEO — escopo (esclarecimento):** a operadora vale **só para o Meridian, por ora**; reunião fica para decisão separada. É a **opção C**. O DPA ganhou §1.2 (reunião fora do escopo até decidir) e a inteligência de reunião não é vendida a cliente externo até lá.
- **2026-09-29 — Decisão do CEO — benchmark:** `benchmarkOptIn` **desligado no primeiro contrato, com trava no produto** (`assessments.tsx:211`, Norte e Bussola).
- **2026-09-29 — Decisão do CEO — SLA:** Dono do SLA do repasse = **Ordem**, com delegação escrita do CEO para o envio (ainda a escrever).

Ainda sem resposta do CEO (encarregado e C8 seguem em aberto; as linhas abaixo de benchmark e Dono do SLA ficaram decididas acima):
- **CEO — C8 (sim / não):** _aguardando_
- **CEO — encarregado:** _aguardando_
- **Jurídico — revisão do `dpa-modelo.md` v1.1:** _aguardando_
