# Quickstart — validar o Scaffold

Guia de execução. Prova que cada critério de [`spec.md`](spec.md) §Success
Criteria roda de verdade. Não contém implementação — ver [`plan.md`](plan.md)
para a estrutura e `tasks.md` (após `/speckit-tasks`) para as tarefas.

---

## Pré-requisitos

```bash
pnpm install
```

Docker rodando (Postgres local), e um tenant de teste com o módulo contratado.
Sem a linha em `TenantModule` o layout redireciona para `/scaffold-indisponivel`
— que é o comportamento correto, e vale testar antes de considerá-lo bug.

---

## 1 · Migration

```bash
pnpm migrate
```

Roda `prisma format` + `generate` + `db push`. Depois disso, `ProductModule`
deve conter `SCAFFOLD`:

```bash
grep -A6 'enum ProductModule' packages/database/prisma/schema/modules.prisma
```

---

## 2 · Seed dos templates

Três templates por arquétipo (S-12), cada um com as quatro fases, passos e
critérios de gate — os do protótipo (`triage v3/v4`, `docreview v2`,
`reporting v3`).

```bash
pnpm --filter @repo/database seed:scaffold
```

Verificar que a versão publicada é imutável (ST-01): nenhuma action expõe
update, e a tabela não tem `updatedAt`.

---

## 3 · Subir o app

```bash
pnpm dev
```

- Cliente: `http://localhost:3012/scaffold` → portfólio de trilhas
- Back-office (fila de supervisão): `http://localhost:3013/scaffold-supervision`

---

## 4 · Suíte de testes

```bash
pnpm test
```

Cobertura ≥ 80% (gate bloqueante de CI). Para rodar só o Scaffold:

```bash
pnpm --filter app test scaffold
```

### A suíte que prova o produto

`gates-negative.test.ts` — uma asserção por linha do contrato de bloqueio em
[`contracts/server-actions.md`](contracts/server-actions.md):

| Cenário | Erro esperado | Req |
|---|---|---|
| fechar com passo requerido `TODO` | `STEPS_INCOMPLETE` | SG-01 |
| fechar com critério não atendido, sem override | `CRITERIA_UNMET` | SG-02 |
| override com `rationale` vazia ou só espaços | `RATIONALE_REQUIRED` | SG-03 |
| override com `unmetCriteria` vazio | `UNMET_CRITERIA_REQUIRED` | SG-03 |
| fechar `ASSESS` com caso de negócio em `DRAFT` / `AWAITING` / `CONTESTED` | `BASELINE_NOT_SIGNED` | SG-04 |
| fechar `SCALE` com Charter ativo e sem ack | `CHARTER_POLICY_NOT_ACKED` | SG-05 |
| fechar `SCALE` **sem** Charter contratado | passa | SG-05 condicional |
| `UPDATE` / `DELETE` em `GateResult` ou `GateOverride` | nenhuma action expõe | SG-07 |

`gates-architecture.test.ts` — grep no source: falha se
`state: "CLOSED"` (ou o enum equivalente) for escrito fora de
`closePhase()` em `actions/gates.ts`. É o teste que impede que a invariante seja
contornada por um atalho de UX seis meses depois.

---

## 5 · Cenários end-to-end

```bash
pnpm --filter app test:e2e scaffold
```

**SC-001 — ciclo completo sem engenharia.** `scaffold-track-lifecycle.spec.ts`:
promover lacuna do Meridian → trilha nasce com 4 fases → executar passos →
assinar caso de negócio → fechar `ASSESS` → `PILOT` com override atribuído →
`SCALE` com ack do Charter → fechar `EMBED` → `OBSERVING` → avançar o relógio
30 dias → `status = EMBEDDED`.

**SC-003 — publicação não move trilha em curso.** Criar trilha na `v3`,
publicar `v4` que altera passos e critérios, reler a trilha: conjunto de passos
byte-idêntico.

**SC-004 — export do Signal.** Fixture do `BC-104` valida contra o schema Zod
dos shapes v2 e v1 de
[`contracts/signal-baseline-export.md`](contracts/signal-baseline-export.md) e
importa sem transformação.

**SC-005 — isolamento.** `tenant-isolation.test.ts`: tenant A não lê artefato,
trilha nem caso de negócio do tenant B por nenhum caminho de action. Inclui a
fila de supervisão: `listGateQueue` devolve `QueueEntry` de shape fechado, sem
artefato e sem texto de critério (SN-06).

---

## 6 · Estagnação (S-09)

Sem esperar 14 dias: recuar `lastGateAt` de uma trilha e disparar a função
Inngest local.

```bash
pnpm --filter app inngest:dev
```

Esperado: trilha marcada `STALLED`, badge da sidebar incrementa, notificação
enfileirada para dono e sponsor. A notificação é fire-and-forget — se o
provedor cair, a varredura ainda termina (constituição II).

---

## 7 · Gates de qualidade antes do PR

```bash
pnpm check
```

```bash
pnpm --filter app typecheck
```

```bash
pnpm build
```

Bloqueantes no CI: `biome check` → `test:coverage` (≥80%) → security audit
(high/critical) → `build`. `typecheck` é informativo no CI — rodar local.

---

## 8 · Acessibilidade (SN-10)

WCAG 2.2 AA em toda superfície de cliente. Dois pontos herdados do protótipo que
o axe cobra e que já vêm resolvidos no design:

- Alvo de toque de 44px em ponteiro grosso (`@media (pointer:coarse)` no CSS).
- `generateMetadata` na rota única — sem ele, toda aba lê `localhost:3012` e o
  axe acusa em todas as telas.

---

## Checklist de aceite

- [ ] `SCAFFOLD` em `ProductModule`; tenant sem a linha vai para `/scaffold-indisponivel`
- [ ] Lacuna promovida gera trilha com `MeridianGapPromotion.targetEntityId` preenchido
- [ ] Toda linha de `gates-negative.test.ts` passa
- [ ] `gates-architecture.test.ts` passa
- [ ] Publicar `v4` deixa trilha na `v3` intacta
- [ ] Caso de negócio assinado é imutável; editar cria versão
- [ ] Fila de supervisão não devolve artefato nem texto de critério
- [ ] `apps/app` não importa `platformDb` (teste da ADR-0013 verde)
- [ ] Cobertura ≥ 80%
- [ ] Completion doc em `.claude/completions/YYYY-MM-DD-scaffold-<fatia>.md`
