# Plano — Nebuloz como cliente da própria esteira

**Status:** aprovado em 2026-09-24 (D1 ordem confirmada · D2 = b · D3 = manter AS-NBZ-001 · D4 = "vai" por passo) · **Dono:** Morgana · **Data:** 2026-09-23

## Objetivo

Validar cada produto da franquia usando a Nebuloz como cliente real, em produção
(`app.nebuloz.ai`), um produto por vez, na ordem em que um cliente atravessa a
esteira. O Back-office fica fora deste plano.

"Validado" quer dizer: todo critério de sucesso (SC) da spec foi provado com
evidência de produção, nenhum atrito P0/P1 ficou aberto, e a saída do produto
alimentou o próximo produto sem nenhum atalho por SQL.

## Ordem da esteira

| # | Produto | Por que nesta posição | Fonte dos critérios |
|---|---|---|---|
| 1 | **Meridian** | É a porta de entrada: diagnostica e produz as lacunas (`MeridianGap`) | `specs/001-meridian-diagnose/spec.md` SC-001..010 |
| 2 | **Scaffold** | Recebe a lacuna promovida (`MeridianPromotionTarget.SCAFFOLD`) e executa a trilha | `specs/002-scaffold-adoption/spec.md` (7 SCs) |
| 3 | **Charter** | Governança das iniciativas que o Scaffold abre (Scaffold US7 exporta para o Charter) | `docs/superpowers/specs/2026-08-*-charter-*.md`, ADRs 0002–0010 — **sem SCs formais** |
| 4 | **Cosmos** | Execução SAFe do que foi aprovado | `docs/produto/cosmos-prd.md` (22 requisitos) — **sem SCs formais** |
| 5 | **Signal** | Mede a adoção e o valor do que foi executado | `specs/003-signal-measure/spec.md` — **0 SCs, e o código ainda não está na main** |

## Ciclo padrão por produto (6 passos)

Os seis passos se repetem em cada produto. Nada pula etapa.

1. **Roteiro** — Regua (PO) transforma os SCs e o PRD num roteiro de dogfood:
   um passo por tela ou ação, cada um com o resultado esperado e a evidência a
   coletar. Para produto sem SCs formais, Regua os escreve primeiro e o Norte
   aprova. → `docs/qualidade/dogfood/<produto>/roteiro.md`
2. **Ensaio** — Crivo (QA) roda o roteiro no ambiente local e escreve o E2E
   Playwright do fluxo principal. Hoje nenhum dos 5 produtos tem E2E.
   → `apps/app/__tests__/e2e/<produto>-dogfood.spec.ts`
3. **Execução em produção** — a Nebuloz opera como cliente. Cada escrita em
   produção exige um "vai" do CEO. O que se faz fica registrado em
   `dogfood/<produto>/diario.md`.
4. **Atrito** — cada tropeço vira uma linha `P0..P3 | tela | passo de reprodução | dono`
   em `dogfood/<produto>/atrito.md`. Morgana distribui cada linha ao dev do
   produto pela esteira normal (spec → dev → Crivo → PR).
5. **Correção** — o dev corrige, Crivo aprova, o CEO faz o merge, e o passo
   afetado é repetido em produção.
6. **Gate de saída** — todos os SCs provados (com print, id ou linha do log de
   auditoria), zero P0/P1 abertos, E2E verde no CI, Sentry sem erro novo do
   produto por 7 dias e runbook de operação em `docs/runbooks/<produto>.md`.
   A saída real do produto (lacuna, trilha, iniciativa) vira a entrada do
   próximo.

## Produto 1 — Meridian (detalhado)

**Estado:** implementado (9 telas, 27 modelos). O AS-NBZ-001 foi carregado
**por SQL** (`packages/database/scripts/2026-09-diagnostico-nebuloz.sql`, #162).
`tasks.md` tem 82 tarefas desmarcadas mesmo com o código entregue: está
desatualizado e não prova nada.

| Passo | O quê | Quem | SC provado |
|---|---|---|---|
| M1 | Abrir o AS-NBZ-002 pela carteira, do zero | CEO (consultor) | SC-001 (início) |
| M2 | Convidar respondentes por eixo (link com token) | CEO | — |
| M3 | Respondentes preenchem a bateria v3.2 e anexam evidência, cronometrados | ver D2 | SC-006 (<10 min) |
| M4 | Scoring → comparar com o AS-NBZ-001 usando as mesmas respostas | Bussola + Crivo | SC-002 |
| M5 | Fila de revisão: eixos contestados entram, override com rationale | CEO | SC-003, SC-004 |
| M6 | Gap register + plano de 12 meses; conferir a topologia | Crivo | SC-007 |
| M7 | Relatório gerado sem planilha auxiliar | CEO | SC-001 (fim) |
| M8 | Amostragem na trilha de auditoria de leitura de evidência | Crivo | SC-008 |
| M9 | Promover ≥1 lacuna para o Scaffold; tentar editar a lacuna fora do Meridian | CEO + Crivo | SC-009 → entrada do Scaffold |
| M10 | Carga: 200 assessments / 2.000 gaps **só no local** (não sujar prod) | Crivo | SC-010 |
| M11 | Benchmark: com coorte < 5, nenhuma comparação aparece | Crivo | SC-005 |

Pareceres: **Lacre**, porque respondente + evidência é coleta de dado pessoal
(gate da esteira), e o **Vigia** (security), porque o link do respondente fica
fora do guard de tenant.

## Produtos 2–5 (esboço, detalhamento no gate anterior)

- **Scaffold:** entrada = lacuna promovida no M9. Caso de negócio → template da
  trilha (governança, conformidade ou segurança, `docs/produto/trilhas/`) →
  supervisão no back-office (ADR-0017) → export para o Charter.
- **Charter:** entrada = export do Scaffold. Onboarding → política gerada →
  aprovação com caminho congelado (ADR-0005) → pacote de evidência com diff
  real (#240).
- **Cosmos:** entrada = iniciativa aprovada no Charter. Portfólio → ART → PI
  Planning. A trava de estratégia (bot de reunião) entra aqui como SC.
- **Signal:** primeiro o merge da worktree na main (Farol), depois o roteiro.

## Decisões do CEO antes de começar

- **D1 — ordem:** Meridian → Scaffold → Charter → Cosmos → Signal. Confirma?
- **D2 — respondentes do Meridian:** (a) só você, (b) você + agentes via
  browser respondendo como "auditoria de repo", como no SQL, (c) pessoas reais
  além de você. Recomendo (b): reproduz o AS-NBZ-001 e permite comparar.
- **D3 — AS-NBZ-001 (SQL):** manter como gabarito de comparação (recomendado)
  ou apagar depois que o AS-NBZ-002 existir.
- **D4 — "vai" em produção:** por operação (a regra atual) ou por passo do
  roteiro (M1..M9)? O segundo é mais rápido, e cada passo é listado antes.

## Riscos

- **ALTO** — agentes param no prompt "read outside working directories" (a Lacre
  já parou). Sem a opção 1 liberada, nenhum papel lê o repo.
- **ALTO** — Charter, Cosmos e Signal não têm SCs: o gate de saída deles não
  existe até a Regua escrever os critérios.
- **MÉDIO** — dado real da Nebuloz em produção se mistura ao benchmark pool
  (SC-005). Confirmar que o opt-in está desligado para o tenant interno.
- **MÉDIO** — `tasks.md` do Meridian desatualizado engana quem ler o estado pelo
  arquivo.
- **BAIXO** — o E2E em produção suja dados. O E2E roda só no local; em produção
  o roteiro é manual.

## Complexidade

Meridian: **MÉDIA** (o produto existe; o trabalho é roteiro, E2E e correção de
atrito). Charter, Cosmos e Signal: **ALTA** por causa dos SCs que faltam.
