# Meridian: escopo dos atritos A3 e A5 do dogfood local

- **Pedido por:** CEO, via Morgana · **Data:** 2026-09-29 · **Autor:** Norte (CPO)
- **Estado:** **Decidida.** O CEO confirmou D-19 e D-20 em 2026-09-29 (via Morgana; entradas em `registro-de-decisoes.md`).
- **Origem:** `docs/qualidade/dogfood/meridian/diario.md:112-114` (main `93b77c9a`), PR #287 ("A3 … é decisão de
  produto") e #288.

## Resumo

| Item | Decisão | Dono seguinte |
|---|---|---|
| **A3** — "Ver evidência" só existe no painel de divergência; Coleta e gap mostram só "N anexos" | **Entra agora**: exibir também em Coleta e no gap, escopo mínimo | Regua (spec com critério de aceite e tela) → Bussola |
| **A5** — dependência/ciclo entre gaps e ajuste de severidade/esforço sem tela | **Fica para depois**, com gatilho de volta declarado | Regua mantém no backlog (PRD M-14); Crivo exercita o ciclo pelo servidor na próxima rodada |

## A3 — entra agora

**O que existe.** A leitura já está pronta e auditada. `requestEvidenceUrl` (`apps/app/app/(meridian)/actions/report.ts:265`)
exige `evidence.read`, grava `meridian.evidence.read` antes de emitir a URL assinada e recusa evidência eliminada pela
retenção. Já existe um botão que a chama: `EvidenceButton` (`components/meridian/screens/tab-scoring.tsx:57`, commit
`c08657af`), mas só no painel de divergência de um eixo contestado (`DivergencePanel`, aba Scoring & Revisão). Eixo sem
divergência não abre esse painel, e em Coleta e no gap o consultor vê só "1 anexos" (`diario.md:112`). O caminho
existe, mas só num caso particular. A decisão é exibir o mesmo botão também em Coleta e no gap (correção do Crivo,
2026-09-29).

**Por que agora.** A evidência é o que separa um score "medido" de um "declarado" na escala de confiança que o
Meridian é dono (Mapa de fronteiras). Um consultor que não consegue abrir a evidência não consegue revisar o score
nem defender o relatório ao cliente. O Meridian abre a conta (`memoria-empresa.md`, tese comercial), e a esteira D-01
exige o produto terminado antes da venda. O custo é baixo: reaproveita uma action e um componente que já existem.

**LGPD.** O escopo não muda o tratamento de dado. É a mesma permissão, a mesma trilha e o mesmo bucket; só muda a
tela de onde a leitura parte. O parecer de 2026-09-24 (`docs/compliance/2026-09-24-parecer-meridian-respondente.md:20`)
já confirmou que essa leitura está correta. A retenção de 90 dias e a eliminação por DSAR estão implementadas
(`atrito.md:71`, parecer :53). Não consultei o Lacre. Se a spec passar a mostrar prévia do conteúdo, ou o nome do
arquivo em lugar novo como lista ou exportação, aí passa pelo Lacre antes de ir para dev.

**Escopo para a spec (Regua):**
- Onde hoje aparece "N anexos" (Coleta e gap), o consultor abre cada evidência pelo mesmo `EvidenceButton`.
- Nenhuma prévia inline e nenhum download em lote. Um clique gera uma URL assinada e uma linha de auditoria.
- Evidência eliminada pela retenção aparece como eliminada, sem botão ativo.
- Quem não tem `evidence.read` não vê o botão. O servidor já recusa; a spec cobre só a tela.
- Critério de aceite mínimo: M8 do dogfood prova `meridian.evidence.read` na trilha a partir de Coleta e a partir do gap.

## A5 — fica para depois

**O que existe.** A derivação de gaps funciona pela tela (M6 ok, `diario.md:87`). Criar, ajustar, remover e ligar
gaps existe só no servidor: `upsertGap`, `deleteGap`, `linkGapDependency` e `unlinkGapDependency`
(`actions/gaps.ts:152-356`). Nenhum componente do Meridian chama essas actions. O PRD já registra isso: M-14 P2
"parcial" (`meridian-prd.md:122`). O próprio diário classifica o A5 como "Info" e passa o dono ao QA
(`diario.md:114`).

**Por que depois.** É P2 no PRD. O dogfood rodou M1–M11 sem precisar dessas telas. A primeira venda está travada por
jurídico e contrato, não por isso (`memoria-empresa.md`). E fazer a tela de dependências com recusa de ciclo é trabalho
maior que o A3: grafo, mensagem nomeando os gaps do ciclo, edição de severidade e esforço.

**Gatilho para voltar.** O que acontecer primeiro:
1. O primeiro assessment de cliente externo passa da coleta (a consultora vai precisar corrigir gap à mão).
2. A consultora pede ajuste de gap numa rodada de dogfood e não tem caminho.
3. O Crivo acha, pelo servidor, defeito na recusa de ciclo.

**Enquanto isso:** o Crivo exercita o ciclo e o ajuste pelo servidor (teste de action) na próxima rodada, para o
FR-023 não ficar sem prova.
