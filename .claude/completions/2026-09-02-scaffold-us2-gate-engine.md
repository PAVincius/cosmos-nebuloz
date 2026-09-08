# Scaffold — US2: gate engine (T031–T048)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

A invariante do produto. O SRD: *"o comportamento bloqueante do gate é o
produto. Qualquer caminho de código que feche uma fase sem registrar critérios
atendidos ou um override atribuído é defeito de correção de severidade máxima,
não atalho de UX."*

- **`lib/scaffold/gate-machine.ts`** — a máquina como lógica pura, sem Prisma:
  tabela de transição, `canEnterGateReady` (SG-01), `evaluateCriteria` (SG-02).
- **`actions/gates.ts`** — `evaluateGate`, `closePhase`, `overridePhase`,
  `reopenPhase`, `acknowledgeCharterPolicy`. `closePhase` é o único dono da
  transição; `overridePhase` monta a decisão e delega.
- **Modelos** — `ScaffoldGateResult` e `ScaffoldGateOverride`, append-only, sem
  `updatedAt`.
- **`lib/scaffold/action.ts`** — `scaffoldAction`, que preserva o código da
  recusa. O `safeAction` de `_base.ts` descarta `code`, e o teste negativo
  asserta a razão exata.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` em `apps/app` | 0 erros |
| `biome check` nos arquivos do Scaffold | 0 erros |
| Suíte `apps/app` | 352 arquivos, 3435 testes, 0 falhas |
| Testes novos nesta fatia | 73 (117 no total do Scaffold) |

TDD respeitado desta vez: `gate-machine.test.ts` escrito primeiro, RED
confirmado (`Cannot find module`), depois a implementação. Era a dívida que a
US1 deixou registrada, e a lógica pura é exatamente onde ela era pagável.

## Três decisões que divergem do plano

**1. `assertBaselineSigned` bloqueia de verdade, em vez de ser stub.**
T044 pedia guards "que hoje passam", preenchidos em US4. Não fiz: um gate cuja
trava mais forte é no-op durante uma fatia inteira é o produto entregue
desligado exatamente onde o SRD manda a severidade ser máxima. Entrou uma
âncora mínima de `ScaffoldBusinessCase` — cinco colunas, `signedVersionId`
sendo a que SG-04 lê. US4 acrescenta versões, métricas e contestação por cima.

Consequência aceita e declarada: enquanto US4 não chega, nenhuma trilha fecha a
Fase 1. É o comportamento correto — sem caso de negócio, não há baseline
assinado.

**2. `charterPolicyId`/`charterPolicyAckAt` entraram agora, não em US7.** Duas
colunas nuláveis pelo mesmo motivo: SG-05 precisa de onde ler para bloquear.

**3. `@@unique([tenantId, phaseInstanceId, cycle])`, não
`[phaseInstanceId, cycle]`.** Ver abaixo.

## Dois erros meus que os testes pegaram

**O teste de arquitetura estava procurando o sintoma.** A primeira versão
procurava o literal `state: "CLOSED"` e não achava nada no próprio arquivo dono
— porque `gates.ts` escreve `state: to`, com `to` vindo de `nextState()`. Além
disso, casava fixtures de teste. Reescrito para o ponto de estrangulamento real:
`scaffoldPhaseInstance.update`. Quem quisesse contornar a regra escreveria
`state: algumaVariavel` e passaria pela versão antiga.

**Uma inconsistência no meu próprio `data-model.md`.** Ele especificava
`phaseInstanceId @unique` em `GateResult`. Com unicidade simples, fechar uma
fase reaberta obrigaria a sobrescrever o resultado anterior — a edição
destrutiva que SG-07 proíbe. Corrigido para incluir `cycle`.

**E `tenant-unique-keys.test.ts`, que já existia, pegou a chave nova**: modelo
com `tenantId` não pode ter `@@unique` que o omita. Aqui era redundante
(`phaseInstanceId` é cuid global e já implica o tenant), mas a regra vale pelo
caso em que não é — abrir exceção para o caso fácil é como as regras morrem.
Chave escopada, sem exemption.

## Cobertura do contrato de bloqueio

| Req | Recusa | Testado |
|---|---|---|
| SG-01 | `STEPS_INCOMPLETE` | TODO, ACTIVE, e opcional não bloqueia |
| SG-02 | `CRITERIA_UNMET` | não atendido, ausente, e a fase vai a BLOCKED |
| SG-03 | `RATIONALE_REQUIRED` / `UNMET_CRITERIA_REQUIRED` | vazia, só espaço, "ok", lista vazia, override sobre fase não bloqueada |
| SG-04 | `BASELINE_NOT_SIGNED` | DRAFT, AWAITING, CONTESTED, ausente — **e por override também** |
| SG-05 | `CHARTER_POLICY_NOT_ACKED` | com Charter, com ack, e degradação sem Charter |
| SG-06 | — | EMBED vai a OBSERVING com janela de 30d; trilha **não** vira EMBEDDED |
| SG-07 | — | ciclos 0/1/2 geram três registros; reabrir não toca no anterior |

O ator do override vem da sessão, nunca do payload — testado.

## O que fica para a próxima fatia

- **US3 (T049–T064)** — shell, portfólio e detalhe de trilha. Primeira
  superfície visível.
- `evaluateGate` já devolve `criteria`, `canClose`, `blockers` e `pendingSteps`
  no formato que o painel de gate consome.
- Migration real continua pendente: o worktree não tem `.env`. Schema validado,
  client gerado.
