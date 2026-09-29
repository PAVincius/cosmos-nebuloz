// Papéis do Signal — teto de atribuição.
//
// Escada cumulativa (VIEWER < OWNER < ANALYST < ADMIN), a mesma da matriz. Quem
// atribui papel não entrega mais do que tem: sem o teto, um papel que ganhasse
// `signal.member.write` num ajuste futuro promoveria qualquer um a ADMIN.

import type { SignalRole } from "@repo/database";

const RANK: Record<SignalRole, number> = {
  VIEWER: 0,
  OWNER: 1,
  ANALYST: 2,
  ADMIN: 3,
};

export function canAssignSignalRole(
  actor: SignalRole,
  target: SignalRole
): boolean {
  return RANK[actor] >= RANK[target];
}
