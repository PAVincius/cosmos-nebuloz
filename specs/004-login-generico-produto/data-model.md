# Data Model: Login genérico + seleção de produto pós-login

## Tenant (extensão)

Model existente: `packages/database/prisma/schema/tenant.prisma:25-42`.

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| `isInternalTenant` | `Boolean` | `false` | Novo. Diferencia o(s) tenant(s) que veem o catálogo pós-login dos demais. Distinto de `isSystem` (tenant técnico de auditoria, propósito diferente). Setado manualmente (migration de dado ou ação administrativa) — esta feature não entrega UI de gerenciar a flag. |

**Migration**: `ALTER TABLE "Tenant" ADD COLUMN "isInternalTenant" BOOLEAN NOT NULL DEFAULT false;` (via `prisma migrate dev`).

**Regra de leitura**: só a partir da sessão do tenant (`requireTenantSession`), nunca de input do cliente — mesmo padrão de qualquer outro campo de `Tenant` já lido no repo.

## ProdutoNoPainel (extensão)

Tipo existente: `apps/app/app/actions/produtos/index.ts` (`EstadoDoProduto`, `ProdutoNoPainel`).

| Campo | Tipo | Notas |
|---|---|---|
| `perfis` | `string[]` | Novo. Rótulos dos perfis possíveis do produto — vem do enum de papel de cada produto (`MeridianRole`, `CharterRole`, `ScaffoldRole`, `SignalRole`; `MemberRole` para o Cosmos). Não introduz um vocabulário único de "perfil de suíte" (fora de escopo) — cada produto expõe os seus próprios rótulos. |

Sem mudança nos campos existentes (`modulo`, `nome`, `resumo`, `href`, `estado`, `motivo`, `expiraEm`, `emTrial`, `assentos`) nem na regra de habilitação (`listModules()`).

## Solicitação de redefinição de senha

Gerida inteiramente pelo Better Auth (tabela interna de verification/token do plugin `emailAndPassword` + `Account`) — não é uma entidade nova no schema da aplicação. Propriedades relevantes (padrão Better Auth, não modeladas por nós): token de uso único, TTL padrão da lib, vinculado ao `email`.

**Regra de negócio desta feature**: a resposta de "solicitar redefinição" é idêntica exista ou não o e-mail na base (FR-012) — isso é comportamento do próprio Better Auth (`requestPasswordReset` já não revela existência de conta por padrão), não uma lógica nova a implementar; a tarefa de implementação é confirmar isso, não construir.

## Sem novas entidades de auditoria

Troca de senha e redefinição não pedem uma entidade de auditoria nova nesta spec — o Better Auth já registra sessão/mudança de credencial nas tabelas próprias dele. (A spec 006, em paralelo, é quem introduz `meridian.respondent.reissue`, sem relação com este modelo.)
