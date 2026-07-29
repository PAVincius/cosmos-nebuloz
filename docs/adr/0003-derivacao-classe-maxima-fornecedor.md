# ADR-0003 — Derivação da classe máxima do fornecedor

**Status**: Accepted · **lacuna de spec — precisa de validação de Legal/Segurança**
**Data**: 2026-07-28
**Contexto de origem**: implementação de FR-9.2 / FR-9.3

## Contexto

`SRD-Charter.md` exige duas coisas incompatíveis com um campo digitado à mão:

- **FR-9.2** — "deve derivar e exibir a **classe máxima de dado** que a postura
  contratual permite, com o raciocínio visível"
- **FR-9.3** — "deve permitir marcar/desmarcar cláusulas e **recalcular** a
  classe máxima"

`DATA-MODEL.md §1` reforça: `maxClass` "é derivado do julgamento de governança
sobre postura contratual — **não é campo digitado livre**".

**A lacuna**: nenhum documento fornece o algoritmo. `DATA-MODEL.md §4.2` define
apenas o *uso* de `maxClass` (o gate contra a classe do caso), não a *derivação*.

Pior: os valores do protótipo não seguem fórmula alguma. Confrontando
`VENDOR_CLAUSES` com `maxClass` em `charter-data.jsx`:

| Vendor | Cláusulas | DPA | Retenção | `maxClass` no protótipo |
|---|---|---|---|---|
| V-01 Lumen | CL-01,02,03,04,05 | sim | Zero | `internal` |
| V-02 Kairos | CL-01,03,05 | sim | 30 dias | `confidential` |
| V-04 Meridian | CL-01,02,03,04,05,08 | sim | Zero | `restricted` |
| V-06 Corpus | CL-01,03,05 | sim | 14 dias | `confidential` |

V-01 tem **mais** cláusulas críticas que V-02 e retenção zero, e mesmo assim
recebe um teto **menor**. Não há função de `(dpa, cláusulas, retenção)` que
produza essa tabela. São julgamentos escritos à mão, coerentes como narrativa de
protótipo e inutilizáveis como especificação.

## Decisão

Derivar `maxClass` por uma escada de degraus, cada um exigindo o degrau
anterior, ancorada no **texto normativo de cada classe** (`DATA-MODEL.md §1`,
campo `DataClass.rule`) — a única fonte normativa disponível:

| Regra da classe (citação) | Exigência derivada |
|---|---|
| Público: "uso livre em ferramenta aprovada" | baseline |
| Interno: "exige **DPA assinado**" | `dpa === true` **e** CL-01 (proibição de treinamento) |
| Confidencial: "revisão de Segurança e **retenção zero**" | + CL-02 (retenção zero), CL-03 (incidente 24h), CL-04 (sub-processadores) |
| Restrito: "só ambiente dedicado com **BAA**" | + CL-08 (BAA / adendo de dado de saúde) |

`tier === BLOCKED` curto-circuita para `null` — decisão de governança supera
postura contratual.

Implementação: `deriveVendorMaxClass()` em
[apps/app/lib/charter/rules.ts](../../apps/app/lib/charter/rules.ts). Retorna
`{ maxClass, reasoning: string[] }` — **um degrau por linha**, atendendo o
"raciocínio visível" de FR-9.2. Recomputado em `setVendorClauses` e
`setVendorTier`, que também reavaliam todos os casos vinculados
(`DATA-MODEL.md §6`).

O seed usa a derivação como fonte da verdade e **não** replica os `maxClass`
divergentes do protótipo. Os valores resultantes (V-01 Confidencial, V-02
Interno, V-06 Interno) são mais conservadores que os do protótipo em dois casos e
consistentes com as `notes` de cada fornecedor — a de V-06 diz literalmente
"retenção de 14 dias incompatível com política para Confidencial", que é o que a
escada produz.

## Alternativas consideradas

**Manter `maxClass` como campo editável por Segurança.** Rejeitada: contraria
`DATA-MODEL.md §1` de forma explícita e torna FR-9.3 ("recalcular") sem sentido —
não há o que recalcular num campo digitado.

**Teto = mínimo entre derivação e override manual de governança.** Permitiria
Segurança rebaixar sem nunca elevar. Rejeitada para o V1 por adicionar um
segundo campo, uma segunda tela e uma segunda entrada de auditoria antes de
existir demanda real. É a evolução natural se Legal quiser o poder de rebaixar.

**Ajustar o seed até a derivação reproduzir os `maxClass` do protótipo.**
Rejeitada: exigiria dar a V-02 cláusulas que ele não tem, contradizendo as
`notes` do próprio protótipo. Seria fabricar dado para caber na fórmula.

## Consequências

- FR-9.2 e FR-9.3 passam a ser implementáveis e testáveis: 6 testes em
  `__tests__/charter/rules.test.ts` cobrem cada degrau.
- O gate do intake (FR-4.4) fica determinístico: mesma postura contratual, mesmo
  bloqueio, sempre.
- **Dois fornecedores do dataset de demonstração mudam de teto** em relação ao
  protótipo. Se a demo for mostrada a quem viu o protótipo, a diferença aparece.
- A escada é opinativa. Se Legal discordar de qual cláusula guarda qual degrau,
  a mudança é de uma função pura e seus testes — não do schema nem da UI.
- **Pendente de validação**: a lista de cláusulas por degrau precisa de aval de
  Legal e Segurança antes de ir a cliente. Até lá, é decisão de engenharia
  documentada, não política da empresa.
