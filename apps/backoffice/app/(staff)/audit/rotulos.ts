/**
 * Rótulos das ações e entidades do AuditLog. Fora de `filtros.tsx` porque
 * aquele é "use client" e as páginas de Atividade e Audit (Server Components)
 * também precisam do mesmo dicionário: a linha mostrava `row.action` cru —
 * "updated" — ao lado de um select que já dizia "Alteração".
 *
 * As ações que o painel realmente grava. Lista fechada em vez de campo livre:
 * digitar "update" e não achar nada porque o valor é "updated" é frustração
 * sem aprendizado. A chave é o valor gravado no AuditLog e o que vai para a
 * URL; o rótulo é o que a pessoa lê.
 */
export const ACOES: Record<string, string> = {
  created: "Criação",
  updated: "Alteração",
  deleted: "Remoção",
  approved: "Aprovação",
  rejected: "Rejeição",
};

export const ENTIDADES: Record<string, string> = {
  tenant: "Cliente",
  tenant_member: "Membro do cliente",
  tenant_module: "Módulo contratado",
  staff_diagram: "Diagrama do staff",
  platform_approval: "Pedido de aprovação",
};
