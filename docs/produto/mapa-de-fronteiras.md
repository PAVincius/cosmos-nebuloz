# Mapa de fronteiras

> **DOCUMENTO** Arquitetura de produto · **VERSÃO** 1 (ago/2026) · **STATUS** Normativo
> **ESTADO NA MAIN** conferido em 2026-09-22 contra ea512044

Toda entidade tem exatamente um dono; os demais leem, ou anexam sem alterar.

---

## 1. Cadeia de valor

A pergunta que cada produto responde define sua fronteira. Quando dois produtos
respondem à mesma pergunta, um dos dois está fora do lugar.

Quatro produtos em sequência; dois transversais atravessam as quatro fases.

| Produto | Verbo | Pergunta | O que faz |
|---|---|---|---|
| [Meridian](./meridian-prd.md) | Avaliar | Estamos prontos? | Prontidão para IA: scoring com override, gap register, benchmark |
| [Scaffold](./scaffold-prd.md) | Contratar | O que foi prometido? | Engajamento faseado por template, trilhas, gates com assinatura |
| [Cosmos](./cosmos-prd.md) | Executar | O que estamos fazendo? | Portfólio SAFe: hierarquia, WSJF, gates de ciclo de vida |
| [Signal](./signal-prd.md) | Apurar | Valeu a pena? | Valor realizado: adoção × valor, atribuição, decisão, encerramento |
| [Charter](./charter-prd.md) (transversal) | Governar | É permitido? Sob qual risco? | Risco e política multi-tenant: Policy Builder, matriz de impacto, SSO, auditoria |
| [Big Bang](./backoffice-prd.md) (transversal) | Vender e operar | Como isso entra e roda? | Back-office: gerador de proposta, editor BPMN, MCP lab |

SRDs: [Meridian](./meridian-srd.md) · [Scaffold](./scaffold-srd.md) ·
[Cosmos](./cosmos-srd.md) · [Signal](./signal-srd.md) ·
[Charter](./charter-srd.md) · [Big Bang](./backoffice-srd.md).

**O site conta outra ordem, e as duas valem.** O site público apresenta
Diagnosticar (Meridian) → Estruturar (Scaffold) → Medir (Signal) → Governar
(Charter) → Operar (Cosmos), com o Cosmos por último
(`packages/internationalization/dictionaries/pt.json:271-303`; estágios em
`:331-391`). O dono decidiu em 2026-09-22: a sequência do site é a jornada
comercial; a cadeia deste mapa vale para os docs internos e para os prompts dos
especialistas.

---

## 2. Registro de propriedade

Dezesseis entidades compartilhadas, uma linha por entidade, um dono por linha.
O dono cria, altera e versiona. O consumidor **lê** (referência imutável) ou
**anexa** (adiciona fato próprio sem tocar no original). Nenhum consumidor edita
entidade alheia: se precisar editar, a fronteira está errada.

**Como ler o estado na main.** O mapa é o alvo (decisão do dono, 2026-09-22).

- `alinhado`: a regra vale no código.
- `gap`: um produto faz o que a regra proíbe, ou o dono no código não é o do
  mapa. A célula termina com o produto que muda para o mapa valer.
- `sem implementação`: nada viola a regra, mas a ligação que ela pede não existe.

Caminhos a partir da raiz do repositório. `schema/` abrevia
`packages/database/prisma/schema/`.

### Organização e identidade

| Entidade | Dono | Lê | Anexa | Regra de fronteira | Estado na main |
|---|---|---|---|---|---|
| **1. Tenant / cliente** (hierarquia legal, contrato, isolamento) | Charter | todos | — | Charter é o único emissor de `tenant_id`. Nenhum produto cria tenant próprio nem duplica árvore organizacional. | `gap` — o tenant nasce em `provisionTenant` (`packages/provisioning/src/tenant.ts:53-116`), chamado pelo Big Bang (`apps/backoffice/app/actions/provisioning.ts:145-178`) e pelo cadastro do app (`apps/app/app/actions/onboarding.ts:36-52`). Contrato e isolamento também são da plataforma (`packages/provisioning/src/modules.ts:52-60`; `packages/database/tenant-db.ts:20`). O Meridian guarda a organização avaliada como texto, no tenant da consultoria (`schema/meridian.prisma:209-212`), como decidiu o dono. Muda: o Charter passa a emitir o tenant. |
| **2. Usuário, papel, permissão** (SSO, grupos, escopo de acesso) | Charter | todos | — | Personas de produto (ex.: as 4 do Signal) são lentes de UI sobre o papel do Charter — nunca um segundo modelo de permissão. | `gap` — identidade e sessão em `packages/auth/server.ts` (`:41`, `:159`, `:229`). O SSO é gravado nas configurações do Cosmos (`apps/app/app/actions/settings/sso.ts:55`). Há cinco matrizes de permissão, uma por produto, em `packages/rbac/src`. Os 4 papéis do Signal são permissão, não lente; a lente de persona não foi portada (`schema/signal.prisma:107-119`; `apps/app/components/signal/shell.tsx:15-21`). Muda: o Charter assume papel e permissão; os outros produtos trocam matriz por lente. |
| **3. Política e apetite de risco** (regras, limites, obrigações) | Charter | Cosmos, Signal, Meridian, Big Bang | — | Produtos avaliam conformidade contra a política; nenhum define regra localmente. Violação vira evento no Charter, não flag privado. | `gap` — o Big Bang escreve no Charter: o bootstrap cria a política (`packages/provisioning/src/charter.ts:132-145`) e "Exportar para o Charter" altera `CharterVendor` (`apps/backoffice/app/actions/empresa/fornecedores.ts:263-341`). O Scaffold lê as políticas publicadas para o SG-05 (`apps/app/app/(scaffold)/actions/tracks.ts:522-540`), mas aceite e bloqueio ficam no Scaffold (`apps/app/app/(scaffold)/actions/gates.ts:123-150`, `:531-562`). Cosmos, Signal e Meridian não leem a política; o Big Bang só confere se ela existe (`apps/backoffice/app/actions/clients.ts:102-110`). Muda: Big Bang e Scaffold. |

### Avaliação e promessa

| Entidade | Dono | Lê | Anexa | Regra de fronteira | Estado na main |
|---|---|---|---|---|---|
| **4. Avaliação de prontidão** (score, dimensões, override) | Meridian | Scaffold, Signal | — | Scaffold usa o score para escolher template. Signal cita a avaliação de origem, sem recalcular. | `gap` — no Meridian, o score é gravado uma vez e o override é append-only (`schema/meridian.prisma:338-340`, `:362-365`). O Big Bang mantém avaliação própria, que o schema chama de "o diagnóstico que a Nebuloz vende no degrau 01 da Escada (Meridian)" (`schema/platform-ops.prisma:667-715`). As leituras não existem: o template da trilha é escolhido à mão (`apps/app/app/(scaffold)/actions/tracks.ts:140-151`) e o Signal não cita o Meridian. Muda: Big Bang; Scaffold e Signal passam a ler. |
| **5. Escala de confiança** (medido / estimado / declarado) | Meridian | Signal, Scaffold | — | Vocabulário único em toda a suíte. Signal reusa a mesma escala na atribuição de ganho — não cria outra nomenclatura. | `gap` — o Meridian declara a escala (`schema/meridian.prisma:82-89`; `apps/app/components/meridian/seams.tsx:15-50`). O Signal usa score 0–100 com faixas Alta, Média e Baixa (`apps/app/lib/signal/confidence.ts:11-54`). O Scaffold repete os três valores em enum próprio (`schema/scaffold.prisma:704-711`). O WSJF do Cosmos usa LOW, MEDIUM, HIGH (`schema/art-core.prisma:331`). Muda: Signal; em menor grau, Scaffold e Cosmos. |
| **6. Gap register** (lacunas de capacidade priorizadas) | Meridian | Scaffold, Cosmos | — | Gap virar iniciativa é ação do Cosmos, com `origin_gap_id`. O gap permanece do Meridian. | `gap` — a posse fica no Meridian (`schema/meridian.prisma:390-393`; `apps/app/app/(meridian)/actions/gaps.ts:382-449`). Mas Scaffold e Big Bang gravam `targetEntityId` na promoção, que é linha do Meridian (`apps/app/app/(scaffold)/actions/tracks.ts:153-156`; `apps/backoffice/app/actions/scaffold.ts:165-190`). Para o Cosmos, a promoção só registra intenção; `origin_gap_id` existe só em texto de tela (`apps/app/components/meridian/screens/gap-register.tsx:645-648`). Muda: Cosmos cria a iniciativa; Scaffold e Big Bang param de escrever no Meridian. |
| **7. Baseline e caso de negócio** (linha de base, meta, janela, assinatura) | Scaffold | Signal, Cosmos | — | Costura crítica. Emitido como artefato de gate assinado, imutável e versionado. Signal apura contra ele e nunca o edita. | `gap` — o Scaffold tem caso versionado e assinado e o export para o Signal (`schema/scaffold.prisma:522-657`; `apps/app/lib/scaffold/signal-export.ts:74-160`). Mas nenhuma ação cria o caso; `saveDraft` só altera um existente (`apps/app/app/(scaffold)/actions/business-case.ts:95`). O Signal cria e assina baseline próprio (`schema/signal.prisma:167-226`; `apps/app/app/(signal)/actions/baseline.ts:110`, `:205`). O Cosmos mantém Lean Business Case no épico (`schema/art-core.prisma:236-247`). Muda: Signal consome; Cosmos lê; Scaffold ganha caminho de criação. |
| **8. Engajamento, fase, gate** (template, trilha, assinatura de avanço) | Scaffold | Cosmos, Big Bang | — | Gate de fase (entrega) ≠ gate de ciclo de vida (Cosmos) ≠ gate de política (Charter). Três coisas, três donos. | `gap` — os três gates existem, com donos distintos: fase no Scaffold (`schema/scaffold.prisma:494-520`), ciclo de vida no Cosmos (`schema/governance.prisma:3-47`), política no Charter (`apps/app/app/(charter)/actions/cases.ts:320-339`). O Big Bang lê a fila de gates sem escrever (`apps/backoffice/app/actions/scaffold-supervision.ts:84-138`). Mas o ADR-0014, ainda Accepted, faz do `Engagement` do Big Bang o destino da promoção ao Scaffold (`schema/platform-ops.prisma:377-423`). O Cosmos não lê o Scaffold. Muda: Big Bang. |

### Execução

| Entidade | Dono | Lê | Anexa | Regra de fronteira | Estado na main |
|---|---|---|---|---|---|
| **9. Hierarquia de portfólio** (tema, épico, feature, squad, capability) | Cosmos | Signal, Scaffold, Big Bang | — | Costura crítica. Signal pendura valor realizado nesta árvore. Corte por unidade ou capability é lente, não modelo próprio. | `gap` — a árvore existe no Cosmos (`schema/portfolio.prisma:3`; `schema/art-core.prisma:1`, `:33`, `:198`, `:304`; `schema/large-solution.prisma:52`), e nenhum outro produto a lê. O Signal agrega portfólio sobre as próprias iniciativas e corta por `businessUnit`, texto livre (`schema/signal.prisma:130`; `apps/app/lib/signal/portfolio.ts:111-139`). Muda: Signal. |
| **10. Iniciativa** (identidade, status, dono, escopo) | Cosmos | Charter | Signal | Signal anexa desempenho de valor à iniciativa; não altera status, escopo nem prioridade. Fim de execução é do Cosmos. | `gap` — o Cosmos não tem entidade "iniciativa": o único modelo com esse nome no schema é o do Signal, e o Meridian nomeia o destino como "épico no Cosmos" (`gap-register.tsx:645`). O Signal cria identidade, dono e status e encerra a iniciativa (`schema/signal.prisma:124-165`; `apps/app/app/(signal)/actions/initiatives.ts:682-692`). O Charter registra "toda iniciativa de IA" como caso de uso próprio (`schema/charter.prisma:339-407`; `apps/app/components/charter/screens/cases.tsx:164`). Muda: Cosmos expõe a iniciativa; Signal anexa; Charter lê. |
| **11. Priorização WSJF** (ranking, componentes, sugestão de IA) | Cosmos | Signal | — | Valor realizado do Signal alimenta o WSJF como entrada. O cálculo e o ranking ficam no Cosmos. | `sem implementação` — cálculo, componentes e rebalanceamento por IA ficam no Cosmos (`packages/safe-engine/src/wsjf.ts:15-32`; `schema/art-core.prisma:321-335`; `apps/app/app/actions/wsjf/rebalance.ts`). Nenhum valor do Signal entra no WSJF. |

### Valor realizado

| Entidade | Dono | Lê | Anexa | Regra de fronteira | Estado na main |
|---|---|---|---|---|---|
| **12. Métrica e fórmula** (definição, versão, dono, frescor) | Signal | Cosmos, Meridian | — | Signal governa dado de valor como produto: dono por métrica, versão de fórmula com retroatividade declarada, política de lacuna. | `gap` — no Signal, mapeamento e fórmula de ROI são versionados, e o frescor vem da saúde da fonte, que tem dono (`schema/signal.prisma:228-305`, `:354-381`). Faltam dono por métrica, retroatividade declarada e política de lacuna. O Cosmos mede valor realizado sozinho: `EpicValueMetric`, planejado × real (`schema/portfolio.prisma:272-296`; `apps/app/app/(cosmos)/actions/value-realization.ts:161`). Muda: Cosmos lê do Signal; Signal completa a governança. |
| **13. Atribuição de ganho** (fator, contrafactual, selo de confiança) | Signal | Cosmos | — | Núcleo exclusivo do Signal. Usa a escala de confiança do Meridian; a declaração de atribuição é local. | `sem implementação` — não há fator de atribuição nem contrafactual; a palavra só aparece em comentário (`apps/app/lib/signal/roi.ts:10`). A confiança do Signal pontua a medição, não o ganho (`apps/app/lib/signal/confidence.ts:113-139`). |
| **14. Decisão de valor** (continuar / escalar / pivotar / encerrar) | Signal | Charter | Cosmos | O vácuo real. Ninguém mais decide sobre desempenho em operação. A decisão viaja ao Cosmos como recomendação com dono e prazo. | `sem implementação` — o Signal calcula um veredito na leitura, com ação sugerida, mas não registra decisão com dono e prazo (`apps/app/lib/signal/verdict.ts:1-60`). O alerta tem dono e próximo passo, sem prazo (`schema/signal.prisma:525-552`). Nada chega ao Cosmos nem ao Charter. |
| **15. Encerramento de valor** (benefício apurado, variância, lição) | Signal | — | Scaffold | Estado terminal próprio, posterior ao fim da entrega. A lição retorna ao template do Scaffold como insumo do próximo caso de negócio. | `sem implementação` — há estado terminal `CLOSED` com motivo obrigatório (`schema/signal.prisma:26-35`, `:138-142`), sem benefício apurado, variância nem lição, e sem ligação com o fim da trilha. O template do Scaffold não recebe lição. |
| **16. Trilha de auditoria** (quem, quando, o quê, antes/depois) | Charter | — | todos | Cada produto emite evento no formato do Charter e exibe sua própria visão. O registro canônico é um só. | `gap` — o registro é um só: `AuditLog`, append-only por trigger (`schema/system.prisma:81-103`). O formato `[campo, antes, depois]` é a convenção do Charter (`docs/adr/0009-auditoria-reusa-auditlog.md`), seguida por Meridian, Signal, Scaffold e Big Bang. O Cosmos grava por `logAudit`, com `diff` em mapa e erro engolido (`apps/app/app/actions/audit/log-audit.ts:14-30`). Muda: Cosmos. |

---

## 3. Costuras contratadas

Seis costuras. Cada uma diz o que passa, o que é imutável (ou o efeito) e o que
fica proibido.

### 3.1 Scaffold → Signal · baseline assinado

- **Passa:** métrica, linha de base, meta, janela de apuração, signatário, versão.
- **Imutável:** após a assinatura do gate; mudar exige nova versão justificada.
- **Proibido:** o Signal editar o baseline, porque o gate do Scaffold perderia
  valor. Apurar sem baseline: a iniciativa fica "aguardando promessa", não zero.
- **Estado na main:** `gap`. O Scaffold emite tudo, só de versão assinada
  (`apps/app/lib/scaffold/signal-export.ts:74-160`). O Signal não importa: cria e
  assina baseline próprio (`apps/app/app/(signal)/actions/baseline.ts:110-282`).
  "Aguardando promessa" só existe em telas do Scaffold e do Meridian
  (`apps/app/components/meridian/seams.tsx:183-265`).

### 3.2 Cosmos → Signal · hierarquia e identidade de iniciativa

- **Passa:** árvore de portfólio, identidade, dono, status, custo planejado.
- **Efeito:** o Signal anexa desempenho de valor como camada sobre a árvore.
- **Proibido:** o Signal criar nó de portfólio ou árvore paralela para agrupar
  por unidade; alterar status de iniciativa, porque ele só recomenda.
- **Estado na main:** `gap`. Nada passa. O Signal cria a iniciativa, corta por
  `businessUnit` e muda o status, inclusive para encerrada
  (`apps/app/app/(signal)/actions/initiatives.ts:682-692`). O investido sai da
  fórmula do Signal, não do custo planejado do Cosmos
  (`apps/app/lib/signal/roi.ts:8-11`).

### 3.3 Signal → Cosmos · recomendação de decisão

- **Passa:** recomendação, evidência anexa, dono, prazo, selo de confiança.
- **Efeito:** entra na fila de decisão do Cosmos e realimenta o WSJF como entrada.
- **Proibido:** o Signal executar a decisão; encerrar execução é ato do Cosmos.
- **Estado na main:** `sem implementação`. O veredito e os alertas do Signal não
  saem do módulo (`apps/app/lib/signal/verdict.ts:31-60`). O Cosmos tem fila de
  aprovação e registro de decisão (`schema/governance.prisma:3-47`, `:121-141`),
  sem entrada do Signal.

### 3.4 Meridian → Signal · vocabulário de confiança

- **Passa:** a escala (medido / estimado / declarado) e sua semântica.
- **Efeito:** o Signal reusa a escala na atribuição e a propaga até o relatório.
- **Proibido:** o Signal inventar segunda nomenclatura de confiança.
- **Estado na main:** `gap`. O Meridian avisa em comentário que o Signal não deve
  criar "alta / média / baixa" (`apps/app/components/meridian/seams.tsx:15-22`).
  O Signal criou isso e o leva ao relatório
  (`apps/app/lib/signal/report-payload.ts:44-45`).

### 3.5 Signal → Scaffold · lição de encerramento

- **Passa:** benefício final, variância contra o caso de negócio, lição
  reaproveitável.
- **Efeito:** insumo do template, que calibra a próxima promessa.
- **Proibido:** reabrir engajamento encerrado; a lição só anexa aprendizado ao
  template.
- **Estado na main:** `sem implementação`. O encerramento do Signal guarda data,
  autor e motivo (`schema/signal.prisma:138-142`), e o Scaffold não tem onde
  receber lição. Ao cancelar trilha com caso assinado, "parar" ou "seguir
  apurando" só vai para a nota do audit
  (`apps/app/app/(scaffold)/actions/tracks.ts:675-697`).

### 3.6 Todos → Charter · evento de auditoria

- **Passa:** ator, momento, entidade, antes/depois, motivo.
- **Imutável:** o formato, único e definido pelo Charter; cada produto renderiza
  sua própria vista.
- **Proibido:** manter trilha canônica privada.
- **Estado na main:** `gap`. O registro é único (`schema/system.prisma:81-103`), e
  só o Cosmos grava fora do formato (entidade 16). Ninguém mantém trilha privada
  de alteração; o `AccessLog` do Big Bang registra acesso ao painel e é separado
  de propósito (`schema/platform-ops.prisma:635-640`).

---

## 4. Colisões resolvidas

Sem veredito registrado, a duplicação volta na próxima sprint.

### 4.1 Portfólio agregado

- **Reivindicavam:** Cosmos (hierarquia SAFe, WSJF) e Signal (corte por unidade,
  capability, squad).
- **Veredito — Cosmos vence.** O Signal herda a hierarquia e pendura valor
  realizado nela. Corte executivo é lente de leitura. Sai do escopo do Signal
  como entidade própria.
- **Estado na main:** `gap`. O Signal mantém portfólio próprio, com cortes por
  área e categoria (`apps/app/lib/signal/portfolio.ts:111-139`).

### 4.2 Baseline e caso de negócio

- **Reivindicavam:** Scaffold (artefato de gate assinado) e Signal (referência de
  apuração).
- **Veredito — Scaffold cria, Signal apura.** O caso de negócio aprovado é
  artefato de gate e nasce no Scaffold; quem apura contra ele por 18 meses é o
  Signal. Criação sai do escopo do Signal; consumo imutável entra. "Sem baseline,
  Signal não tem o que medir; com baseline editável, o gate não vale nada."
- **Estado na main:** `gap`. Os dois produtos criam baseline (3.1).

### 4.3 Ciclo de decisão sobre desempenho

- **Candidatos descartados:** Charter (risco e política), Scaffold (avanço de
  fase), Cosmos (prioridade).
- **Veredito — Signal, sem disputa.** Ninguém decide sobre desempenho de valor em
  operação. Escopo: pauta gerada, recomendação, decisão registrada com dono e
  prazo, efeito de volta ao portfólio.
- **Estado na main:** `sem implementação`. Ninguém disputa. O Signal tem veredito,
  alertas e relatório congelável para o comitê (`schema/signal.prisma:556-587`),
  mas não gera pauta, não registra decisão e não devolve efeito ao portfólio.

### 4.4 Confiança e atribuição

- **Reivindicavam:** Meridian (metodologia de scoring e confiança) e Signal
  (atribuição de ganho).
- **Veredito — escala do Meridian, atribuição do Signal.** O Meridian pontua
  prontidão antes; atribuição de ganho depois é medição. Domínios diferentes,
  vocabulário compartilhado.
- **Estado na main:** `gap`. O Signal tem escala própria (3.4) e não tem
  atribuição (entidade 13).

### 4.5 Encerramento

- **Reivindicavam:** Scaffold (fim do engajamento) e Signal (fim da apuração de
  benefício).
- **Veredito — dois encerramentos, dois donos.** Eventos em tempos diferentes. O
  Signal precisa de estado terminal próprio. A lição volta ao template do
  Scaffold.
- **Estado na main:** `sem implementação`. Os dois estados terminais existem e não
  se falam: `EMBEDDED` e `CANCELLED` na trilha (`schema/scaffold.prisma:65-70`),
  `CLOSED` no Signal (`schema/signal.prisma:26-35`). A lição não volta (3.5).

---

## 5. Consequência — núcleo exclusivo do Signal

Fica no Signal: decisão de valor, atribuição com contrafactual, encerramento de
benefício e governança de dado de valor. Baseline vira consumo do Scaffold.
Portfólio agregado vira consumo do Cosmos. Escala de confiança vira vocabulário
herdado do Meridian. "O escopo fica menor e mais defensável — e as três telas
que faltavam desenhar caem de sete para quatro."

**Na main.** Decisão de valor e atribuição não existem (entidades 13 e 14).
Encerramento de benefício e governança de dado existem em parte (12 e 15). O
que o mapa tira do Signal está todo lá: baseline, portfólio e escala próprios
(4.1, 4.2, 4.4), além de iniciativa e permissão próprias (entidades 10 e 2).

---

## 6. Divergências abertas

Em ordem de prioridade: primeiro o que quebra fronteira (um produto cria ou
altera entidade de outro, ou o dono no código não é o do mapa), depois as
ligações que faltam. Cada item diz quem muda para o mapa valer. As sete
divergências prováveis da leitura do PDF se confirmam; a de auditoria, só em
parte: o registro é único, e o que diverge é o formato do Cosmos (item 13).

**Quebram fronteira**

1. **Signal cria o próprio baseline** (entidade 7; 3.1; 4.2):
   `apps/app/app/(signal)/actions/baseline.ts:110`, `:205`. Muda: Signal. E o
   Scaffold: sem ação que crie o caso, a costura nada entrega num tenant real.
2. **Signal mantém iniciativa e portfólio próprios** (entidades 9 e 10; 3.2; 4.1):
   `schema/signal.prisma:124-165`. Muda: Signal. O Cosmos precisa expor a
   iniciativa, que hoje não existe como entidade.
3. **Cosmos mede valor realizado** (entidade 12):
   `schema/portfolio.prisma:272-296`. Muda: Cosmos.
4. **Signal usa escala de confiança própria** (entidade 5; 3.4; 4.4):
   `apps/app/lib/signal/confidence.ts:11-54`. Muda: Signal. Menor: Scaffold (enum
   próprio) e Cosmos (LOW, MEDIUM, HIGH no WSJF).
5. **Tenant e contrato nascem fora do Charter** (entidade 1):
   `packages/provisioning/src/tenant.ts:53-116`. Muda: Big Bang e cadastro do app
   deixam de emitir; o Charter passa a emitir.
6. **Cinco modelos de permissão** (entidade 2): `packages/rbac/src`, com o SSO no
   Cosmos. Muda: o Charter assume; os outros trocam matriz própria por lente.
7. **Big Bang escreve em entidade do Charter** (entidade 3):
   `packages/provisioning/src/charter.ts:132-145`;
   `apps/backoffice/app/actions/empresa/fornecedores.ts:324`. Muda: Big Bang.
8. **Consumidores escrevem na promoção do Meridian; Big Bang como destino do
   Scaffold** (entidades 6 e 8): `apps/app/app/(scaffold)/actions/tracks.ts:153-156`;
   `apps/backoffice/app/actions/scaffold.ts:181`. Muda: Scaffold e Big Bang; o
   ADR-0014 precisa de revisão.
9. **Charter registra iniciativa de IA como caso de uso próprio** (entidade 10):
   `apps/app/components/charter/screens/cases.tsx:164`. Muda: Charter.
10. **Aceite e violação de política ficam no Scaffold** (entidade 3):
    `apps/app/app/(scaffold)/actions/gates.ts:531-562`. Muda: Scaffold.
11. **Big Bang mantém avaliação de prontidão própria** (entidade 4):
    `schema/platform-ops.prisma:667-715`. Muda: Big Bang.
12. **Cosmos mantém caso de negócio próprio** (entidade 7):
    `schema/art-core.prisma:236-247`. Muda: Cosmos.
13. **Auditoria do Cosmos fora do formato** (entidade 16; 3.6):
    `apps/app/app/actions/audit/log-audit.ts:14-30`. Muda: Cosmos.

**Faltam ligações**

14. **Lacuna → iniciativa com `origin_gap_id`** (entidade 6): decidida em
    `specs/001-meridian-diagnose/research.md:152-154`, nunca feita. Muda: Cosmos.
15. **Promoção de lacuna não atravessa tenant** (entidade 6). Com o Meridian no
    tenant da consultoria (decisão do dono, 2026-09-22), a lacuna de um cliente
    vive fora do tenant dele. Na main, a trilha nasce no mesmo tenant da promoção
    (`apps/app/app/(scaffold)/actions/tracks.ts:121-150`), e o ADR-0014 supõe que
    "a lacuna vive no tenant do cliente avaliado"
    (`docs/adr/0014-promocao-scaffold-materializa-no-backoffice.md:13-14`). Muda:
    Meridian, Scaffold e Cosmos.
16. **Decisão de valor e entrada no WSJF** (entidades 11 e 14; 3.3; 4.3):
    `apps/app/lib/signal/verdict.ts:1-60`. Muda: Signal e Cosmos.
17. **Atribuição com contrafactual** (entidade 13): não existe. Muda: Signal.
18. **Encerramento de benefício e lição ao template** (entidade 15; 3.5; 4.5):
    `schema/signal.prisma:138-142`. Muda: Signal e Scaffold.
19. **Leituras previstas que não existem:** Scaffold e Signal sobre a avaliação
    (entidade 4); Cosmos, Signal e Meridian sobre a política (entidade 3);
    Signal, Scaffold e Big Bang sobre a árvore (entidade 9); Cosmos sobre o
    Scaffold (entidade 8). Muda: cada leitor.
