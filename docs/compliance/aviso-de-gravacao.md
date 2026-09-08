# Aviso de gravação e memorando de base legal

> `[ferramenta]`, `[organização]`, `[prazo]` e `[contato]` não são lacunas: mudam
> por tenant, e quem lê o aviso preenche na hora. Decisão pendente está na §4.

## 0. Para que serve

O produto já garante que alguém com papel de governança **afirmou** ter obtido
consentimento antes de qualquer fala chegar a um modelo de linguagem: em
`apps/app/lib/inngest/fireflies-transcript.ts`, `consentState` nasce `PENDING` e
o mapeador de IA só é enfileirado com `GRANTED`. É tudo o que software faz; o que
ele não faz — e o RoPA §7 diz com todas as letras — é garantir que o
consentimento **existiu**. Este documento é a outra metade: o texto que, lido na
sala, o faz existir. Sem ele, `grantConsent` registra afirmação sem lastro, e o
ônus da prova do art. 8º, § 2º da Lei 13.709/2018 recai sobre quem não a tem.

## 1. Aviso lido na abertura — modo `PER_MEETING`

Lido em voz alta por quem abre a cerimônia, antes de a gravação valer; cada
versão cabe em cerca de 20 segundos de fala.

### 1.1 Reunião só interna (sem convidado de fora do workspace)

**PT** — Esta reunião está sendo gravada e transcrita pelo [ferramenta], e o
resumo é processado por um modelo de IA de terceiro. O acesso fica com quem tem
papel ADMIN, STE ou RTE nesta organização, e o conteúdo é retido por [prazo].
Quem não quiser ser gravado diz agora. Depois, pedindo a revogação, o resumo e
os itens derivados são apagados.

**EN** — This meeting is being recorded and transcribed by [ferramenta], and the
summary is processed by a third-party AI model. Access is limited to people
holding an ADMIN, STE or RTE role in this organisation, and the content is kept
for [prazo]. If you do not want to be recorded, say so now. Later, on request,
the summary and everything derived from it are deleted.

### 1.2 Reunião com participante externo

É a versão que importa: sob `STANDING`, um convidado de fora do workspace derruba
a liberação automática e joga a transcrição em `PENDING`, supondo **este** aviso.

**PT** — Esta reunião está sendo gravada e transcrita pelo [ferramenta], e o
conteúdo é processado por um modelo de IA de terceiro para gerar resumo e itens
de ação. Quem responde por esses dados é a [organização], que os retém por
[prazo]. Se alguém não concordar, diga agora e a gravação não é processada.
Pedidos de acesso ou exclusão vão para [contato].

**EN** — This meeting is being recorded and transcribed by [ferramenta], and the
content is processed by a third-party AI model to produce a summary and action
items. [organização] is responsible for this data and keeps it for [prazo]. If
anyone objects, say so now and the recording will not be processed. Requests for
access or deletion go to [contato].

**O que a promessa de revogação vale.** `revokeConsent` apaga os `MeetingInsight`
ainda `PENDING`/`DISMISSED`, redige o `text` dos já `APPLIED` — preservando a
linha como prova de origem — e zera o `rawSummary`. O que **não** faz: desfazer o
`Risk`, `Impediment` ou `DecisionLog` que um humano já criou a partir do insight.
Por isso o aviso não diz "tudo some": prometer mais do que `revokeConsent` executa
é o erro que o RoPA §2.3 e §2.4 apontam na policy antiga.

## 2. Consentimento permanente — modo `STANDING`

`STANDING` só é habilitável com `standingConsentRef` preenchido — `CHECK`
constraint na migration `20260901130000_meeting_consent`, não validação de
aplicação. A referência é carimbada em `consentGrantedRef` de cada transcrição
liberada sozinha: aqui, o "quem liberou" é a declaração, não uma pessoa. Ela
aponta para um destes, e nada menos:

1. documento assinado pela organização — política interna de gravação, aprovada e
   datada; ou
2. cláusula destacada de contrato de trabalho, de prestação de serviço ou de
   regulamento interno, na forma do art. 8º, § 1º ("*deverá constar de cláusula
   destacada das demais cláusulas contratuais*").

Nos dois casos com versão e data: a fila exibe `standingConsentRef` como texto, e
referência sem versão não responde "esta gravação tinha base?" **Cláusula, em PT:**

> **Gravação e transcrição de cerimônias.** As cerimônias conduzidas por esta
> organização podem ser gravadas e transcritas por ferramenta de terceiro, e o
> conteúdo resultante processado por modelo de inteligência artificial com a
> finalidade determinada de gerar resumo, riscos, impedimentos e itens de ação
> registrados na plataforma de gestão. Quem conduz a cerimônia deve anunciar a
> gravação na abertura, antes de ela começar, e interrompê-la caso qualquer
> participante se oponha. O acesso é restrito a quem tem papel de governança na
> organização; a retenção é de [prazo]. O consentimento pode ser revogado a
> qualquer momento, por procedimento gratuito, junto a [contato], hipótese em
> que o resumo e os itens derivados daquela cerimônia são eliminados. Esta
> cláusula não autoriza gravação para finalidade diversa da aqui descrita.

A última frase não é enfeite: o art. 8º, § 4º torna nulas as autorizações
genéricas, e "as reuniões podem ser gravadas", sozinho, cai nessa nulidade.

## 3. Memorando — as duas bases legais possíveis

Não decido nenhuma. Segue, para cada uma, o que exige do fluxo que já está no
código, o que o código cobre, o que falta, e o risco.

### 3.1 Consentimento — art. 7º, I, na forma do art. 8º

**Exige.** Consentimento é "*manifestação livre, informada e inequívoca pela qual
o titular concorda com o tratamento de seus dados pessoais para uma finalidade
determinada*" (art. 5º, XII), "*fornecido por escrito ou por outro meio que
demonstre a manifestação de vontade do titular*" (art. 8º, caput). Ônus da prova
do controlador (§ 2º); autorização genérica nula (§ 4º); revogação a qualquer
momento, "*por procedimento gratuito e facilitado*" (§ 5º) e art. 18, IX.

**Coberto.** Default deny no schema; portão antes do LLM; liberação por ato humano
com papel e auditoria (`consent_granted`); revogação com efeito material;
`participantsKnown` fail-closed; finalidade determinada, nomeada pela §2.

**Falta.** Nada disso é código. (a) A manifestação do titular não é capturada em
lugar nenhum: o sistema guarda que um ADMIN/STE/RTE afirmou, não o que o
participante disse — contra o art. 8º, § 2º só existe o aviso da §1 e o registro
de que a cerimônia o seguiu. (b) O aviso é opt-out, e silêncio não é manifestação
inequívoca sob o art. 5º, XII — frágil justamente para o externo. (c) A revogação
"gratuita e facilitada" não existe para quem não tem conta: o DSR exige sessão, e
o externo depende do cliente — ver [`operadora-controladora.md`](operadora-controladora.md).

**Risco.** Consentimento colhido de empregado dentro da relação de emprego tem
liberdade questionável. Tido por não livre ou não inequívoco, o tratamento fica
sem base — e a consequência não é só multa: todo insight derivado vira fruto de
tratamento em desconformidade, alcançável pelo art. 18, IV.

### 3.2 Legítimo interesse — art. 7º, IX, com o teste do art. 10

**Exige.** Admite-se o tratamento "*quando necessário para atender aos interesses
legítimos do controlador ou de terceiro, exceto no caso de prevalecerem direitos
e liberdades fundamentais do titular*" (art. 7º, IX). O art. 10 fecha o cerco:
finalidade legítima "*considerada a partir de situações concretas*"; "*somente os
dados pessoais estritamente necessários*" (§ 1º); transparência (§ 2º); relatório
de impacto se a ANPD pedir (§ 3º). O titular pode se opor (art. 18, § 2º).

**Coberto.** Minimização — guarda-se título, resumo e participantes, não a fala
inteira. Transparência — o aviso da §1 serve às duas bases. Oposição —
operacionalmente, o mesmo `revokeConsent`.

**Falta.** O teste em si. Não existe no repositório documento que pondere o
interesse da organização contra os direitos do participante, nem relatório de
impacto da finalidade 7 — e sob esta base ele **é** a base.

**Risco.** A legítima expectativa do art. 10, II é onde quebra. Um funcionário
pode esperar que sua cerimônia interna gere itens de ação; um convidado externo
não tem expectativa alguma de que sua fala seja processada por um LLM de terceiro
— e é para ele que o portão cai em `PENDING`. Legítimo interesse defende bem o
caso interno e mal o externo; consentimento é o inverso.

## 4. O que fica para o parecer

Perguntas fechadas, com consequência em configuração ou texto — nenhuma exige
reescrever arquitetura.

1. **A base legal da finalidade 7 do RoPA é consentimento (art. 7º, I) ou
   legítimo interesse (art. 7º, IX)?** Uma das duas.
2. Se consentimento: **o aviso opt-out da §1 satisfaz o "inequívoca" do art. 5º,
   XII?** Um "não" obriga coleta ativa por participante — escopo novo.
3. Se consentimento: **a cláusula da §2 satisfaz o art. 8º, § 1º e § 4º como está
   redigida?** Sim, ou com que alteração.
4. **`STANDING` é habilitável?** A pergunta que
   [`consentimento-de-gravacao.md`](consentimento-de-gravacao.md) §6 abriu; sem
   um "sim", nenhum tenant o habilita.
5. Se legítimo interesse: **quem redige o teste do art. 10 e o relatório de
   impacto, e até quando?** Não existem hoje.
6. **Qual o prazo de retenção da finalidade 7?** O RoPA §3 a lista como "não
   definida", e o `[prazo]` da §1 e da §2 não se lê em voz alta vazio.
7. **Consentimento colhido de empregado nesta forma é livre?** Um "não" derruba a
   opção 3.1 inteira e obriga a 3.2.

**Donos.** As perguntas 1, 2, 3, 4 e 7 são do responsável jurídico; a 5 e a 6, de
quem ocupa a linha **Dono do SLA** do Cosmos no RACI do
[playbook de vendas](../comercial/playbook-de-vendas.md) §4 — em branco, e
preenchê-la é decisão de quem dirige a empresa.
