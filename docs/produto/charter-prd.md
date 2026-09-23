# Charter — Product Requirements Document

> **PRODUCT** Charter · **STAGE** Produto (cliente) · **STATUS** Draft for review
> **VERSION** 1.0 · **OWNER** Product, Nebuloz
> **COMPANION** [Charter SRD v1.0](./charter-srd.md)

GOVERNAR, transversal às quatro fases: o Charter responde "É permitido? Sob
qual risco?" antes do uso de IA e guarda a prova da resposta no mesmo registro.

---

## 1. Problema

A empresa já usa IA com dado próprio, quase sempre sem regra escrita, e "posso
usar?" vira "espera". Quando cliente, auditor ou RFP pede prova, a resposta sai
de semanas de planilha alimentada por memória
(`docs/superpowers/specs/2026-08-05-charter-conformidade-design.md:23-26`). O
mercado vende sistema de registro — OneTrust, Credo AI, Holistic AI,
watsonx.governance — e deixa a prova com o cliente (mesma spec, :11-14).

> **POR QUE ISSO TRAVA A ADOÇÃO**
> A ausência de política já é uma política, e hoje ela diz "espera"
> (`docs/comercial/playbook-de-vendas.md:72`). O valor não é guardar documento:
> é a regra, a decisão e a evidência lerem o mesmo registro, na mesma transação.

### Evidência

- A validação partiu de uma RFP que se declara genérica: molde de exigência,
  "não prova de negócio assinado" (spec de conformidade, :47-48).
- O comprador qualificado "já respondeu questionário de IA de algum cliente"
  (`docs/comercial/icp-e-precificacao.md:178`).
- Em 15/09, a crítica de design achou um P0: o primeiro cliente não fechava o
  fluxo central (`.claude/completions/2026-09-15-charter-fluxo-primeiro-cliente.md:6-9`).
- O repo não tem cliente pagante, dado de uso, depoimento nem benchmark
  (`docs/comercial/insumos-de-posicionamento.md:22-25`). A produção confirma:
  `CHARTER` está `ACTIVE` em 6 tenants e `TRIAL` em 1, todos internos ou de teste,
  e os 9 casos de uso são do tenant `nebuloz`, o dogfood (banco de produção,
  consulta de 2026-09-22).

---

## 2. Usuários

Assina o Head de Compliance ou de Riscos, e o CIO co-assina. A verba é de
compliance e recorrente; o comprador é regulado ou vende para regulado
(`docs/comercial/icp-e-precificacao.md:173-179`). Opera primeiro o Compliance
Lead, e "quem chega não é jurista"
(`docs/superpowers/specs/2026-08-22-charter-geracao-politica-design.md:6-7`).

| PAPEL | TRABALHO A FAZER | SUCESSO É |
|---|---|---|
| Compliance Lead (`COMPLIANCE`) | Publicar política, decidir caso, exportar evidência, distribuir papéis | Responder ao auditor com o export, sem montar planilha |
| CISO (`SECURITY`) | Avaliar risco técnico, aprovar fornecedor, verificar retenção | Teto de cada fornecedor derivado do contrato, com o motivo à vista |
| Legal (`LEGAL`) | Editar política, gerir cláusula, decidir caso | Cláusula ausente vira teto menor, sem reunião |
| People Ops (`HR`) | Publicar trilha, cobrar aceite, medir cobertura | Cobertura por versão da política |
| AI Program Lead (`REQUESTER`) | Submeter caso, acompanhar SLA, tocar mitigação | Saber o caminho e o prazo antes de submeter |
| Executivo (`EXEC`) | Ler e exportar | Ver exposição sem pedir relatório |
| Auditor (`AUDITOR`) | Leitura forense e export | Trilha que não muda depois do fato |

O papel de governança é ortogonal ao papel SAFe, e o admin do tenant não herda
permissão de governança (ADR-0002). Nome de pessoa no SRD & Data Model do
Charter (projeto de design, ago/2026) é fixture de demo (ADR-0004).

**Preço de catálogo.** R$ 1.800 por mês e tenant, sobre o plano por assento e
mês (Starter R$ 89, Scale R$ 149, Enterprise R$ 219), com SV-03 AI Governance
Setup a R$ 56.000 e SV-07 AI Literacy Program a R$ 38.000
(`packages/database/scripts/2026-08-comercial.sql:70-72`, `:93`;
`2026-09-catalogo-nebuloz.sql:27-29`, `:39-41`). `PrecoDeModulo` tem os mesmos
R$ 1.800 em produção (banco de produção, consulta de 2026-09-22).

---

## 3. Objetivos e não-objetivos

### Objetivos

| OBJETIVO | MEDIDA |
|---|---|
| Regra escrita antes do uso | Versão publicada; seções em `PUBLISHED` sobre nove |
| Decidir por regra conhecida | Caso com caminho congelado na submissão; decisão com justificativa |
| Barrar fornecedor inadequado antes | Recusas do gate sobre tentativas de submissão |
| Política comunicada, não só publicada | Aceites da versão vigente sobre atribuídos |
| Prova tirada do registro | Exigência com veredito que aponta capacidade; export reproduzível |
| Não afirmar sem lastro | Nenhuma tela afirma risco, prazo ou conformidade sem o fato que sustenta |

Nenhuma medida é coletada hoje: não há analytics nem trace no código do Charter.

### Não-objetivos

- **Não impede uso em runtime.** Registra; não fica no caminho da chamada de IA (spec de conformidade, :59-76).
- **Não afirma conformidade.** Anexa a prova que existe; o veredito é de uma pessoa (`apps/app/components/charter/screens/compliance.tsx:7-9`).
- **Não publica sozinho nem gera cláusula.** O rascunho nasce `DRAFT`; cláusula gerada sem advogado é passivo (spec de geração, :55-57, :142-146).
- **Não responde RFP sozinho.** Portfólio e ROI são do [Cosmos](./cosmos-prd.md).
- **Não é o registro de modelo da Nebuloz.** Esse é o [LAB](./lab-prd.md).
- **Não contrata módulo.** Hoje isso é do [Back-office](./backoffice-prd.md); ver §8.

---

## 4. As telas

Onze telas atrás de `/charter/[[...seg]]` e um portão, `/charter-indisponivel`,
em produção (`docs/superpowers/plans/INDEX-MESTRE.md:41`). Tenant e login são os do Cosmos; shell e navegação são próprios.

| ÁREA | TELAS | O QUE RESOLVE |
|---|---|---|
| Governança | Visão Geral · Políticas · Casos de Uso e detalhe | O que vence primeiro, a política vigente e cada uso de IA com caminho e decisão |
| Risco | Matriz de Risco · Fornecedores e detalhe | Exposição por categoria, mitigação com dono, teto de cada fornecedor |
| Pessoas | Onboarding | Trilha presa a uma versão publicada e aceite pendente |
| Evidência | Histórico de Auditoria · Mapa de Conformidade | Trilha filtrável, pacote CSV/JSON, exigência → capacidade que prova |
| Configurações | Configurações | Perfil, papéis, matriz em leitura, gatilhos |
| Intake (modal) | — | "A tela mais importante do produto" no SRD & Data Model: caminho, SLA e HITL ao vivo, fornecedor barrado antes |

> **RESTRIÇÃO DURA**
> Na dúvida, não afirmar (`docs/superpowers/specs/2026-08-06-charter-onboarding-design.md:160`).
> Toda negativa diz o motivo e o papel que resolve. Cor nunca carrega estado
> sozinha: a UI escreve "vencido". Botão sem backend não entra (ADR-0011).

---

## 5. Requisitos

Estado na `main` em `ea512044` (2026-09-22): **implementado**, **parcial** ou
**ausente**. FR-1 a FR-12 vêm do SRD & Data Model do Charter, onde todo "deve" é
obrigatório; FR-13 a FR-15 nasceram em spec e ADR do repo. Onde os dois divergem,
a célula traz as duas versões, e vale o código. Prefixos: `A/` =
`apps/app/app/(charter)/actions/`, `C/` = `apps/app/components/charter/`, `L/` =
`apps/app/lib/charter/`, `P/` = `packages/provisioning/src/`.

| ID | REQUISITO | ESTADO | O QUE FALTA OU DIVERGE · EVIDÊNCIA |
|---|---|---|---|
| FR-1 | Visão Geral: 4 KPIs, alertas por severidade com destino, distribuição por classe e status, saúde da política | parcial | O SRD & Data Model pede casos em revisão, fora de SLA, mitigações abertas e cobertura; o código mostra casos aguardando decisão, casos de alto risco, aceite e fornecedores em revisão (`C/screens/dashboard.tsx:280-310`). A distribuição virou exposição por categoria. O alerta "Atribuir revisor" não tem atribuição: `reviewerId` só nasce na decisão (`A/dashboard.ts:239-253`, `A/cases.ts:582`) |
| FR-2 | Políticas: nove seções, edição rebaixa para revisão, publicação barrada por nome, resumo e versão, aceites invalidados, diff, rascunho por IA | implementado | Abas no código: Seções, Histórico de versões e Prontidão, com o escopo em painel (`C/screens/policy.tsx:231-241`). Diff por linha desde #236 (`L/diff.ts`). `changeCount` grava o total de seções, não as alteradas (`A/policy.ts:365`) |
| FR-3 | Casos de uso: inventário, filtros, SLA consumido com "vencido", linha navegável, CTA de intake | implementado | `A/cases.ts:159-214`, `C/screens/cases.tsx:279-401`. Sem paginação (NFR-3 no SRD) |
| FR-4 | Intake: avalia ao vivo, mostra a regra, barra fornecedor inelegível, notifica revisores | parcial | Cálculo e gate ok (`L/rules.ts:80-183`, `A/cases.ts:320-341`); o fornecedor é obrigatório na submissão. Notificação ausente (ADR-0011). O intake não pede perfil de risco |
| FR-5 | Detalhe do caso: perfil de risco 7×(1–5) com heatmap, restrição, bloqueio ou ajuste por status, mitigações, decisão, trilha | implementado | A tela renderiza tudo (`C/screens/case-detail.tsx`; aba Risco em `C/screens/case-risk.tsx`). A reavaliação (`C/modals/rescore.tsx`) pontua os sete eixos por `rescoreCase`, com justificativa e trilha. Caso que ninguém pontuou diz "sem pontuação", não score 1 "Baixo" (`L/rules.ts`, `caseRisk`). O intake não pede risco: a pontuação é da revisão |
| FR-6 | Decisão: quatro desfechos, justificativa sempre, ≥ 1 condição, ajuste volta ao requester, bloqueio sai do SLA, notifica | parcial | Regras ok (`A/cases.ts:504-628`); bloquear zera o SLA (:585). O requester não reenvia depois do ajuste (ADR-0005:60-63). Sem notificação e sem pendência de aceite das condições (ADR-0011:39-46) |
| FR-7 | Matriz de risco: heatmap clicável, 7 categorias com tom fixo, atrasadas primeiro, criar mitigação | parcial | Tela ok (`C/parts.tsx:143-185`, `A/risk.ts`). Caso sem pontuação fica fora do heatmap e da exposição por categoria e aparece nomeado sob o mapa, com o caminho para pontuar (`C/screens/risk.tsx`). Dono e prazo são obrigatórios só no formulário (`C/modals/mitigation.tsx:50-53`; `A/risk.ts:199-201`) |
| FR-8 | Fornecedores: tier, região, DPA, retenção, subprocessadores, teto, casos; score 0–100; cadastro; tier com justificativa reavalia todos os casos | parcial | Cadastro e tier ok (`A/vendors.ts:211-398`). O score não tem regra nos docs nem escrita que o calcule: a coluna guarda o default 50 (`packages/database/prisma/schema/charter.prisma:282`), e o detalhe mostra "sem medição" (`C/screens/vendor-detail.tsx:241-247`). DPA, retenção e região não se editam no Charter depois do cadastro |
| FR-9 | Detalhe do fornecedor: postura, teto derivado com raciocínio, cláusulas recalculam, casos com aviso, biblioteca | parcial | Derivação ok (`P/charter-rules.ts:37-82`). Biblioteca vazia em tenant provisionado: o bootstrap não cria `CharterClause` (`P/charter.ts:67-158`); só o seed de demo cria (`apps/app/scripts/seed-charter.ts:1177`). Sem CL-01, o teto para em Público |
| FR-10 | Onboarding: trilhas, cobertura, pendentes por atraso, publicação presa à versão, reatribuição ao publicar | parcial | Leitura e publicação ok (`A/onboarding.ts:49-237`). Nada limpa `needsReassignment` nem reatribui. Todo aceite é registrado por terceiro, com justificativa (`A/onboarding.ts:255-285`), e não troca `policyVersionId` quando a versão muda (`A/policy.ts:410-413`) |
| FR-11 | Auditoria: entradas com diff, filtros, append-only, pacote CSV/JSON que grava a si mesmo | parcial | Trilha e pacote ok (`A/audit.ts:160-217`, ADR-0009). O filtro por ator roda em memória depois do teto de 200 linhas (`A/audit.ts:44`, `:92-95`) |
| FR-12 | Configurações: workspace, matriz em leitura, 8 gatilhos, auditoria de mudança de papel | parcial | A matriz tem 12 permissões, não 10. Os gatilhos persistem sem efeito (ADR-0011). Mudança de papel audita (`A/settings.ts:326-413`) |
| FR-13 | Mapa de conformidade: conjuntos de RFP e regulação, veredito que aponta capacidade viva, vigência dupla, export CSV/JSON/PDF | implementado | `A/compliance.ts`, `L/capabilities.ts`, `L/vigencia.ts`, `A/compliance-export.ts`. Cinco corpora globais, 87 exigências (`packages/database/scripts/regulacao-corpora.ts`) |
| FR-14 | Montagem guiada: passos lidos do banco, com motivo e bloqueio | implementado | Seis passos no código, cinco na spec (`A/setup.ts:153-231`) |
| FR-15 | Contratação e bootstrap: módulo por tenant, portão explicativo, política inicial em nove seções | parcial | `TenantModule` (ADR-0001), `P/charter.ts:67-158`. O portão só oferece "Voltar ao Cosmos" (`apps/app/app/charter-indisponivel/page.tsx:106-122`). O app-switcher quebra com MERIDIAN ou SCAFFOLD contratado (`C/shell.tsx:35-59`, `:513-519`) |

### Promessa × código

O que o texto promete e o código não faz. Vale o código.

- **Site:** quatro "artefatos gerados" (`packages/internationalization/dictionaries/pt.json:377-383`); só a política tem rascunho gerado, a matriz deriva dos casos, a cláusula é biblioteca fixa e o guia não existe (spec de geração, :147).
- **Intake:** "Via rápida — aprovação automática com registro" é rótulo; todo caso vai para `SUBMITTED` e espera decisão (`L/rules.ts:127`, `A/cases.ts:392`).
- **Configurações:** o perfil "alimenta a geração de política e o cálculo de caminho" e não alimenta; retenção e residência não são aplicadas (`C/screens/settings.tsx:186`, `:260-276`).
- **Trilha:** "Exigir quiz e aceite formal" só soma 5 minutos à estimativa; não há quiz no schema (`C/modals/publish-track.tsx:59-65`).
- **Capacidade:** POLICY_ATTESTATION fala em "aceite individual", mas o aceite é sempre registrado por terceiro (`L/capabilities.ts:74-75`).
- **Política vazia:** a tela diz que o seed cria a estrutura; quem cria é o bootstrap (`C/screens/policy.tsx:97`).
- **Pacote:** prometia versão "com diff campo a campo" e levava uma contagem ("Seções alteradas: — → 9", o total sob o rótulo de alteradas). Resolvido na #240 (2026-09-22): o diff das versões de política agora é derivado dos snapshots e vai no pacote (`apps/app/lib/charter/version-diff.ts`, `.claude/completions/2026-09-22-charter-diff-no-pacote.md`).

---

## 6. Critérios de sucesso

- A montagem fecha quando o primeiro caso é decidido: o Charter "deixa de ser documento e vira registro" (spec de onboarding, :54).
- Um tenant provisionado pelo back-office decide um caso Interno sem SQL e sem seed. Hoje não passa (FR-9).
- Nenhum número de risco aparece antes de alguém pontuar. Passa: sem pontuação, as telas dizem "sem pontuação" (FR-5).
- Toda linha "Atende" do mapa aponta capacidade que relê o registro (spec de conformidade, :251).
- Existe um export do Charter da Nebuloz com política publicada, dezoito fornecedores e nove casos decididos (`docs/runbooks/charter-nebuloz.md:273-277`). Os nove casos já estão no tenant `nebuloz` (banco de produção, consulta de 2026-09-22); o repo não registra que foram decididos nem que o export saiu (`INDEX-MESTRE.md:122`).
- SLA estourado não chega por e-mail do auditor. Hoje só vale para quem abre a Visão Geral (ADR-0011:62-64).

Nenhum critério é medido hoje.

---

## 7. Riscos

| RISCO | MITIGAÇÃO |
|---|---|
| Biblioteca de cláusulas vazia: nenhum caso acima de Público passa no gate | Decidir se o bootstrap cria CL-01 a CL-08 (questão 1) |
| Score de fornecedor sem regra: o FR-8 promete 0–100 e o detalhe diz "sem medição" | Definir a regra (questão 10) ou tirar o score do FR-8 |
| Nenhum cliente usa o Charter: os 7 tenants com o módulo são internos ou de teste, e todo caso de produção é do dogfood `nebuloz` (banco de produção, consulta de 2026-09-22) | O dogfood é a única prova de uso; fechar FR-5 e FR-9 antes do primeiro cliente |
| RLS anulada pela conexão superuser (ADR-0012) | Papel `cosmos_app` sem `BYPASSRLS`, antes do segundo cliente (`docs/runbooks/charter-em-producao.md:200`) |
| Promessa pública e texto de tela maiores que o código | Ligar ou remover (§5, Promessa × código) |
| Inventário do cliente vai a LLM de terceiro | `sanitizar()`, rascunho em `DRAFT`, cota de 30 por mês; falta zero-retention confirmado e rastreio (`docs/runbooks/charter-nebuloz.md:235-240`) |
| Nome de pessoa fora da eliminação de titular | Levar `ownerName` e `personName` à eliminação (`docs/compliance/lgpd-ropa-e-lacunas.md:157`) |
| Escada de cláusulas sem aval de Legal e Segurança | Validar antes de ir a cliente (ADR-0003:92-94) |
| SLA vencido sem aviso | Job de varredura e canal de entrega (ADR-0011:71-73) |
| Seed destrutivo com senha conhecida | Nunca em produção (`docs/runbooks/charter-em-producao.md:128-137`) |

---

## 8. Dependências

| DEPENDE DE | NATUREZA |
|---|---|
| Back-office | Contrata o módulo, roda o bootstrap, mostra prontidão; exporta fornecedores ao tenant `nebuloz` |
| `@repo/provisioning` | `provisionTenant`, `bootstrapCharter` e a derivação do teto |
| `@repo/auth` · `@repo/rbac` | Sessão multi-tenant; matriz do Charter, papel e módulo contratado |
| `@repo/database` | 18 modelos do Charter, `withTenantDb` e `AuditLog` |
| `@repo/ai` | LLM do rascunho: Anthropic, Google ou OpenAI, pela primeira chave presente |
| `@repo/design-system/cosmos` | Kit visual reusado sem cópia (ADR-0010) |
| Upstash · BrasilAPI | Cache de papel e módulo, cota de geração; feriados nacionais do SLA |
| Scaffold | Lê a política publicada no gate SG-05 da Fase 3 |

### Fronteiras no Mapa de fronteiras

O [Mapa de fronteiras](./mapa-de-fronteiras.md) (Arquitetura de produto,
ago/2026 v1) é o alvo normativo: o Charter é GOVERNAR, transversal, dono de
quatro entidades; consumidor lê ou anexa, nunca edita. Onde o código não chega lá, é gap.

| ENTIDADE | NO MAPA | GAP NA MAIN | O QUE TERIA DE MUDAR |
|---|---|---|---|
| Tenant / cliente | Charter é o único emissor de `tenant_id`; todos leem | `provisionTenant` (`P/tenant.ts:53-63`) cria o tenant, chamado pelo back-office e pelo onboarding do app; o back-office escreve `TenantModule` | Emissão de tenant e contrato sob o Charter; back-office e onboarding viram chamadores |
| Usuário, papel, permissão | Um modelo, do Charter; persona de produto é lente | Cinco modelos com matriz própria em `packages/rbac` (SAFe, Charter, Meridian, Scaffold, Signal); IdP configurado nas telas do Cosmos | Um modelo de papel e permissão sob o Charter; rever ADR-0002 |
| Política e apetite de risco | Cosmos, Signal, Meridian e back-office leem; violação vira evento no Charter | Leem só o Scaffold e o back-office; `posture` não entra em regra; não há evento de violação | Leitura da versão publicada pelos produtos; apetite como entrada de regra; canal de violação |
| Trilha de auditoria | Todos anexam no formato do Charter; registro canônico único | Tabela única da plataforma, mas cada produto e a plataforma escrevem com helper próprio, e há ao menos dois formatos de `diff` (ADR-0009) | Formato de evento definido pelo Charter e adotado por todos os escritores |

Costuras que tocam o Charter: **Todos → Charter · evento de auditoria** (gap
acima); a leitura de iniciativa (Cosmos) e de decisão de valor (Signal), que o
Charter não faz (gap, SRD §6.3); e o gate de política, que o Scaffold consulta no
SG-05. O site mantém a jornada comercial, com o Charter no degrau "Governar"
(`pt.json:298-303`); não é gap.

---

## 9. Questões em aberto

1. **Cláusulas no bootstrap.** CL-01 a CL-08 nascem em todo tenant? Sem elas, nada acima de Público passa no gate.
2. **Pontuação de risco.** Decidido em 2026-09-23: na revisão, pela reavaliação na aba Risco; o intake segue sem pedir risco, e o caso diz "sem pontuação" até alguém pontuar. Em aberto: exigir pontuação antes de decidir?
3. **Promessa pública.** "Política em minutos" e os quatro "artefatos gerados" (`pt.json:375-383`) ficam, ou a copy volta ao código?
4. **Primeiro cliente.** Nenhum dos 7 tenants com o módulo é de cliente (banco de produção, consulta de 2026-09-22). Quando entra o primeiro? O export da Nebuloz já saiu?
5. **ADR-0012.** Quando a aplicação passa a conectar como `cosmos_app`? Antes do segundo cliente?
6. **Aceite.** Pela própria pessoa, com conta, ou por procuração com justificativa? Muda o que POLICY_ATTESTATION prova.
7. **Gaps do Mapa.** Em que ordem o Charter assume tenant, identidade e formato de auditoria? Cada passo move código de plataforma.
8. **Prova de venda.** O playbook promete um caso bloqueado no export (`docs/comercial/playbook-de-vendas.md:106`); o runbook registra o UC-07 como `RESTRICTED` (`docs/runbooks/charter-nebuloz.md:216`). E o V-05 é Neon ou Supabase?
9. **Fora do V1.** Notificação, job de SLA e enforcement seguem fora? Que evidência reabre cada um?
10. **Score do fornecedor.** Que regra calcula o 0–100 do FR-8? Até existir, o detalhe diz "sem medição" e a coluna guarda o default 50.

---

*Draft para revisão interna. Documento companheiro: Charter SRD v1.0.*
