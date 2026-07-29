# ADR-0002 — Papel de governança ortogonal ao papel SAFe

**Status**: Accepted
**Data**: 2026-07-28
**Contexto de origem**: `DATA-MODEL.md §3` (matriz 7×10) vs `packages/rbac` existente

## Contexto

O Charter define 7 papéis de governança (Compliance, Legal, Security, HR,
Requester, Exec, Auditor) × 10 permissões. O repo tem `MemberRole`
(ADMIN/STE/RTE/SM/PO/DEV/MEMBER) e uma `PERMISSION_MATRIX` inteiramente
SAFe — `epic:write`, `pi-plan:manage`, `sprint:manage`.

Os dois conjuntos não se correspondem. "Auditor" — papel de leitura forense que
lê e exporta mas não decide nada — não tem análogo em SAFe. "Requester" também
não. E a mesma pessoa pode legitimamente ser `DEV` na entrega e `AUDITOR` na
governança.

## Decisão

`CharterMembership(tenantId, userId, role)` separada, com `CHARTER_MATRIX` em
`packages/rbac/src/charter-matrix.ts` transcrevendo literalmente a tabela de
`DATA-MODEL.md §3`.

Duas escolhas que valem ser explícitas:

**Sem coringa `*`.** A `PERMISSION_MATRIX` do SAFe dá `["*"]` ao ADMIN. A do
Charter não dá a ninguém. `MemberRole.ADMIN` **não herda** permissão de Charter:
governança que o admin de plataforma contorna não é evidência de auditoria. O
admin gerencia `CharterMembership`; para decidir um caso precisa de papel de
governança.

**Ausência de linha = sem acesso**, mesmo com o módulo contratado. Default deny
nos dois eixos independentes: contrato (ADR-0001) e papel.

Na UI, permissão ausente **desabilita com o motivo visível** (`GatedButton` +
`denialReason()`), não esconde o controle. Esconder deixa o usuário sem saber
que a ação existe nem por que não pode — `NFR-1.3` pede motivo.

## Alternativas consideradas

**Mapear nos `MemberRole` existentes** (ADMIN→Compliance, etc.). Zero migration,
mas colide com a semântica SAFe e não representa Auditor nem Requester. Forçaria
promover alguém a ADMIN de plataforma para dar acesso de leitura forense.

**Usar `CustomRole` com `permissions[]`.** Já existe, sem migration, e cada
tenant configuraria a sua matriz. Rejeitada: sem matriz fixa typesafe, um tenant
mal configurado vira default allow por engano — exatamente o que uma ferramenta
de governança não pode permitir.

## Consequências

- `hasCharterPermission` é função pura sobre um `Record` congelado: testável sem
  banco, e a matriz é lida diretamente na tela de Configurações (FR-12.2).
- Um usuário precisa de **duas** atribuições para operar nos dois módulos. É
  fricção real de onboarding, aceita em troca de não confundir os dois eixos.
- Só o papel `COMPLIANCE` atribui papéis de governança — é a permissão que
  distribui todas as outras.
- Cache de papel em Redis com sentinela `"none"`, para que quem não tem acesso
  não bata no banco a cada request.
