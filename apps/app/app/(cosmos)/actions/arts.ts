"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { type Result, safeAction } from "../../actions/_base";

// Leitura da tela /cosmos/arts (story-059). As mutações — createART,
// createPIPlanWithSprints, transitionPIPlan — não moram aqui: já existem em
// app/actions/arts/lifecycle.ts, com guard de papel, checagem de nome duplicado
// e 20 casos de teste verdes. A tela importa de lá direto, como governance.tsx e
// okrs já fazem. Reimplementar aqui criaria a terceira cópia de createART neste
// repo (lifecycle.ts e get-arts.ts já divergem entre si).
//
// O que falta lá é só a leitura no formato do quadro: getARTs() devolve o objeto
// Prisma cru e não traz a contagem de times — e é justamente a contagem que
// decide se a criação de PI pode ser oferecida (AC-002), já que
// createPIPlanWithSprints recusa com ART_NO_TEAMS quando o ART está vazio.

/** Status de PIPlan que o Program Board enxerga (getActiveProgramBoard). */
const PI_VISIVEL_NO_BOARD = new Set(["PLANNING", "COMMITTED", "EXECUTING"]);

export type ArtPiView = {
  id: string;
  name: string;
  status: string;
  // Nullable no schema: um PIPlan pode existir sem janela definida. Devolver
  // null em vez de fabricar data — a tela mostra "—", não uma data inventada.
  startDate: string | null;
  endDate: string | null;
  sprintCount: number;
  /** false em DRAFT: o PI existe mas nenhuma outra tela o enxerga. */
  visivelNoBoard: boolean;
  /** DRAFT é o único estado do qual OPEN_PLANNING é transição válida. */
  podeAbrir: boolean;
};

export type ArtListView = {
  id: string;
  name: string;
  status: string;
  piCadenceWeeks: number;
  sprintLengthWeeks: number;
  ipSprintEnabled: boolean;
  teamCount: number;
  /** Quantos sprints por time createPIPlanWithSprints geraria com esta cadência. */
  sprintsPorTime: number;
  piPlans: ArtPiView[];
};

/**
 * Espelha generateSprints() de app/actions/arts/lifecycle.ts. Aqui é previsão
 * mostrada ao usuário antes de criar; lá é a geração de verdade. Se as duas
 * divergirem, a tela mente — por isso a fórmula está comentada nos dois lados.
 *
 * O total **não** muda com o IP sprint: ligado, lá são `floor - 1` regulares
 * mais um IP; desligado, `floor` regulares. O que muda é a composição, e é ela
 * que a tela mostra. 10 semanas / sprint de 2 = 5 (4 regulares + IP), que é o
 * número da story-017 AC-003.
 */
function preverSprints(art: {
  piCadenceWeeks: number;
  sprintLengthWeeks: number;
  ipSprintEnabled: boolean;
}): number {
  return Math.floor(art.piCadenceWeeks / art.sprintLengthWeeks);
}

export async function listArts(): Promise<Result<ArtListView[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const arts = await database.aRT.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        piCadenceWeeks: true,
        sprintLengthWeeks: true,
        ipSprintEnabled: true,
        _count: { select: { teams: true } },
        piPlans: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            _count: { select: { sprints: true } },
          },
        },
      },
    });

    return arts.map((art) => ({
      id: art.id,
      name: art.name,
      status: art.status,
      piCadenceWeeks: art.piCadenceWeeks,
      sprintLengthWeeks: art.sprintLengthWeeks,
      ipSprintEnabled: art.ipSprintEnabled,
      teamCount: art._count.teams,
      sprintsPorTime: preverSprints(art),
      piPlans: art.piPlans.map((pi) => ({
        id: pi.id,
        name: pi.name,
        status: pi.status,
        startDate: pi.startDate?.toISOString() ?? null,
        endDate: pi.endDate?.toISOString() ?? null,
        sprintCount: pi._count.sprints,
        visivelNoBoard: PI_VISIVEL_NO_BOARD.has(pi.status),
        podeAbrir: pi.status === "DRAFT",
      })),
    }));
  });
}
