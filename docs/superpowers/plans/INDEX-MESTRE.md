# Índice mestre — fila única entre os produtos

**Onda 2 do lançamento comercial.** O checklist pede "backlog único priorizado
entre os 4 produtos". O diagnóstico estava quase certo: há três índices, e eles
não se contradizem — **eles cobrem o mesmo produto**.

Este índice fica acima dos três. Não os reescreve e não os substitui: aponta
para eles e responde a pergunta que nenhum responde sozinho — qual é o próximo
trabalho de engenharia da empresa, entre todos os produtos.

---

## 1. O que os três índices são, e o que nenhum é

| Índice | Data | Recorte | Cobertura |
|---|---|---|---|
| [`2026-05-26-INDEX-cosmos-roadmap.md`](2026-05-26-INDEX-cosmos-roadmap.md) | 26/05 | 11 planos T02–T13 em três fases, por diferencial de mercado | Cosmos |
| [`2026-06-09-INDEX-mrr-roadmap.md`](2026-06-09-INDEX-mrr-roadmap.md) | 09/06 | Quatro fases orientadas ao trial TOTVS e ao MRR | Cosmos |
| [`2026-07-19-INDEX-cosmos-full-implementation.md`](2026-07-19-INDEX-cosmos-full-implementation.md) | 19/07 | Seis tiers por tela, contra o design canônico | Cosmos |

Os três são bons e os três são do Cosmos. **Meridian, Charter, Signal e
Scaffold não têm backlog em lugar nenhum** — e três deles já estão em produção
ou vendidos. Não é dispersão de esforço entre produtos, como o checklist supõe;
é o oposto: todo o planejamento formal está num produto só.

---

## 2. São cinco produtos, não quatro

O checklist de lançamento, o mapa de ondas e o ICP em
[`comercial/icp-e-precificacao.md`](../../comercial/icp-e-precificacao.md) falam
de quatro produtos. O site e o catálogo comercial falam de cinco.

`ladder.tsx` na home ordena a suíte assim:

| # | Produto | Papel | Estado |
|---|---|---|---|
| 01 | Meridian | Diagnose | Em produção — spec kit, 27 modelos, rotas no ar |
| 02 | Scaffold | Structure | PRD escrito, sem implementação |
| 03 | **Signal** | **Measure** | **Precificado (R$ 1.200/mês), no site, sem ICP e sem backlog** |
| 04 | Charter | Govern | Em produção — 18 modelos, geração de rascunho, export |
| 05 | Cosmos | Operate | Em produção — o destino, deliberadamente fora da escada |

**O Signal é o buraco.** Está no `PrecoDeModulo`, está na narrativa do site como
o terceiro degrau, e não aparece em nenhum documento da Onda 0 ou 1 — nem ICP,
nem inventário de risco, nem RoPA. Antes de priorizar qualquer coisa aqui,
resolver o que ele é: produto vendável com backlog próprio, ou capacidade do
Cosmos com nome de marca. As duas respostas são legítimas; a ausência de
resposta é que não é.

---

## 3. O bloqueador do MRR mudou de natureza e ninguém anotou

O índice de MRR abre com:

> **Phase 0 é o único blocker para o primeiro trial pago.**

E lista sete stories (046–052) para a integração de reunião — todas marcadas
`✅ done`. O código confirma: `MeetingIntegration`, `MeetingTranscript` e
`MeetingInsight` no schema, `fireflies-transcript.ts`,
`fireflies-normalize.ts`, `fireflies-insights.ts` e `fathom-transcript.ts` em
`lib/inngest/`.

**O bloqueador técnico caiu. O que sobrou no lugar é jurídico**, e está
registrado em dois documentos da Onda 0 sem que nenhum índice o conecte de
volta:

- [`runbooks/charter-nebuloz.md`](../../runbooks/charter-nebuloz.md) — UC-07 é o
  único caso de uso **Crítico** do inventário, e a recomendação é entrar
  `BLOCKED` até haver consentimento de gravação.
- [`compliance/lgpd-ropa-e-lacunas.md`](../../compliance/lgpd-ropa-e-lacunas.md)
  — finalidade 7 do RoPA, base legal ausente, titulares (participantes de
  reunião, inclusive externos) sem canal.

Ou seja: **a mesma funcionalidade que destrava o trial da TOTVS é a que não pode
rodar sem consentimento resolvido.** Um índice que ainda diz "Phase 0 blocker"
manda a engenharia construir o que já está construído, enquanto o que trava não
tem dono.

Corrigir a marcação daqueles índices é parte do trabalho desta onda.

---

## 4. Fila única

Ordenada por o que destrava receita, não por produto. Cada linha aponta para
onde o trabalho está descrito.

### Trava receita agora

| # | Trabalho | Produto | Onde está descrito | Natureza |
|---|---|---|---|---|
| 1 | Consentimento de gravação de reunião | Cosmos · Charter | UC-07 e RoPA §7 | **Jurídico, não engenharia** |
| 2 | Confirmar DPA dos fornecedores | Todos | `charter-nebuloz.md` §5 | Contratual |
| 3 | CAC totalmente carregado | Todos | Onda 1 | Financeiro |
| 4 | Provisionar o Charter da própria Nebuloz | Charter | `charter-nebuloz.md` §2–3 | Operação, minutos |

Nenhum dos quatro é código. É o achado mais importante deste índice: **a fila
que trava a primeira venda não tem uma linha de engenharia.**

### Engenharia, por ordem de retorno

| # | Trabalho | Produto | Onde está descrito |
|---|---|---|---|
| 5 | Promoção de lacuna que aterrissa em `Engagement` | Scaffold | [`produto/scaffold-prd.md`](../../produto/scaffold-prd.md) §7 |
| 6 | Plano de piso zero para cotar diagnóstico avulso | Comercial | [`comercial/icp-e-precificacao.md`](../../comercial/icp-e-precificacao.md) §2 |
| 7 | Estender eliminação LGPD a três tabelas | Plataforma | [`compliance/lgpd-ropa-e-lacunas.md`](../../compliance/lgpd-ropa-e-lacunas.md) §5 |
| 8 | Job de expurgo de tenant em D+30 | Plataforma | RoPA §2.4 — hoje a policy promete e não existe |
| 9 | Role de aplicação sem `BYPASSRLS` | Plataforma | ADR-0012 · [`runbooks/app-db-role.md`](../../runbooks/app-db-role.md) |
| 10 | Tiers 1–5 do Cosmos | Cosmos | `INDEX-cosmos-full-implementation` |

**5 e 6 vêm antes dos tiers do Cosmos** porque cada um destrava uma venda que
hoje não é cotável. O Cosmos é o produto mais maduro da casa; continuar
aprofundando-o enquanto o produto de entrada não é vendável avulso é otimizar o
fim do funil com o começo fechado.

**9 é o mais fácil de adiar e o pior de adiar.** Enquanto a aplicação conectar
como `postgres`, as 106 declarações de RLS do repositório são inertes — a nova
do `Lead` inclusive — e quem isola é o filtro por `tenantId`. Com um cliente é
risco teórico; com dois, não.

### Sem backlog

| Produto | Situação |
|---|---|
| Signal | Nada. Ver §2 — precisa de decisão antes de fila. |
| Meridian | Em produção, sem roadmap pós-V1. |
| Charter | Em produção, sem roadmap pós-V1. |

---

## 5. Como manter isto vivo

Um índice mestre que não é atualizado é pior que três índices desatualizados,
porque promete consolidação. Três regras curtas:

1. **Este arquivo aponta, não descreve.** Trabalho novo é descrito no plano do
   produto; aqui entra uma linha com link.
2. **Marcação de bloqueador tem dono e data.** "Phase 0 é o único blocker" ficou
   verdadeiro por semanas depois de deixar de ser — porque ninguém era
   responsável por desmarcá-lo.
3. **Prioridade se decide entre produtos, não dentro de cada um.** É onde o
   esforço se dispersa hoje, e é a única coisa que este índice faz que os outros
   três não fazem.

## 6. Pendências deste índice

- **Decidir o que é o Signal** (§2). Trava a fila dele e o ICP que falta.
- **Desmarcar a Phase 0** do índice de MRR e registrar o bloqueador jurídico que
  a substituiu (§3).
- **Rodar PI Planning interno com esta fila.** O SAFe que o Cosmos vende vale
  como prova quando aplicado em casa, e mede o lead time da própria squad — que
  é benchmark vendável.
