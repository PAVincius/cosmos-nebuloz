"use server";

import { requireRole, requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { type Result, safeAction } from "../../actions/_base";
import { logAudit } from "../../actions/audit/log-audit";

export type PillarView = {
  id: string;
  name: string;
  tone: string;
  themes: {
    id: string;
    title: string;
    healthStatus: string;
    targetAllocationPct: number | null;
  }[];
  // Rollup through themes[].epics — same aggregation getStrategyPillar()
  // computes for a single pillar, applied here to every pillar in the list.
  epicCount: number;
  // null (never 0) when no epic in the pillar has features: "0% concluído" and
  // "não há o que medir" are different states, and the second is not the first.
  avgProgress: number | null;
};

// Média das porcentagens dos épicos que TÊM feature. Épico sem feature fica
// fora do denominador — contá-lo como 0% afundaria a média de um pilar por
// causa de épicos que ninguém decompôs ainda.
function avgProgressOf(
  epics: { featureCount: number; doneFeatureCount: number }[]
): number | null {
  const withFeatures = epics.filter((e) => e.featureCount > 0);
  if (withFeatures.length === 0) {
    return null;
  }
  return Math.round(
    withFeatures.reduce(
      (s, e) => s + (e.doneFeatureCount / e.featureCount) * 100,
      0
    ) / withFeatures.length
  );
}

export async function listStrategyPillars(): Promise<Result<PillarView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.strategyPillar.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        tone: true,
        themes: {
          select: {
            id: true,
            title: true,
            healthStatus: true,
            targetAllocationPct: true,
            epics: { select: { featureCount: true, doneFeatureCount: true } },
          },
        },
      },
    });

    return rows.map((p) => {
      const epics = p.themes.flatMap((t) => t.epics);
      return {
        id: p.id,
        name: p.name,
        tone: p.tone,
        themes: p.themes.map((t) => ({
          id: t.id,
          title: t.title,
          healthStatus: t.healthStatus,
          targetAllocationPct: t.targetAllocationPct,
        })),
        epicCount: epics.length,
        avgProgress: avgProgressOf(epics),
      };
    });
  });
}

export type UnlinkedThemeView = {
  id: string;
  title: string;
  healthStatus: string;
};

// story-031 AC-001: nó órfão vai para a faixa de "desalinhados", não some do
// mapa. Um tema sem pilar é uma aposta de investimento que ninguém consegue
// ligar à estratégia — é a lacuna que a FR-029 caça, e escondê-la da tela é
// pior do que não tê-la.
//
// Tema ARQUIVADO fica de fora: ele saiu do portfólio, e cobrar alinhamento
// dele seria um alarme que ninguém pode resolver.
export async function listUnlinkedThemes(): Promise<
  Result<UnlinkedThemeView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    return database.strategicTheme.findMany({
      where: {
        tenantId: ctx.tenantId,
        pillarId: null,
        status: { not: "ARCHIVED" },
      },
      orderBy: { order: "asc" },
      select: { id: true, title: true, healthStatus: true },
    });
  });
}

export type PillarDetailView = {
  id: string;
  name: string;
  tone: string;
  themes: {
    id: string;
    title: string;
    healthStatus: string;
    targetAllocationPct: number | null;
    epicCount: number;
    avgProgress: number;
  }[];
  epics: {
    id: string;
    title: string;
    themeTitle: string;
    wsjf: number | null;
    progressPct: number;
  }[];
  epicCount: number;
  doneEpicCount: number;
  avgProgress: number;
};

export async function getStrategyPillar(
  id: string
): Promise<Result<PillarDetailView>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const pillar = await database.strategyPillar.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: {
        id: true,
        name: true,
        tone: true,
        themes: {
          select: {
            id: true,
            title: true,
            healthStatus: true,
            targetAllocationPct: true,
            epics: {
              select: {
                id: true,
                title: true,
                wsjf: true,
                featureCount: true,
                doneFeatureCount: true,
              },
            },
          },
        },
      },
    });

    if (!pillar) {
      throw new Error("Pilar estratégico não encontrado.");
    }

    // Mesma média da grade, coagida a 0 na borda: PillarDetailView é a
    // superfície da tela de detalhe do pilar, que ainda espera number. Trocar
    // o contrato dela é assunto do nó `pillar`, não deste.
    const detailProgressOf = (
      epics: { featureCount: number; doneFeatureCount: number }[]
    ) => avgProgressOf(epics) ?? 0;

    const themes = pillar.themes.map((t) => ({
      id: t.id,
      title: t.title,
      healthStatus: t.healthStatus,
      targetAllocationPct: t.targetAllocationPct,
      epicCount: t.epics.length,
      avgProgress: detailProgressOf(t.epics),
    }));

    const rawEpics = pillar.themes.flatMap((t) =>
      t.epics.map((e) => ({ ...e, themeTitle: t.title }))
    );
    const epics = rawEpics.map((e) => ({
      id: e.id,
      title: e.title,
      themeTitle: e.themeTitle,
      wsjf: e.wsjf,
      progressPct:
        e.featureCount > 0
          ? Math.round((e.doneFeatureCount / e.featureCount) * 100)
          : 0,
    }));

    return {
      id: pillar.id,
      name: pillar.name,
      tone: pillar.tone,
      themes,
      epics,
      epicCount: epics.length,
      doneEpicCount: epics.filter((e) => e.progressPct === 100).length,
      avgProgress: detailProgressOf(rawEpics),
    };
  });
}

const CreatePillarSchema = z.object({
  name: z.string().min(1).max(200),
  tone: z.string().min(1).max(40).optional(),
});

export async function createPillar(
  input: z.input<typeof CreatePillarSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { name, tone } = CreatePillarSchema.parse(input);

    const created = await database.strategyPillar.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        tone: tone ?? "accent",
      },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "created",
      entityType: "pillar",
      entityId: created.id,
      diff: { name },
    });
    revalidateTag(`strategy:${ctx.tenantId}`, "max");
    return { id: created.id };
  });
}

const AssignThemeToPillarSchema = z.object({
  themeId: z.string().min(1),
  // null desvincula. É o mesmo caminho da vinculação porque mover um tema
  // entre pilares e tirá-lo de todos são a mesma escrita — separá-las em duas
  // actions duplicaria as duas guardas de tenant e o audit.
  pillarId: z.string().min(1).nullable(),
});

export async function assignThemeToPillar(
  input: z.input<typeof AssignThemeToPillarSchema>
): Promise<Result<{ id: string }>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    requireRole(["ADMIN", "STE"], ctx);
    const { themeId, pillarId } = AssignThemeToPillarSchema.parse(input);

    // Guarda IDOR do primeiro FK. `pillarId` do registro é lido junto porque o
    // audit precisa do valor anterior: sem ele, mover um tema entre pilares
    // deixa rastro só do destino e a origem se perde.
    const theme = await database.strategicTheme.findFirst({
      where: { id: themeId, tenantId: ctx.tenantId },
      select: { id: true, pillarId: true, title: true },
    });
    if (!theme) {
      throw new Error("Tema estratégico não encontrado.");
    }

    // Guarda IDOR do segundo FK. Só há o que reconferir quando há destino —
    // desvincular não aponta para pilar algum.
    if (pillarId) {
      const pillar = await database.strategyPillar.findFirst({
        where: { id: pillarId, tenantId: ctx.tenantId },
        select: { id: true },
      });
      if (!pillar) {
        throw new Error("Pilar estratégico não encontrado.");
      }
    }

    await database.strategicTheme.update({
      where: { id: themeId },
      // Nenhum Epic é tocado: o épico pertence ao tema, e é o tema que se move
      // entre pilares.
      data: { pillarId },
      select: { id: true },
    });

    await logAudit(ctx.tenantId, {
      userId: ctx.userId,
      action: "updated",
      entityType: "theme",
      entityId: themeId,
      diff: { pillarId: `${theme.pillarId ?? "—"}→${pillarId ?? "—"}` },
    });
    revalidateTag(`strategy:${ctx.tenantId}`, "max");
    return { id: themeId };
  });
}
