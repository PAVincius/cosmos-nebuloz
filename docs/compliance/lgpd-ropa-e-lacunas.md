# LGPD — registro de tratamento e lacunas

**Onda 0 do lançamento comercial.** O comprador corporativo brasileiro não pede
SOC 2; pede LGPD. `soc2/policies/05-data-classification-policy.md` já cobre boa
parte do substrato — inventário, retenção, direitos do titular, subprocessadores
— e a maquinaria de atendimento ao titular existe em código. O que falta é o
registro de operações de tratamento (RoPA), a base legal por finalidade, o
DPA-modelo, e a correção de quatro afirmações da policy que o código contradiz.

> Este documento levanta fatos do repositório e propõe enquadramento. **A coluna
> de base legal é proposta para revisão de quem responde juridicamente pela
> Nebuloz, não parecer.** Onde há dúvida, está marcada.

---

## 1. O que já existe

Levantado antes de escrever, e muda a prioridade:

- **Eliminação e portabilidade em produção.** `apps/app/lib/inngest/lgpd-dsr.ts`
  tem `processErasureRequest` (anonimiza em vez de apagar, com hash SHA-256 do
  `subjectId` como substituto estável) e `buildPortabilityExport`. Disparo por
  `apps/app/app/actions/settings/lgpd.ts`, registro em `DataSubjectRequest`
  (`PENDING → IN_PROGRESS → COMPLETED`), auditoria ao final, e suíte em
  `__tests__/compliance/`.
- **Classificação de dados** em quatro níveis, com o Nível 4 já definido como
  dado pessoal sob LGPD/GDPR.
- **Prazos e canal** — 15 dias úteis, `privacy@nebuloz.ai`, seis direitos
  tabelados.
- **Trilha de auditoria** imutável (`AuditLog`, sem UPDATE/DELETE — ADR-0009).

Nada disso precisa ser construído. O que segue é o que falta e o que está errado.

---

## 2. As quatro contradições entre a policy e o código

São verificáveis, e cada uma é do tipo que um auditor testa em vez de acreditar.

### 2.1 A lista de subprocessadores não descreve o sistema

A policy lista Supabase/Railway, Vercel, Upstash, BetterStack, Stripe, PostHog e
Resend. As dependências reais do monorepo apontam Neon, Vercel, Upstash, Sentry,
Resend, Liveblocks, Arcjet e Inngest.

**E nenhum subprocessador de IA aparece.** Anthropic, OpenAI, Google e Langfuse
recebem conteúdo em dez call sites de LLM; Fireflies recebe transcrição de
reunião. Uma empresa que vende governança de IA com a lista de subprocessadores
sem um único provedor de IA é a contradição que derruba a venda antes do preço.

Inventário completo, com o que cada um processa, em
[`runbooks/charter-nebuloz.md`](../runbooks/charter-nebuloz.md) §5.

### 2.2 O "DPA ✅" não está confirmado

A policy marca DPA assinado para os sete subprocessadores que lista. O
levantamento do Charter marcou os dezoito como "a confirmar", porque DPA é fato
de contrato e não se infere de `package.json`. **Os dois documentos do mesmo
repositório se contradizem, e um deles está errado.**

Enquanto a confirmação não vier, a coluna correta é "a confirmar". Afirmação não
verificada numa policy é pior que omissão: a omissão gera pergunta, a afirmação
falsa gera achado.

### 2.3 "Audit logs contêm no personal data except user IDs" — falso

`AuditLog` guarda `ipAddress` e `userAgent` (`system.prisma:81`). `AccessLog`
guarda `email` em claro, mais `ip` e `userAgent`
(`platform-ops.prisma`). Endereço IP é dado pessoal sob LGPD.

A frase precisa cair. O tratamento em si é defensável por legítimo interesse de
segurança — o que não é defensável é a policy dizer que ele não acontece.

### 2.4 O job de eliminação em D+30 não existe

A policy descreve: *"Day 30: Automated deletion job removes all tenant data from
active database"*. Não há função Inngest de expurgo de tenant, nem action de
deleção de tenant no código de produção — só `DELETE FROM "Tenant"` em teardown
de teste. A tela `/aprovacoes` cita "deleção de tenant" como operação sensível,
mas não há ação que a implemente.

**É a lacuna mais cara das quatro**, porque é um controle prometido por escrito
que não roda. Duas saídas honestas: construir o job, ou reescrever a policy para
descrever o procedimento manual que de fato existe. A segunda é legítima e
imediata; a primeira é trabalho de engenharia com escopo próprio.

---

## 3. RoPA — registro de operações de tratamento

Derivado do schema, não de template. Uma linha por finalidade.

| # | Finalidade | Dado pessoal | Titular | Base legal proposta | Retenção |
|---|---|---|---|---|---|
| 1 | Autenticação e gestão de conta | e-mail, nome, imagem, 2FA | Usuário da plataforma | Execução de contrato | Duração da conta + 30 dias |
| 2 | Registro de acesso e tentativa recusada | e-mail, IP, user-agent | Usuário e quem tentou entrar | Legítimo interesse — segurança | **Não definida** |
| 3 | Trilha de auditoria | userId, actorId, IP, user-agent, targetUserId, diff | Usuário | Legítimo interesse + obrigação contratual | 12 meses |
| 4 | Execução de portfólio | nome, avatar, conteúdo de standup | Usuário e membro de time | Execução de contrato | Duração do contrato + 30 dias |
| 5 | Diagnóstico de maturidade | **nome, e-mail e cargo de respondente** | **Terceiro sem conta** | Base do cliente; Nebuloz operadora — decisão do CEO, 2026-09-29 (§9) | **Não definida** (evidência: 90 dias, ver parecer de 2026-09-28) |
| 6 | Governança de IA | nome livre de dono de caso, aceites | Usuário e terceiro nomeado | Execução de contrato | Duração do contrato |
| 7 | Inteligência de reunião | fala transcrita, resumo, **e-mail e nome de participante** | Participante, inclusive externo | Consentimento — **coletado e verificado antes do processamento** (ver §7) | **Não definida** |
| 8 | Copiloto e geração por IA | conteúdo de conversa, dado de contexto do tenant | Usuário | Execução de contrato | Duração do contrato |
| 9 | Operação comercial | nome e e-mail de contato do prospect | Contato em organização-alvo | Legítimo interesse — prospecção | **Não definida** |
| 10 | Gestão de pessoal | nome e custo de colaborador | Colaborador | Execução de contrato de trabalho | Vínculo + prazo legal |

As cinco retenções não definidas são decisão pendente, não omissão deste
documento: nenhuma delas tem prazo em código nem na policy.

### 3.1 Retenção transitória — backup do reset do Meridian

Incluída em 2026-09-29, conforme o parecer `2026-09-29-parecer-reset-meridian-producao.md`
§1. A execução do reset em produção é **relato da Morgana**, não conferida por
Compliance; a linha vale enquanto o schema existir.

> **Backup transitório do reset do Meridian.** Schema `backup_meridian_20260929`, 13
> tabelas do domínio Meridian, todos os tenants. Dado pessoal: nome, e-mail e cargo
> de respondente; conteúdo de respostas e evidências. Finalidade: restaurar em caso
> de apagamento indevido. Base: continuação do tratamento original; art. 6º, VII e
> VIII; art. 7º, IX. Acesso: nenhum papel da API; só o dono do banco. Eliminação:
> `DROP SCHEMA` até 2026-10-29, roteiro em
> `2026-09-29-roteiro-fechamento-backup-reset-meridian.md`. Cópias da plataforma
> (backup diário e PITR do Supabase): persistem pela janela do plano,
> `[preencher: retenção do backup diário e janela de PITR, painel Supabase]`, e não
> são apagáveis por nós antes disso; a data efetiva de eliminação total é
> 2026-10-29 mais essa janela. Pedido de titular dentro da janela: apagar as
> linhas dele no backup ou antecipar o `DROP`, e reaplicar eliminações pedidas
> depois do reset em qualquer restauração. **Ressalva a repetir em resposta a
> titular:** o `AuditLog` retém nome de quem agiu e um identificador do
> diagnóstico; o dado do diagnóstico é eliminado, a trilha não.

---

## 4. Titulares que não têm por onde pedir

A action de DSR exige sessão autenticada. Duas categorias de titular aparecem no
banco sem nunca terem tido conta:

**Respondentes do Meridian.** `MeridianRespondent` guarda nome, e-mail e cargo
de pessoas convidadas a responder a bateria por link com token. São terceiros em
relação à Nebuloz e, na maior parte dos casos, funcionários do cliente. Não têm
login, não aparecem em `/settings`, e o canal que resta é
`privacy@nebuloz.ai` — que funciona, mas não está dito em lugar nenhum que eles
leiam.

O enquadramento correto depende de uma decisão que ainda não foi tomada: **a
Nebuloz é operadora do cliente para esse dado, ou controladora?** Se operadora —
que é o enquadramento coerente com o produto — a base legal é a do cliente, o
pedido do titular vai para ele, e o que a Nebuloz precisa é do DPA que a
descreva como operadora. Isso muda o texto do contrato, não o código.

**Participantes de reunião.** Era a lacuna mais grave deste documento e **foi
fechada em parte** — ver §7. O tratamento agora tem portão de consentimento
default deny antes de qualquer conteúdo alcançar um LLM, os participantes são
registrados, e a eliminação alcança transcrição e participante.

O que **não** foi fechado é o canal: o participante externo continua sem ter
como pedir nada, porque não tem conta e o fluxo de DSR exige sessão. É o mesmo
problema do respondente do Meridian, e tem a mesma solução — **não é código, é o
DPA que descreva a Nebuloz como operadora**, com o pedido do titular indo ao
cliente.

---

## 5. Cobertura da eliminação

`processErasureRequest` alcança sete tabelas. Dado pessoal vive em mais que
isso.

| Tabela | Dado | Coberto |
|---|---|---|
| `User` | e-mail, nome | sim |
| `StandupEntry` | texto livre | sim |
| `CopilotMessage` | conteúdo de conversa | sim |
| `MeetingParticipant` | e-mail, nome | **sim** — casado pelo e-mail do `User` |
| `MeetingTranscript` | fala transcrita | **sim** — `rawSummary` zerado, insight derivado apagado ou redigido |
| `AccessLog` | e-mail, IP, user-agent | **sim** — evento e motivo preservados, identificador anonimizado (§7 abaixo explica por quê) |
| `AuditLog` | IP, user-agent, `targetUserId` | não — e provavelmente **não deve ser**, por imutabilidade (ADR-0009) |
| `MeridianRespondent` | nome, e-mail, cargo | **sim** — `MeridianResponse` preservado, token invalidado |
| `CharterUseCase.ownerName` | nome livre | não |
| `Proposal` | `clienteNome`, `contatoEmail` | não |
| `StaffPerson` | dado de colaborador | não |
| `TeamMember` | nome, avatar | não |

Nem toda linha "não" é defeito. `AuditLog` é imutável por decisão registrada, e
retenção de trilha sob legítimo interesse é exceção prevista no próprio Art. 18.
O que **é** defeito é a diferença não estar documentada.

Das três que este documento apontou como mínimo — `AccessLog`,
`MeridianRespondent` e `MeetingTranscript` — as três estão fechadas agora, junto
com `MeetingParticipant`, que nem existia quando a lista foi escrita.

`AccessLog` não é apagado, é anonimizado: o RoPA classifica esse tratamento como
legítimo interesse de segurança, e o Art. 18 prevê a exceção — a linha
(`evento`, `motivo`, `criadoEm`) fica, só o e-mail/IP/user-agent em claro some.
`MeridianRespondent` também não é apagado — `MeridianResponse` tem
`onDelete: Cascade` a partir dele e alimenta `MeridianAxisScore`, que é
diagnóstico do cliente, não dado do titular — só nome/e-mail somem e o token de
acesso é invalidado. `MeridianEvidence.storagePath` fica de fora: o arquivo vive
no bucket, fora do banco, e apagar o objeto pede uma rotina própria de limpeza
de storage que ainda não existe.

Uma ressalva que a cobertura nova não elimina: `MeetingParticipant` e
`MeridianRespondent` são casados pelo **e-mail do `User`**, então só alcançam
quem também é usuário da plataforma. O externo não tem `User.id` para disparar
o fluxo — está registrado em comentário no próprio `lgpd-dsr.ts`, e é a mesma
lacuna de canal da §4.

---

## 6. O que falta escrever

- **DPA-modelo** para anexar em contrato, com a lista de subprocessadores
  corrigida (§2.1), a Nebuloz como operadora onde couber (§4), e cláusula de
  notificação de incidente em 72 horas, que a policy já promete.
- **Base legal por finalidade** — a policy cita "contract, consent, legitimate
  interest" em bloco, sem mapear. A tabela da §3 é o rascunho desse mapa.
- **Política de retenção** para as cinco linhas sem prazo, e o procedimento de
  eliminação que de fato existe (§2.4).
- **`/legal/privacy` com o texto real.** A rota é estática e não depende mais do
  CMS — a decisão certa já foi tomada. Falta o conteúdo.
- **Encarregado.** *Decisão de 2026-09-30, confirmada pelo CEO:* a Nebuloz
  **não indica encarregado**, com base no art. 11 da Resolução CD/ANPD nº 2/2022
  (agentes de tratamento de pequeno porte não são obrigados a indicá-lo, desde que
  ofereçam canal de comunicação com o titular, aqui `privacy@nebuloz.com`). O CEO
  confirmou em 2026-09-30 que a Nebuloz é microempresa, empresa de pequeno porte
  ou startup, que a receita bruta anual está dentro do limite e que não integra
  grupo econômico acima do limite (declaração do CEO, relatada pela Morgana; sem
  documento no repositório). Reavaliar com mudança de porte ou grupo, volume que
  caracterize larga escala, lançamento de reunião a cliente externo, ou dado
  sensível recorrente em evidência; se a Resolução deixar de permitir, a
  indicação (art. 41 da LGPD) é obrigatória. Detalhe em
  [`2026-09-30-decisoes-provisorias-encarregado-e-c8.md`](2026-09-30-decisoes-provisorias-encarregado-e-c8.md).

---

## 7. Controles da finalidade 7 — inteligência de reunião

Era a finalidade sem base legal deste documento. Os controles existem hoje, e
estão aqui reunidos porque é o que um auditor pede quando a linha da tabela diz
"consentimento".

Desenho completo em
[`consentimento-de-gravacao.md`](consentimento-de-gravacao.md).

| Controle | Onde |
|---|---|
| Consentimento default deny no schema | `MeetingTranscript.consentState` nasce `PENDING` |
| Portão antes de o conteúdo alcançar um LLM | `fireflies-transcript`, `fathom-transcript` e, redundantemente, `fireflies-insights` |
| Liberação exige ato humano com papel | `grantConsent`, restrito a `ADMIN`/`STE`/`RTE`, com trilha de auditoria |
| Liberação automática só sem participante externo | `STANDING` exige `participantsKnown` **e** nenhum externo |
| Desconhecido não é permissão | `participantsKnown` nasce `false`; provedor sem os campos cai em `PENDING` |
| Registro de quem estava na sala | `MeetingParticipant`, externo por `participants` menos `workspace_users` |
| Revogação com efeito | apaga insight derivado e zera `rawSummary`, preservando a linha |
| Eliminação do titular alcança o tratamento | `processErasureRequest`, §5 |

**O que estes controles não fazem**, e precisa estar dito: eles garantem que
alguém com papel afirmou ter obtido o consentimento, não que o consentimento
existiu. A lista de participantes é do provedor, não da sala. E o participante
externo continua sem canal próprio — §4.

## 8. Ordem sugerida

1. Corrigir as quatro contradições da §2. É reescrita de documento, resolve em
   horas, e é o que transforma a policy de passivo em ativo.
2. Decidir operadora × controladora (§4). Trava o DPA-modelo e o texto do
   contrato, e agora vale para **dois** grupos de titular: respondente do
   Meridian e participante externo de reunião.
3. Fechar as cinco retenções da §3 — incluindo a da finalidade 7, que segue sem
   prazo mesmo com os controles da §7 no lugar.
4. Estender a eliminação a `AccessLog` e `MeridianRespondent`, as duas que
   sobraram da §5.
5. Publicar `/legal/privacy` e nomear o encarregado.
6. **Parecer sobre `STANDING`** — se um aviso verbal na abertura da cerimônia,
   apoiado em declaração escrita, sustenta a base legal. Não bloqueia nada: o
   modo continua desabilitado em todo tenant até haver resposta.

Os passos 1, 2, 5 e 6 não dependem de engenharia. O 4 é o único com código, e é
o menor deles.

## 9. Decisões

Fonte: relato da Morgana, 2026-09-29; não vi a resposta original do CEO. Detalhe
em [`operadora-controladora.md`](operadora-controladora.md) §6.

- **2026-09-29 — Decisão do CEO: a Nebuloz é operadora no Meridian** (finalidade
  5, respondente sem conta). Fecha a decisão que a §4 e o passo 2 da §8 deixavam
  aberta para o respondente do Meridian: a base legal é a do cliente, e o pedido
  do titular vai a ele. **Vale só para o Meridian, por ora.** O participante de
  reunião (finalidade 7) fica para decisão separada do CEO (opção C do memo de
  2026-09-29); a finalidade 7 segue sem enquadramento decidido.
- **2026-09-29 — Decisão do CEO: conteúdo de cliente não é usado para
  demonstração, ajuste de prompt ou avaliação de modelo.** Nenhuma linha nova de
  finalidade própria da Nebuloz nasce disso.
- **2026-09-29 — Decisão do CEO: canal público `privacy@nebuloz.com`.** Falta
  confirmar que a caixa existe e é lida.
- **2026-09-29 — Decisão do CEO: `benchmarkOptIn` desligado no primeiro contrato,
  com trava no produto** (`assessments.tsx:211`, Norte e Bussola). A operadora
  vale só com a função desligada: ligada, a Nebuloz é controladora do conjunto
  comparativo e a finalidade 5 ganha uma linha própria, com aviso ao respondente.
  Enquanto a trava não existir, a decisão vale no contrato e não no produto.
- **2026-09-29 — Decisão do CEO: Dono do SLA do repasse = Ordem**, com delegação
  escrita do CEO para o envio (a delegação ainda precisa ser escrita).
- **2026-09-30 — Decisão, confirmada pelo CEO: dispensa de encarregado**, art. 11
  da Resolução CD/ANPD nº 2/2022, com os fatos F1 a F3 confirmados pelo CEO (§6).
  Texto público sem nome de encarregado, com o canal `privacy@nebuloz.com`.
- **2026-09-30 — Decisão provisória (a confirmar pelo CEO): cláusula C8** (instrução
  prévia de eliminação de respondente após 10 dias úteis) adotada no DPA §9.3 e no
  aditivo §4.4, com aviso duplo ao cliente antes de executar.
- **Em aberto com o CEO:** confirmar a cláusula C8.
