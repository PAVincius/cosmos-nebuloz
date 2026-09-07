import "server-only";
import { database } from "@repo/database";
import { StaffAuthError, SYSTEM_TENANT_ID } from "@/lib/guard";
import type { Conta } from "./plano-de-contas";

/**
 * Consultas comuns aos três módulos de action de empresa/financeiro
 * (financeiro.ts, livro.ts, titulos.ts). Módulo de servidor comum, sem
 * "use server": em Next, todo export de um módulo "use server" é uma server
 * action registrada e alcançável por POST, e o guard do layout (staff) não
 * roda antes dela — essas duas funções não têm `requirePlatformStaff` próprio
 * porque quem chama já passou por ele; virar action as exporia sem guard
 * nenhum. Cada action pública que as usa segue exigindo
 * `requirePlatformStaff` antes de chamá-las.
 */

const SELECT_CONTA = {
  conta: true,
  nome: true,
  grupo: true,
  centroDeCusto: true,
  ativa: true,
  ordem: true,
} as const;

export type ContaView = Conta & { ordem: number };

export async function contasDoPlano(): Promise<ContaView[]> {
  const linhas = await database.contaDoPlano.findMany({
    where: { tenantId: SYSTEM_TENANT_ID },
    orderBy: [{ grupo: "asc" }, { ordem: "asc" }, { conta: "asc" }],
    select: SELECT_CONTA,
  });
  return linhas as ContaView[];
}

/** A mesma checagem de `salvarLancamento` em financeiro.ts: conta desativada
 *  ou fora do plano não recebe lançamento novo. Usada por livro.ts e
 *  titulos.ts — na criação do título e, de novo, na baixa, já que a conta
 *  pode ser desativada entre as duas. */
export async function assertContaAtiva(conta: string): Promise<void> {
  const contaDoPlano = await database.contaDoPlano.findUnique({
    where: { tenantId_conta: { tenantId: SYSTEM_TENANT_ID, conta } },
    select: { ativa: true },
  });
  if (!contaDoPlano?.ativa) {
    throw new StaffAuthError("FORBIDDEN", "Conta desativada ou fora do plano.");
  }
}
