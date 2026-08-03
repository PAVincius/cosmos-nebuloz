"use server";

// velocity.ts — Velocity & Capacity Analytics (FR-011, story-032 AC-001/AC-003).
//
// Predictability em SAFe é *aceito sobre comprometido*: o ponto que o PO
// aceitou na Sprint Review dividido pela capacidade comprometida no
// planejamento. Não é entregue/capacidade — `Sprint.velocity` conta o que foi
// concluído, e concluir sem aceite não é previsibilidade. Sprint sem
// SprintReview não tem ponto aceito: fica `null` (o "N/A" do AC-001) em vez de
// herdar `velocity` como proxy.
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

export type SprintView = {
  id: string;
  name: string;
  /** capacidade comprometida no planejamento — o denominador de predictability */
  capacity: number | null;
  /** pontos concluídos, denormalizados no fechamento da sprint */
  velocity: number | null;
  /** pontos concluídos segundo a Sprint Review */
  completedPoints: number | null;
  /** pontos aceitos pelo PO na Sprint Review — o numerador de predictability */
  acceptedPoints: number | null;
  predictabilityPct: number | null;
};

// null (nunca 0) com denominador ausente/zero ou sem ponto aceito registrado:
// AC-001 pede "N/A" explícito, e um 0% leria como "nada foi aceito".
function predictabilityPct(
  capacity: number | null,
  accepted: number | null
): number | null {
  if (capacity === null || capacity <= 0 || accepted === null) {
    return null;
  }
  return Math.round((accepted / capacity) * 100);
}

export async function listRecentSprints(): Promise<Result<SprintView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.sprint.findMany({
      where: { tenantId: ctx.tenantId, status: "CLOSED" },
      orderBy: { endDate: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        capacity: true,
        velocity: true,
        review: { select: { completedPoints: true, acceptedPoints: true } },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      capacity: s.capacity,
      velocity: s.velocity,
      completedPoints: s.review?.completedPoints ?? null,
      acceptedPoints: s.review?.acceptedPoints ?? null,
      predictabilityPct: predictabilityPct(
        s.capacity,
        s.review?.acceptedPoints ?? null
      ),
    }));
  });
}

export type TeamPredictabilityView = {
  teamId: string;
  teamName: string;
  predictabilityPct: number;
  sprintCount: number;
};

// Predictability por time — média de aceito/comprometido sobre as sprints
// fechadas que têm capacidade e ponto aceito registrados, tenant-scoped.
// Ordenado do melhor para o pior para a tela não reordenar.
export async function listTeamPredictability(): Promise<
  Result<TeamPredictabilityView[]>
> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const rows = await database.sprint.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: "CLOSED",
        capacity: { not: null },
        review: { acceptedPoints: { not: null } },
      },
      select: {
        teamId: true,
        capacity: true,
        team: { select: { name: true } },
        review: { select: { acceptedPoints: true } },
      },
    });

    const byTeam = new Map<string, { name: string; ratios: number[] }>();
    for (const s of rows) {
      const pct = predictabilityPct(
        s.capacity,
        s.review?.acceptedPoints ?? null
      );
      if (pct === null) {
        continue;
      }
      const entry = byTeam.get(s.teamId) ?? {
        name: s.team.name,
        ratios: [],
      };
      entry.ratios.push(pct);
      byTeam.set(s.teamId, entry);
    }

    return Array.from(byTeam.entries())
      .map(([teamId, { name, ratios }]) => ({
        teamId,
        teamName: name,
        predictabilityPct: Math.round(
          ratios.reduce((a, b) => a + b, 0) / ratios.length
        ),
        sprintCount: ratios.length,
      }))
      .sort((a, b) => b.predictabilityPct - a.predictabilityPct);
  });
}
