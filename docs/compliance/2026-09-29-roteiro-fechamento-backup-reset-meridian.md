# Roteiro de fechamento do backup do reset do Meridian

- **Data:** 2026-09-29
- **Autor:** Compliance / DPO
- **Base:** `2026-09-29-parecer-reset-meridian-producao.md` (C2 a C5), `docs/runbooks/meridian-reset-producao.md` ("Backup e prazo"), `apps/app/scripts/sql/meridian-reset.sql`, condição 3 de `docs/qualidade/prontidao/meridian.md`.
- **O que não vi:** produção. Que o reset rodou em 2026-09-29 e que o schema existe é **relato da Morgana**, não conferido por mim. Cada passo abaixo pede que quem executa confira antes.
- **Quem faz o quê:** Pilar executa; Lacre confirma o prazo e abre o lembrete; o CEO dá o "vai" para cada escrita em produção.

## Datas

| Marco | Data | Origem |
|---|---|---|
| Bloco 3 do reset rodou | 2026-09-29 | relato da Morgana |
| **`DROP SCHEMA` até** | **2026-10-29** | 30 dias contados do dia em que o bloco 3 rodou (runbook, "Backup e prazo"). Se a data real do bloco 3 for outra, o prazo é essa data + 30 dias |
| Eliminação total efetiva | 2026-10-29 + janela do Supabase | Não é 2026-10-29: as cópias automáticas da plataforma continuam. A janela é `[preencher no passo 1]` |

## Passos, em ordem

### 1. Registrar a janela da plataforma (agora; leitura, sem "vai")

Pilar abre o painel do Supabase, projeto `aosdvvluokrbgpyqwoor` (ref citado em `memoria-empresa.md` pelo parecer de reset; confira contra o host do `DATABASE_URL`), em Database > Backups, e cola no relatório do reset:

- retenção do backup diário, em dias;
- PITR ligado ou desligado, e a janela se ligado;
- a data efetiva de eliminação total = 2026-10-29 + o maior dos dois números.

Não sei o plano contratado nem os números; qualquer valor que eu escrevesse aqui seria chute. O número entra na linha do RoPA (§3.1 de `lgpd-ropa-e-lacunas.md`), no lugar do `[preencher]`.

### 2. Registrar a contagem do bucket (agora; leitura)

O parecer de reset (C5) exige contagem de objetos do bucket `meridian-evidence` antes e depois do esvaziamento, no relatório. Se o relatório do reset ainda não traz as duas, Pilar roda, com papel que enxergue o schema `storage`:

```sql
SELECT count(*) AS objetos FROM storage.objects WHERE bucket_id = 'meridian-evidence';
```

Esperado depois do reset: `0`. Se não for zero, há objeto sem linha dona, fora da rotina de retenção de 90 dias (que é guiada pelas linhas de `MeridianEvidence`, hoje vazias). Nesse caso pare e avise Lacre.

### 3. Lembrete (Lacre)

Lacre abre lembrete para **2026-10-27** (dois dias antes) com este roteiro e a data-limite. O lembrete é dela, não do runbook, porque o prazo vale a partir do dia em que o bloco 3 rodou.

### 4. Enquanto o backup existir: regra para pedido de titular

O fluxo de eliminação (`apps/app/lib/inngest/lgpd-dsr.ts`) **não alcança** o schema `backup_meridian_20260929`. Então, se chegar pedido de eliminação de respondente antes do DROP:

1. **Opção 1 (padrão):** apagar as linhas do titular no backup, como dono do banco, com "vai" do CEO. As tabelas do backup são cópias sem chave estrangeira, então a cascata não vale; apague na ordem abaixo, pelo e-mail do titular (informado no pedido):

```sql
-- Conferir o alvo antes: host do DATABASE_URL contém o ref do projeto de produção.
-- E-mail do titular: substituir ':email'. Rodar em transação.
BEGIN;
CREATE TEMP TABLE _resp AS
  SELECT id FROM backup_meridian_20260929."MeridianRespondent" WHERE lower(email) = lower(:'email');
SELECT count(*) AS respondentes_encontrados FROM _resp;

DELETE FROM backup_meridian_20260929."MeridianEvidence"
  WHERE "uploadedByRespondentId" IN (SELECT id FROM _resp)
     OR "responseId" IN (SELECT id FROM backup_meridian_20260929."MeridianResponse"
                          WHERE "respondentId" IN (SELECT id FROM _resp));
DELETE FROM backup_meridian_20260929."MeridianResponse"
  WHERE "respondentId" IN (SELECT id FROM _resp);
DELETE FROM backup_meridian_20260929."MeridianRespondent"
  WHERE id IN (SELECT id FROM _resp);
-- Conferir as contagens afetadas; se estiverem como esperado:
COMMIT;
```

   `MeridianAxisScore` (agregado do diagnóstico) e as demais tabelas não guardam dado do titular; não mexa nelas. Confira o nome das colunas com `\d backup_meridian_20260929."MeridianEvidence"` antes de rodar: montei os nomes a partir do `meridian.prisma` e não abri o banco.

2. **Opção 2:** antecipar o `DROP SCHEMA` (passo 6) e registrar que o pedido foi atendido dessa forma. Só faz sentido se o CEO aceitar perder a rede de segurança.

Registre no relatório qual das duas foi usada, com data e pessoa. Depois do DROP, o backup deixa de ser problema; as cópias da plataforma passam a ser (item 5).

5. **Cópias da plataforma (Supabase):** não são apagáveis por nós antes da janela do passo 1. Resposta honesta ao titular: "seus dados foram eliminados do sistema em [data]; cópias automáticas de segurança da nossa plataforma de banco de dados são sobrescritas até [data efetiva]". Nunca diga "eliminado de todos os lugares" antes dessa data.

6. **Restauração antes do prazo** (só com "vai" do CEO): antes do `INSERT ... SELECT` do runbook, conferir eliminações pedidas depois do reset, senão a restauração traz de volta dado que o titular mandou apagar:

```sql
SELECT id, "tenantId", type, status, "requestedAt", "processedAt"
FROM "DataSubjectRequest"
WHERE "requestedAt" >= '2026-09-29' AND type = 'ERASURE'
ORDER BY "requestedAt";
```

   (o valor `'ERASURE'` do enum `DsrType` deve ser conferido em `system.prisma`.) Para cada linha, e para cada pedido recebido por `privacy@` no período, aplique a Opção 1 sobre as linhas restauradas.

### 5. O `DROP SCHEMA` (com "vai" do CEO, até 2026-10-29)

Antes de rodar, tudo isto deve estar registrado: o passo 1 (janela) e a decisão de cada pedido de titular do passo 4.

**a) Conferir o alvo (leitura).**

```sql
SELECT current_database() AS banco, current_user AS papel, inet_server_addr() AS ip;
```

E fora do SQL: o host do `DATABASE_URL` em uso contém o ref do projeto de produção. Se não conferir, pare.

**b) Inventário do que será apagado (leitura).** Espera-se 13 tabelas, as do bloco 2 de `meridian-reset.sql:84-96`:

```sql
SELECT table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                           false, true, '')))[1]::text::int AS linhas
FROM information_schema.tables
WHERE table_schema = 'backup_meridian_20260929'
ORDER BY table_name;
```

Cole a saída no relatório. Se o schema não existir, ou tiver número de tabelas diferente de 13, pare e avise Lacre: ou o reset não rodou como descrito, ou alguém já mexeu.

**c) O DROP.** Só o schema do backup; `CASCADE` apaga as tabelas dentro dele e mais nada, porque as cópias foram criadas sem chave estrangeira para fora.

```sql
BEGIN;
DROP SCHEMA backup_meridian_20260929 CASCADE;
SELECT count(*) AS schema_restante
FROM information_schema.schemata WHERE schema_name = 'backup_meridian_20260929';
-- esperado: 0. Se for 0:
COMMIT;
```

**d) Registrar na trilha (recomendado pelo parecer de reset, §3; opcional).** O trigger de `AuditLog` só barra `UPDATE` e `DELETE`, então o `INSERT` passa. Confirme os nomes de coluna com `\d "AuditLog"`; usei os de `system.prisma:81-96`.

```sql
INSERT INTO "AuditLog" (id, "tenantId", "actorType", action, "entityType", reason, metadata, "createdAt")
SELECT gen_random_uuid()::text, t.id, 'system', 'meridian.backup_eliminado', 'meridian.reset',
       'DROP SCHEMA backup_meridian_20260929 dentro do prazo de 30 dias',
       jsonb_build_object('autorizadoPor', 'CEO', 'executadoPor', 'Pilar', 'prazoLimite', '2026-10-29'),
       now()
FROM "Tenant" t WHERE t.slug = 'nebuloz';
```

**e) Relatório.** Data e hora do DROP, saída do (a), (b) e (c), e a data efetiva de eliminação total (passo 1).

### 6. Depois do DROP (Lacre)

- Atualiza o RoPA §3.1: troca "existe" por "eliminado em [data]", mantendo o registro do que houve.
- Atualiza `docs/qualidade/prontidao/meridian.md`, condição 3, com o link do relatório.
- Marca o lembrete como cumprido.

## O que este roteiro não afirma

- Que o reset rodou, que o schema existe e qual é o plano do Supabase: relato ou hipótese, cada passo pede conferência.
- Que a resposta ao titular pode ser "eliminado" antes da data efetiva: só depois dela.
- Que `gen_random_uuid()`, o enum `ERASURE` e os nomes de coluna existem como usei: conferir no banco antes de rodar.

## Decisões

- 2026-09-29 — Compliance/DPO: o prazo do `DROP SCHEMA` é 2026-10-29 (30 dias do bloco 3), e a data efetiva de eliminação total a declarar é essa data mais a janela do Supabase. Nenhuma escrita em produção acontece sem "vai" do CEO por operação.
- 2026-09-29 — Regra dentro da janela: pedido de titular é atendido apagando as linhas dele no backup (padrão) ou antecipando o `DROP`; restauração antes do prazo reaplica as eliminações pedidas depois do reset.
