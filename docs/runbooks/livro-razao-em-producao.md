# Livro-razão em produção — o que falta depois do build verde

**Levantamento de 2026-09-07.** O código do plano D-a (livro-razão e
títulos) está pronto para deploy. Este documento cobre a única migration
pendente, como confirmar que ela rodou de verdade, e o que fazer se o DRE não
bater depois do deploy.

Spec: [`docs/superpowers/specs/2026-09-06-base-financeira-design.md`](../superpowers/specs/2026-09-06-base-financeira-design.md) §6.

---

## 0. O que a migration faz

`packages/database/prisma/migrations/20260910000000_livro_razao_e_titulos/migration.sql`:

1. Cria as tabelas `Lancamento` e `Titulo` (índices e FKs incluídos).
2. Copia cada linha de `LancamentoMensal` para um `Lancamento` de abertura —
   `id` prefixado `abert_`, `data` no dia 1 da competência, `descricao`
   "Saldo de abertura (migrado)", `nota` preservada. A cópia roda **antes** do
   bloco de RLS, porque `current_tenant_id()` está vazio durante
   `migrate deploy` e o INSERT seria recusado depois do `FORCE ROW LEVEL
   SECURITY`.
3. Ativa RLS (`ENABLE` + `FORCE` + policy `tenant_isolation`) nas duas tabelas
   novas.

`LancamentoMensal` **não é apagado** nesta migration e continua sem escritor
— fica como origem auditável até o DRE bater em produção por um mês. A
remoção é uma migration posterior.

---

## 0.1 Antes do deploy: valor migrado zero ou negativo

O `LancamentoMensal` antigo aceitava `valorCentavos` zero ou negativo (o
schema não exigia positividade); a cópia de abertura preserva esse valor tal
qual, então o DRE segue certo. O `LancamentoSchema` novo, porém, exige
`valorCentavos > 0` — uma linha copiada assim não se edita sem primeiro
excluí-la e recriá-la (fix-wave B2, `lancamento-dialog.tsx` recusa o
salvamento com aviso).

Rodar antes do push, Supabase SQL Editor, só leitura:

```sql
SELECT count(*) FROM "LancamentoMensal" WHERE "valorCentavos" <= 0;
```

`0` esperado. Se vier maior que zero, não bloqueia o deploy — a cópia sai
correta e o DRE não muda —, mas vale saber de antemão quantas linhas do
livro-razão vão nascer bloqueadas para edição direta na tela.

---

## 1. Ordem de deploy

1. Push do branch. A Vercel builda e, pelo pipeline padrão deste projeto, o
   `prisma migrate deploy` roda como parte do build (não é um passo manual
   separado, ao contrário do que o runbook do Charter descreve para aquele
   momento do projeto — conferir `vercel-build` do `package.json` do app se
   houver dúvida).
2. **A única prova de que a migration rodou é a linha no log de build:**

   ```
   Applying migration 20260910000000_livro_razao_e_titulos
   ```

   Sem essa linha, nada rodou — as tabelas `Lancamento`/`Titulo` não existem
   e a cópia de abertura não aconteceu, mesmo que o deployment apareça como
   `READY`. Um build pode ficar verde sem aplicar migration nenhuma (schema
   já "up to date" do ponto de vista de um cache, deploy de um commit que não
   tocou `prisma/migrations`, etc.) — a linha no log é o que distingue os dois
   casos.

3. **Nunca usar `prisma migrate resolve --applied` para "consertar" isto.**
   Esse comando marca uma migration como aplicada no banco **sem executar o
   SQL dela** — é para destravar um histórico de migration que já rodou por
   fora (ex.: aplicada à mão) e ficou com o registro desalinhado. Se a
   migration `20260910000000_livro_razao_e_titulos` não aplicou e alguém
   rodar `resolve --applied` nela, o Prisma passa a achar que as tabelas
   existem e a cópia aconteceu — e nenhuma das duas coisas é verdade. O
   sintoma correto para "a migration não aplicou" é rodar
   `npx prisma migrate deploy` de novo (idempotente: uma migration já
   aplicada não roda duas vezes) ou investigar por que o deploy não a
   aplicou, nunca marcar como aplicada à mão.

4. Abrir `/empresa/financeiro?aba=dre`, mês corrente, e comparar com o número
   de antes do deploy (print ou anotação de antes de dar o push). Essa
   comparação é a verificação que decide se a migração foi bem — é a mesma
   regra do §6 da spec e do plano de produção do D-a.

---

## 2. Se o número não bater — consulta de divergência

Somente leitura, para o SQL Editor do Supabase. É a mesma consulta que a
Task 1 rodou no banco local para provar a cópia:

```sql
SELECT
  (SELECT count(*) FROM "LancamentoMensal") AS mensais,
  (SELECT count(*) FROM "Lancamento" WHERE "id" LIKE 'abert_%') AS aberturas,
  (SELECT count(*) FROM (
     SELECT m."competencia", m."conta", m."valorCentavos" AS esperado,
            COALESCE(SUM(l."valorCentavos"), 0) AS obtido
     FROM "LancamentoMensal" m
     LEFT JOIN "Lancamento" l ON l."competencia" = m."competencia" AND l."conta" = m."conta" AND l."tenantId" = m."tenantId"
     GROUP BY m."competencia", m."conta", m."valorCentavos"
     HAVING m."valorCentavos" <> COALESCE(SUM(l."valorCentavos"), 0)
   ) d) AS divergentes;
```

Esperado: `mensais = aberturas` e `divergentes = 0`. Se `divergentes > 0`, o
resultado da subconsulta interna (basta soltar o `SELECT count(*)` externo e
rodar só ela) aponta exatamente a `competencia` e a `conta` onde o valor
copiado não bate com o `LancamentoMensal` de origem.

**Nada apaga.** `LancamentoMensal` continua intacto ao lado de `Lancamento` —
a divergência se audita comparando as duas tabelas linha a linha pela mesma
`(tenantId, competencia, conta)`, sem precisar reconstruir nada. Corrigir é
um `UPDATE`/`INSERT` pontual em `Lancamento` para a combinação que divergiu,
nunca um rerun da migration inteira (ela não é `ON CONFLICT DO NOTHING` na
cópia — rodar de novo duplicaria as linhas `abert_%` já copiadas).

---

## 3. Semear

Nada. Assinatura, orçamento e o próprio livro-razão daqui para frente são
dado que a Nebuloz digita pela tela — não há script de seed para este plano,
ao contrário do funil ou do mapa de processos.

---

## 4. Nota — migration do D-b (orçado × realizado e receita recorrente)

A mesma branch carrega, além desta, a migration
`20260911000000_orcamento_e_recorrente`. Ao contrário da migration deste
runbook, ela só cria quatro tabelas (`OrcamentoDaConta`,
`AssinaturaDoTenant`, `MudancaDeAssinatura`, `CreditoDoMes`) — sem cópia de
dado nenhuma. A verificação dela é mínima: conferir a linha `Applying
migration 20260911000000_orcamento_e_recorrente` no log de build e abrir as
duas abas novas (`/empresa/financeiro?aba=orcado` e
`/empresa/financeiro?aba=recorrente`). A comparação do DRE acima (§1.4)
continua sendo o check que importa, porque é a migration desta página
(D-a) que copia dado de produção.
