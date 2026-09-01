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
- **Prazos e canal** — 15 dias úteis, `privacy@nebuloz.com`, seis direitos
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
| 5 | Diagnóstico de maturidade | **nome, e-mail e cargo de respondente** | **Terceiro sem conta** | A definir — ver §4 | **Não definida** |
| 6 | Governança de IA | nome livre de dono de caso, aceites | Usuário e terceiro nomeado | Execução de contrato | Duração do contrato |
| 7 | Inteligência de reunião | **fala transcrita e resumo** | **Participante, inclusive externo** | **Consentimento — não coletado hoje** | **Não definida** |
| 8 | Copiloto e geração por IA | conteúdo de conversa, dado de contexto do tenant | Usuário | Execução de contrato | Duração do contrato |
| 9 | Operação comercial | nome e e-mail de contato do prospect | Contato em organização-alvo | Legítimo interesse — prospecção | **Não definida** |
| 10 | Gestão de pessoal | nome e custo de colaborador | Colaborador | Execução de contrato de trabalho | Vínculo + prazo legal |

As cinco retenções não definidas são decisão pendente, não omissão deste
documento: nenhuma delas tem prazo em código nem na policy.

---

## 4. Titulares que não têm por onde pedir

A action de DSR exige sessão autenticada. Duas categorias de titular aparecem no
banco sem nunca terem tido conta:

**Respondentes do Meridian.** `MeridianRespondent` guarda nome, e-mail e cargo
de pessoas convidadas a responder a bateria por link com token. São terceiros em
relação à Nebuloz e, na maior parte dos casos, funcionários do cliente. Não têm
login, não aparecem em `/settings`, e o canal que resta é
`privacy@nebuloz.com` — que funciona, mas não está dito em lugar nenhum que eles
leiam.

O enquadramento correto depende de uma decisão que ainda não foi tomada: **a
Nebuloz é operadora do cliente para esse dado, ou controladora?** Se operadora —
que é o enquadramento coerente com o produto — a base legal é a do cliente, o
pedido do titular vai para ele, e o que a Nebuloz precisa é do DPA que a
descreva como operadora. Isso muda o texto do contrato, não o código.

**Participantes de reunião.** `MeetingTranscript.rawSummary` guarda resumo e
itens de ação derivados de fala. Quem falou numa cerimônia com convidado externo
tem dado tratado sem ter relação com a Nebuloz nem, provavelmente, ciência dela.
É o mesmo ponto que travou UC-07 no Charter, visto do outro lado: lá era risco
de governança, aqui é base legal ausente.

---

## 5. Cobertura da eliminação

`processErasureRequest` anonimiza três tabelas: `User`, `StandupEntry` e
`CopilotMessage`. Dado pessoal vive em mais que isso.

| Tabela | Dado | Coberto |
|---|---|---|
| `User` | e-mail, nome | sim |
| `StandupEntry` | texto livre | sim |
| `CopilotMessage` | conteúdo de conversa | sim |
| `AccessLog` | e-mail, IP, user-agent | não |
| `AuditLog` | IP, user-agent, `targetUserId` | não — e provavelmente **não deve ser**, por imutabilidade (ADR-0009) |
| `MeridianRespondent` | nome, e-mail, cargo | não |
| `MeetingTranscript` | fala transcrita | não |
| `CharterUseCase.ownerName` | nome livre | não |
| `Proposal` | `clienteNome`, `contatoEmail` | não |
| `StaffPerson` | dado de colaborador | não |
| `TeamMember` | nome, avatar | não |

Nem toda linha "não" é defeito. `AuditLog` é imutável por decisão registrada, e
retenção de trilha sob legítimo interesse é exceção prevista no próprio Art. 18.
O que **é** defeito é a diferença não estar documentada: hoje um pedido de
eliminação é respondido como completo quando oito lugares continuam com o dado.

Mínimo para fechar o buraco sem virar projeto: estender a eliminação a
`AccessLog`, `MeridianRespondent` e `MeetingTranscript` — os três onde o dado é
identificável e não há base para retê-lo — e **documentar as exceções restantes
com a base que as sustenta**. Documentar é metade do trabalho e vale mais que a
outra metade numa auditoria.

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
- **Encarregado nomeado**, com o nome publicado junto ao canal.

---

## 7. Ordem sugerida

1. Corrigir as quatro contradições da §2. É reescrita de documento, resolve em
   horas, e é o que transforma a policy de passivo em ativo.
2. Decidir operadora × controladora para o dado de respondente (§4). Trava o
   DPA-modelo e o texto do contrato.
3. Fechar as cinco retenções da §3.
4. Estender a eliminação às três tabelas da §5 e documentar as exceções.
5. Publicar `/legal/privacy` e nomear o encarregado.

Os passos 1, 2 e 5 não dependem de engenharia. O 4 é o único com código, e é o
menor deles.
