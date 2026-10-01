"use server";

import { platformDb } from "@repo/provisioning";
import { requirePlatformStaff } from "@/lib/guard";
import { TETO_DA_LISTA } from "@/lib/paginacao";
import { type Result, safeAction } from "@/lib/safe-action";

// Dispensa visível (specs/017, PR 3, FR-005/FR-006).
//
// Todo entregável dispensado de qualquer trilha de cliente, com motivo, trilha,
// cliente e quem/quando. SÓ LEITURA: não há escrita neste arquivo, e o tenant
// nunca vem do chamador — a leitura atravessa organizações pela porta única
// (`platformDb`, ADR-0013), como a fila de gates.

/** Prefixo que `_seed-track.ts` (apps/app) grava na dispensa que veio do
 *  overlay do cliente. É o único sinal de "overlay" no banco. */
const PREFIXO_DO_OVERLAY = "Dispensado pelo overlay do cliente:";

/** Dispensa manual deixa registro de auditoria com esta ação (a do app do
 *  cliente, entregue à parte); automática e overlay nascem com a trilha e não
 *  deixam. */
const ACAO_DE_DISPENSA = "scaffold.deliverable.dispens";

export type DispensaVia = "automatica" | "overlay" | "manual";

/** O que a fila entrega. Só metadado de triagem: o motivo é o que a spec pede;
 *  nada do artefato do cliente atravessa. */
export type DispensaRow = {
  id: string;
  code: string;
  title: string;
  reason: string;
  via: DispensaVia;
  trackId: string;
  trackCode: string;
  orgName: string;
  /** "Sistema" para automática e overlay; o nome gravado na auditoria para a
   *  manual ("—" quando o registro não trouxe nome). */
  by: string;
  /** ISO. Manual: momento da dispensa. Automática/overlay: criação da trilha. */
  at: string;
};

export type DispensasResult = { items: DispensaRow[]; truncated: boolean };

function nomeDoAtor(metadata: unknown): string {
  const nome = (metadata as { actorName?: unknown } | null)?.actorName;
  return typeof nome === "string" && nome.trim() ? nome : "—";
}

export async function listDispensedDeliverables(): Promise<
  Result<DispensasResult>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const rows = await platformDb.scaffoldDeliverableInstance.findMany({
      where: {
        dispensedReason: { not: null },
        // O tenant interno não é cliente (ADR-0013).
        track: { tenant: { isSystem: false } },
      },
      // Dispensar mexe em `updatedAt`: a dispensa recente de uma trilha antiga
      // não fica de fora do teto.
      orderBy: { updatedAt: "desc" },
      take: TETO_DA_LISTA + 1,
      select: {
        id: true,
        tenantId: true,
        code: true,
        title: true,
        dispensedReason: true,
        createdAt: true,
        track: {
          select: {
            id: true,
            code: true,
            tenant: { select: { name: true } },
          },
        },
      },
    });

    const truncated = rows.length > TETO_DA_LISTA;
    const visiveis = truncated ? rows.slice(0, TETO_DA_LISTA) : rows;
    if (visiveis.length === 0) {
      return { items: [], truncated };
    }

    // Quem/quando da dispensa manual. Mais recente primeiro: o primeiro
    // registro de cada instância é o que vale.
    const auditoria = await platformDb.auditLog.findMany({
      where: {
        tenantId: { in: [...new Set(visiveis.map((r) => r.tenantId))] },
        entityType: "scaffold.deliverable",
        entityId: { in: visiveis.map((r) => r.id) },
        action: { startsWith: ACAO_DE_DISPENSA },
      },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, createdAt: true, metadata: true },
    });
    const manual = new Map<string, (typeof auditoria)[number]>();
    for (const a of auditoria) {
      if (a.entityId && !manual.has(a.entityId)) {
        manual.set(a.entityId, a);
      }
    }

    const items = visiveis
      .map((r): DispensaRow => {
        const registro = manual.get(r.id);
        const reason = r.dispensedReason ?? "";
        let via: DispensaVia = "automatica";
        if (registro) {
          via = "manual";
        } else if (reason.startsWith(PREFIXO_DO_OVERLAY)) {
          via = "overlay";
        }
        return {
          id: r.id,
          code: r.code,
          title: r.title,
          reason,
          via,
          trackId: r.track.id,
          trackCode: r.track.code,
          orgName: r.track.tenant.name,
          by: registro ? nomeDoAtor(registro.metadata) : "Sistema",
          at: (registro?.createdAt ?? r.createdAt).toISOString(),
        };
      })
      .sort((a, b) => b.at.localeCompare(a.at));

    return { items, truncated };
  });
}
