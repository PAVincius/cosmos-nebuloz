# Scaffold PR 3 — Dispensa visível, parte do back-office

Spec 017 (branch docs/scaffold-operavel-spec, 7d26c21d), FR-005 e FR-006. Branch `feat/scaffold-dispensa-backoffice`, base github/main 97c0db49.

## Feito
- `apps/backoffice/app/actions/scaffold-dispensas.ts`: `listDispensedDeliverables` (só leitura; `requirePlatformStaff`; tenant do servidor). Lista `ScaffoldDeliverableInstance` com `dispensedReason` não nulo, de tenants que não são `isSystem`, com cliente, trilha, entregável, motivo, via e quem/quando. Teto de 100, avisa se cortou.
- Via: manual quando há `AuditLog` (`entityType` `scaffold.deliverable`, ação `scaffold.deliverable.dispens*`), overlay pelo prefixo "Dispensado pelo overlay do cliente:" (de `_seed-track.ts`), senão automática.
- Quem/quando: manual vem da auditoria (`metadata.actorName`, `createdAt`); automática e overlay mostram "Sistema" e a criação da trilha.
- Tela: seção "Entregáveis dispensados" em `/scaffold` (`dispensas.tsx`), só leitura, sem botão nem link. Dois testes de página ganharam o mock da action.

## Contrato com o Andaime (dispensa manual no app)
A ação manual precisa gravar auditoria com `entityType: "scaffold.deliverable"`, `entityId` = id da instância e `action` começando por `scaffold.deliverable.dispens` (ex.: `scaffold.deliverable.dispense`), com `metadata.actorName` (já é o que `logScaffoldAudit` grava). Sem isso a dispensa manual aparece como "automática, Sistema".

## Verificação
- Testes novos: 16 (action 11, tela 5) + os de página relacionados, verdes; tsc limpo; biome limpo nos arquivos tocados.
- Não conferido no navegador: sem banco local com trilha dispensada.
