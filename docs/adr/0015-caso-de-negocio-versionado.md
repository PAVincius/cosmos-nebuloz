# ADR-0015 — Caso de negócio versionado vence o baseline plano do SRD

**Status**: Accepted
**Data**: 2026-09-02

## Contexto

O SRD do Scaffold §3 modela `baseline` como linha plana, com três métricas
fixas: `volume`, `cycle_time`, `error_rate`, mais `captured_at` e `signed_by`.

O protótipo de design, no mesmo projeto, modela outra coisa. `scaffold-baseline.jsx`
traz um **caso de negócio** de primeira classe: N métricas com unidade, linha de
base, meta, direção e **nível de confiança** (`measured` / `estimated` /
`declared`), cada uma com fonte e amostra; benefício anual com base de cálculo e
visto de Finanças; máquina de estado `draft → awaiting → signed → superseded`
com ramo `contested`; e histórico de versões imutável.

O comentário no topo daquele arquivo é normativo: *"Scaffold é a FONTE DA
VERDADE. Emite artefato assinado, imutável e versionado; o Signal apura contra
ele e nunca o edita."*

Os dois documentos descrevem a mesma entidade de formas incompatíveis.

## Decisão

O modelo do design vence. O SRD §3 é o esboço; `scaffold-baseline.jsx` é a
especificação.

Três métricas fixas não descrevem "Laudos dentro da janela de plantio" nem
"Casos por analista/semana" — ambos casos reais no próprio protótipo. E, sem
`confidence`, some a distinção entre número medido e número declarado, que é
exatamente sobre o que patrocinadores contestam: a objeção de BC-105 no
protótipo é *"a taxa de 12% mistura divergência de opinião clínica com erro de
transcrição"*. Achatar o modelo apagaria o mecanismo que torna essa objeção
representável.

Duas consequências estruturais, e não convencionais:

- **As métricas pendem da VERSÃO, não do caso.** Alterar uma meta não pode ser
  um `update`: cria versão nova, com métricas novas. Se elas pendessem do caso,
  editar uma reescreveria em silêncio o que já foi assinado.
- **`currentVersionId` e `signedVersionId` são colunas separadas.** É o que faz
  o painel dizer *"v2 vigente · v3 em edição"*: o Signal continua apurando
  contra a assinada enquanto um rascunho existe por cima. Uma coluna só faria o
  rascunho passar a valer sozinho.

## Consequência sobre o contrato de saída

O shape achatado do SRD §6 — `volume_per_period`, `cycle_time_minutes`,
`error_rate`, `headcount_touching` — é mantido como **derivação**, não como
schema interno. `toSignalV1` o emite a partir das chaves canônicas, com a única
conversão de unidade do contrato (percentual para fração na taxa de erro) do
lado do produtor. Métrica ausente vira `null` e não falha: um consumidor que
espera três números lida melhor com um nulo do que com um erro.

O contrato vigente é o v2, com N métricas e `confidence` preservado.

## Alternativas rejeitadas

**Seguir o SRD §3 literalmente.** Entregaria o documento e não o produto: a tela
de casos de negócio do protótipo não teria como existir, e a contestação — que
é um estado real do fluxo — não teria onde morar.

**Manter os dois, com o plano como espelho.** Duas fontes de verdade para a
mesma promessa divergem na primeira edição, e a divergência apareceria como o
Signal apurando contra números que ninguém assinou.

## Referências

- `specs/002-scaffold-adoption/research.md` §R3
- `specs/002-scaffold-adoption/contracts/signal-baseline-export.md`
- SRD do Scaffold §3 e §6; PRD do Scaffold S-06
