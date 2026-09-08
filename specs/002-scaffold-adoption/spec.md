# Feature Specification: Scaffold — framework de adoção em trilhas guiadas

**Feature Branch**: `claude/scaffold-html-impl-baa4f7`
**Created**: 2026-09-02
**Status**: Draft
**Origem**: import do projeto Claude Design `691f7fe5-e623-458e-aa9f-92b8c46dbbd9`
(`scaffold.html` + `scaffold-*.jsx` + `charter-base.jsx` / `cosmos-kit.jsx` / `cosmos-icons.jsx`),
com PRD v1.0 e SRD v1.0 anexados ao mesmo projeto (`uploads/scaffold_prd.txt`,
`uploads/scaffold_srd.txt`).

> **Este spec foi derivado, não escrito do zero.** `/speckit-specify` não rodou
> para o Scaffold; a fonte é o par PRD/SRD v1.0 do design mais o protótipo
> navegável. Os IDs `S-*`, `SG-*`, `ST-*`, `SN-*` abaixo são os do SRD/PRD
> originais e devem ser preservados na rastreabilidade.

---

## ⚠️ Conflito de escopo a decidir antes de codar

Existem **dois Scaffolds documentados** no repositório, com o mesmo nome e
escopos incompatíveis:

| Fonte | O que diz que o Scaffold é | Tamanho |
|---|---|---|
| [`docs/produto/scaffold-prd.md`](../../docs/produto/scaffold-prd.md) (repo, Onda 1 comercial) | **Serviço de implementação**, não SaaS. V1 = uma ligação: `MeridianGapPromotion.targetEntityId` → `Engagement`. Diz textualmente: *"Não é um quarto produto no monorepo, e tratá-lo como tal seria o erro mais caro possível"* | ~1 ADR + 1 action |
| PRD/SRD v1.0 do design + `scaffold.html` | **Produto multi-tenant completo**: 6 telas, gate engine bloqueante, biblioteca de templates versionada com overlays, caso de negócio assinado e imutável, fila de supervisão cross-tenant | ~4º produto no monorepo |

**Esta spec assume a segunda leitura**, porque a instrução explícita foi
"Implement: `scaffold.html`". A ligação de promoção descrita no PRD do repo
**não é descartada** — ela sobrevive como **S-01** (seed de trilha a partir de
lacuna do Meridian) e permanece a primeira fatia entregável.

O que a decisão muda, se for revertida: tudo além da Fase 1 de
[`plan.md`](plan.md) deixa de existir. Ver `research.md` §R1.

---

## User Scenarios & Testing

### Primary User Story

Uma consultora da Nebuloz promove uma lacuna do diagnóstico Meridian para o
Scaffold. Nasce uma **trilha**: um processo do cliente que atravessa quatro
fases — Assess, Pilot, Scale, Embed — cada uma fechada por um **gate
bloqueante**. O time do cliente executa os passos e anexa os artefatos; o dono
do processo assina o caso de negócio; a consultora só aparece na fila de gates.
Ao fim da Fase 4, o processo sobrevive 30 dias sem a Nebuloz e a trilha vira
capacidade permanente do cliente.

### Acceptance Scenarios

1. **Seed** — Dada uma `MeridianGap` promovida com `targetProduct = SCAFFOLD`,
   quando a promoção é confirmada, então existe uma trilha com `sourceGapId`
   preenchido, `template_version` fixada, e as quatro fases instanciadas com a
   Fase 1 em `open`.
2. **Gate bloqueante** — Dada uma fase em `gate_ready` com um critério não
   atendido, quando alguém tenta fechá-la sem override, então a operação falha
   e a fase permanece `blocked`.
3. **Override atribuído** — Dado o mesmo cenário, quando um ator autenticado
   registra override com lista de critérios não atendidos e rationale não
   vazia, então a fase fecha e o override fica gravado, append-only.
4. **Baseline trava a Fase 1** — Dada a Fase 1 com todos os passos completos e
   um caso de negócio em `draft` ou `awaiting`, quando se tenta fechar o gate,
   então falha por SG-04 até haver versão `signed`.
5. **Contestação** — Dado um caso de negócio em `awaiting`, quando o
   patrocinador devolve com objeção, então o estado vira `contested`, a objeção
   fica registrada com autor e data, e a Fase 1 continua bloqueada.
6. **Imutabilidade do assinado** — Dado um caso de negócio `signed`, quando
   alguém edita uma métrica, então nasce uma nova versão `draft` e a versão
   assinada permanece intacta e legível.
7. **Publicação de template** — Dada uma trilha rodando na `v3` de um template,
   quando a `v4` é publicada, então o conjunto de passos da trilha permanece
   idêntico (ST-03).
8. **Overlay em conflito** — Dado um overlay de tenant sobre a `v3` e uma `v4`
   que endurece o mesmo critério, quando a `v4` publica, então o conflito é
   exposto para resolução explícita e nada é sobrescrito silenciosamente
   (ST-02).
9. **Estagnação** — Dada uma trilha sem movimento de gate há ≥ 14 dias, quando
   a varredura agendada roda, então a trilha é sinalizada e dono e sponsor são
   notificados (S-09 / SN-07).
10. **Fila cross-tenant** — Dada a consultora na fila de supervisão, quando ela
    lista gates de vários clientes, então vê apenas metadado de gate (trilha,
    org, fase, idade, status de critérios) e **nenhum artefato**; abrir um
    artefato exige entrada logada naquele tenant (SN-06).
11. **Observação de 30 dias** — Dado o gate da Fase 4 fechado, quando a janela
    de 30 dias corre sem reabertura, então a trilha vira `embedded`; se
    reabrir, volta a `open` na Fase 4 (SG-06).
12. **Degradação graciosa** — Dado um tenant sem Charter provisionado, quando a
    Fase 3 abre, então os passos rodam sem o passo de vínculo de política, sem
    erro (SG-05 condicional).

### Edge Cases

- Promoção revogada com trilha ativa → deve falhar com mensagem que explica o
  porquê (mesmo princípio de `Restrict` do `Engagement`).
- Múltiplas lacunas em uma trilha, ou múltiplas trilhas por lacuna.
- Persona sem papel de consultora tenta acessar a fila de supervisão.
- Caso de negócio assinado cuja trilha é cancelada — o artefato permanece para
  auditoria e o Signal continua lendo, ou para de ler?
- Template sem nenhuma versão publicada.

---

## Requirements

### Funcionais (IDs do PRD v1.0)

| ID | Requisito | Pri | Nesta feature |
|---|---|---|---|
| **S-01** | Trilha instanciada a partir de lacuna do Meridian, carregando contexto e rationale | P0 | ✅ |
| **S-02** | Progressão em quatro fases com gates explícitos e bloqueantes | P0 | ✅ |
| **S-03** | Sign-off de gate por aprovador nomeado; override só com rationale gravada | P0 | ✅ |
| **S-04** | Guia em nível de passo, com artefato esperado e estado de conclusão | P0 | ✅ |
| **S-05** | Biblioteca de templates versionada, com customização por cliente que sobrevive a upgrades | P0 | ✅ |
| **S-06** | Captura de baseline da Fase 1 em schema que o Signal consome | P0 | ✅ |
| **S-07** | Visão de portfólio: toda trilha, fase, dono e bloqueio da organização | P1 | ✅ |
| **S-08** | Modo de supervisão da consultora — fila cross-cliente de gates | P1 | ✅ |
| **S-09** | Detecção de estagnação além do limiar configurado | P1 | ✅ |
| **S-10** | Export do handover pack no fechamento da Fase 4 | P1 | ⚠️ Fase 4 do plano |
| **S-11** | Vínculo de política do Charter dentro dos passos da Fase 3 | P1 | ✅ |
| **S-12** | Templates por arquétipo de processo (triagem, revisão de documento, relatórios) | P2 | ✅ (seed) |
| **S-13** | Sync bidirecional com o tracker do cliente | P2 | ❌ fora |

### Gate engine (SRD §4)

- **SG-01** Fase não entra em `gate_ready` até que todo passo requerido esteja completo.
- **SG-02** Fase não entra em `closed` sem todos os critérios atendidos **ou** override gravado.
- **SG-03** Override exige ator autenticado, lista de critérios não atendidos e rationale não vazia.
- **SG-04** Fase 1 não fecha sem caso de negócio validado e assinado.
- **SG-05** Fase 3 não fecha sem ack da política do Charter aplicável, **quando o Charter existe**.
- **SG-06** Fechar a Fase 4 abre janela de observação de 30 dias; a trilha só é `embedded` ao fim dela sem reabertura.
- **SG-07** Resultados de gate e overrides são append-only, nunca editados destrutivamente.
- **SG-08** Taxa de override por organização é computada e exposta no portfólio.

> **Invariante crítico (SRD):** o comportamento bloqueante do gate *é* o produto.
> Qualquer caminho de código que feche uma fase sem registrar critérios
> atendidos ou override atribuído é defeito de correção de severidade máxima —
> não atalho de UX. Gate crítico do BMAD-TEA: unit + integration + e2e + negative.

### Templates (SRD §5)

- **ST-01** Versões publicadas são imutáveis.
- **ST-02** Overlays de tenant sobrevivem ao upgrade da base ou levantam conflito explícito.
- **ST-03** Trilhas rodando não são afetadas por publicação de template.
- **ST-04** Toda trilha reporta exatamente qual versão + overlay produziu seus passos.

### Não-funcionais (SRD §7)

- **SN-01** Isolamento de tenant no banco via RLS.
- **SN-02** Artefatos cifrados em repouso; acesso escopado à trilha e logado na leitura.
- **SN-03** Trilha de auditoria completa em toda transição, sign-off e override.
- **SN-04** Residência de dado configurável por organização. ⚠️ *fora do V1 — ver research §R6*
- **SN-05** RBAC: team member, process owner, transformation lead, consultant reviewer, admin.
- **SN-06** Fila de supervisão atravessa organizações **sem** expor dado cross-tenant além de metadado de gate.
- **SN-07** Detecção de estagnação roda agendada e notifica dono e sponsor.
- **SN-08** Dado de cliente nunca treina modelo.
- **SN-09** Handover pack exporta como arquivo auto-contido, legível sem acesso Nebuloz.
- **SN-10** WCAG 2.2 AA em toda superfície voltada ao cliente.

### Key Entities

Ver [`data-model.md`](data-model.md). Resumo: `ScaffoldTrack`, `ScaffoldPhaseInstance`,
`ScaffoldStepInstance`, `ScaffoldArtefact`, `ScaffoldGateResult`, `ScaffoldGateOverride`,
`ScaffoldTemplate` / `Version` / `StepTemplate` / `GateCriterion` / `Overlay`,
`ScaffoldBusinessCase` / `Version` / `Metric` / `Contest`.

---

## Success Criteria

| SC | Métrica |
|---|---|
| SC-001 | Uma trilha nasce de lacuna do Meridian e chega a Embed sem intervenção de engenharia |
| SC-002 | Nenhum caminho de código fecha fase sem critérios atendidos ou override atribuído — **verificado por teste automatizado** |
| SC-003 | Publicar nova versão de template deixa toda trilha em curso com conjunto de passos idêntico |
| SC-004 | O caso de negócio da Fase 1 valida contra o schema do Signal e importa sem transformação |
| SC-005 | Um tenant não lê artefato de outro por nenhum caminho de API |
| SC-006 | Handover pack abre e é utilizável sem conta Nebuloz |
| SC-007 | Cobertura ≥ 80%; gate engine com suíte negativa |

---

## Mapeamento SAFe

Competência: **Lean Portfolio Management** (adoção governada de mudança de processo).
Nível: **Portfolio**.

---

## Open Questions

Herdadas do PRD v1.0 §9 e do PRD do repo — nenhuma bloqueia o Fase 0/1 do plano,
mas todas bloqueiam GA. Rastreadas em [`research.md`](research.md).

1. **Escopo** — produto ou ligação? (§ conflito acima) — **bloqueante para o plano inteiro**
2. **Preço** — por workspace/mês, por trilha ativa, ou por assento? Travado no CAC carregado.
3. **Autoridade de gate** — cliente assina o próprio gate em tier baixo?
4. **Posse do template** — customização do cliente fica privada ou alimenta biblioteca opt-in?
5. **Acoplamento com o Cosmos** — trilha empurra item de entrega para clientes SAFe?
6. **RACI** — quem entrega ≠ quem responde pelo SLA. Travado na função comercial da Onda 2.
