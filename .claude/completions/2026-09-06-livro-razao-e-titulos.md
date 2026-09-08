# 2026-09-06 — Livro-razão e títulos (D-a)

Spec: docs/superpowers/specs/2026-09-06-base-financeira-design.md (§1.1, §1.2, §2, §3, §4, §5, §6)
Plano: docs/superpowers/plans/2026-09-06-livro-razao-e-titulos.md
Ledger: .superpowers/sdd/2026-09-06-livro-razao-e-titulos/progress.md

Entregue, por task:

1. Schema e migration (`31e3863c`) — `Lancamento` e `Titulo` em
   `packages/database/prisma/schema/empresa.prisma`, retro-relações em
   `Tenant`. Migration `20260910000000_livro_razao_e_titulos`: cria as duas
   tabelas, copia cada `LancamentoMensal` para um `Lancamento` de abertura
   (`abert_<id>`, data no dia 1 da competência, "Saldo de abertura
   (migrado)"), depois RLS. `LancamentoMensal` não é apagado. Prova local
   (banco vazio na época, 3 linhas de teste inseridas e removidas):
   `mensais=3 aberturas=3 divergentes=0`.
2. Regras puras (`a399cb87`, fix `24b087a2`) —
   `apps/backoffice/lib/empresa/livro.ts`: `sinalDoGrupo`,
   `dreDeLancamentos`, `totalPorConta`, `totalPorCentro`,
   `situacaoDoTitulo`, `envelhecimento`, e o agregador por mês
   `agregarPorMes(Pick<LinhaDoLivro, "competencia" | "conta" |
   "valorCentavos">[])` (Ruling 1, tipo fechado no plano antes de executar
   para o `select` estreito do DRE entrar sem cast). Fix: tipagem do `status`
   padrão no teste de envelhecimento.
3. Actions (`73c4b6c3`, fix `a88e1753`) —
   `app/actions/empresa/livro.ts` (`listarLancamentos`, `criarLancamento`,
   `atualizarLancamento`, `excluirLancamento`) e
   `app/actions/empresa/titulos.ts` (`listarTitulos`, `criarTitulo`,
   `baixarTitulo`, `cancelarTitulo`). `baixarTitulo` gera o `Lancamento` na
   mesma `$transaction` da baixa. Fix round 1: `criarTitulo` e `baixarTitulo`
   não checavam conta ativa do plano (`contaValida` é só regex) — a baixa
   cria o `Lancamento` sem passar por `criarLancamento`, então um título em
   conta desativada ou inexistente lançaria dinheiro nela silenciosamente.
   `assertContaAtiva` (já existia, privada, em `livro.ts`) passou a
   exportada e é chamada em `criarTitulo` e de novo em `baixarTitulo` (a
   conta pode ser desativada entre os dois).
4. DRE e CAC leem o livro-razão (`1df24b00`) — `montarDre` troca
   `lancamentoMensal.findMany` por `lancamento.findMany` + `agregarPorMes`;
   `salvarLancamento` e o input de célula do DRE saem; cada célula vira link
   para a aba Lançamentos filtrada. `cac.ts` lê as seis contas 4.1–4.6 por
   `groupBy` em vez de escrevê-las; `ParcelasSchema` perde o campo `contas` e
   vira `z.strictObject` (Ruling 7 — `z.object` do zod 4 descarta chave
   desconhecida em silêncio, e o teste "enviar `contas` é recusado" só prova
   com strict). `calcularDre` não foi tocado. `intervaloDaCompetencia`
   exportada de `lib/empresa/periodo.ts` (Ruling 8, 7º arquivo do commit) em
   vez de reimplementar a conta de fim-de-mês em `dre.tsx`.
5. Aba Lançamentos (`6a8da885`) — tabela por intervalo, filtro por conta,
   busca, total do período, diálogo de criar/editar, seletor de aba.
6. Aba Títulos (`6e9d6ae9`) — duas listas (a pagar/a receber), chips de
   situação, cinco cartões de envelhecimento, diálogos de novo/baixar/
   cancelar. Ruling 10: `NovoTituloDialog` em arquivo próprio
   (`titulo-dialog-novo.tsx`, por tamanho) e prop `aberto` derivada de
   `titulo !== null` em vez de um boolean separado (Biome `noLeakedRender`
   reprovava o `&&` com a prop redundante).
7. Verificação e registro (esta task).

## Decisões tomadas ao planejar

Do pre-flight do ledger, fechadas antes da execução:

- **Ruling 1** — `agregarPorMes` recebe o `Pick` estreito de três campos, não
  `LinhaDoLivro` inteira, para o `select` de `montarDre` entrar sem cast.
- **Ruling 2** — a regra de nulo do DRE (conta sem linha = `null`, não zero)
  é preservada; migração fica número por número idêntica. Custo: mês novo
  exige uma linha em toda conta que se quer no total, como hoje exige célula
  — D-b pode revisitar.
- **Ruling 3** — `sinalDoGrupo` da spec §2 fica fora do escopo do DRE, que
  usa estrutura (grupos fixos), não sinal por linha. Custo se errado: uma
  função a mais no D-b.

## Rulings do ledger (durante a execução)

- **Ruling 4** — escritas de `livro.ts` devolvem `{id}` e o cliente
  recarrega a lista inteira em vez de fazer patch otimista. Aceito.
- **Ruling 5** — `atualizarLancamento` usa schema completo (o diálogo manda
  todos os campos, não um patch parcial). Aceito.
- **Ruling 6** — `criarTitulo` sem checagem de conta ativa **não** foi
  aceito: virou o fix round 1 (ver Task 3, acima). Confirmado pelo revisor
  como Critical.
- **Ruling 7** — `ParcelasSchema` vira `z.strictObject` (ver Task 4, acima).
- **Ruling 8** — `intervaloDaCompetencia` exportada de `periodo.ts` (ver
  Task 4, acima).
- **Ruling 9** — `$transaction` removida de `salvarParcelas` ao sumir o
  ramo de contas do CAC — sobrou uma escrita só, envolver em transação não
  protegia nada.
- **Ruling 10** — `NovoTituloDialog` em arquivo próprio e prop `aberto`
  derivada (ver Task 6, acima).

Reviews: Task 1 clean; Task 2 approved; Task 3 needs-fixes (Ruling 6,
Critical) → fix round `a88e1753` → re-review pendente no ledger no momento
deste registro; Task 4 approved (DRE/CAC null-vs-soma provados intactos);
Task 5 approved; Task 6 review pendente no ledger no momento deste registro
(escopo desta task não inclui aguardar essas duas re-reviews — não bloqueiam
produção, ver Pendente).

## Verificação (Task 7)

- Suíte `apps/backoffice` (`npx vitest run`): **661 testes, 0 falhas.**
- Suíte `apps/app` (`NODE_ENV=test npx vitest run`) — **obrigatória**, é
  onde vive o guard de chave única por tenant
  (`__tests__/security/tenant-unique-keys.test.ts`): **4052 testes, 0
  falhas.** `Lancamento` e `Titulo` seguem sem `@@unique` (confirmado lendo
  o schema linha a linha) — nenhuma entrada nova precisou do allowlist.
- Suíte `packages/database` (`npx vitest run`): **23 testes, 0 falhas.**
- Suíte `packages/provisioning` (`npx vitest run`): **46 testes, 0
  falhas.**
- `tsc --noEmit --emitDeclarationOnly false` limpo (zero erros) em
  `apps/backoffice`, `apps/app`, `packages/database` e
  `packages/provisioning` (cada um com o próprio tsconfig).
- `npx prisma migrate status` (banco local `cosmos_dev`, Docker porta 5434):
  **`Database schema is up to date!`** (111 migrations encontradas,
  incluindo `20260910000000_livro_razao_e_titulos`).
- Consulta de divergência (mesma do Task 1 Step 5, verbatim) contra o banco
  local: **`mensais=0 aberturas=0 divergentes=0`** — `LancamentoMensal`
  segue vazia localmente (mesmo estado de base do Task 1, sem as linhas de
  teste que aquele task inseriu e removeu), então a consulta prova a
  invariante no caso trivial. A prova não-trivial (dado real) só acontece
  em produção, onde `LancamentoMensal` tem conteúdo — é exatamente o que o
  runbook (abaixo) pede como verificação pós-deploy.

## Pendente (produção)

1. Push do branch — o build da Vercel aplica
   `20260910000000_livro_razao_e_titulos`. **A única prova de que rodou é a
   linha `Applying migration 20260910000000_livro_razao_e_titulos` no log
   de build** — sem ela, nada rodou, mesmo com deployment `READY`.
2. Abrir `/empresa/financeiro?aba=dre`, mês corrente, comparar com o número
   de antes do deploy. Se bater, a migração foi bem.
3. Se não bater: rodar a consulta de divergência do runbook
   (`docs/runbooks/livro-razao-em-producao.md`) no SQL Editor do Supabase —
   ela aponta a conta e a competência; `LancamentoMensal` continua intacto
   para auditar.
4. Semear nada.
5. Re-review da Task 6 (aba Títulos) e re-review do fix round 1 (Task 3)
   seguem pendentes no ledger — não bloqueiam produção (ambas cobertas por
   teste; a revisão que falta é sobre qualidade de código, não corretude
   funcional).

## Ponytail

Cortado por decisão de escopo, com o motivo:

- **DRE editável** — a célula do DRE deixou de ser `<input>` e virou link
  para a aba Lançamentos filtrada (Task 4). Editar direto na célula do DRE
  morreria de qualquer forma com a mudança de "um valor por conta/mês" para
  "soma de N linhas por conta/mês" — não há mais um valor único para
  editar ali. Quem quer mudar o número edita as linhas na aba Lançamentos.
- **Escrita do CAC nas seis contas 4.1–4.6** — o CAC deixou de escrever
  essas seis parcelas (`salvarParcelas` perdeu o ramo de `contas`) porque
  elas agora vêm por `groupBy` do livro-razão, a mesma fonte que o DRE usa.
  Manter os dois caminhos de escrita (CAC e Lançamentos) para a mesma conta
  reabriria exatamente o problema que este plano existe para fechar — dois
  números para a mesma pergunta. `ParcelasSchema` virou `strictObject` para
  que reenviar `contas` seja um erro visível, não um no-op silencioso.
- **`sinalDoGrupo` da spec §2 usado pelo DRE** — ficou de fora
  (Ruling 3, fechado antes da execução): o DRE usa a estrutura de grupos
  fixos que `calcularDre` já tinha, não um sinal por linha calculado a
  partir da conta. Custo se a decisão estiver errada: uma função a mais a
  escrever no D-b, quando o orçado×realizado provavelmente vai precisar
  dela de qualquer forma.

Cortes já decididos no design da spec (não revisitados aqui): medição de
crédito por chamada, conciliação bancária/OFX, venda de crédito avulso,
multimoeda, regime de competência automático para parcelamento, nota
fiscal/prefeitura — todos documentados na spec §0 com o motivo.
