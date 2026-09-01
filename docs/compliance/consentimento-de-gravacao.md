# Consentimento de gravação de reunião

**O item de maior alcance do lançamento.** Uma única coisa trava três frentes
registradas em documentos diferentes:

- **Receita** — a integração de reunião é o que destrava o trial da TOTVS. O
  índice de MRR marcava a Phase 0 como o único bloqueador; as sete stories estão
  entregues e o bloqueador que sobrou é este.
- **Governança** — UC-07 é o único caso **Crítico** do inventário do Charter, com
  recomendação de entrar `BLOCKED`.
- **LGPD** — finalidade 7 do RoPA, base legal ausente, titulares sem canal.

Este documento resolve o desenho. A validade jurídica da opção recomendada é a
única parte que não se resolve aqui.

---

## 1. O que o sistema faz hoje

O webhook do provedor dispara `fireflies-transcript-fetch`, que busca a
transcrição, persiste em `MeetingTranscript` e **enfileira o mapeador de IA na
sequência**. O único portão é o status da integração:

```
if (!integration || integration.status !== "ACTIVE") {
  return { skipped: true, reason: "integration not active" };
}
```

Não há verificação de consentimento em nenhum ponto do caminho.

E há um segundo problema, mais silencioso: **a query do provedor busca `id`,
`title` e `summary` — e nada mais.** Nem o Fireflies nem o adaptador do Fathom
capturam participantes. O sistema guarda o que foi dito e nunca quem estava na
sala.

Isso tem duas consequências que se somam. Não dá para escopar consentimento a
quem não se sabe quem é; e não dá para atender um pedido de titular, porque não
há como saber que os dados dele estão ali. A eliminação de LGPD hoje não toca
`MeetingTranscript` — o que é coerente, já que ela não teria como localizar o
titular.

---

## 2. O padrão da casa já existe

Não é preciso inventar mecanismo. O Meridian já resolve consentimento, e o
comentário do próprio código enuncia a regra:

> a porta é o consentimento, e ele é default deny no schema

E, sobre revogação:

> Retirar o opt-in remove as contribuições e recalcula. Sem isto, o
> consentimento retirado não teria efeito no pool — o que é o mesmo que não ter
> consentimento.

Três princípios, já validados neste repositório:

1. **Default deny no schema**, não na aplicação.
2. **O portão fica antes do processamento**, não depois.
3. **Revogar tem efeito material** — remove o que foi derivado, senão não é
   revogação.

O desenho abaixo é a aplicação desses três ao pipeline de reunião.

---

## 3. O conflito real, dito antes da recomendação

A métrica de sucesso da Phase 0 é explícita: *"RTE conclui 1 cerimônia →
insights aparecem automaticamente."*

Um portão de consentimento que exija um clique humano por reunião **quebra
exatamente essa métrica** — e ela é o que se demonstra no trial. Um desenho que
resolva o LGPD destruindo a demonstração não resolveu nada; só mudou de que lado
o problema fica.

Portanto o desenho precisa das duas coisas: default deny para o caso geral, e um
caminho legítimo em que o fluxo automático continue.

---

## 4. Desenho recomendado — consentimento em dois níveis

### Nível 1 · Modo de consentimento da integração

`MeetingIntegration.consentMode`, default `PER_MEETING`:

| Modo | Comportamento |
|---|---|
| `PER_MEETING` | Toda transcrição para em `PENDING`. Alguém libera na tela, sabendo quem estava na sala. Default. |
| `STANDING` | A transcrição é liberada automaticamente, carimbada com a declaração vigente que a autoriza. |

`STANDING` **não é uma caixa de seleção.** Habilitá-lo exige apontar para uma
declaração escrita do tenant, afirmando que o consentimento é obtido no início
de toda cerimônia gravada. É esse artefato que sustenta a base legal — e é
exatamente o tipo de artefato que o Charter gera e versiona.

O dogfooding aqui é literal: a Nebuloz habilita `STANDING` para as próprias
cerimônias apontando para a própria política de IA, gerada pelo próprio Charter.

### Nível 2 · Estado por transcrição

`MeetingTranscript.consentState`, default `PENDING`:

```
PENDING → GRANTED → (REVOKED)
   └────→ DENIED
```

- `consentGrantedBy` e `consentGrantedAt` — quem liberou e quando. Sob
  `STANDING`, o "quem" é a declaração, não uma pessoa: auditável e revogável do
  mesmo jeito.
- O mapeador de IA só é enfileirado com `GRANTED`. O portão fica **antes** de
  qualquer conteúdo chegar a um provedor de LLM, que é o ponto do exercício.

### Nível 3 · Revogar com efeito

Revogar apaga os `MeetingInsight` derivados e zera `rawSummary`, preservando a
linha de `MeetingTranscript` como registro de que a reunião existiu e foi
revogada. Sem isso, pelo critério que o próprio Meridian escreveu, não é
revogação.

### Participantes — campos confirmados em 2026-09-01

Registrar quem estava na sala é **pré-requisito de atender pedido de titular**,
e hoje não existe. Entra como `MeetingParticipant` vinculado à transcrição.

A dúvida que este documento carregava — se o provedor expõe participantes e sob
que campo — está resolvida. A documentação do Fireflies descreve, no tipo
`Transcript`:

| Campo | Tipo | O que traz |
|---|---|---|
| `participants` | `[String]` | E-mails de participantes e convidados, **incluindo quem não tem conta Fireflies** |
| `fireflies_users` | `[String]` | Apenas os participantes que têm conta |
| `workspace_users` | `[String]` | Apenas os do workspace |
| `meeting_attendees` | `[MeetingAttendee]` | `displayName` e `email` |
| `meeting_attendance` | `[MeetingAttendance]` | Quando cada um entrou e saiu |
| `organizer_email` | `String` | Quem organizou |

A query atual (`TRANSCRIPT_QUERY` em `fireflies-normalize.ts`) pede `id`,
`title` e `summary`. Nenhum destes.

**Isso muda o desenho, e para melhor.** `participants` menos `workspace_users`
identifica o convidado externo **sem depender de um campo de domínio no
`Tenant`** — que era exatamente o motivo pelo qual a §4 original descartou
detecção automática de participante externo.

Com isso, `STANDING` deixa de ser tudo-ou-nada:

> **`STANDING` libera automaticamente apenas reuniões sem participante externo.
> Havendo qualquer convidado de fora do workspace, a transcrição cai em
> `PENDING`, independentemente do modo.**

É materialmente mais seguro e não custa a demonstração: a cerimônia interna de
um RTE — o caso do trial — não tem convidado externo, e continua fluindo
sozinha. O que passa a exigir decisão humana é exatamente o caso que motivou
todo este documento.

Duas ressalvas que permanecem:

- **É mais dado pessoal do que se guarda hoje.** Só se justifica dentro deste
  desenho — como o registro que torna o consentimento escopável e o direito do
  titular exercível. Guardar participante sem o portão seria piorar o problema.
- **A lista de participantes é do provedor, não da sala.** Quem entrou por link
  sem estar no convite pode não aparecer. A detecção reduz o risco; não o zera,
  e a afirmação humana continua sendo o que sustenta o consentimento.

Isso obriga a atualizar a finalidade 7 do RoPA — o que é bom sinal: significa
que o tratamento passou a ser descritível.

---

## 5. Por que não as alternativas

**Bloquear a integração inteira até haver processo jurídico.** É o mais seguro e
o mais caro: mata a demonstração que destrava o trial. O default deny por
transcrição dá a mesma proteção sem desligar o produto.

**Confiar no aviso do provedor.** O Fireflies anuncia a gravação, e isso é
argumento de que houve ciência — não de que houve consentimento para
processamento por IA de terceiro, que é o tratamento em questão. Não sustenta a
finalidade 7.

**Consentimento só no nível da integração, sem estado por transcrição.** É uma
declaração genérica sem rastro por reunião. Não permite revogar uma reunião
específica nem responder "esta gravação tinha base?" — que é a pergunta que um
titular faz.

---

## 6. A decisão que não é minha

**`STANDING` é juridicamente válido?** Ou seja: um aviso verbal no início de uma
cerimônia, apoiado numa declaração escrita do tenant, constitui base legal para
processar por IA a fala de um participante externo?

Não sou o responsável jurídico da empresa e não emito parecer. O que o desenho
garante é que a resposta é **uma configuração, não uma arquitetura**:

- Se `STANDING` for aceito, o fluxo automático do trial funciona.
- Se não for, `PER_MEETING` continua sendo o default e nada precisa ser
  reescrito — só não se habilita o outro modo.

É por isso que vale implementar o portão antes da resposta chegar: ele é correto
sob as duas.

Junto disso, e sem depender dele:

- **Nomear a base legal** da finalidade 7 no RoPA.
- **Texto do aviso** lido no início da cerimônia, quando houver `STANDING`.
- **Canal para o participante externo**, que não é usuário da plataforma — mesmo
  problema, e mesma solução, do respondente do Meridian: se a Nebuloz é
  operadora, o pedido vai ao cliente, e o que muda é o DPA.

---

## 7. Ordem de implementação

1. `consentMode` na integração e `consentState` na transcrição, ambos default
   deny, com a migration.
2. Portão no `fireflies-transcript-fetch`: só enfileira o mapeador com
   `GRANTED`. Mesmo portão no caminho do Fathom.
3. Ações de liberar, negar e revogar, com auditoria — no padrão de
   `logAudit` já usado em toda mutação.
4. Revogação apagando insights e zerando `rawSummary`.
5. Tela: fila de transcrições em `PENDING`, com quem estava na sala à vista de
   quem vai liberar.
6. `MeetingParticipant` — campos do provedor confirmados, ver §4. Inclui
   estender a `TRANSCRIPT_QUERY`, que hoje não pede nenhum deles, e marcar quem
   é externo por `participants` menos `workspace_users`.
7. **`STANDING` ciente de participante externo** — só libera sozinho reunião
   sem convidado de fora. Depende do 6, e é o que torna `STANDING` defensável.
8. Estender a eliminação de LGPD a `MeetingTranscript` e `MeetingParticipant`.
   Hoje o expurgo de titular não os alcança, o que é coerente enquanto não se
   sabe quem estava na sala — e deixa de ser assim que o 6 entrar.
9. Atualizar a finalidade 7 do RoPA e o UC-07 no Charter — o caso sai de
   `BLOCKED` para `RESTRICTED`, com as condições sendo estes controles.

Os passos 1 a 4 são o que efetivamente destrava, e estão entregues. O 5 é
usabilidade. O 6 é pré-requisito de DSR e habilita o 7. O 8 é a consequência
que o 6 cria: **registrar participante sem estender a eliminação seria guardar
dado pessoal novo sem caminho de apagar** — trocar um problema por outro. O 9 é
o que faz os três documentos pararem de discordar.
