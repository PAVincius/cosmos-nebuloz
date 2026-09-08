# Runbook: Charter na própria Nebuloz

**Onda 0 do lançamento comercial.** A Nebuloz vende governança de IA e não tem a
própria. Este runbook põe o tenant da casa dentro do Charter, com política
publicada, fornecedores classificados e casos de uso decididos — o que vira
anexo de proposta e prova de que o produto funciona em quem o vende.

Diferente de `charter-em-producao.md`, que descreve o provisionamento de um
cliente qualquer, aqui o inventário já está levantado: os fornecedores saem das
dependências reais do monorepo e os casos de uso saem dos dez call sites de LLM
que existem no código.

---

## 0. O que mudou desde o runbook de produção

O levantamento de 2026-07-31 dizia que a política inicial só nascia por SQL ou
seed. **Não é mais verdade.** `bootstrapCharter`
(`packages/provisioning/src/charter.ts`) cria papel `COMPLIANCE`,
`CharterSettings` e a política com as nove seções em `DRAFT`, e há UI para isso
no backoffice. Nada abaixo precisa de SQL.

Continua aberto o **ADR-0012**: a aplicação conecta como `postgres`, que tem
`BYPASSRLS`, então o isolamento vale por filtro de `tenantId` em
`withTenantDb()`, não por RLS. Com a governança da Nebuloz no mesmo banco dos
clientes isso deixa de ser risco teórico. Correção em `app-db-role.md`; merece
janela própria, e não bloqueia este runbook.

---

## 1. Pré-requisitos

| Item | Onde confere |
|---|---|
| `ENCRYPTION_KEY` no projeto da Vercel | sem ela o build morre na validação de env |
| Responsável de compliance já entrou uma vez | `bootstrapCharter` exige `User` existente — falha com `USER_NOT_FOUND` |
| Acesso de staff ao backoffice com permissão de escrita | `requirePlatformStaff` + `assertCanWrite` |

---

## 2. Provisionar o tenant

`/clientes/novo` → nome da organização, e-mail do responsável, módulos.

Marque `CHARTER` **e** `COSMOS`: a Nebuloz também roda o próprio portfólio no
Cosmos (dogfooding do SAFe, pendência de P&D na Onda 2), e contratar depois é um
passo a mais sem ganho.

O tenant nasce com `isSystem = false` — é cliente de si mesma, e precisa ser,
porque `tenantIdBySlug` recusa tenant de sistema no bootstrap.

## 3. Bootstrap do Charter

`/clientes/<slug>` → bloco do Charter → e-mail do responsável de compliance.

Cria em uma tacada: `CharterMembership` com papel `COMPLIANCE`,
`CharterSettings` e `CharterPolicy` com as nove seções em `DRAFT`. Idempotente —
rodar de novo não duplica política.

## 4. Ordem do preenchimento — inverta o painel

O painel de montagem (`getSetupProgress`) lista "escreva as seções" como passo
1. Para a Nebuloz, faça **fornecedores e casos de uso primeiro**:
`generatePolicyDraft` faz grounding no inventário do tenant, e gerar as nove
seções com o inventário vazio produz texto genérico que depois tem de ser
reescrito à mão. Com o inventário carregado, o rascunho já cita fornecedor e
caso pelo nome.

Ordem efetiva: **fornecedores → casos de uso → gerar rascunho → revisar →
publicar → papéis → decidir os casos**.

---

## 5. Inventário de fornecedores

Derivado das dependências reais do monorepo. **Toda coluna contratual está como
"a confirmar" de propósito** — DPA, retenção e subprocessadores são fato de
contrato, não de `package.json`, e inventá-los é exatamente o que a política
existe para impedir. Confirmar antes de cadastrar; o `tier` sugerido pressupõe
a confirmação positiva.

`tier` aceita `APPROVED`, `RESTRICTED`, `REVIEW`, `BLOCKED`. `score` é 0..100 e
**maior = pior**.

### Processam dado de cliente

| Código | Fornecedor | Categoria | Tier sugerido | Observação para o campo `notes` |
|---|---|---|---|---|
| V-01 | Anthropic | Modelo de linguagem | `REVIEW` até DPA confirmado | Provedor padrão do roteador (`packages/ai/lib/router.ts`). Confirmar zero-retention e região. |
| V-02 | OpenAI | Modelo de linguagem | `REVIEW` | Usado em `packages/ai/lib/models.ts` (`gpt-4o-mini`). Confirmar se ainda é caminho ativo ou herança do template. |
| V-03 | Google | Modelo de linguagem | `REVIEW` | Terceira rota do roteador (`gemini-2.0-flash`). |
| V-04 | Langfuse | Observabilidade de LLM | `RESTRICTED` | **Ponto sensível**: `LANGFUSE_CAPTURE_CONTENT` liga o envio de prompt e resposta em claro. Ausente = mascarado. A restrição a registrar é: nunca ligar em ambiente com dado de cliente. |
| V-05 | Neon / PostgreSQL | Banco de dados | `APPROVED` após DPA | Guarda tudo. Anotar ADR-0012 aqui — o isolamento hoje é de aplicação. |
| V-06 | Vercel | Hospedagem e execução | `APPROVED` após DPA | |
| V-07 | Upstash | Cache e rate limit | `APPROVED` após DPA | Guarda lista de módulos por tenant (5 min). |
| V-08 | Sentry | Observabilidade de erro | `RESTRICTED` | Stack trace carrega dado incidental. Confirmar política de scrubbing. |
| V-09 | Liveblocks | Colaboração em tempo real | `REVIEW` | Conteúdo de documento em trânsito. |
| V-10 | Resend | E-mail transacional | `APPROVED` após DPA | |
| V-11 | Fireflies | Transcrição de reunião | `REVIEW` | **Maior risco do inventário.** Transcrição de reunião de cliente entra em LLM por `lib/inngest/fireflies-insights.ts`. Confirmar consentimento de gravação antes de aprovar. |

### Não processam dado de cliente (ou uso a confirmar)

| Código | Fornecedor | Categoria | Nota |
|---|---|---|---|
| V-12 | PostHog | Analytics de produto | Confirmar o que é enviado por evento. |
| V-13 | Arcjet | Segurança de borda | |
| V-14 | Inngest | Execução de jobs | Orquestra V-11 — herda o risco dele. |
| V-15 | Svix | Webhooks | Confirmar se está em uso: três arquivos importam o pacote. |
| V-16 | Knock | Notificações | Um arquivo importa — provável herança do Next Forge. Confirmar antes de cadastrar. |
| V-17 | BaseHub | CMS do site | Quatro arquivos. O site já tirou `/legal` do CMS de propósito. |
| V-18 | Stripe | Pagamentos | Três arquivos. Confirmar se está ativo. |

Fornecedor que não estiver em uso **não entra no inventário**: inventário
inflado é pior que inventário curto, porque a primeira auditoria pergunta por
um contrato que não existe.

---

## 6. Inventário de casos de uso

Os dez call sites de LLM do código, mais o uso de IA no próprio
desenvolvimento. `dataClass` ∈ `PUBLIC` `INTERNAL` `CONFIDENTIAL` `RESTRICTED`;
`exposure` ∈ `INTERNAL` `EXTERNAL`; `criticality` ∈ `LOW` `MEDIUM` `HIGH`;
`hitl` ∈ `FULL_REVIEW` `SAMPLING` `PASSIVE`.

**Você digita as três primeiras colunas. O resto o produto calcula.**
`recommendPath()` deriva caminho de aprovação, SLA e HITL de
`dataClass × exposure × criticality`, e congela os três na submissão — não são
campos de escolha. As colunas derivadas abaixo estão preenchidas só para você
conferir se a classificação produz o rito que faz sentido; se não produzir, o
que se ajusta é a classificação, nunca o resultado.

| Código | Caso | Origem no código | Classe | Exp. | Crit. | → Caminho | SLA | HITL |
|---|---|---|---|---|---|---|---|---|
| UC-01 | Geração de rascunho de política | `(charter)/actions/policy-generate.ts` | CONFIDENTIAL | EXTERNAL | HIGH | Legal + Segurança + Comitê de IA | 10d | FULL_REVIEW |
| UC-02 | Copilot conversacional | `api/copilot/chat/route.ts` | CONFIDENTIAL | EXTERNAL | HIGH | Legal + Segurança + Comitê de IA | 10d | FULL_REVIEW |
| UC-03 | Análise INVEST de épico | `actions/epics/analyze-invest.ts` | CONFIDENTIAL | EXTERNAL | MEDIUM | Segurança + Legal | 5d | FULL_REVIEW |
| UC-04 | Rascunho de hipótese de épico | `actions/epics/draft-hypothesis.ts` | CONFIDENTIAL | EXTERNAL | MEDIUM | Segurança + Legal | 5d | FULL_REVIEW |
| UC-05 | Rebalanceamento WSJF | `actions/wsjf/rebalance.ts` | CONFIDENTIAL | EXTERNAL | MEDIUM | Segurança + Legal | 5d | FULL_REVIEW |
| UC-06 | Narrativa de anomalia de custo | `lib/cost/anomaly-narrative.ts` | CONFIDENTIAL | EXTERNAL | MEDIUM | Segurança + Legal | 5d | FULL_REVIEW |
| UC-07 | Insights de reunião | `lib/inngest/fireflies-insights.ts` | RESTRICTED | EXTERNAL | HIGH | Legal + Segurança + Comitê de IA | 10d | FULL_REVIEW |
| UC-08 | Geração de prompt | `actions/ai-prompt/generate-prompt.ts` | INTERNAL | EXTERNAL | LOW | Segurança | 3d | SAMPLING |
| UC-09 | Desenvolvimento assistido por IA | fora do produto | CONFIDENTIAL | INTERNAL | MEDIUM | Segurança + Legal | 5d | FULL_REVIEW |

Pesos: `PUBLIC` 1, `INTERNAL` 2, `CONFIDENTIAL` 4, `RESTRICTED` 5. Peso ≥ 5, ou
externo combinado com criticidade alta, cai no Comitê.

**Oito dos nove casos caem em `FULL_REVIEW`, e isso é um sinal, não um
resultado.** Revisão integral em tudo vira carimbo, e carimbo não é controle. A
classificação está correta — dado de portfólio, custo e épico de um tenant é
confidencial de fato —, então a saída não é rebaixar classe: é decidir quais
casos ganham mitigação que reduza a criticidade de `HIGH` para `MEDIUM`, e
aceitar que a Nebuloz opera com uma carga de revisão alta enquanto não as tiver.

Notas que importam na hora de classificar:

- **UC-01 e UC-07 são os dois que um auditor abre primeiro.** UC-01 manda o
  inventário de governança do cliente para um LLM de terceiro; UC-07 manda
  transcrição de reunião. Ambos merecem mitigação registrada, não só aprovação.
- **UC-09 é o mais esquecido.** Código-fonte da Nebuloz passa por assistente de
  IA todo dia. Não registrar isso e depois exigir do cliente que registre os
  dele é a contradição que derruba a venda.
- `approvalPath` e `slaTotal` são **congelados na submissão** por
  `recommendPath()`. Mudar a regra depois não reescreve caso em curso — então
  vale acertar a configuração antes de submeter os nove.

### Perfil de risco — sete eixos, impacto e probabilidade

Cada eixo vai de 1 a 5 em duas colunas: `risk*` é impacto, `prob*` é
probabilidade. `riskScore()` toma o **maior** impacto como severidade e a
**média arredondada** como verossimilhança, e multiplica: ≥16 Crítico, ≥9
Elevado, ≥4 Moderado. Fronteira pertence ao nível mais alto — arredondar para
baixo é como um caso escapa do gatilho de aprovação por um ponto.

Valores propostos, no formato `impacto/probabilidade`:

| Caso | Privac. | Regul. | Seg. | Viés | PI | Oper. | Reput. | → Score | Nível |
|---|---|---|---|---|---|---|---|---|---|
| UC-01 | 3/3 | 4/3 | 4/2 | 2/2 | 3/2 | 3/3 | 4/3 | 4 × 3 = 12 | Elevado |
| UC-02 | 3/3 | 3/2 | 4/3 | 3/3 | 3/2 | 3/3 | 4/3 | 4 × 3 = 12 | Elevado |
| UC-03 | 2/2 | 2/1 | 3/2 | 3/3 | 2/2 | 3/3 | 3/2 | 3 × 3 = 9 | Elevado |
| UC-04 | 2/2 | 2/1 | 3/2 | 3/3 | 3/2 | 2/3 | 3/2 | 3 × 3 = 9 | Elevado |
| UC-05 | 2/2 | 2/1 | 3/2 | 4/3 | 2/2 | 4/3 | 3/2 | 4 × 3 = 12 | Elevado |
| UC-06 | 2/2 | 2/1 | 3/2 | 2/2 | 2/1 | 3/3 | 3/2 | 3 × 2 = 6 | Moderado |
| UC-07 | 5/4 | 5/4 | 4/3 | 3/2 | 4/3 | 3/3 | 5/3 | 5 × 4 = 20 | **Crítico** |
| UC-08 | 1/1 | 1/1 | 3/3 | 2/2 | 1/1 | 2/2 | 2/2 | 3 × 2 = 6 | Moderado |
| UC-09 | 2/2 | 2/2 | 4/3 | 2/2 | 5/3 | 3/3 | 3/2 | 5 × 3 = 15 | Elevado |

Onde os números vieram de um julgamento que vale discutir:

- **UC-05 viés 4.** Rebalanceamento de WSJF reordena investimento. Viés aqui
  não erra um texto, move dinheiro de um épico para outro.
- **UC-07 privacidade e regulatório 5.** Transcrição carrega voz e fala de
  pessoa identificada, e de terceiros que estavam na sala sem terem consentido
  com processamento por IA. É o único Crítico do inventário e o único cujo
  impacto não depende de o modelo errar.
- **UC-09 propriedade intelectual 5.** O código-fonte é o ativo da empresa. O
  impacto de vazá-lo é máximo, mesmo com probabilidade baixa — e é por isso que
  a severidade sobe para 5 enquanto o score fica em Elevado, não Crítico.
- **UC-08 segurança 3/3.** É o único caso em que o usuário escreve prompt
  livre. Probabilidade alta, impacto contido.

### Mitigações a registrar junto com a decisão

Caso `RESTRICTED` exige ao menos uma condição; `BLOCKED` exige motivo. Os três
que não devem ser aprovados sem mitigação escrita:

**UC-07 — Insights de reunião.** Este caso mudou de estado. Quando o inventário
foi escrito, o pipeline processava transcrição sem verificação nenhuma, e o
estado correto era `BLOCKED` com motivo. Os controles pedidos aqui foram
implementados — ver
[`compliance/consentimento-de-gravacao.md`](../compliance/consentimento-de-gravacao.md)
e a §7 do
[RoPA](../compliance/lgpd-ropa-e-lacunas.md).

**Estado a registrar agora: `RESTRICTED`**, com estas condições, que são os
controles que passaram a existir:

1. Nenhum conteúdo alcança um provedor de LLM sem consentimento `GRANTED` —
   portão default deny nos três caminhos do pipeline.
2. Liberação exige ato humano com papel de governança, com trilha de auditoria.
3. Liberação automática (`STANDING`) só ocorre em reunião comprovadamente sem
   participante externo; desconhecido cai em revisão humana.
4. Revogar apaga o conteúdo derivado e zera o resumo bruto.
5. A eliminação de titular alcança transcrição e participante.

**O que sustenta a restrição em vez da aprovação**, e é o que o auditor vai
perguntar: os controles garantem que alguém com papel **afirmou** ter obtido o
consentimento — não que ele existiu. A lista de participantes vem do provedor,
não da sala. E o participante externo continua sem canal próprio para exercer
direito, o que depende da decisão operadora × controladora, não de código.

`APPROVED` só quando essas duas frases deixarem de ser verdadeiras.

**UC-01 — Geração de rascunho de política.** O inventário de governança do
cliente vai para um LLM de terceiro. Mitigações: `sanitizar()` já corta em 200
caracteres e remove caractere de controle, e isso é o controle de injeção que
existe hoje — registrar como mitigação, não presumir; rascunho nunca publica
sozinho (`saveGeneratedDraft` grava em `DRAFT`); e o provedor precisa de
zero-retention confirmado, que é a dependência do V-01.

**UC-09 — Desenvolvimento assistido por IA.** Mitigações: proibição de colar
segredo ou dado de cliente real em prompt; varredura de segredo antes do commit;
e revisão humana de toda dependência sugerida por IA antes de entrar no
`package.json`. É a seção que o cliente vai ler para saber se a Nebuloz exige de
si o que exige dele.

---

## 7. Gerar, revisar, publicar

Com o inventário carregado, `/charter/policy` gera o rascunho seção a seção. O
gerador escreve em tom de norma ("A empresa…", "É vedado…"), entre 250 e 400
palavras, e só cita exigência pelo código do corpus — não inventa.

Revisar as nove antes de publicar. Rascunho não é evidência: só versão
publicada pode ser citada em decisão ou auditoria, e `publishTrack` do
Onboarding exige versão publicada.

## 8. Fechar o ciclo

Papéis em `/charter/settings` — pelo menos um segundo papel. Uma pessoa só
submetendo e decidindo reprova na primeira pergunta de auditor.

Depois, decidir os nove casos de uso: aprovar, restringir ou bloquear. Caso
`RESTRICTED` exige ao menos uma condição; `BLOCKED` exige motivo.

Por fim, exportar (`compliance-export.ts`). É esse arquivo que vai anexado à
proposta.

---

## Pronto quando

Existe um export do Charter da Nebuloz, com política publicada, dezoito
fornecedores classificados e nove casos decididos, que pode ser anexado a
qualquer proposta sem edição manual.

## Decisões que não são deste runbook

- Confirmar DPA, retenção e subprocessadores de cada fornecedor — é trabalho
  contratual, e é o gargalo real do item 5.
- Consentimento de gravação (V-11 / UC-07): os controles técnicos existem e o
  caso vai como `RESTRICTED`. O que falta é fora do código — o texto do aviso
  lido na abertura da cerimônia, e o parecer sobre se ele sustenta a base legal.
- ADR-0012: mover a aplicação para `cosmos_app` sem `BYPASSRLS`.
