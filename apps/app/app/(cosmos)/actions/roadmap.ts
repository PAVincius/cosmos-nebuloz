"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type RoadmapItemView = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  status: string;
  milestone: boolean;
  artId: string | null;
  // Resolved tenant-scoped ART name for the Gantt lane label. RoadmapItem.artId
  // is a plain app-layer string, not a Prisma relation (same precedent as
  // RoadmapItem.epicId — see EpicValueMetric's comment in portfolio.prisma),
  // so it is re-scoped against the tenant's own ARTs below rather than
  // trusted as-is: an artId that doesn't resolve to one of this tenant's ARTs
  // (data-integrity bug, or a stale/foreign id) yields null, never another
  // tenant's ART name.
  artName: string | null;
};

export async function listRoadmapItems(): Promise<Result<RoadmapItemView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.roadmapItem.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        color: true,
        status: true,
        milestone: true,
        artId: true,
      },
    });

    const artIds = [
      ...new Set(rows.map((r) => r.artId).filter((id): id is string => !!id)),
    ];
    const arts =
      artIds.length > 0
        ? await database.aRT.findMany({
            where: { id: { in: artIds }, tenantId: ctx.tenantId },
            select: { id: true, name: true },
          })
        : [];
    const artNameById = new Map(arts.map((a) => [a.id, a.name]));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      color: r.color,
      status: r.status,
      milestone: r.milestone,
      artId: r.artId,
      artName: r.artId ? (artNameById.get(r.artId) ?? null) : null,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
    }));
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// FR-028: "max 25/ART/quarter". Sem o teto, replanejar vira empurrar tudo para
// frente até um trimestre concentrar o portfólio inteiro — o oposto do que um
// roadmap serve para impedir.
const MAX_ITEMS_PER_ART_QUARTER = 25;

const MoveRoadmapItemSchema = z.object({
  id: z.string().min(1),
  // Faixa de planejamento plausível. Não é regra de negócio inventada: é o
  // limite que impede um typo de mandar um item para o ano 20226 e explodir o
  // eixo da grade, que é derivado das datas dos próprios itens.
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
});

function quarterStartUtc(year: number, quarter: number): Date {
  return new Date(Date.UTC(year, (quarter - 1) * 3, 1));
}

function quarterLabel(date: Date): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export async function moveRoadmapItemToQuarter(
  input: z.input<typeof MoveRoadmapItemSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "RTE", "PO"], ctx);
    const { id, year, quarter } = MoveRoadmapItemSchema.parse(input);

    // Guarda IDOR — id do cliente reconferido dentro do tenant.
    const item = await database.roadmapItem.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        artId: true,
      },
    });
    if (!item) {
      throw new Error("Item de roadmap não encontrado.");
    }

    const newStart = quarterStartUtc(year, quarter);
    const nextQuarterStart = quarterStartUtc(
      quarter === 4 ? year + 1 : year,
      quarter === 4 ? 1 : quarter + 1
    );

    // Teto por faixa da grade. `id: { not: item.id }` porque reposicionar
    // dentro do mesmo trimestre não é adicionar um item — sem isso, o próprio
    // item contaria contra si mesmo e o 25º ficaria preso onde está.
    // artId null é uma faixa como outra qualquer: "Sem ART atribuído" é uma
    // linha da grade, não a ausência de linha.
    const siblings = await database.roadmapItem.count({
      where: {
        tenantId: ctx.tenantId,
        artId: item.artId,
        id: { not: item.id },
        startDate: { gte: newStart, lt: nextQuarterStart },
      },
    });
    if (siblings >= MAX_ITEMS_PER_ART_QUARTER) {
      throw new Error(
        `O trimestre já tem o máximo de ${MAX_ITEMS_PER_ART_QUARTER} itens para este ART.`
      );
    }

    // Duração preservada, nunca recalculada: um item de seis semanas continua
    // com seis semanas depois de mover. Gravar só o início deixaria o fim onde
    // estava e poderia inverter o intervalo.
    //
    // Math.max(0, …) para o caso do intervalo já invertido no banco: o
    // movimento sai com fim igual ao início, corrigindo a inversão em vez de
    // propagá-la — e sem inventar uma duração que ninguém registrou.
    const durationMs = Math.max(
      0,
      item.endDate.getTime() - item.startDate.getTime()
    );
    const newEnd = new Date(newStart.getTime() + durationMs);

    await database.roadmapItem.update({
      where: { id },
      data: { startDate: newStart, endDate: newEnd },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "roadmap_item",
      entityId: id,
      diff: {
        quarter: `${quarterLabel(item.startDate)}→${quarterLabel(newStart)}`,
      },
    });
    revalidatePath("/cosmos/roadmap");
    return { id };
  });
}
