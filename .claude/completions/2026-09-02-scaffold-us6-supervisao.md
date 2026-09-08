# Scaffold — US6: supervisão e estagnação (T098–T111)

**Data**: 2026-09-02 · **Branch**: `claude/scaffold-html-impl-baa4f7`
**Plano**: [`specs/002-scaffold-adoption/plan.md`](../../specs/002-scaffold-adoption/plan.md)

## O que entrou

A fatia que sai de `apps/app`. A fila de gates é a única superfície do produto
que atravessa organizações, e por isso vive no back-office.

- **`apps/backoffice/app/actions/scaffold-supervision.ts`** — `listGateQueue` e
  `enterTenantContext`, via `platformDb`.
- **`apps/backoffice/app/(staff)/scaffold/`** — a tela, agrupada por tipo de
  trabalho, com o modal de travessia.
- **`apps/app/lib/scaffold/stall.ts`** — estagnação e taxa de override como
  lógica pura.
- **`apps/app/lib/inngest/scaffold-stall.ts`** — varredura diária, registrada em
  `/api/inngest`.
- **Nav do back-office** — "Fila de gates" na seção Delivery.

## Verificação

| Gate | Resultado |
|---|---|
| `tsc --noEmit` (app + backoffice) | 0 erros |
| `biome check` | 0 erros |
| Suíte `apps/app` | 3540 testes, 0 falhas |
| Suíte `apps/backoffice` | 300 testes, 0 falhas |
| Testes novos | 29 (19 backoffice + 10 app) |

## A decisão que a fatia executa

**A fila vive em `apps/backoffice` porque a ADR-0013 diz que tem de viver.**
Esta era a decisão registrada em research §R4 lá na Fase 0, e é a primeira vez
que ela custa alguma coisa: a tela está num app diferente do resto do produto,
com outro guard, outra casca e outro `safeAction`. O teste de fronteira em
`apps/app` (T015) continua verde porque ninguém precisou contorná-lo.

**SN-06 é defendido na CONSULTA, não na projeção.** Buscar o artefato e
descartá-lo depois deixaria o dado passar pela memória do processo, e a
primeira refatoração distraída o devolveria à tela. O `select` pede as chaves
dos critérios para contar, e nada mais.

O teste asserta o shape por **igualdade de chaves**, não `toMatchObject`: campo
a mais reprova. Um teste que só verificasse "a fila lista" passaria com o
vazamento dentro.

## Detalhes que não são óbvios

**Critérios DA FASE, não do template.** Contar todos faria a fila mostrar "0 de
3" para um gate que já tem dois atendidos — o template tem critérios das quatro
fases.

**Na observação, a idade é quanto já correu da janela**, não o tempo desde o
último gate. São números diferentes, e o que a consultora precisa saber é
quanto falta para os 30 dias.

**A varredura escreve só quando o estado MUDA.** Sem isso, toda trilha
estagnada gera uma escrita por noite e o audit vira ruído — e quem recebe a
notificação para de ler. Limpar a bandeira quando a trilha volta a andar é tão
importante quanto marcá-la: bandeira que nunca sai deixa de ser sinal.

**`overrideRate` devolve `null`, não zero, sem gates fechados.** Zero por cento
afirma "ninguém dispensou critério", que é diferente de "ainda não houve gate".

**A varredura não usa `platformDb`.** Ela roda no app do cliente e percorre
tenant a tenant. Ler todos de uma vez seria mais rápido e quebraria a ADR-0013
por conveniência de job.

## Erro meu, no fim

O `sed` que marca as tasks concluídas usou `T1[01][0-9]` e casou T112–T119 —
oito tarefas da US7 que não fiz. Revertido; o placar correto é 111/142, não
119. Padrão de intervalo largo demais, e a segunda vez que uma regex minha
casa mais do que devia nesta implementação.

## O que fica para a próxima fatia

- **US7 (T112–T124)** — Charter na Fase 3, janela de observação fechando
  sozinha, e o export para o Signal. É a fatia que fecha o ciclo ponta a ponta.
- **A varredura de observação (SG-06) ainda não existe.** `closePhase` abre a
  janela; nada a fecha. É T120, em US7.
- **A notificação de estagnação grava audit, não envia.** O `notify` no
  metadata nomeia quem precisa saber; o envio por `@repo/notifications` fica
  para quando houver decisão sobre canal.
- Migration real segue pendente: worktree sem `.env`.
