---
status: approved
---

# Intent: Gate de maturidade + teste de carga (k6)

**Feature Branch**: `007-gate-maturidade-carga`

**Created**: 2026-09-26

**Input**: descrição original do usuário: pedido do Norte (CPO), já aprovado pelo CEO pra virar spec — `docs/produto/regra-maturidade-e-carga.md` (commit `b7e467f4`). Definir um gate de maturidade (3 critérios) que cada produto precisa cumprir antes de entrar em teste de carga com k6; escrever SCs de carga por produto, começando pelo Meridian; levantar com o CEO o número real de concorrência por tenant.

## Problema

O foco atual é Meridian e Charter, mas os demais produtos (Scaffold, Cosmos, Signal, Backoffice) também precisam chegar ao cliente funcionando e com teste de carga consolidado antes do lançamento. Hoje não existe k6 no repo (`docs/produto/regra-maturidade-e-carga.md:19`, "k6 não instalado, nenhum doc cita"), nem um critério formal de "quando um produto está maduro o suficiente pra medir carga". Sem esse gate, testar carga de um produto que ainda quebra na jornada básica mede a coisa errada — "aguenta muita gente ao mesmo tempo" não responde "o cliente consegue fazer a jornada".

## Contexto

Estado hoje, por tipo de teste (`regra-maturidade-e-carga.md:16-20`):

| Pergunta | Ferramenta | Estado |
|---|---|---|
| Cliente completa a jornada? | Playwright por persona | Existe: `apps/app/e2e/swarm/` (harness de personas RTE/PO/SM/LPM/DevOps) + dogfood do Meridian |
| Aguenta concorrência? | k6 | Não existe |
| Aguenta volume de dados? | Seed de volume + medição | Só Meridian: `apps/app/e2e/meridian-load.spec.ts` (200 assessments / 2.000 gaps, orçamento 2s, só local) |

O CEO aprovou adotar k6 como critério de liberação de produto, **depois** de um gate de maturidade — não como épico prioritário (o bloqueio nº 1 do trial TOTVS continua sendo a integração com bot de reunião). Ordem sugerida pelo CPO: Meridian (já tem teste de volume e dogfood em curso) → Charter (em foco, falta SC formal) → Signal (tem jornada e teste de isolamento de tenant, 0 SC no spec) → Scaffold/Cosmos/Backoffice, quando passarem no gate.

## Restrições

- **Gate de entrada (as três, não uma escolha)**: (1) SCs formais escritos e verdes no E2E — jornada Playwright da persona principal passando; (2) dogfood sem P0/P1 aberto, e P2 com dono e data; (3) condições de compliance cumpridas quando o produto coleta dado de terceiro (ex.: Meridian, `docs/compliance/2026-09-24-parecer-meridian-respondente.md` §4).
- **Nunca rodar k6 contra produção.** Produção usa pooler Supabase (6543) e dado real; carga sintética contamina dado e gera custo Vercel/Supabase. Ambiente: local ou staging dedicado.
- k6 é critério de liberação de produto, não feature — não compete por prioridade com o bloqueio nº 1 (bot de reunião).
- Meta de concorrência (algumas centenas de usuários simultâneos por tenant; dezenas de tenants ativos no total) é **hipótese sem fonte** — precisa validação com os 3 leads (TOTVS é o lead primário) antes de virar critério de aprovação real. Precedente de número irreal levando a otimizar a coisa errada: `docs/qualidade/escala-backoffice-10k.md`.
- Risco técnico registrado (decisão do Maestro, não do PO): mutações do app são Server Actions do Next.js com IDs gerados no build — k6 HTTP puro tem dificuldade com isso (módulo browser do k6 vs. exercitar route handlers). Afeta prazo, mas a escolha é do Maestro.

## Resultado desejado

Existe um checklist reutilizável (o gate de 3 critérios) que qualquer produto usa pra saber se já pode entrar em teste de carga. Existe pelo menos um SC de carga formal e verificável pro Meridian (primeiro da fila), com critério de aprovação sugerido (p95 < 2s nas telas críticas, erro < 1%) marcado como hipótese até validação com os leads. O número real de concorrência por tenant é levantado com o CEO antes de virar critério definitivo — até lá, spec e SCs deixam claro que é hipótese, não fato.

## Fora de escopo

- Rodar k6 de fato ou escolher a ferramenta de execução (browser module vs. route handlers) — decisão e execução do Maestro.
- Fechar SCs de carga formais para Charter, Signal, Scaffold, Cosmos ou Backoffice nesta rodada — a spec cobre o gate (reutilizável por todos) e o primeiro SC (Meridian); os demais entram quando passarem no gate, em rodada própria.
- Mudar a ordem de prioridade de produtos do roadmap — a ordem (Meridian → Charter → Signal → resto) é a que o CPO já registrou, não é decisão desta spec.
- Definir o número final de concorrência sem validação com os leads — fica registrado como pergunta ao CEO, não como decisão de intent.
