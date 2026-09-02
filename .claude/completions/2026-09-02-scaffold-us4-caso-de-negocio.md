# Scaffold — US4: caso de negócio (T065–T082)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

O baseline como artefato de primeira classe: assinado, imutável, versionado.
SG-04 deixou de ser uma trava sobre uma âncora de cinco colunas e passou a ter
o que destravar.

- **Modelos** — `ScaffoldBusinessCase` completo, mais `Version`, `Metric` e
  `Contest`. Métricas pendem da **versão**, não do caso: é o que torna a
  imutabilidade estrutural em vez de convencional.
- **`lib/scaffold/business-case-hash.ts`** — o `ref` do protótipo. Prova, não
  identificador.
- **Actions** — `saveDraft`, `submitForSignature`, `signBusinessCase`,
  `contestBusinessCase`, `newVersionFromSigned`, `listBusinessCases`,
  `getBusinessCase`.
- **Telas** — `baselines.tsx` (lista com KPIs e o alerta de trilhas sem
  promessa) e `baseline-detail.tsx` (métricas com delta e confiança, contrato
  com o Signal, histórico de versões, benefício).
- **`cancelTrack`** — o `TODO(US4 · T082)` fechado.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| `biome check` | 0 erros |
| Suíte `apps/app` | 3494 testes, 0 falhas |
| Testes novos | 40 (176 no Scaffold) |

TDD respeitado: `business-case-hash.test.ts` escrito primeiro, RED confirmado,
depois a implementação. As 21 asserções de `business-case.test.ts` passaram na
primeira execução da action — o que só é bom sinal porque a suíte inclui os
caminhos negativos, não só o feliz.

## As duas invariantes, e onde elas moram

**1. Assinado é imutável.** Não é uma checagem: é a forma do schema. As
métricas pendem da `Version`, então alterar uma exige criar versão nova. Uma
action que quisesse editar em cima da assinada teria de escrever numa linha que
não é dela.

**2. `signedVersionId` só muda em `signBusinessCase`.** É o campo que SG-04 lê.
Se outra action pudesse escrevê-lo, a trava da Fase 1 teria mais de uma chave.

`currentVersionId` e `signedVersionId` são colunas separadas de propósito — é o
que faz o painel dizer *"v2 vigente · v3 em edição"*. Uma coluna só faria o
rascunho passar a valer sozinho, e o Signal apuraria contra o que ninguém
aprovou.

## Decisões da fatia

**O hash cobre a promessa, não a prosa.** Entram métrica, unidade, linha de
base, meta, direção, confiança, janela e benefício. Ficam de fora rótulo,
fonte, amostra e nota. Corrigir um typo em "Cycle time da triagem" não pode
invalidar uma assinatura — se pudesse, ninguém corrigiria o typo. E
`confidence` entra: `measured` e `declared` sobre os mesmos números são
promessas diferentes, e é essa distinção que o patrocinador de BC-105 contesta.

**Métricas são substituídas em bloco.** Editar uma a uma abriria uma janela em
que a versão tem metade das métricas velhas e metade das novas — e alguém
poderia assinar exatamente aí.

**`newVersionFromSigned` serve aos dois caminhos de reabertura** — pós-objeção
e pós-assinatura. É a mesma transição; duplicá-la daria duas chances de
esquecer de preservar a anterior.

**Promessa vazia não se assina.** `submitForSignature` recusa caso sem métrica:
o patrocinador que recebesse um artefato vazio não teria como recusar sem
parecer difícil.

**Cancelar trilha com promessa assinada exige decisão explícita sobre o
Signal.** O artefato continua existindo e a apuração continua correndo;
cancelar em silêncio deixaria uma promessa viva sem ninguém para cumpri-la. A
decisão vai para a trilha de auditoria.

## O guard de segurança me pegou de novo

`tenant-unique-keys.test.ts` acusou `ScaffoldBusinessCaseVersion` e
`ScaffoldBusinessCaseMetric`: modelo com `tenantId` não pode ter `@@unique` que
o omita. É a **segunda vez** nesta implementação — a primeira foi
`ScaffoldGateResult` na US2.

Nos dois casos a chave era redundante (`businessCaseId` e `versionId` são cuid
globais), e nos dois casos escopei em vez de pedir exceção. Vale registrar o
padrão: eu escrevo `@@unique` pensando na unicidade lógica, o teste cobra a
unicidade escopada. Da próxima vez, escrever já com `tenantId` na frente.

## O que fica para a próxima fatia

- **US5 (T083–T097)** — biblioteca de templates: versões imutáveis, overlays
  como lista de operações, detecção de conflito.
- Edição de métrica na tela é read-only: `saveDraft` existe e está testada, mas
  o formulário de edição não foi portado. Entra junto do editor.
- A superfície de assinatura (`SigningSheet` do protótipo) não foi portada —
  ela vive fora do console, e o fluxo de identidade do patrocinador é decisão
  de US7 em diante.
- Migration real segue pendente: worktree sem `.env`. Schema validado, client
  gerado.
