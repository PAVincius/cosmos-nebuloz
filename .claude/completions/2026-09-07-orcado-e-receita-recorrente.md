# 2026-09-07 — Orçado × realizado e receita recorrente (D-b)

Spec: docs/superpowers/specs/2026-09-06-base-financeira-design.md (§1.3, §1.4,
recorrente do §2 e do §3, duas últimas abas do §4, §5)
Plano: docs/superpowers/plans/2026-09-07-orcado-e-receita-recorrente.md
Ledger: .superpowers/sdd/2026-09-07-orcado-e-receita-recorrente/progress.md

Entregue, por task:

1. Schema e migration (`5970e76f`) — `OrcamentoDaConta`, `AssinaturaDoTenant`,
   `MudancaDeAssinatura` e `CreditoDoMes` em
   `packages/database/prisma/schema/empresa.prisma`. Migration
   `20260911000000_orcamento_e_recorrente`: cria as quatro tabelas, sem cópia
   de dado (ao contrário do D-a). `OrcamentoDaConta` leva
   `@@unique([tenantId, competencia, conta])` e `CreditoDoMes`
   `@@unique([tenantId, clienteSlug, competencia])` — as duas com `tenantId`
   líder, então passam o guard de chave única por tenant sem allowlist
   (confirmado nesta task, não suposto — ver Verificação).
2. Regras puras (`d2f6301b`) — receita recorrente: MRR pela competência
   (histórico de mudança, não estado atual), movimento do mês, churn de
   clientes, franquia de IA e excedente. Ruling 5 (churn) e Ruling 6
   (biome-ignore em fixture de teste) fechados durante a execução — ver
   abaixo.
3. Actions de orçamento e de assinatura (`c5851fe9`, fix `a84a8ca2`) —
   `lerOrcado`, `salvarOrcamento`, `listarRecorrente` e as quatro escritas de
   assinatura, histórico gravado na mesma transação. Guard de 6 para 8
   arquivos (`no-cross-tenant-leak.test.ts`). Fix round: `valorNaCompetencia`
   devolvia `1` no empate (comparador inválido) e não desempatava duas
   mudanças no mesmo mês — corrigido no controller por `criadoEm`, com `0` no
   empate total e teste provando independência da ordem de chegada.
4. Aba Orçado × realizado (`f4f4cde7`) — desvio por conta e por centro de
   custo. Ruling 9: `SeletorDaAba.aba` ganhou `"orcado"`.
5. Aba Receita recorrente (`177bb02c`) — MRR, movimento do mês, franquia de
   IA e serviço ao lado. Ruling 10: `NovaAssinaturaDialog` em terceiro
   arquivo. Ruling 11: MRR inicial do churn% vem do `mrr()` do mês anterior.
6. Verificação e registro (esta task).

## Decisões tomadas ao planejar

Do pre-flight do ledger, fechadas antes da execução:

- **Ruling 1** — `mrr` recebe `(assinaturas, mudancas, competencia)`, contra
  a assinatura da spec. Sem o histórico, editar um contrato hoje reescreveria
  o MRR de meses fechados. Custo se errado: uma função com um parâmetro a
  mais.
- **Ruling 2** — ativa na competência é foto do fim do mês
  (`iniciouEm <= fim`, `encerradaEm > fim`). É o que fecha contra o
  movimento do mês. Custo se errado: assinatura de um dia não aparece.
- **Ruling 3** — `receitaDeServico` trata ausência como zero, ao contrário do
  DRE, onde ausência é nulo. A pergunta aqui é quanto se vendeu de serviço, e
  não vender é zero. Custo se errado: um zero onde deveria haver travessão.
- **Ruling 4** — `sinalDoGrupo` e `dreDeLancamentos` da spec §2 seguem fora,
  como no D-a. A spec descreve uma API que o código não precisou.

## Rulings do ledger (durante a execução)

- **Ruling 5** — `churnDeClientes` usa base = ativas no fim do mês + as que
  saíram no mês. A leitura literal do plano ("ativas no mês anterior + as
  que saíram") contava duas vezes quem saiu e reprovava no próprio teste do
  brief. Aceito, e o plano é que estava errado.
- **Ruling 6** — um `biome-ignore useMaxParams` no helper de 5 parâmetros do
  teste — aceito, é fixture.
- **Ruling 7** — `salvarCreditoDoMes` recebe `{clienteSlug, competencia,
  consumidos}` e busca a assinatura ativa sozinha — aceito, é o que impede o
  cliente de mandar franquia e taxa.
- **Ruling 8** — `listarRecorrente` traz o histórico inteiro sem filtro de
  competência — necessário, `valorNaCompetencia` precisa dele; vigiar volume
  quando houver muitas assinaturas.
- **Ruling 9** — `SeletorDaAba.aba` ganhou `"orcado"` (ver Task 4, acima).
- **Ruling 10** — `NovaAssinaturaDialog` em terceiro arquivo — o brief
  permite (ver Task 5, acima).
- **Ruling 11** — MRR inicial do churn% vem do `mrr()` do mês anterior —
  aceito, é a definição certa (ver Task 5, acima).

Fix round (não numerado como ruling, é correção de bug): `valorNaCompetencia`
não desempatava duas mudanças do mesmo mês e devolvia comparador inválido —
ver Task 3, acima.

Reviews: Task 1 aprovada (5970e76f, ponytail nada). Task 2 Needs fixes → fix
round `a84a8ca2` → aprovada. Task 3 aprovada (c5851fe9; transações reais,
guard por valor lido, crédito recalculado no servidor). Minor parked: audit
diff de `salvarOrcamento` grava `"null"` como texto ao apagar. Task 4
aprovada (f4f4cde7; `desvioRuim` cobre grupo 1 e 2–6 com teste nas duas
direções; total geral sem cor de propósito). Minor parked: `LinhaSubtotal` e
`LinhaTotalGeral` repetem a soma. **Task 5 (177bb02c) segue com review
pendente no ledger no momento deste registro** — não bloqueia produção (73/73
testes cobrindo a aba, mesma lógica pura já revisada na Task 2); é revisão de
qualidade de código sobre a integração da tela, não corretude funcional.

## Verificação (Task 6)

- Suíte `apps/backoffice` (`npx vitest run`): **783 testes, 0 falhas.**
- Suíte `apps/app` (`NODE_ENV=test npx vitest run`) — **obrigatória**, é onde
  vive o guard de chave única por tenant
  (`__tests__/security/tenant-unique-keys.test.ts`): **4052 testes, 0
  falhas.** Rodado à parte, o próprio arquivo do guard: **1 teste, 0
  falhas** (`has no @@unique key on a tenantId-bearing model that omits
  tenantId, unless allowlisted`). `OrcamentoDaConta`
  (`@@unique([tenantId, competencia, conta])`) e `CreditoDoMes`
  (`@@unique([tenantId, clienteSlug, competencia])`) têm `tenantId` líder —
  confirmado passando sem entrada nova no allowlist, não suposto.
- Suíte `packages/database` (`npx vitest run`): **23 testes, 0 falhas.**
- Suíte `packages/provisioning` (`npx vitest run`): **46 testes, 0 falhas.**
- `tsc --noEmit --emitDeclarationOnly false` limpo (zero erros) em
  `apps/backoffice`, `apps/app`, `packages/database` e
  `packages/provisioning` (cada um com o próprio tsconfig).
- `npx prisma migrate status` (banco local `cosmos_dev`, Docker porta 5434):
  **`Database schema is up to date!`**, **112 migrations** encontradas,
  incluindo `20260911000000_orcamento_e_recorrente`. Desvio de ambiente: o
  hook do `rtk` reescreveu esse `npx` e devolveu um resumo enganoso ("0
  applied, 0 pending"); o binário direto
  (`node_modules/.bin/prisma migrate status`) deu o resultado real acima.

Nota de ambiente (reafirmando o Task 1): o hook do `rtk` intercepta `npx` e
comprime a saída dos testes para `PASS (N) FAIL (0)`, o que é fiel para
vitest; para o prisma ele produziu um resumo incorreto, então esse comando
específico foi conferido com o binário direto.

## Pendente (produção)

Esta branch carrega **D-a e D-b juntos, ainda sem push** (24 commits
pendentes contando os dois planos). São migrações de risco muito diferentes:

- **D-a** (`20260910000000_livro_razao_e_titulos`) copia dado de produção
  (`LancamentoMensal` → `Lancamento` de abertura). É a migração de risco —
  ver `docs/runbooks/livro-razao-em-producao.md` para o procedimento
  completo de verificação pós-deploy (comparação do DRE, consulta de
  divergência).
- **D-b** (`20260911000000_orcamento_e_recorrente`) só cria quatro tabelas
  vazias, sem cópia de dado nenhuma. A verificação dela é mínima — nota
  acrescentada ao fim do runbook do livro-razão (ver diff desta task).

Ordem no build: as duas migrations aplicam no mesmo push, em sequência (D-a
primeiro, por timestamp). **A comparação do DRE descrita no runbook do
livro-razão é o check que importa depois do push** — ela cobre a parte de
risco real (D-a); D-b só precisa da linha `Applying migration
20260911000000_orcamento_e_recorrente` no log e das duas abas abrindo.

1. Push do branch.
2. Conferir no log de build as duas linhas `Applying migration
   20260910000000_livro_razao_e_titulos` e `Applying migration
   20260911000000_orcamento_e_recorrente`.
3. Rodar a verificação do D-a (DRE, runbook) — é a que decide se o deploy foi
   bem.
4. Abrir `/empresa/financeiro?aba=orcado` e `/empresa/financeiro?aba=recorrente`
   para confirmar que as abas novas carregam.
5. Semear nada: orçamento e assinatura são dado que a Nebuloz digita pela
   tela. A primeira assinatura cadastrada já produz MRR no mês do
   `iniciouEm`, porque a linha `NOVO` do histórico nasce junto.
6. Review da Task 5 (aba Receita recorrente, `177bb02c`) segue pendente no
   ledger — não bloqueia produção (ver Reviews, acima).

## Ponytail

- **Audit diff de `salvarOrcamento` grava `"null"` como texto ao apagar** —
  parado no review da Task 3. Comportamento cosmético do log de auditoria
  (o valor em si é apagado corretamente); custo se ignorado: uma leitura
  estranha no log, nunca um dado errado.
- **`LinhaSubtotal` e `LinhaTotalGeral` repetem a soma** — parado no review
  da Task 4. Duas funções pequenas fazendo a mesma conta em vez de uma
  compartilhada; custo se ignorado: se a regra de soma mudar, dois lugares
  para atualizar em vez de um.
- **Review da Task 5 pendente** — ver Pendente (produção), acima. Não é um
  corte de escopo, é revisão que ainda não rodou.

Cortes já decididos no design da spec (não revisitados aqui): medição de
crédito por chamada, conciliação bancária/OFX, venda de crédito avulso,
multimoeda, regime de competência automático para parcelamento, nota
fiscal/prefeitura — todos documentados na spec §0 com o motivo.
