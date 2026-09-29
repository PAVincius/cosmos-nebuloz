# Acordo de Tratamento de Dados Pessoais — modelo

> **Rascunho pendente de revisão jurídica.** Este documento é um rascunho
> estruturado, escrito para que quem responde juridicamente pela Nebuloz revise
> em vez de redigir do zero. Não foi revisado por advogado e não constitui
> aconselhamento jurídico. Os itens entre colchetes duplos são fatos que só a
> Nebuloz pode confirmar. Os fatos técnicos — o que se coleta, quem processa, o
> que a eliminação alcança — estão conferidos contra o código e apontam para o
> [RoPA](lgpd-ropa-e-lacunas.md).

> **v1.1 — o que entrou nesta versão, e por quê.** Sete cláusulas vindas de
> [`operadora-controladora.md`](operadora-controladora.md) §3, nas seções 1, 3,
> 5, 8, 9 e 10. Elas fecham a única lacuna que o modelo não cobria: os titulares
> que aparecem no banco sem nunca terem tido conta — respondentes convidados por
> link no Meridian e participantes de reunião gravada — não têm sessão para
> exercer o art. 18, e o modelo dizia para onde o pedido deles vai sem dizer em
> que prazo, por qual canal, nem o que a Nebuloz faz ao recebê-lo. As cláusulas
> nomeiam o canal, fixam 5 dias úteis para o repasse e 30 para a eliminação ao
> fim do contrato, e explicitam subcontratação e cooperação em incidente. O
> enquadramento operadora × controladora que elas pressupõem continua sendo a
> decisão pendente do §1 — as cláusulas o assumem, não o decidem.

> **v1.2 — o que entrou nesta versão, e por quê** (2026-09-29, contestação do
> Sócio em `docs/socio/2026-09-29-lancamento-meridian.md`, R2). Três coisas,
> todas marcadas onde aparecem: (1) **§2.1**, benchmark do Meridian desligado no
> primeiro contrato, porque ligá-lo faz da Nebuloz controladora sem linha no
> RoPA; (2) **§10.2**, que separa o prazo de eliminação (procedimento manual, já
> exequível) dos mecanismos automáticos (que só valem depois de verificados em
> produção); (3) **§9.3**, instrução prévia para eliminação de respondente, que
> **só entra com decisão do CEO**. Também corrige a linha do banco de dados na
> §5, que listava Neon enquanto produção roda em Supabase. Continua rascunho
> pendente de revisão jurídica. Se o DPA revisado não couber no prazo do primeiro
> contrato, vale o [aditivo provisório](dpa-aditivo-provisorio.md).

**Anexo ao contrato de prestação de serviços** celebrado entre
[[DADO NECESSÁRIO: razão social da Nebuloz]], CNPJ [[DADO NECESSÁRIO: CNPJ]],
com sede em [[DADO NECESSÁRIO: endereço]] ("**Nebuloz**"), e o cliente
identificado no contrato principal ("**Cliente**").

---

## 1. Papéis

**O Cliente é o controlador** dos dados pessoais tratados nos produtos
contratados, e **a Nebuloz é a operadora**, nos termos do art. 5º, VI e VII, da
Lei 13.709/2018 (LGPD). O Cliente decide as finalidades e os meios; a Nebuloz
trata os dados por conta do Cliente e sob suas instruções, que são as
constantes do contrato principal, deste anexo e da configuração que o Cliente
faz no produto.

Isso vale para todos os dados que o Cliente insere ou que os produtos coletam
em nome dele — inclusive os de pessoas que **não** são usuárias da plataforma:
respondentes convidados por link no Meridian, participantes de reuniões
transcritas, contatos nomeados em casos de uso do Charter. Para essas pessoas,
o Cliente é quem detém a relação e a base legal; a Nebuloz responde ao Cliente,
não diretamente ao titular.

> **Variante — Nebuloz como controladora.** Há tratamentos em que a Nebuloz
> decide finalidade e meios por conta própria: registro de acesso e trilha de
> auditoria da plataforma (segurança), operação comercial (prospecção), e dados
> de seus próprios colaboradores. Para esses, a Nebuloz é controladora
> independente, e este anexo não se aplica — a Política de Privacidade do site
> e os contratos de trabalho é que regem. O RoPA (§3, finalidades 2, 3, 9 e 10)
> separa uma coisa da outra. **Decisão do CEO, 2026-09-29: a Nebuloz é
> operadora no Meridian** (`operadora-controladora.md` §6). Para participante de
> reunião a resposta não o citou; até confirmação, o texto de §1.1 sobre reunião
> segue como recomendação. [[DADO NECESSÁRIO: o jurídico confirmar essa linha
> divisória, inclusive para reunião]]

**1.1 Titulares sem conta.** O Cliente é o controlador também quanto aos dados
pessoais de pessoas que não possuem conta na plataforma e cujos dados são
coletados por iniciativa dele — em especial os respondentes convidados por link
no Meridian e os participantes de reuniões gravadas por integração que o Cliente
conecte e opere. A Nebuloz trata esses dados exclusivamente como operadora, nos
termos do art. 5º, VII, da Lei 13.709/2018, e não estabelece relação direta com
esses titulares.

## 2. Objeto e finalidades

A Nebuloz trata dados pessoais exclusivamente para prestar os produtos
contratados. As finalidades, por produto, são as registradas no RoPA §3 — em
resumo:

| Produto | O que trata | Titulares |
|---|---|---|
| Cosmos | Nome, e-mail, avatar e conteúdo de trabalho de usuários; conteúdo de conversa com o copiloto | Usuários do Cliente |
| Meridian | Nome, e-mail e cargo de respondentes; respostas e evidências | Usuários e **respondentes convidados por link** |
| Charter | Nome de donos de caso de uso; aceites de política | Usuários e terceiros nomeados |
| Inteligência de reunião (Cosmos) | Resumo e itens derivados de fala; nome e e-mail de participantes | **Participantes, inclusive externos ao Cliente** |
| Scaffold | Artefatos de trilha; caso de negócio | Usuários do Cliente |

A Nebuloz não trata dados pessoais para finalidade própria a partir dos dados
do Cliente, e não os utiliza para treinar modelos de inteligência artificial.
[[DADO NECESSÁRIO: decisão do CEO de 2026-09-29: conteúdo de cliente não é usado
para demonstração, ajuste de prompt nem avaliação de modelo; falta confirmar essa
cláusula com cada provedor de LLM — ver §5;
sem zero-retention contratual, a Nebuloz não consegue prometer o que o
subprocessador não promete]]

**2.1 Benchmark do Meridian desligado.** O Meridian possui função opcional de
benchmark (`benchmarkOptIn`), pela qual respostas de diagnósticos compõem um
conjunto comparativo entre organizações. Nessa função, a finalidade é da
Nebuloz, e não do Cliente. **Nas condições deste anexo, a função permanece
desligada**: o Cliente não a ativa em nenhum diagnóstico, e a Nebuloz não
contribui, nem consulta, dados do Cliente para o conjunto comparativo. Ativá-la
depende de aditivo específico, com finalidade, base legal e aviso ao titular
próprios, em que a Nebuloz figura como controladora daquele tratamento.
[[DECISÃO CEO: confirmar que o benchmark não será oferecido no primeiro contrato.
Além da cláusula, é preciso um controle no produto: hoje o consultor do Cliente
liga a opção por uma caixa de seleção em `apps/app/components/meridian/screens/assessments.tsx:211`,
e a proposta comercial não pode prometer "compare com o mercado" enquanto a
função estiver desligada. Ver memo de 2026-09-29, §5]]

## 3. Instruções e limites

A Nebuloz trata dados apenas conforme instruções documentadas do Cliente. Se
uma instrução, no entendimento da Nebuloz, violar a LGPD, a Nebuloz informará o
Cliente antes de executá-la.

Dois limites técnicos são parte da instrução, e estão no produto, não só no
papel:

- **Conteúdo de reunião só chega a um provedor de IA após consentimento
  registrado.** O pipeline nasce em estado `PENDING` e não enfileira
  processamento por modelo de linguagem sem liberação — por pessoa com papel de
  governança, ou automaticamente apenas em reunião comprovadamente sem
  participante externo. Detalhe em [`consentimento-de-gravacao.md`](consentimento-de-gravacao.md).
- **Observabilidade de IA não recebe conteúdo em claro** por padrão. O envio de
  prompt e resposta ao subprocessador de observabilidade é desligado, e a
  instrução do Cliente é que permaneça desligado em qualquer ambiente com seus
  dados.

**3.1 O que constitui instrução documentada.** Para os fins do art. 39 da Lei
13.709/2018, constituem instruções documentadas do Cliente: o contrato principal,
este anexo, e a configuração que o Cliente realiza no produto — inclusive o modo
de consentimento de gravação, a declaração escrita que o sustenta, e cada
liberação, negativa ou revogação registrada na trilha de auditoria. A Nebuloz não
trata os dados fora dessas instruções, e informará o Cliente antes de executar a
que entenda violar a lei.

## 4. Confidencialidade e pessoas autorizadas

A Nebuloz garante que as pessoas autorizadas a tratar os dados estão sujeitas a
obrigação de confidencialidade e acessam apenas o necessário. O acesso de
equipe da Nebuloz aos dados do Cliente passa por conta de staff com segundo
fator obrigatório e é registrado na trilha de auditoria da plataforma.

[[DADO NECESSÁRIO: a trilha de auditoria da plataforma registra ações; não há
hoje registro de *leitura* de dado de cliente por staff. Se o jurídico
considerar necessário afirmar "todo acesso é registrado", isso precisa ser
construído antes de ser prometido — ver RoPA §2, onde a policy anterior
prometia controle inexistente]]

## 5. Subprocessadores

O Cliente autoriza, de forma geral, o uso dos subprocessadores abaixo.

**5.1 Regime da subcontratação.** A Nebuloz pode subcontratar o tratamento aos
subprocessadores relacionados neste anexo, mediante contrato que lhes imponha
obrigações não menos protetivas que as aqui assumidas, e permanece integralmente
responsável perante o Cliente pelos atos e omissões deles. A inclusão ou
substituição de subprocessador é comunicada com **30 (trinta) dias** de
antecedência, e o Cliente pode opor-se por motivo fundamentado nesse prazo;
mantida a oposição, qualquer das partes pode rescindir o contrato quanto ao
serviço afetado, sem multa.

**Recebem conteúdo do Cliente:**

| Subprocessador | Finalidade | Localização | Salvaguarda |
|---|---|---|---|
| Anthropic | Modelo de linguagem — rota padrão | EUA | [[DADO NECESSÁRIO: DPA e cláusula de zero-retention]] |
| OpenAI | Modelo de linguagem — rota secundária | EUA | [[DADO NECESSÁRIO]] |
| Google | Modelo de linguagem — rota terciária | EUA | [[DADO NECESSÁRIO]] |
| Langfuse | Observabilidade de IA — conteúdo mascarado por padrão | [[DADO NECESSÁRIO]] | [[DADO NECESSÁRIO]] |
| Fireflies | Transcrição de reunião — só após consentimento | [[DADO NECESSÁRIO]] | [[DADO NECESSÁRIO: DPA e consentimento de gravação]] |

**Infraestrutura:**

| Subprocessador | Finalidade | Localização | Salvaguarda |
|---|---|---|---|
| Supabase | Banco de dados de produção, armazenamento de evidência do Meridian (bucket `meridian-evidence`) e cópias de segurança | [[DADO NECESSÁRIO: região do projeto]] | [[DADO NECESSÁRIO: DPA. `dpa-fornecedores.md` V-05 registra Neon e não cita Supabase; o parecer de 2026-09-29 sobre o reset abriu essa divergência]] |
| Neon | Banco de dados (dependência do monorepo) | [[DADO NECESSÁRIO: confirmar se ainda é usado em algum ambiente; se não, remover a linha]] | [[DADO NECESSÁRIO]] |
| Vercel | Hospedagem e execução | EUA | [[DADO NECESSÁRIO]] |
| Upstash | Cache e limitação de taxa | EUA / UE | [[DADO NECESSÁRIO]] |
| Sentry | Monitoramento de erros | [[DADO NECESSÁRIO]] | [[DADO NECESSÁRIO]] |
| Liveblocks | Colaboração em tempo real | [[DADO NECESSÁRIO]] | [[DADO NECESSÁRIO]] |
| Resend | E-mail transacional | EUA | [[DADO NECESSÁRIO]] |
| Inngest | Execução de tarefas em segundo plano | [[DADO NECESSÁRIO]] | [[DADO NECESSÁRIO]] |

A lista é derivada das dependências reais do sistema, não de modelo. A coluna
de salvaguarda está vazia de propósito: **é fato de contrato com cada
subprocessador e só entra depois de confirmado.** Inventário completo, com o que
cada um processa, em [`../runbooks/charter-nebuloz.md`](../runbooks/charter-nebuloz.md) §5.

## 6. Transferência internacional

Os subprocessadores acima processam dados fora do Brasil. A transferência se
apoia em [[DADO NECESSÁRIO: o mecanismo do art. 33 da LGPD aplicável a cada um
— cláusulas contratuais padrão aprovadas pela ANPD, ou outro]], e a Nebuloz
mantém à disposição do Cliente a documentação correspondente.

## 7. Segurança

A Nebuloz adota as medidas descritas na [Política de Classificação e Retenção
de Dados](soc2/policies/05-data-classification-policy.md), v1.1, em especial:
criptografia em trânsito e em repouso; credenciais de integração cifradas na
camada de aplicação; isolamento por organização em toda consulta; segundo fator
obrigatório para equipe; trilha de auditoria imutável.

**Uma limitação que a Nebuloz declara em vez de esconder:** o isolamento entre
organizações é aplicado pela camada de aplicação em toda consulta ao banco. A
política de isolamento em nível de banco de dados está declarada em todas as
tabelas, mas não é a barreira ativa hoje — ver
[ADR-0012](../adr/0012-rls-anulada-por-conexao-superuser.md). O Cliente é
informado disso porque é o tipo de coisa que um auditor pergunta, e a resposta
honesta vale mais que a conveniente.

## 8. Incidentes de segurança

A Nebuloz notificará o Cliente sobre incidente de segurança que afete seus
dados pessoais em até **72 horas** após tomar conhecimento, com o que souber
até então — natureza do incidente, dados e titulares afetados, medidas tomadas
— e complementará conforme apurar. A notificação à ANPD e aos titulares, quando
cabível, é decisão do Cliente como controlador; a Nebuloz fornece o que for
necessário para ela.

[[DADO NECESSÁRIO: nomear o canal e a pessoa de contato para incidentes, dos
dois lados]]

**8.1 Cooperação.** A Nebuloz coopera com o Cliente na apuração e na resposta a
incidente de segurança, fornecendo, no que estiver ao seu alcance, os registros
de auditoria e de acesso pertinentes, a identificação dos titulares afetados —
inclusive os sem conta — e as medidas técnicas adotadas. A comunicação à ANPD e
aos titulares é decisão e ato do Cliente, como controlador; a Nebuloz não a
realiza por conta própria quanto a dados tratados em nome dele, salvo instrução
escrita.

## 9. Direitos dos titulares

**9.1 Canal do titular sem conta.** A Nebuloz mantém canal público para
recebimento de pedidos de titulares, em **privacy@nebuloz.com** (decisão do CEO,
2026-09-29), divulgado em sua Política de Privacidade.
Pedido recebido por esse canal que diga respeito a dados tratados em nome do
Cliente não é decidido no mérito pela Nebuloz: é encaminhado ao Cliente, e o
titular é informado de que o pedido foi encaminhado e a quem, na forma do art.
18, § 4º, I, da Lei 13.709/2018.

**9.2 Prazo de repasse e assistência.** O encaminhamento ocorre em até **5
(cinco) dias úteis** do recebimento. A Nebuloz presta ao Cliente a assistência
técnica necessária para responder no prazo legal — localização dos registros,
execução de eliminação ou anonimização, geração de export de portabilidade —
mediante instrução escrita dele.

O que a plataforma faz hoje, tecnicamente, quando um pedido de eliminação é
executado: anonimiza perfil, entradas de standup, mensagens de copiloto,
participação em reunião e conteúdo derivado, registro de acesso (identificadores
apenas) e registro de respondente do Meridian — preservando o que tem base para
ser retido, documentado no RoPA §5.

**Titulares sem conta** — respondentes convidados por link e participantes de
reunião — não têm como acionar esse fluxo pela aplicação, porque ele exige
sessão. Para eles, o caminho é o Cliente, como controlador, receber o pedido e
instruir a Nebuloz; o canal de §9.1 existe para levá-los até ele. É exatamente
por isso que o enquadramento da §1 importa.

**9.3 Instrução prévia para eliminação de respondente.** [[DECISÃO CEO: só entra
com "sim" à cláusula C8 do memo de 2026-09-29; sem ele, apagar esta cláusula.]]
O Cliente instrui a Nebuloz, desde já e por escrito, a executar o pedido de
eliminação de dados de titular sem conta que a Nebuloz lhe tenha encaminhado nos
termos da cláusula 9.1, caso o Cliente não se manifeste em **10 (dez) dias
úteis** do encaminhamento. A instrução não se aplica a dado que o Cliente
informe, no mesmo prazo, ter de reter por obrigação legal ou por exercício
regular de direitos, caso em que o Cliente responde ao titular. A Nebuloz registra
a execução e a informa ao Cliente.

## 10. Retenção e eliminação ao fim do contrato

Ao término do contrato, a Nebuloz cessa o tratamento e, em até **30 (trinta)
dias**, elimina ou devolve os dados pessoais do Cliente, conforme instrução
escrita dele, salvo o que a lei exigir reter.

**10.1 Alcance e comprovação.** A eliminação alcança os dados de titulares sem
conta tratados em nome do Cliente — respondentes do Meridian e participantes de
reunião — e a Nebuloz fornece, ao final, declaração escrita do que foi eliminado,
devolvido e retido, com a base de cada retenção.

[[DADO NECESSÁRIO: a policy 05 v1.1 diz com todas as letras que essa eliminação
é hoje um procedimento manual com dono nomeado, não um processo automático. O
anexo pode prometer o prazo; não pode prometer o mecanismo. Se o jurídico quiser
afirmar automação, ela precisa existir antes]]

**10.2 Prazos e mecanismos.** Os prazos das cláusulas 9.2 e 10 (5 dias úteis, 30
dias) são cumpridos por **procedimento manual com responsável nomeado**, e valem
desde a assinatura. Os **mecanismos automáticos** que a plataforma possui — a
eliminação programada da evidência 90 dias após o fechamento do diagnóstico e a
execução automática de pedido de eliminação de titular — só são compromisso da
Nebuloz **a partir da data em que ela comunicar ao Cliente, por escrito, que
foram verificados em produção**. Até essa data, a Nebuloz executa o mesmo
resultado por procedimento manual, dentro dos mesmos prazos, e o Cliente não deve
presumir que a rotina automática esteja em operação. [[DADO NECESSÁRIO: a data de
verificação só existe depois de o Inngest de produção estar com as chaves do alvo
Production, `GET /api/inngest` respondendo 200 e um run real de
`eliminateExpiredMeridianEvidence` visto no painel; condição 2 de
`docs/qualidade/prontidao/meridian.md`. Conferido em 2026-09-29 só por relato da
Morgana e pelo runbook `docs/runbooks/inngest-producao.md`: não está verificado]]

## 11. Auditoria

A Nebuloz disponibiliza ao Cliente, mediante pedido razoável, as informações
necessárias para demonstrar o cumprimento deste anexo: a Política de
Classificação e Retenção, o RoPA, o inventário de subprocessadores, e o export
de conformidade do Charter da própria Nebuloz.

[[DADO NECESSÁRIO: decidir se o anexo prevê auditoria presencial pelo Cliente,
com que frequência e a que custo]]

## 12. Vigência e lei aplicável

Este anexo vigora enquanto vigorar o contrato principal e pelo tempo necessário
para cumprir a §10. É regido pela lei brasileira, em particular pela Lei
13.709/2018. [[DADO NECESSÁRIO: foro eleito]]

---

## O que este modelo depende, e de quem

| Item | De quem |
|---|---|
| Confirmar operadora × controladora por finalidade (§1) | Jurídico |
| Salvaguarda de cada subprocessador (§5, §6) | Contratual — 18 confirmações |
| Zero-retention dos provedores de LLM (§2) | Contratual |
| Canal de incidente (§8) e foro (§12) | Nebuloz |
| Endereço do canal público de titular, citado em §9.1 | Decidido pelo CEO em 2026-09-29 (`privacy@nebuloz.com`); falta confirmar que a caixa existe e é lida, e publicar |
| Encarregado, nomeado junto ao canal | CEO — em aberto |
| Validar os prazos de §5.1, §9.2 e §10 como redigidos | Jurídico |
| Benchmark do Meridian desligado (§2.1) e controle no produto | CEO (decisão); Norte/Bussola (controle) |
| Instrução prévia de eliminação de respondente (§9.3) | CEO (decisão) e jurídico |
| Data de verificação do Inngest de produção (§10.2) | Infra/SRE, com "vai" do CEO |
| Registro de leitura por staff, se for prometido (§4) | Engenharia — não existe |
| Eliminação automática ao fim do contrato, se for prometida (§10) | Engenharia — não existe |

Quase nenhuma linha é código. As que são (registro de leitura, eliminação
automática, controle de benchmark no produto) estão marcadas como inexistentes ou
pendentes, para o anexo não prometer o que o sistema não faz — que foi o erro da
policy anterior.
Os prazos que estavam em aberto (§5, §9, §10) deixaram de ser lacuna e passaram a
ser texto: o que se pede agora é validação, não preenchimento.
