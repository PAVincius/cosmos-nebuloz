# Roteiro — prova de que a retenção e a eliminação funcionam em produção

- **Data:** 2026-09-30
- **Autor:** Compliance / DPO
- **Contexto:** passo 4 do parecer do PR #310 (ADR-0021, fase 1): retenção de 90 dias da evidência do Meridian e eliminação de titular pelo Vercel Cron. O primeiro run na produção só prova que a rota responde: depois do reset de 2026-09-29 não há dado antigo, então a retenção vem com `eliminated: 0`. Este teste cria o mínimo de dado sintético para forçar as duas eliminações uma vez e conferir o resultado.
- **Quem executa:** Morgana, com escrita controlada. **Escrita em produção precisa do "vai" do CEO por operação, ou de delegação escrita dele à Morgana para esta.** Eu não presumo a delegação.
- **O que eu não vi:** produção. Escrevi o SQL a partir de `meridian.prisma`, `tenant.prisma`, `system.prisma` e dos jobs do #310 (`f063409e`). Os nomes de coluna e os enums devem ser conferidos com `\d` antes de rodar. O tenant `nebuloz` e a existência de um `MeridianTemplate` vêm do parecer de reset e do runbook, por relato, e não foram conferidos.
- **Pré-requisitos:** #310 mergeado e no ar; `CRON_SECRET` em Production; passos 1 a 3 do parecer do #310 cumpridos (as duas rotas responderam 200). Escrita no bucket precisa do painel do Supabase ou de papel com escrita no Storage.

## O que este teste prova, e o que não prova

| Prova | Não prova |
|---|---|
| Que a função em produção **consegue apagar o objeto** no bucket (permissão do Storage) | Que a retenção funciona em escala; o teto é 500 por execução |
| Que `fileName` e `storagePath` viram marcador, e que a auditoria não leva o nome do arquivo | O caminho de falha e de retry (é coberto por teste automatizado no PR) |
| Que o pedido de eliminação é pego pelo cron em até 15 min e vai a `COMPLETED` | Eliminação de respondente **externo** sem conta: esse caminho ainda não existe; o teste usa respondente cujo e-mail coincide com o de um usuário, que é o único alcançado pelo job |

## O que criar (tudo com prefixo `sint-0930-`)

Um usuário e dois diagnósticos, no tenant `nebuloz`:
- **Diagnóstico de retenção** `sint-0930-a-ret`: `FINALISED`, com `closedAt` de 91 dias atrás, e uma evidência `sint-0930-e-ret`.
- **Diagnóstico de eliminação** `sint-0930-a-dsr`: aberto, com um respondente `sint-0930-r` cujo e-mail é o do usuário sintético, e uma evidência `sint-0930-e-dsr` enviada por ele.
- **Usuário** `sint-0930-user` (e-mail `sint-0930@nebuloz.ai`, endereço que não precisa existir; nada é enviado a ele).
- **Dois arquivos de teste** no bucket, sem conteúdo real (um texto de uma linha basta).

Os nomes de arquivo imitam dado pessoal de propósito (`CV_Fulano_Sintetico.pdf`, `Contrato_Maria_Sintetica.pdf`), para provar que o nome some.

## Passo 0 — Guardas (leitura). Se qualquer uma falhar, pare

O cron age sobre **tudo** que for elegível, não só sobre o dado do teste. As guardas garantem que o único elegível é o sintético.

```sql
-- 0.1 alvo: confira o host do DATABASE_URL e o ref do projeto de produção
SELECT current_database() AS banco, current_user AS papel;

-- 0.2 tenant e template existem
SELECT id FROM "Tenant" WHERE slug = 'nebuloz';                  -- esperado: 1 linha
SELECT id FROM "MeridianTemplate" ORDER BY "createdAt" LIMIT 1;  -- esperado: 1 linha

-- 0.3 nada real é elegível para retenção (esperado: 0)
SELECT count(*) AS elegiveis_retencao
FROM "MeridianEvidence" e JOIN "MeridianAssessment" a ON a.id = e."assessmentId"
WHERE e."storagePath" <> 'eliminado-por-retencao'
  AND a."closedAt" < now() - interval '90 days';

-- 0.4 nenhum pedido de eliminação pendente (esperado: 0 linhas)
SELECT id, "tenantId", "subjectId", status, "requestedAt"
FROM "DataSubjectRequest"
WHERE type = 'ERASURE' AND status IN ('PENDING', 'IN_PROGRESS');

-- 0.5 os ids do teste não existem (esperado: 0 em cada)
SELECT (SELECT count(*) FROM "User" WHERE id = 'sint-0930-user') AS u,
       (SELECT count(*) FROM "MeridianAssessment" WHERE id LIKE 'sint-0930-%') AS a;
```

Se 0.3 ou 0.4 vierem diferentes de zero, **não rode o teste**: o cron executaria esses itens junto, e eliminação não tem volta. Trate-os antes (passo 2 do parecer do #310).

## Passo 1 — Criar o dado sintético (escrita; "vai" do CEO)

```sql
BEGIN;

INSERT INTO "User" (id, email, name, "updatedAt")
VALUES ('sint-0930-user', 'sint-0930@nebuloz.ai', 'Teste Sintetico LGPD', now());

INSERT INTO "MeridianAssessment"
  (id, "tenantId", code, "orgName", sector, "sizeBand", "templateId",
   status, "consultantId", deadline, "closedAt", "updatedAt")
SELECT 'sint-0930-a-ret', t.id, 'SINT-RET', 'SINTETICO', 'teste', 'teste',
       (SELECT id FROM "MeridianTemplate" ORDER BY "createdAt" LIMIT 1),
       'FINALISED', 'sint-0930-user', now(), now() - interval '91 days', now()
FROM "Tenant" t WHERE t.slug = 'nebuloz';

INSERT INTO "MeridianAssessment"
  (id, "tenantId", code, "orgName", sector, "sizeBand", "templateId",
   status, "consultantId", deadline, "updatedAt")
SELECT 'sint-0930-a-dsr', t.id, 'SINT-DSR', 'SINTETICO', 'teste', 'teste',
       (SELECT id FROM "MeridianTemplate" ORDER BY "createdAt" LIMIT 1),
       'COLLECTING', 'sint-0930-user', now() + interval '30 days', now()
FROM "Tenant" t WHERE t.slug = 'nebuloz';

INSERT INTO "MeridianRespondent"
  (id, "tenantId", "assessmentId", name, role, email, axis, status,
   "tokenHash", "tokenExpiresAt", "updatedAt")
SELECT 'sint-0930-r', t.id, 'sint-0930-a-dsr', 'Teste Sintetico', 'teste',
       'sint-0930@nebuloz.ai', 'DATA', 'PENDING',
       'sint-0930-token-hash', now() + interval '30 days', now()
FROM "Tenant" t WHERE t.slug = 'nebuloz';

INSERT INTO "MeridianEvidence"
  (id, "tenantId", "assessmentId", "storagePath", "fileName", "mimeType", "sizeBytes")
SELECT 'sint-0930-e-ret', t.id, 'sint-0930-a-ret',
       t.id || '/sint-0930-a-ret/sint-0930-e-ret',
       'CV_Fulano_Sintetico.pdf', 'application/pdf', 10
FROM "Tenant" t WHERE t.slug = 'nebuloz';

INSERT INTO "MeridianEvidence"
  (id, "tenantId", "assessmentId", "storagePath", "fileName", "mimeType",
   "sizeBytes", "uploadedByRespondentId")
SELECT 'sint-0930-e-dsr', t.id, 'sint-0930-a-dsr',
       t.id || '/sint-0930-a-dsr/sint-0930-e-dsr',
       'Contrato_Maria_Sintetica.pdf', 'application/pdf', 10, 'sint-0930-r'
FROM "Tenant" t WHERE t.slug = 'nebuloz';

-- conferir antes de confirmar: 2 diagnósticos, 1 respondente, 2 evidências
SELECT (SELECT count(*) FROM "MeridianAssessment" WHERE id LIKE 'sint-0930-%') AS a,
       (SELECT count(*) FROM "MeridianRespondent" WHERE id = 'sint-0930-r') AS r,
       (SELECT count(*) FROM "MeridianEvidence" WHERE id LIKE 'sint-0930-%') AS e;
COMMIT;

-- os dois caminhos de objeto que o Storage precisa ter (copie a saída):
SELECT "storagePath" FROM "MeridianEvidence" WHERE id LIKE 'sint-0930-%';
```

**Enviar os dois arquivos** ao bucket `meridian-evidence`, **exatamente** nos caminhos da última consulta (`<tenantId>/sint-0930-a-ret/sint-0930-e-ret` e `<tenantId>/sint-0930-a-dsr/sint-0930-e-dsr`, sem extensão). Depois, conferir que existem:

```sql
SELECT name FROM storage.objects
WHERE bucket_id = 'meridian-evidence' AND name LIKE '%sint-0930-%';   -- esperado: 2 linhas
```

Se o papel não enxergar o schema `storage`, conferir pelo painel do Supabase e anotar.

## Passo 2 — Retenção (escrita indireta)

**Opção A, imediata:** disparar a rota à mão, com o segredo (só quem tem `CRON_SECRET` faz):
`POST https://app.nebuloz.ai/api/cron/meridian-evidence-retention` com `Authorization: Bearer <CRON_SECRET>`. **Opção B:** esperar o cron diário de 03:00 (o horário é o da Vercel, em UTC, a confirmar no painel).

**Esperado na resposta:** `ok: true`, `eliminated: 1`, `assessments: 1`, `failed: 0`. Qualquer outro número, pare e veja §Se falhar.

**Conferir:**
```sql
-- 2.1 marcador em storagePath e fileName
SELECT id, "storagePath", "fileName" FROM "MeridianEvidence" WHERE id = 'sint-0930-e-ret';
-- esperado: ambos = 'eliminado-por-retencao'

-- 2.2 objeto sumiu do bucket (esperado: 1 linha, só a do teste de eliminação)
SELECT name FROM storage.objects WHERE bucket_id = 'meridian-evidence' AND name LIKE '%sint-0930-%';

-- 2.3 auditoria gravada, sem nome de arquivo
SELECT id, action, "entityId", metadata FROM "AuditLog"
WHERE id = 'meridian-evidence-retention:sint-0930-e-ret';
-- esperado: 1 linha; action = 'meridian.evidence.retention-eliminated'; metadata só com assessmentId

-- 2.4 o nome do arquivo não vazou para nenhuma auditoria (esperado: 0)
SELECT count(*) FROM "AuditLog" WHERE metadata::text ILIKE '%CV_Fulano%' OR diff::text ILIKE '%CV_Fulano%';

-- 2.5 idempotência: rodar de novo não muda nada (esperado: eliminated 0)
```
Para 2.5, disparar a rota de novo e ver `eliminated: 0`.

## Passo 3 — Eliminação de titular (escrita)

Antes: rerodar a guarda 0.4 (esperado: 0 linhas). Depois, criar o pedido, que é o que a aplicação faria por `submitErasureRequest`:

```sql
INSERT INTO "DataSubjectRequest" (id, "tenantId", "subjectId", type, status)
SELECT 'sint-0930-dsr', t.id, 'sint-0930-user', 'ERASURE', 'PENDING'
FROM "Tenant" t WHERE t.slug = 'nebuloz';
```

Esperar até **15 minutos** (`*/15`), ou disparar `POST /api/cron/lgpd-erasure` com o Bearer. **Esperado na resposta:** `claimed: 1`, `completed: 1`, `failed: 0`.

**Conferir** (o hash é o SHA-256 de `sint-0930-user`, calculado antes:
`e1373177367e23a3966ea18b639f6ed770c7f6511e89ba5c5c415cc61eadb12f`):
```sql
-- 3.1 pedido concluído
SELECT status, "processedAt", metadata FROM "DataSubjectRequest" WHERE id = 'sint-0930-dsr';
-- esperado: COMPLETED; processedAt preenchido

-- 3.2 usuário anonimizado
SELECT name, email FROM "User" WHERE id = 'sint-0930-user';
-- esperado: name = '{subject_anonymized_e1373177...eadb12f}', email = 'e1373177...eadb12f@erased.cosmos'

-- 3.3 respondente anonimizado e link invalidado
SELECT name, email, "tokenExpiresAt" FROM "MeridianRespondent" WHERE id = 'sint-0930-r';
-- esperado: mesmo substituto no nome e no e-mail; tokenExpiresAt = 1970-01-01

-- 3.4 fileName anonimizado (não marcador de retenção) e objeto apagado
SELECT "fileName", "storagePath" FROM "MeridianEvidence" WHERE id = 'sint-0930-e-dsr';
-- esperado: fileName = '{subject_anonymized_e1373177...}'
SELECT count(*) FROM storage.objects WHERE bucket_id = 'meridian-evidence' AND name LIKE '%sint-0930-%';
-- esperado: 0

-- 3.5 auditoria de conclusão, sem e-mail nem nome
SELECT action, metadata FROM "AuditLog"
WHERE action = 'compliance.lgpd_erasure.completed' AND metadata::text LIKE '%sint-0930%';
-- (o metadata guarda requestId e o hash em subjectId; conferir que não há 'sint-0930@nebuloz.ai' nem 'Contrato_Maria')
SELECT count(*) FROM "AuditLog"
WHERE metadata::text ILIKE '%Contrato_Maria%' OR metadata::text ILIKE '%sint-0930@nebuloz.ai%';
-- esperado: 0
```
No caminho do #310 com o `await` na auditoria de conclusão, a linha de 3.5 deve existir; se não existir, é achado.

## Passo 4 — Limpeza (escrita; "vai" do CEO)

Só depois de copiar as saídas dos passos 2 e 3 para o relatório. Os dois objetos do bucket **já foram apagados pelos jobs**; conferir com a consulta 3.4 antes.

```sql
BEGIN;
DELETE FROM "MeridianEvidence" WHERE id LIKE 'sint-0930-%';
DELETE FROM "MeridianRespondent" WHERE id = 'sint-0930-r';
DELETE FROM "MeridianAssessment" WHERE id LIKE 'sint-0930-%';
DELETE FROM "DataSubjectRequest" WHERE id = 'sint-0930-dsr';
DELETE FROM "User" WHERE id = 'sint-0930-user';
-- conferir que não sobrou nada (esperado: tudo 0)
SELECT (SELECT count(*) FROM "MeridianAssessment" WHERE id LIKE 'sint-0930-%') AS a,
       (SELECT count(*) FROM "MeridianEvidence" WHERE id LIKE 'sint-0930-%') AS e,
       (SELECT count(*) FROM "User" WHERE id = 'sint-0930-user') AS u;
COMMIT;
```

**O que fica de propósito:** as linhas de `AuditLog` do teste (retenção e conclusão). A trilha é imutável (ADR-0009) e não é apagada; elas não têm dado pessoal (só ids, o `assessmentId` e o hash). Registre no relatório que essas linhas são do teste sintético de 2026-09-30, para que ninguém as leia como eliminação de titular real.

## O relatório do teste

Cole, com data e hora e quem executou: as saídas das guardas (Passo 0), a resposta de cada rota, e as consultas 2.1 a 2.4, 3.1 a 3.5 e a limpeza. **A data desse relatório é a "data de verificação" do DPA §10.2** (`dpa-modelo.md`) e da condição 2 de `docs/qualidade/prontidao/meridian.md`. Só a partir dela o texto do contrato pode dizer que os mecanismos automáticos foram verificados em produção.

## Se falhar

- **Resposta 401:** `CRON_SECRET` ausente ou errado. Pare; é pré-requisito do passo 1 do parecer do #310.
- **`failed` maior que zero, ou objeto ainda no bucket:** provável falta de permissão de remoção no Storage para a chave usada pela função. Não repita em loop. Anote a mensagem de erro do painel da Vercel (o job registra o erro por passo) e chame Pilar.
- **Pedido em `FAILED`:** `metadata.lastError` diz o passo. A auditoria `compliance.lgpd_erasure.failed` existe. Como o usuário é sintético, não há titular real afetado; deixe o dado do teste como está e limpe depois de corrigido.
- **Qualquer linha de dado real apareceu em `eliminated` ou `claimed` além do esperado:** é incidente, não teste. Pare, não limpe, avise o CEO e me avise no mesmo dia: eu abro o registro e avalio o que precisa ser comunicado.

## Decisões

- 2026-09-30 — Compliance/DPO: a verificação em produção de retenção e eliminação se faz com este teste sintético, e o relatório dele é a data de verificação do DPA §10.2.
