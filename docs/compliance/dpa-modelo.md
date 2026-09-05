# Acordo de Tratamento de Dados Pessoais — modelo

> **Rascunho pendente de revisão jurídica.** Este documento é um rascunho
> estruturado, escrito para que quem responde juridicamente pela Nebuloz revise
> em vez de redigir do zero. Não foi revisado por advogado e não constitui
> aconselhamento jurídico. Os itens entre colchetes duplos são fatos que só a
> Nebuloz pode confirmar. Os fatos técnicos — o que se coleta, quem processa, o
> que a eliminação alcança — estão conferidos contra o código e apontam para o
> [RoPA](lgpd-ropa-e-lacunas.md).

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
> separa uma coisa da outra. [[DADO NECESSÁRIO: o jurídico confirmar essa linha
> divisória; é a decisão "operadora × controladora" que o RoPA §4 deixa aberta,
> e é a que define para onde vai o pedido de um titular sem conta]]

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
[[DADO NECESSÁRIO: confirmar essa cláusula com cada provedor de LLM — ver §5;
sem zero-retention contratual, a Nebuloz não consegue prometer o que o
subprocessador não promete]]

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

O Cliente autoriza, de forma geral, o uso dos subprocessadores abaixo. A Nebuloz
informará o Cliente com [[DADO NECESSÁRIO: prazo — usual 30 dias]] de
antecedência sobre inclusão ou substituição, e o Cliente poderá se opor por
motivo fundamentado.

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
| Neon | Banco de dados | [[DADO NECESSÁRIO]] | [[DADO NECESSÁRIO]] |
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

## 9. Direitos dos titulares

Pedidos de titular recebidos pela Nebuloz que digam respeito a dados do Cliente
são encaminhados ao Cliente em até [[DADO NECESSÁRIO: prazo — usual 5 dias
úteis]], e a Nebuloz presta a assistência técnica necessária para o Cliente
responder no prazo legal.

O que a plataforma faz hoje, tecnicamente, quando um pedido de eliminação é
executado: anonimiza perfil, entradas de standup, mensagens de copiloto,
participação em reunião e conteúdo derivado, registro de acesso (identificadores
apenas) e registro de respondente do Meridian — preservando o que tem base para
ser retido, documentado no RoPA §5.

**Titulares sem conta** — respondentes convidados por link e participantes de
reunião — não têm como acionar esse fluxo pela aplicação, porque ele exige
sessão. Para eles, o caminho é o Cliente, como controlador, receber o pedido e
instruir a Nebuloz. É exatamente por isso que o enquadramento da §1 importa.

## 10. Retenção e eliminação ao fim do contrato

Ao término do contrato, a Nebuloz cessa o tratamento e, em até 30 dias, elimina
ou devolve os dados do Cliente, conforme instrução escrita, salvo o que a lei
exigir reter.

[[DADO NECESSÁRIO: a policy 05 v1.1 diz com todas as letras que essa eliminação
é hoje um procedimento manual com dono nomeado, não um processo automático. O
anexo pode prometer o prazo; não pode prometer o mecanismo. Se o jurídico quiser
afirmar automação, ela precisa existir antes]]

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
| Canal de incidente (§8), prazos (§5, §9), foro (§12) | Nebuloz |
| Registro de leitura por staff, se for prometido (§4) | Engenharia — não existe |
| Eliminação automática ao fim do contrato, se for prometida (§10) | Engenharia — não existe |

Quatro das seis linhas não são código. As duas que são estão marcadas como
inexistentes, para o anexo não prometer o que o sistema não faz — que foi o
erro da policy anterior.
