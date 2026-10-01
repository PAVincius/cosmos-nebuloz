---
status: approved
---

# Intent: Trilha "Fundação de Prontidão de IA" no Scaffold (D-24)

**Feature Branch**: `013-scaffold-ai-readiness-foundation`

**Created**: 2026-09-30

**Input**: descrição original do usuário: pedido do CEO via Morgana e Norte — trilha do Scaffold derivada do diagnóstico do Meridian (faixas por eixo, arquétipos, molde `ai-readiness-foundation`, overlay de entregável, cliente fictício Atlas). Decisão D-24, revisada (commit `08326db2`: A4 política mínima, S3/E3 reavaliação do Meridian, P1/P2/P3 separados, 16 entregáveis) e `§7.7` (commit `9e8ea5cd`: dispensa automática do A2, requirementRefs finais, overlay de critério recusado como débito). D-25 (commit `9d2b28e9`: catálogo do Scaffold com no máximo 9 moldes — contexto de governança, sem requisito técnico nesta spec). D-27 (commit `822a161c`: Scaffold depende do Meridian — `sourceAssessmentId` obrigatório para trilha de prontidão; "Meridian assistido" e item de `Service` ficam para PR próprio do back-office). Tudo em `docs/produto/trilhas/framework-no-scaffold.md` §7-9, branch `docs/scaffold-trilha-framework`, e no briefing `.maestri/briefings/2026-09-30-scaffold-ai-readiness-foundation.md`. Entra num PR único do Andaime (cherry-pick de `537d8da1` e `643532a2`), sem depender de outro PR não mergeado, com os testes junto. **Aprovado por Morgana/Norte em 2026-09-30, com delegação do CEO.**

## Problema

O Meridian mede prontidão de IA por eixo (score 0-100, confiança 0-1) mas não traduz esse número em nada acionável: não há faixa (Inicial/Em formação/Estruturado/Maduro), não há arquétipo (padrão entre os cinco eixos que diz "por onde começar"), e não há trilha do Scaffold que nasça desse diagnóstico. O Scaffold, por sua vez, força toda trilha a ter uma forma de trabalho (`archetype: WorkForm` obrigatório) — uma trilha de prontidão organizacional não é uma forma de trabalho, e não tem como os entregáveis citarem a norma que cobrem, nem como um cliente remover um entregável que não se aplica (ex.: "já temos papéis de dado formais") sem enfraquecer silenciosamente um gate.

## Contexto

Superado o pedido anterior (D-23, schema mínimo genérico) — este é o pedido concreto e prioritário: **D-24**, a trilha que o CEO escolheu. O mecanismo genérico de D-23 entra só na parte que esta trilha usa de fato (ver Restrições); o resto de D-23 (F2 perfil de organização) fica fora, explicitamente, porque nesta trilha quem varia é o arquétipo do Meridian, não o perfil do cliente — a variação por cliente entra por overlay (caso Atlas).

Fonte de verdade dupla, já reconciliada por Norte: o briefing original do CEO (resumo fiel da pesquisa) e o documento técnico de encaixe (`framework-no-scaffold.md` §7), que resolve toda ambiguidade do briefing contra o código atual — inclusive os dois pontos que eu (Regua) teria deixado em aberto: quais perguntas do Meridian alimentam "Governança de papel" e "Campeão isolado" (`Q-G01/02/03`, `Q-E03` — `packages/provisioning/src/meridian.ts:126,136,146,116`), e a ordem de dominância entre arquétipos.

Entrega: **um PR só** (do Andaime), cherry-pick de dois commits da branch de decisão, migration + seed + overlay + função de faixas/arquétipos + testes, tudo junto. Eu não abro PR; o commit desta spec entra na branch do Andaime quando ela existir.

## Restrições

- **Sem depender de PR aberto não mergeado.** A parte de D-23 que esta trilha precisa (F3 — `archetype` opcional) entra NESTE PR, não no PR da spec 013 genérica (que fica sem efeito prático — ver Fora de escopo).
- **F1 (`requirementRefs`) entra parcialmente**: só nos entregáveis do EMBED, e só com códigos que **já existem** no catálogo do Charter (ISO-CL04..10, NIST GOVERN/MAP/MEASURE/MANAGE 1-2, AIA-09..15, LGPD-ART*). Nenhuma ampliação de catálogo neste PR — isso é trabalho do Lacre, para a trilha AI Governance, depois.
- **F2 (perfil de organização) NÃO entra** nesta trilha.
- **F4 (oferta comercial) sem mudança** — continua só no `Service` do back-office.
- **SG-04 continua bloqueando o fechamento da ASSESS sem caso de negócio assinado** (`actions/gates.ts:107-126`) — o baseline desta trilha é os scores por eixo do assessment de origem, com meta de faixa do EMBED; não é uma exceção ao gate, é o conteúdo do caso de negócio.
- **Todo critério de gate é `MANUAL` na v1** — nenhum critério lê o score do Meridian automaticamente ainda; os dois critérios que citam o Meridian (SCALE, EMBED) fazem isso em texto, citando o código do reassessment.
- **Overlay de entregável**: REMOVE de entregável obrigatório só pelo papel CONSULTANT, sempre com motivo, e a instância nasce dispensada (nunca some); REMOVE de passo que é único produtor de entregável obrigatório é recusado, a menos que o mesmo overlay também dispense esse entregável.
- **Nenhum entregável exige módulo contratado** (`requiresModule` nulo em todos) — quem contrata esta trilha já veio do Meridian.
- **Conteúdo é fechado, não é mais slot**: as três fases/13 entregáveis, os critérios de gate e o seed do Atlas já estão especificados em `framework-no-scaffold.md` §7.6-§7.8 — esta spec os transcreve, não inventa.

## Resultado desejado

Um assessment do Meridian, ao fechar, expõe faixa por eixo e arquétipo dominante (+ traço secundário) no relatório. Uma trilha do Scaffold nasce do molde global `ai-readiness-foundation` (sem forma de trabalho), com os 13 entregáveis das quatro fases já carregados — o A2 (ata do workshop) nasce obrigatório só se algum eixo tiver confiança abaixo de 0,6, senão dispensado com motivo. Um consultor pode, por overlay, substituir um passo ou o título de um entregável livremente, e remover um entregável obrigatório só informando motivo — a instância fica visível como dispensada, nunca desaparece. O cliente fictício Atlas prova o mecanismo de ponta a ponta: seus scores produzem "Piloto sem chão" dominante com traço "Campeão isolado", o eixo Pessoas aparece marcado "não confiável" (confiança 0,55), e a trilha fecha a ASSESS com o baseline assinado.

## Fora de escopo

- **F2** (perfil de organização) — não entra nesta trilha.
- **Ampliação do catálogo do Charter** — só códigos já existentes; PL 2338, artigos específicos do AI Act e o Anexo A da ISO ficam para a trilha AI Governance, depois.
- **Avaliação `DERIVED`** de critério de gate (leitura automática do score do Meridian) — fica para quando existir a costura Meridian → Scaffold de leitura do reassessment ligado à trilha; revisão programada para 3 trilhas na SCALE ou 2026-12-15, o que vier primeiro.
- **A spec genérica anterior de D-23** (schema mínimo isolado, sem trilha concreta) fica sem efeito prático — o que ela cobria (F3, parte de F1) entra aqui, no contexto da trilha real.
- Trilha AI Governance (trilha de apoio) e qualquer conteúdo dela.
