# Operadora ou controladora — os dois titulares sem conta

> Análise e recomendação. A escolha entre os dois enquadramentos é decisão de
> quem dirige a empresa, com validação de quem responde juridicamente por ela; a
> §5 lista as perguntas em forma fechada. Os fatos técnicos estão conferidos
> contra o código.

## 0. O problema

Duas categorias de pessoa aparecem no banco sem nunca terem tido conta:

- **quem responde o diagnóstico do Meridian por link**, convidado por um cliente
  para preencher uma bateria de prontidão;
- **quem falou numa reunião gravada**, registrado como participante quando a
  transcrição chegou ao produto.

Nenhuma tem sessão. Todo o maquinário de direito do titular que existe em código
— `apps/app/app/actions/settings/lgpd.ts` e `apps/app/lib/inngest/lgpd-dsr.ts` —
depende de `requireTenantSession`. O art. 18 da Lei 13.709/2018 dá a essas
pessoas confirmação, acesso, correção, eliminação, portabilidade e revogação "*a
qualquer momento e mediante requisição*", e o § 3º diz que os direitos "*serão
exercidos mediante requerimento expresso do titular (…) a agente de tratamento*".

A lei não exige que o titular tenha login: exige que exista um agente de
tratamento a quem se dirigir. Hoje não está dito, em lugar nenhum que essas
pessoas leiam, quem é esse agente. É a lacuna, e ela não é de código.

## 1. Os dois fluxos, um por um

### 1.1 Respondente do Meridian, convidado por link

**O que entra.** `MeridianRespondent` guarda `name`, `role` (cargo declarado),
`email`, o eixo, o `tokenHash` e a validade do link; `MeridianResponse` guarda as
respostas, e `MeridianEvidence` os arquivos anexados, com `storagePath` no bucket.

**Como entra.** Um usuário do cliente cria o `MeridianAssessment` — que carrega
`orgName`, a organização diagnosticada — e convida os respondentes. A pessoa
convidada abre `apps/app/app/meridian-responder/[token]/page.tsx`, única rota do
módulo fora do guard de sessão, e o `tenantId` sai do token, nunca do request
(`resolveRespondentToken`, em `apps/app/app/(meridian)/actions/respondent.ts`).

**Quem decide a finalidade.** O cliente: diagnosticar a própria organização, quem
convidar, em que eixo, com que prazo, e o que fazer com o resultado. A Nebuloz
não escolhe nenhuma dessas coisas.

**Quem escolhe os meios.** A Nebuloz, quanto aos técnicos: os cinco eixos, a
escala, o token de uso individual, o hash, a expiração. Meio, não finalidade.

**Conclusão.** Pelo art. 5º, VI, controlador é "*pessoa natural ou jurídica (…) a
quem competem as decisões referentes ao tratamento de dados pessoais*" — e aqui
são todas do cliente. Pelo art. 5º, VII, operador é quem "*realiza o tratamento
de dados pessoais em nome do controlador*". **Cliente controlador, Nebuloz
operadora.**

**Uma exceção que já existe no schema.** `MeridianAssessment.benchmarkOptIn`
(default `false`) permite que as respostas componham um pool comparativo. Se esse
pool serve à Nebuloz — benchmark de mercado, material comercial, produto — a
finalidade é **dela**, e ali ela é controladora. O default deny mantém a linha
divisória de pé; ligá-lo a cruza.

### 1.2 Participante de reunião gravada

**O que entra.** `MeetingTranscript` (`title`, `rawSummary`), `MeetingParticipant`
(`email`, `name`, `isOrganizer`, `isExternal`) e os `MeetingInsight` derivados. O
externo é identificado por `participants` menos `workspace_users`.

**Como entra.** O cliente conecta a própria conta do provedor em
`MeetingIntegration` — a `apiKey` é dele, cifrada na camada de aplicação. O
webhook dispara `fireflies-transcript-fetch`
(`apps/app/lib/inngest/fireflies-transcript.ts`), que persiste em `PENDING` e
para. Quem libera é um `ADMIN`, `STE` ou `RTE` **do cliente**, por `grantConsent`
(`apps/app/app/actions/meeting/consent.ts`), com auditoria. Quem escolhe
`consentMode` e redige a `standingConsentRef` também é ele.

**Quem decide a finalidade.** O cliente, de forma ainda mais visível que no
Meridian: convoca a reunião, liga a integração, escolhe o modo de consentimento,
lê (ou não lê) o aviso na sala, e clica em liberar. Cada decisão referente ao
tratamento, no sentido do art. 5º, VI, é um ato dele registrado no `AuditLog`.

**Quem escolhe os meios.** A Nebuloz: qual provedor, qual modelo de linguagem,
qual prompt, o que se extrai da fala — a escolha mais consequente do produto, e o
que torna este fluxo diferente do Meridian.

**Conclusão.** Ainda assim, **cliente controlador, Nebuloz operadora**: escolher o
meio técnico não desloca a titularidade das decisões sobre finalidade, dados,
titulares e retenção. Fireflies e os provedores de LLM são subprocessadores da
Nebuloz, listados no DPA §5.

**O custo desse enquadramento, sem rodeio.** O art. 42, § 1º, I é explícito: "*o
operador responde solidariamente pelos danos causados pelo tratamento quando
descumprir as obrigações da legislação de proteção de dados ou quando não tiver
seguido as instruções lícitas do controlador, hipótese em que o operador
equipara-se ao controlador*". Ser operadora não é blindagem: se o portão falhar,
se conteúdo vazar para um subprocessador sem base, ou se a Nebuloz processar fora
da instrução, ela responde como se controladora fosse. É por isso que o default
deny e o `participantsKnown` fail-closed são controle de risco dela, não só do
cliente.

## 2. A recomendação

**Nebuloz operadora nos dois fluxos.** O pedido do titular sem conta vai ao
cliente, que é o controlador; a Nebuloz atende por instrução dele, nos termos do
art. 39: "*o operador deverá realizar o tratamento segundo as instruções
fornecidas pelo controlador, que verificará a observância das próprias instruções
e das normas sobre a matéria*".

Na prática, três coisas concretas:

1. Pedido que chegue direto à Nebuloz não é respondido no mérito: é encaminhado
   ao cliente em prazo contratado, com o titular avisado de para quem foi — o
   caminho do art. 18, § 4º, I ("*comunicar que não é agente de tratamento dos
   dados e indicar, sempre que possível, o agente*"), adaptado ao caso em que a
   Nebuloz **é** agente, mas operadora.
2. A Nebuloz presta a assistência técnica: `processErasureRequest` e
   `buildPortabilityExport` já alcançam `MeridianRespondent`, `MeetingTranscript`
   e `MeetingParticipant`. Falta o gatilho fora de sessão, e ele é o cliente.
3. A base legal é a do cliente — o que amarra este documento ao
   [`aviso-de-gravacao.md`](aviso-de-gravacao.md): quem escolhe entre
   consentimento e legítimo interesse na finalidade 7 do RoPA é o controlador.

**Onde a Nebuloz vira controladora.** Três situações, nenhuma hipotética:

| Situação | O que a torna controladora |
|---|---|
| **Uso próprio** — a Nebuloz é tenant dela mesma e grava as próprias cerimônias | Nas suas reuniões, é ela quem decide finalidade e meios. Aqui não há DPA: há a política interna e o aviso da §2 do `aviso-de-gravacao.md` |
| **Benchmark do Meridian** (`benchmarkOptIn`) | O pool comparativo é finalidade da Nebuloz, decidida por ela |
| **Produto próprio** — usar conteúdo de cliente para treinar, ajustar ou demonstrar | Finalidade nova, decidida por ela |

O que muda quando ela é controladora: base legal própria por finalidade, aviso
próprio ao titular, linha própria no RoPA §3, e o titular passa a exercer o art.
18 **diretamente contra a Nebuloz**, sem intermediação do cliente. O DPA modelo
§1 já traz essa linha divisória como variante; falta confirmá-la.

## 3. As cláusulas, prontas para colar no DPA modelo

Sete cláusulas, cada uma indicando a seção do [`dpa-modelo.md`](dpa-modelo.md) em
que entra.

**C1 — Papéis quanto a titulares sem conta.** *(ao final do §1)*

> O Cliente é o controlador também quanto aos dados pessoais de pessoas que não
> possuem conta na plataforma e cujos dados são coletados por iniciativa dele —
> em especial os respondentes convidados por link no Meridian e os participantes
> de reuniões gravadas por integração que o Cliente conecte e opere. A Nebuloz
> trata esses dados exclusivamente como operadora, nos termos do art. 5º, VII, da
> Lei 13.709/2018, e não estabelece relação direta com esses titulares.

**C2 — Instruções documentadas.** *(ao final do §3)*

> Constituem instruções documentadas do Cliente, para os fins do art. 39 da Lei
> 13.709/2018: o contrato principal, este anexo, e a configuração que o Cliente
> realiza no produto — inclusive o modo de consentimento de gravação, a
> declaração escrita que o sustenta, e cada liberação, negativa ou revogação
> registrada na trilha de auditoria. A Nebuloz não trata os dados fora dessas
> instruções, e informará o Cliente antes de executar a que entenda violar a lei.

**C3 — Canal do titular sem conta.** *(ao §9)*

> A Nebuloz mantém canal público para recebimento de pedidos de titulares,
> divulgado em sua Política de Privacidade. Pedido recebido por esse canal que
> diga respeito a dados tratados em nome do Cliente não é decidido no mérito pela
> Nebuloz: é encaminhado ao Cliente, e o titular é informado de que o pedido foi
> encaminhado e a quem, na forma do art. 18, § 4º, I, da Lei 13.709/2018.

**C4 — Prazo de repasse e assistência.** *(substitui o prazo em aberto do §9)*

> O encaminhamento de que trata a cláusula anterior ocorre em até **5 (cinco)
> dias úteis** do recebimento. A Nebuloz presta ao Cliente a assistência técnica
> necessária para responder no prazo legal — localização dos registros, execução
> de eliminação ou anonimização, geração de export de portabilidade — mediante
> instrução escrita dele.

**C5 — Subcontratação.** *(ao §5, antes das tabelas)*

> A Nebuloz pode subcontratar o tratamento aos subprocessadores relacionados neste
> anexo, mediante contrato que lhes imponha obrigações não menos protetivas que as
> aqui assumidas, e permanece integralmente responsável perante o Cliente pelos
> atos e omissões deles. A inclusão ou substituição de subprocessador é comunicada
> com **30 (trinta) dias** de antecedência, e o Cliente pode opor-se por motivo
> fundamentado nesse prazo; mantida a oposição, qualquer das partes pode rescindir
> o contrato quanto ao serviço afetado, sem multa.

**C6 — Eliminação ao fim do contrato.** *(ao §10, junto ao prazo já previsto)*

> Encerrado o contrato, a Nebuloz cessa o tratamento e, em até **30 (trinta)
> dias**, elimina ou devolve os dados pessoais do Cliente, conforme instrução
> escrita dele, salvo o que a lei exigir reter. A eliminação alcança os dados de
> titulares sem conta tratados em nome do Cliente — respondentes do Meridian e
> participantes de reunião — e a Nebuloz fornece, ao final, declaração escrita do
> que foi eliminado, devolvido e retido, com a base de cada retenção.

**C7 — Cooperação em incidente.** *(ao final do §8)*

> A Nebuloz coopera com o Cliente na apuração e na resposta a incidente de
> segurança, fornecendo, no que estiver ao seu alcance, os registros de auditoria
> e de acesso pertinentes, a identificação dos titulares afetados — inclusive os
> sem conta — e as medidas técnicas adotadas. A comunicação à ANPD e aos
> titulares é decisão e ato do Cliente, como controlador; a Nebuloz não a realiza
> por conta própria quanto a dados tratados em nome dele, salvo instrução escrita.

## 4. O canal do titular — texto público

Para publicar em `/legal/privacy` — rota que já existe em
`apps/web/app/[locale]/legal/privacy/`, com o conteúdo que o RoPA §6 aponta como
pendente. Escrito para quem não é cliente da Nebuloz e não sabe o que ela é.

> **Se seus dados chegaram até nós por uma organização**
>
> Você pode ter respondido a um diagnóstico por um link que recebeu, ou
> participado de uma reunião gravada e transcrita numa organização que usa nossos
> produtos. Nesses casos, quem decidiu coletar esses dados, para quê e por quanto
> tempo foi **essa organização**, não a Nebuloz. Ela é a controladora; nós
> tratamos os dados em nome dela, como operadora, nos termos da Lei 13.709/2018.
>
> Na prática: para pedir confirmação, acesso, correção, eliminação ou
> portabilidade dos seus dados, procure a organização que convidou você ou
> conduziu a reunião. É ela que decide o pedido.
>
> Se preferir escrever para nós, escreva — para [[DADO NECESSÁRIO: endereço do
> canal de privacidade, hoje `privacy@nebuloz.com` na política interna, ainda não
> publicado]]. Em até 5 dias úteis encaminhamos seu pedido à organização
> responsável e avisamos você de que encaminhamos e para quem. Não decidimos o
> mérito, porque não é nossa decisão tomar.
>
> Há tratamentos em que a Nebuloz é a controladora — a operação do nosso site, os
> registros de segurança da plataforma e nosso contato comercial. Para esses, o
> pedido vem direto para nós, e nós respondemos.

## 5. O que fica para decisão

**Para quem dirige a empresa.** Cada "sim" muda contrato ou produto.

1. **A Nebuloz assume o enquadramento de operadora nos dois fluxos?** É a decisão
   que o RoPA §4 e §8 deixaram aberta e que trava o DPA modelo.
2. **O benchmark do Meridian (`benchmarkOptIn`) vai ser explorado como produto ou
   material comercial?** Um "sim" cria finalidade da Nebuloz como controladora,
   com linha própria no RoPA e aviso próprio ao respondente.
3. **Conteúdo de cliente pode ser usado para demonstração, ajuste de prompt ou
   avaliação de modelo?** Um "sim" cruza a mesma linha e contradiz o §2 do DPA
   modelo como está redigido hoje.
4. **O canal público da §4 vai ao ar com `privacy@nebuloz.com` ou endereço novo?**
   É o único dado que falta para publicar `/legal/privacy`.
5. **Quem é o encarregado, e o nome vai publicado junto ao canal?** Pendência do
   RoPA §6; o art. 5º, VIII faz dele o canal com titulares e ANPD.

**Para o jurídico.**

6. **As cláusulas C1 a C7 entram no DPA modelo como redigidas?** Sim, ou com que
   alteração.
7. **Cinco dias úteis para repasse e trinta dias para eliminação são adequados?**
   Ambos praticáveis hoje; pede-se validação, não viabilidade.
8. **O texto público da §4 basta para satisfazer o art. 18, § 4º, I quando o
   pedido chega à Nebuloz?** Um "não" exige redesenhar o fluxo de resposta.

**Donos.** As perguntas 1 a 5 são de quem dirige a empresa; 6 a 8, do responsável
jurídico. A execução — publicar o canal, anexar o DPA revisado ao contrato — cai
na linha **Dono do SLA** do RACI do
[playbook de vendas](../comercial/playbook-de-vendas.md) §4, que segue em branco.
Enquanto estiver, esta decisão não tem dono — e é isso que a mantém aberta desde
o RoPA.
