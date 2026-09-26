import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { listarProdutos } from "@/app/actions/produtos";

/** Mesmo destino de sempre para quem não é tenant interno, quando por algum
 *  motivo `listarProdutos` não devolve nenhum produto disponível (contrato
 *  vazio, ou falha de leitura) — preserva o comportamento anterior a esta
 *  feature em vez de deixar a rota raiz sem destino. */
const DESTINO_PADRAO = "/cosmos/dashboard";

/**
 * Decide para onde o login bem-sucedido leva.
 *
 * `isInternalTenant` é lido a partir do `tenantId` da sessão (nunca de input
 * do cliente) — mesmo padrão de qualquer outro campo de `Tenant` já lido no
 * repo. Quem decide "o que está habilitado" continua sendo `listarProdutos`
 * (que já reaproveita `listModules`); esta função só escolhe entre o catálogo
 * e o primeiro produto disponível — não reimplementa a regra de contrato.
 */
/** Único ponto de leitura de `Tenant.isInternalTenant` — a página do
 *  catálogo (`(authenticated)/produto`) também precisa saber se está
 *  servindo de landing pós-login (rótulo "em breve") ou de hub de
 *  contratação normal, e reusa esta função em vez de repetir a consulta. */
export async function isTenantInterno(tenantId: string): Promise<boolean> {
  const tenant = await database.tenant.findUnique({
    where: { id: tenantId },
    select: { isInternalTenant: true },
  });
  return tenant?.isInternalTenant ?? false;
}

export async function resolvePostLoginDestination(): Promise<string> {
  const { tenantId } = await requireTenantSession(await headers());

  if (await isTenantInterno(tenantId)) {
    return "/produto";
  }

  const resultado = await listarProdutos();
  if (!resultado.ok) {
    return DESTINO_PADRAO;
  }

  const primeiro = resultado.data.find(
    (produto) => produto.estado === "DISPONIVEL"
  );
  return primeiro?.href ?? DESTINO_PADRAO;
}
