# Scaffold — US7: Charter, observação e export (T112–T123)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

O ciclo fecha. A janela de observação agora termina sozinha, a política do
Charter aparece onde SG-05 a cobra, e o artefato assinado tem por onde sair.

- **`lib/scaffold/observation.ts`** — o veredito da janela de 30 dias, puro.
- **`lib/inngest/scaffold-observation.ts`** — varredura diária que entrega a
  trilha ao fim da janela.
- **`lib/scaffold/signal-export.ts`** — `toSignalV2` e `toSignalV1`, puros.
- **`actions/export.ts`** — `exportBusinessCase`, só sobre versão assinada.
- **`CharterPolicyCard`** em `track-detail.tsx` — S-11, só na Fase 3.
- **`reopenCountAtClose`** em `ScaffoldPhaseInstance`.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| `biome check` | 0 erros |
| Suíte `apps/app` | 3566 testes, 0 falhas |
| Testes novos | 26 (248 no Scaffold) |

TDD respeitado nas duas peças de lógica pura: teste primeiro, RED confirmado,
implementação depois.

## O que a US2 já tinha deixado pronto

T112, T115, T116, T117 e T119 vieram de graça — o guard SG-05, as colunas de
política e a transição `EMBED → OBSERVING` foram escritas na fatia do gate
engine, quando eu preferi guards reais a stubs. Metade da US7 já estava paga.

## Três decisões da fatia

**`reopenCountAtClose` é o par que faz SG-06 funcionar.** Sem ele, uma trilha
que tropeçou uma vez em janeiro jamais poderia ser entregue: o contador de
reaberturas nunca zera. O que invalida a entrega é reabrir DEPOIS que a
contagem começou, não o histórico.

**A janela termina no 30º dia, não no 31º.** `<= 0`, não `< 0` — exigir o dia
seguinte cobraria um dia a mais do cliente por causa de arredondamento.

**A primeira leitura é calculada aqui, não pelo Signal.** Deixar para o
consumidor significaria as duas pontas implementarem a mesma regra de
calendário, e regra de calendário duplicada diverge em fevereiro.

**O v1 do SRD §6 é derivação, não schema.** A única conversão de unidade do
contrato — percentual para fração na taxa de erro — vive no produtor. Métrica
ausente vira `null` e não falha: um consumidor que espera três números lida
melhor com um nulo do que com um erro.

## O teste de arquitetura me pegou duas vezes seguidas

**Primeira:** o cron da observação zerava `observationEndsAt`, e o teste
reprovou o `scaffoldPhaseInstance.update`. Tinha razão — `closePhase` é o único
dono da escrita de fase, e abrir exceção "só para limpar um campo" é como a
regra morre. Removi a escrita: `observationEndsAt` no passado com a trilha em
`EMBEDDED` já é o estado correto, e `observationVerdict` lê exatamente isso.
Menos escrita, invariante intacto.

**Segunda:** o teste reprovou o literal `state: "OBSERVING"` no `where` da
consulta — filtro de LEITURA, não escrita. A regex não distingue os dois. A
correção não foi refinar a regex: foi tratar como violação apenas quem escreve
fase **e** cita um estado de fechamento. Quem nunca chama
`scaffoldPhaseInstance.update` não tem como fechar nada.

**É a terceira regex minha nesta implementação que casa mais do que devia** — as
duas anteriores foram comentários sendo lidos como código. O padrão é meu:
escrevo a busca pelo sintoma textual antes de perguntar qual é o ponto de
estrangulamento real.

## Um erro de runtime que o tipo pegou

`step.run` do Inngest serializa o resultado em JSON: a `Date` volta como
string. Comparar string com `Date.now()` daria `NaN` em silêncio, e a janela
nunca fecharia. O `tsc` acusou antes de rodar.

## O que fica

- **T124 (e2e do ciclo completo) não foi escrito.** Ele exige banco: promover
  lacuna → 4 fases → assinar → fechar ASSESS → override no PILOT → ack do
  Charter no SCALE → EMBED → 30 dias → EMBEDDED. Sem `.env` no worktree, um
  spec que não roda é spec que mente sobre cobertura. É a primeira coisa a
  fazer quando houver banco.
- **US8 (T125–T132)** — handover pack. Última fatia.
- **`exportBusinessCase` não tem botão.** A action existe e está testada; o
  gatilho na tela entra quando houver decisão sobre quando exportar
  (automático na assinatura, ou manual).
- Migration real segue pendente: worktree sem `.env`.
