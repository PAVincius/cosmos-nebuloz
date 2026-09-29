# Charter — Prontidão para cliente externo

> Auditoria só leitura. Metodologia igual à usada no Meridian
> (`docs/qualidade/gate-maturidade-carga.md`). Base: PRD/SRD do Charter em
> `main` `ea512044` (2026-09-22), com atualização de FR-5/FR-8 em 2026-09-23
> (`0d88a25e`, `38aaf491`) já incorporada aos dois documentos. Checkout desta
> auditoria: `83d39563` (2026-09-27), 127 commits à frente do deploy de
> produção verificado abaixo — nenhum deles muda regra de governança do
> Charter (ver §4).

## Veredito: **NÃO APTO**

Falha os três critérios do gate de maturidade (C1, C2, C3) e tem um
bloqueador funcional que impede o próprio critério de sucesso central do PRD
("tenant provisionado pelo back-office decide um caso Interno sem SQL e sem
seed" — **não passa**, PRD §6 e §5.4). Nenhum dos 7 tenants com o módulo
`CHARTER` é de cliente pagante; os 9 casos de uso em produção são todos do
dogfood interno (`nebuloz`) — PRD §1 e §8, banco de produção consultado em
2026-09-22.

---

## 1. Gate de maturidade (C1/C2/C3)

Já computado e citado em `docs/qualidade/gate-maturidade-carga.md:27` —
reproduzido aqui, não reavaliado do zero:

| Critério | Resultado | Evidência |
|---|---|---|
| C1 — SC formal + E2E verde | ❌ Não cumprido | E2E existe (`charter-intake.spec.ts`, `charter-decision.spec.ts`, `charter-policy-publish.spec.ts`, `charter-default-deny.spec.ts`, `backoffice-charter-provisioning.spec.ts`), mas `charter-prd.md` não tem tabela de Success Criteria (`grep -n "Success Criteria\|## SC" docs/produto/charter-{prd,srd}.md` → 0 ocorrências, confirmado nesta auditoria). Sem SC, não há "contra o quê" medir o verde. |
| C2 — Dogfood sem P0/P1 aberto | Não avaliado (na prática, não cumprido) | Não existe `docs/qualidade/dogfood/charter/` — só o Meridian tem pasta própria. Sem dogfood registrado, não há como confirmar ausência de P0/P1. |
| C3 — Compliance | Não avaliado (na prática, não cumprido) | Charter lida com dado de contato de fornecedor de terceiro (CharterVendor: DPA, região, subprocessadores). `ls docs/compliance/` não tem nenhum arquivo `charter` (confirmado nesta auditoria) — ao contrário do Meridian, que tem parecer dedicado (`2026-09-24-parecer-meridian-respondente.md`). |

### E2E: escritos, não reexecutados para este gate

- 5 specs existem, cobrindo os 5 fluxos prioritários listados no PRD FR-2/FR-4/FR-6 e no portão de módulo.
- Última execução registrada: `.claude/completions/2026-07-30-charter-e2e.md:56` —
  `AUTH_TEST=1 pnpm exec playwright test e2e/charter-*.spec.ts`: **6/6 passou**,
  em 2026-07-30. Arquivos tocados pela última vez em 2026-09-08 (`git log`),
  sem evidência de nova execução desde então.
- Não há workflow de CI que rode e2e automaticamente
  (`.github/workflows/dark-matter.yml` só roda `seed:e2e`, não
  `playwright test`) — a suíte depende de execução manual.
- Outstanding já registrado pelo próprio autor: a11y (axe) nas 10/11 rotas,
  dark e light — nunca entrou (`2026-07-30-charter-e2e.md:63-64`; confirmado
  ainda ausente em `charter-srd.md:294`, NFR-2 "Falta axe nas rotas").

---

## 2. PRD/SRD × código

O PRD e o SRD do Charter já são, eles próprios, uma auditoria linha-a-linha
(FR-1 a FR-15, NFR-1 a NFR-8, todos com estado **implementado/parcial/ausente**
e evidência `arquivo:linha`). Esta seção não repete as ~25 linhas de tabela —
resume o que bloqueia "apto a cliente externo":

| Requisito | Estado | O que falta |
|---|---|---|
| FR-9 / §5.4 (teto do fornecedor) | parcial | **Bootstrap não cria a biblioteca de cláusulas** (`P/charter.ts:67-158`); só o seed de demo cria. Sem `CL-01`, o teto de qualquer fornecedor novo para em `PUBLIC` — nenhum caso acima de Público passa o gate em tenant de cliente real. É o próprio critério de sucesso #2 do PRD, que hoje "não passa". |
| FR-8 (score do fornecedor) | parcial | Coluna com default 50 que nenhuma escrita calcula; tela mostra "sem medição" (`charter.prisma:282`, `vendor-detail.tsx:241-247`). PRD promete 0–100. |
| NFR-1.1 / ADR-0012 (RLS) | parcial | RLS FORCE em 16/18 tabelas, mas a conexão de app usa superuser e anula RLS; isolamento real é só o `tenantId` no `where`. Risco explícito no PRD: "antes do segundo cliente" (`charter-em-producao.md:200`). |
| NFR-1.4 (SSO SAML) | ausente | Config de IdP gravada, mas `@repo/auth` não consome — plataforma inteira, não só Charter. |
| NFR-1.6 (retenção/região) | ausente | Valor gravado e exibido, nada aplica; região não entra no pacote de evidência. |
| §6.2 (notificação, SLA vencido) | ausente | Decisão de escopo em aberto desde ADR-0011 (fora do V1?) — hoje só alerta quem abre a Visão Geral. |
| NFR-8 (LGPD) | ausente | `ownerName`/`personName` fora da eliminação de titular (`lgpd-ropa-e-lacunas.md:157`) — nome de pessoa também vai para o alvo imutável da trilha de auditoria. |
| §5 "Promessa × código" | — | Site promete "política em minutos" e 4 "artefatos gerados"; só a política tem rascunho gerado de fato. Risco comercial/jurídico de over-promise em RFP. |
| Mapa de fronteiras (§8/§6.3) | gap | Charter não é hoje o único emissor de `tenant_id` nem o formato único de `AuditLog` — 4 costuras estruturais em aberto, arquiteturais, não bugs pontuais. |

Nenhuma divergência nova foi encontrada além do que o PRD/SRD já documentam —
esta auditoria confirma que os dois estão correntes (ver §4).

---

## 3. Specs e completions

- **Spec Kit**: Charter **não tem pasta própria em `specs/`** (as 10 pastas
  existentes são de outros produtos/iniciativas — Meridian, Scaffold, Signal,
  login, catálogo, conta). O histórico de implementação do Charter vive só em
  `.claude/completions/` (17 arquivos, 2026-07-30 a 2026-09-23) e nos ADRs
  0001–0012, não em specs formais com tasks rastreáveis.
- **Completions**: nenhuma task explicitamente aberta/pendente nos 17
  arquivos — cada um fecha com "Outstanding" quando havia algo, e o item
  citado (a11y/axe) já está capturado acima. As questões em aberto do próprio
  PRD (§9, 10 itens: cláusulas no bootstrap, score do fornecedor, promessa
  pública, primeiro cliente, ADR-0012, formato de aceite, gaps do mapa, prova
  de venda, notificação/SLA fora do V1, score do fornecedor) são as
  pendências reais — decisões de produto/negócio sem dono nem prazo
  registrado no PRD.

---

## 4. Produção vs. local

- Deploy de produção Vercel (projeto `cosmos-nebuloz-app`, time
  `team_CjCBX0DGD7HIlBL4MRqQmNzS`): commit **`4701a3d4`** (merge do PR #268,
  2026-09-27 17:39, confirmado por `git log -1` no remoto `ground`).
- Checkout local desta auditoria: `83d39563`, 127 commits à frente de
  `4701a3d4` (`git rev-list --left-right --count ground/main...HEAD` → `0 127`
  — nenhum commit exclusivo de `ground/main`, ou seja, local contém tudo que
  está em produção).
- **Diferença em caminhos do Charter entre local e produção: 2 arquivos, 57
  linhas** — `apps/app/components/charter/shell.tsx` (troca de um `Link` por
  `ActiveAccountBadge`, feature transversal de conta ativa, não é regra de
  governança) e um novo e2e (`active-account-badge.spec.ts`) do mesmo
  componente. Nenhuma regra, tela ou action de governança do Charter mudou
  entre o commit-base do PRD/SRD (`ea512044`) e a produção atual.
- **Conclusão**: PRD/SRD (ea512044 + atualização de 2026-09-23) descrevem com
  precisão o que está em produção hoje. Working tree local tem mudanças
  não commitadas em `apps/app/app/(charter)/layout.tsx`,
  `apps/app/app/(charter)/actions/shell.ts` e `components/charter/shell.tsx`
  (snapshot do início desta sessão) — fazem parte da mesma feature
  transversal de conta ativa, não de governança; não afetam este veredito.

---

## 5. O que falta — tabela

| Item | Evidência | Dono sugerido | Tamanho |
|---|---|---|---|
| SC formal no PRD (Success Criteria mensurável, cobrindo a jornada do Compliance Lead) | `gate-maturidade-carga.md:27`; `grep` sem ocorrência em `charter-prd.md` | Norte/Regua (spec) | M |
| Reexecutar os 5 e2e do Charter e registrar data/resultado (evidência fresca para C1) | Última corrida 2026-07-30 (`2026-07-30-charter-e2e.md:56`), sem CI automático | dev | P |
| Bootstrap criar biblioteca de cláusulas (CL-01–08) por tenant | PRD FR-9, §5.4, §9 q.1; `P/charter.ts:67-158` | dev | M |
| Abrir dogfood do Charter (`docs/qualidade/dogfood/charter/`) com P0/P1/P2 rastreados, dono e data | Gate C2; sem pasta hoje | dev + Norte | G |
| Parecer de compliance dedicado (Charter trata dado de fornecedor de terceiro) | Gate C3; `docs/compliance/` sem arquivo `charter` | Lacre | M |
| Regra de cálculo do score de fornecedor (0–100) ou remover a promessa do FR-8 | PRD §9 q.10; `charter.prisma:282` default 50 sem escrita | Norte (decisão) → dev (implementação) | M |
| `cosmos_app` sem `BYPASSRLS` (RLS deixa de ser anulada) | ADR-0012; `charter-em-producao.md:200` — "antes do segundo cliente" | dev/Infra | G (plataforma) |
| Decisão sobre notificação e job de SLA vencido (fica fora do V1 ou entra?) | ADR-0011; PRD §9 q.9 | CEO/Norte | M/G conforme decisão |
| Alinhar promessa pública ("política em minutos", 4 artefatos gerados) ao código, ou implementar o resto | PRD §5 "Promessa × código"; `pt.json:377-383` | CEO/Norte | P |
| `ownerName`/`personName` na eliminação de titular (LGPD) | `lgpd-ropa-e-lacunas.md:157`; SRD NFR-8 | dev | P |
| axe automatizado nas 11 telas, dois temas | SRD NFR-2; `HANDOFF.md:177-178` | dev | M |
| App-switcher quebra com MERIDIAN ou SCAFFOLD contratado junto | PRD FR-15; `C/shell.tsx:35-59,513-519` | dev | P |

---

## Próximas 3 ações, em ordem

1. **Fechar o bootstrap de cláusulas (CL-01–08)** — sem isso, nenhum tenant de
   cliente novo consegue submeter um caso acima de Público; é o critério de
   sucesso central do PRD e o bloqueador mais direto para o primeiro cliente
   real. *Dono: dev.*
2. **Escrever SC formal no PRD e reexecutar os 5 e2e existentes com data** —
   fecha C1 do gate de maturidade; a suíte já existe e já passou uma vez, só
   falta o SC contra o qual medir e uma corrida recente. *Dono: Norte/Regua
   (SC) + dev (rerun).*
3. **Pedir parecer de compliance dedicado ao Charter** — fecha C3; Charter
   move dado de contato de fornecedor de terceiro (DPA, subprocessadores,
   região) sem parecer hoje, ao contrário do Meridian. *Dono: Lacre.*

---

*Auditoria só leitura — nenhum código, schema ou dado de produção foi
alterado. Fontes: `docs/produto/charter-{prd,srd}.md`,
`docs/qualidade/gate-maturidade-carga.md`, `.claude/completions/*charter*`,
`git log`/`git diff` contra o remoto `ground` (produção), sem escrita em
banco.*
