# Parecer de Compliance — Implementação da retenção de evidência do Meridian (PR #277)

- **Data:** 2026-09-28
- **Solicitante:** Morgana
- **Objeto:** conferência da implementação das condições 2 e 3 do parecer `docs/compliance/2026-09-24-parecer-meridian-respondente.md` — PR #277 (`feat/meridian-retencao-evidencia-90d`, merged, 3 commits: `7b035212`, `979240a4`, `06703fd0`)
- **Autor:** Compliance / DPO

## Veredito

**Condição 2 (rotina de eliminação de objeto): ATENDIDA.**
**Condição 3 (política de retenção declarada): ATENDIDA, 90 dias com fundamento suficiente.**
**Achado novo (audit log com `fileName` legado): ACEITAR COM FUNDAMENTO — não mexer no trigger.** Uma ação pendente, sem prazo até a contagem em produção existir.

## 1. Condição 2 — rotina de eliminação do objeto

Conferido em `apps/app/lib/inngest/meridian-evidence-retention.ts:65-84`: `eliminateExpiredMeridianEvidence` chama `deleteObjects(MERIDIAN_EVIDENCE_BUCKET, ...)` sobre o `storagePath` real antes de qualquer marcação, agrupado por `assessmentId` (nunca mistura tenant, linha 82-108). O registro `MeridianEvidence` não é apagado — `storagePath` e `fileName` viram o marcador `eliminado-por-retencao` (`apps/app/lib/meridian/evidence-retention.ts:15`, `meridian-evidence-retention.ts:95-99`), mesma lógica de anonimizar-em-vez-de-apagar que o DSAR já usa (`apps/app/lib/inngest/lgpd-dsr.ts:218-230`, citado no meu parecer de 24/set). Bate com a condição 2 como redigida: "rotina de eliminação do objeto no bucket que complemente o `lgpd-dsr.ts`".

Ponto adicional que fecha sozinho um risco que eu teria levantado: `requestEvidenceUrl` (`apps/app/app/(meridian)/actions/report.ts:283-289`) recusa emitir URL assinada para evidência já eliminada, checando **antes** de gravar a auditoria de leitura — sem isso, o log diria "URL assinada emitida" para um objeto que não existe mais.

## 2. Condição 3 — política de retenção e fundamento dos 90 dias

**Declarada:** `EVIDENCE_RETENTION_DAYS = 90` (`apps/app/lib/meridian/evidence-retention.ts:12`), cutoff sobre `assessment.closedAt` (`evidenceRetentionCutoff`, mesma linha 22-26), cron diário às 03:00 (`meridian-evidence-retention.ts:32`). Isso fecha o que faltava — hoje existe regra escrita e executada, não mais "indefinidamente sem regra declarada" (`docs/qualidade/dogfood/meridian/atrito.md:60`, meu achado original).

**Fundamento — suficiente.** `docs/qualidade/dogfood/meridian/atrito.md:60-68` registra as três opções trazidas pela Bussola e a escolha do CEO: opção A, "janela mínima pra revisão pós-fechamento; **mais restritiva das três, menor exposição**", contra B (180 dias, ciclo semestral) e C (sem expiração automática, só DSAR sob pedido — a própria doc já classifica C como risco de proporcionalidade, art. 6º, III, se virasse política permanente para cliente externo). A escolha:

- Ancora em evento real do processo (`closedAt`, gravado em `collection.ts:closeCollection` quando a coleta fecha — não é TTL global arbitrário desde a criação);
- É a opção que **minimiza retenção** entre as consideradas, o que é exatamente o que o art. 6º, III, da LGPD (princípio da necessidade — tratamento limitado ao mínimo necessário) pede que se documente;
- Tem finalidade nomeada (janela de revisão pós-fechamento), o que atende ao art. 16, caput (dado eliminado após atingida a finalidade, ressalvadas as hipóteses do próprio art. 16).

Não achei um SLA de contestação/override documentado que bata com 90 dias par-a-par (o fluxo de contestação existe — `MeridianAssessment.status = CONTESTED`, fila em `scoring.ts:313-421` — mas sem prazo em dias fixado em código ou PRD que eu tenha localizado); a justificativa que vale é a de proporcionalidade comparada (mais restritiva das três opções), não um prazo legal específico batendo com um SLA de produto. Isso é suficiente para o padrão de razoabilidade do art. 6º, III — não preciso de mais para liberar.

**O que falta constar para o titular — gap real, achado agora.** O aviso publicado em `apps/app/components/meridian/respondent-form.tsx:151-211` (condição 1 do parecer de 24/set, já implementado) diz que é a organização cliente quem decide "para quê e por quanto tempo" (linha 173) — mas **não menciona os 90 dias**, que não é decisão do cliente: é mecanismo da plataforma, fixo, que o cliente nem pode mudar. Isso é uma nova informação factual desde a condição 1, que a tela ainda não tem. Peço que se acrescente uma frase ao aviso existente — algo como "evidência anexada é apagada do nosso armazenamento 90 dias após o fechamento do diagnóstico" — no mesmo `SectionCard` já criado, sem reescrever o resto. É texto, sem decisão pendente; não bloqueia nada, mas fecha o requisito de informação do art. 9º de forma completa.

## 3. Achado novo — `fileName` legado em `target` de `AuditLog`, tabela imutável

Confirmado o mecanismo: `AuditLog` tem trigger de banco que bloqueia `UPDATE` e `DELETE` incondicionalmente — `packages/database/prisma/migrations/20260603000002_audit_log_immutable_trigger/migration.sql:1-10` (`RAISE EXCEPTION 'audit_logs is append-only...'`). Não é bug, é a garantia central de `ADR-0009` ("Nenhuma action (...) pode chamar `auditLog.update` ou `delete` — incluindo admin. O trigger barra; a regra existe para que ninguém tente") e a mitigação registrada em `docs/compliance/risk-register.md:14` para `R-004` ("Audit trail adulterável — sem trigger append-only"). As linhas antigas de `meridian.evidence.read`/`meridian.evidence.attach` que gravaram `fileName` no `target` (antes da correção em `06703fd0`, que passou a usar `evidence.id`) **não podem ser apagadas nem editadas** sem desabilitar esse trigger — o que eu não recomendo, pelos motivos abaixo.

**Tratamento recomendado: aceitar com fundamento — art. 16, I, LGPD ("cumprimento de obrigação legal ou regulatória pelo controlador").** Três razões, nenhuma nova para este dossiê — todas já eram a base da arquitetura de auditoria antes deste achado:

1. **A exposição é estreita.** O campo `target` de uma linha de `AuditLog` só é lido por staff autenticado do próprio tenant, atrás de `requireMeridianPermissionContext("evidence.read")`/RBAC, na tela `/settings/audit` — não sai da plataforma, não é público, não vai a terceiro. Não é o mesmo risco de um dado pessoal em trânsito ou em bucket acessível por link.
2. **Mudar o trigger para permitir redação custa mais do que resolve.** `AuditLog` sustenta a trilha do Charter inteiro (`ADR-0009`), a mitigação de `R-004` e parte do gap de SOC2 em `R-005` (`risk-register.md:15`). Abrir uma exceção de `UPDATE` — mesmo que só para redigir `fileName` — quebra a garantia "ninguém, nem admin, edita uma linha" para o sistema de auditoria inteiro, não só para o Meridian. O precedente vale mais do que o dado que se está tentando remover.
3. **O forward-fix já existe e é suficiente daqui para frente.** `06703fd0` parou a gravação de `fileName` em `target` para os dois actions identificados. O problema é só retroativo, e limitado (potencialmente) a linhas anteriores a essa data.

**O que falta, e é o único ponto realmente em aberto:** a contagem em produção — Morgana já registrou como pendente no pedido. Sem ela não dá para saber se o volume é zero (como no ambiente local, citado no corpo da PR #277) ou relevante. Ação: **quem tiver acesso de leitura ao Postgres de produção** (não sou eu — não tenho acesso de produção nesta função) roda a mesma contagem que a PR já rodou local — `meridian.evidence.read`/`meridian.evidence.attach` com `target` contendo algo além do padrão `<code> · <uuid>` — e me reporta o número. Se vier zero, o achado fecha sem mais ação. Se vier maior que zero, meu parecer continua o mesmo (aceitar com fundamento), mas eu registro a contagem real no risk register como risco residual conhecido, não hipotético.

## Decisões

- 2026-09-28 — Compliance/DPO confirma condições 2 e 3 do parecer de 24/set atendidas pela PR #277.
- 2026-09-28 — Compliance/DPO recomenda acrescentar menção aos 90 dias no aviso já publicado (`respondent-form.tsx:151-211`) — texto, sem decisão pendente, não bloqueia.
- 2026-09-28 — Compliance/DPO aceita, com fundamento no art. 16, I, LGPD, as linhas legadas de `AuditLog` com `fileName` em `target`; recomenda **não** alterar o trigger de imutabilidade (`20260603000002_audit_log_immutable_trigger`). Contagem em produção pendente — sem dono designado ainda; peço a Morgana indicar quem tem acesso de leitura à produção para rodar a contagem.
