# Regra de maturidade e teste de carga (k6)

- **Autor:** Norte (CPO) · **Data:** 2026-09-26 · **Status:** aprovado pelo CEO para virar spec
- **Dono da spec:** Regua (PO) · **Dono do como:** Maestro

## Por que

O foco atual é Meridian e Charter, mas os outros produtos precisam chegar ao
cliente funcionando e com teste de cliente consolidado. O CEO propôs adotar k6
para testar carga nos produtos quando a maturidade estiver perto de 100%.

k6 responde **"aguenta muita gente ao mesmo tempo?"**. Ele não responde
**"o cliente consegue fazer a jornada?"** — isso é Playwright por persona e
dogfood. Os dois são necessários, nessa ordem.

| Pergunta | Ferramenta | Estado hoje |
|---|---|---|
| Cliente completa a jornada? | Playwright por persona | Existe: `apps/app/e2e/swarm/` (RTE, PO, SM, LPM, DevOps) + dogfood Meridian |
| Aguenta concorrência? | k6 | Não existe (k6 não instalado, nenhum doc cita) |
| Aguenta volume de dados? | Seed de volume + medição | Só Meridian: `apps/app/e2e/meridian-load.spec.ts` (200 assessments / 2.000 gaps, orçamento 2s, só local) |

## Regra de maturidade (gate de entrada do k6)

Um produto só entra no teste de carga quando cumprir **as três**:

1. **SCs formais escritos e verdes** no E2E — jornada Playwright da persona
   principal passando.
2. **Dogfood sem P0/P1 aberto** e P2 com dono e data.
3. **Condições de compliance para cliente externo** cumpridas, quando o produto
   coleta dado de terceiro (ex.: Meridian, `docs/compliance/2026-09-24-parecer-meridian-respondente.md` §4).

Sem o gate, k6 mede velocidade de produto que ainda quebra.

## Meta de carga (hipótese — validar com leads)

- Cenário de referência: **PI Planning de um cliente ICP** (RTE, 3+ ARTs,
  lead primário TOTVS — `memoria-empresa.md`, `project_cosmos_strategy`).
- **Hipótese sem fonte:** pico de algumas centenas de usuários simultâneos
  **num único tenant**; dezenas de tenants ativos no total. Validar com os 3
  leads antes de fixar número. Precedente de número irreal levando a otimizar a
  coisa errada: `docs/qualidade/escala-backoffice-10k.md`.
- Critério de aprovação sugerido (hipótese): p95 < 2s nas telas críticas
  (mesmo orçamento do SC-010 do Meridian), erro < 1%.

## Ordem

1. Meridian (já tem teste de volume e dogfood em curso)
2. Charter (em foco; falta SC formal)
3. Signal (tem jornada e teste de isolamento de tenant; 0 SC no spec)
4. Scaffold, Cosmos, Backoffice — quando passarem no gate

## Restrições (não negociáveis)

- **Nunca rodar k6 contra produção.** Produção usa pooler Supabase (6543) e
  dado real; carga sintética contamina dado e gera custo Vercel/Supabase.
  Ambiente: local ou staging dedicado.
- k6 não é épico prioritário: o que trava a primeira venda é jurídico e
  contratual (parecer de gravação, DPA com fornecedores, CAC). A integração com
  bot de reunião já foi entregue (`memoria-empresa.md`, corrigido em
  2026-09-22). k6 é critério de liberação de produto, não feature.

## Risco técnico (decisão do Maestro)

As mutações do app são Server Actions do Next.js, com IDs gerados no build.
k6 HTTP puro tem dificuldade com isso. Opções: módulo browser do k6, ou exercitar
rotas/route handlers. Afeta prazo — Maestro escolhe.

## Pedido ao PO

Transformar em spec:
- Definir o gate (itens 1–3) como checklist reutilizável por produto.
- Escrever SCs de carga por produto, começando pelo Meridian.
- Levantar com o CEO o número real de concorrência por tenant.

## Decisões

- 2026-09-26 — CEO aprova adotar k6 como critério de liberação, após gate de
  maturidade. Meta de concorrência segue como hipótese até validação com leads.
