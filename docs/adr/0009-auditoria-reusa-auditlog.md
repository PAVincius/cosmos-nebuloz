# ADR-0009 — Auditoria do Charter reusa `AuditLog`

**Status**: Accepted
**Data**: 2026-07-28
**Contexto de origem**: `DATA-MODEL.md §1` (`AuditEntry`) vs `system.prisma` existente

## Contexto

O Charter define `AuditEntry` com `type`, `actor`, `role`, `action`, `target`,
`when`, `note` e `diff: Array<[campo, antes, depois]>`, append-only.

O repo já tem `AuditLog` com `tenantId`, `userId`, `actorId`, `actorType`,
`action`, `entityType`, `entityId`, `diff Json`, `metadata Json`, `createdAt` —
append-only por trigger de banco (`20260603000002_audit_log_immutable_trigger`),
com a aplicação sem grant de `UPDATE`/`DELETE`.

## Decisão

Reusar `AuditLog`. Convenções do Charter:

- `entityType` = `charter.<entidade>` (`charter.policy`, `charter.decision`,
  `charter.vendor`, `charter.export`, …), agrupado em categoria de artefato por
  `AUDIT_CATEGORY` — o auditor filtra por categoria, não por tabela.
- `diff` = `Array<[campo, antes, depois]>`, o formato do `DATA-MODEL`, montado
  por `buildDiff()` que **omite campos inalterados**. Diff com linha "X → X"
  polui a evidência.
- `metadata.charterRole` = papel de governança do ator **no momento do ato**. O
  papel muda; o registro não pode mudar com ele, senão a trilha reescreve a
  história a cada troca de função.

`logCharterAudit` escreve direto na tabela em vez de usar `logAudit()` do Cosmos,
por dois motivos: aquele helper tipa `diff` como `Record<string,string>`, e
engole erro de propósito (fire-and-forget) — aceitável para telemetria,
inaceitável para evidência. Aqui, se a entrada não gravou, a operação inteira
falha.

Recebe o `db` da transação em curso, para participar do mesmo commit da escrita
principal: uma decisão persistida sem trilha é pior que uma decisão que não
persistiu.

## Alternativas consideradas

**Tabela `CharterAuditEntry` própria.** Modelo mais fiel ao `DATA-MODEL` e sem
`Json` genérico. Rejeitada: duplicaria a garantia de imutabilidade — o trigger, o
grant, a política de RLS e a rotina de retenção — em duas tabelas que precisam
das mesmas propriedades. Duas fontes de verdade de auditoria num mesmo tenant é
exatamente o que um auditor não quer encontrar.

**Reusar `logAudit()` como está.** Exigiria alargar `AuditActionSchema` (enum
fechado com ações SAFe) e conviver com o `.catch(() => null)`.

## Consequências

- Zero migration para auditoria. Retenção, RLS e imutabilidade vêm de graça.
- **Nenhuma action do Charter pode chamar `auditLog.update` ou `delete`** —
  incluindo admin. O trigger barra; a regra existe para que ninguém tente.
- `AuditLog` passa a ter dois vocabulários de `action` (enum SAFe em inglês,
  string livre em pt-BR no Charter). Consultas cross-módulo precisam saber disso.
- `metadata.actorName` é desnormalizado de propósito: o nome do ator no momento
  do ato, não o nome atual do usuário.
