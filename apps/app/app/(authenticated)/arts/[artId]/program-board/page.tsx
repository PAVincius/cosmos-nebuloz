import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { CalendarIcon, LayoutGridIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getARTById, getARTs } from "@/app/actions/arts/get-arts";
import { getPIPlanFullDetails } from "@/app/actions/arts/pi-plans";
import {
  getPIPlansByART,
  getProgramBoardData,
} from "@/app/actions/program-board";
import type { PiRelationItem } from "@/app/(authenticated)/components/relation-chip";
import { PiRelationChip, RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { ProgramBoardHeaderActions } from "./components/program-board-header-actions";
import { ProgramBoardBody } from "./components/program-board-body";

const ProgramBoardClient = dynamic(
  () =>
    import("./components/program-board-client").then(
      (m) => m.ProgramBoardClient
    ),
  {
    loading: () => (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-cosmos-lg border border-hairline bg-surface">
        <div className="flex items-center gap-2 text-ink-muted text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          Carregando program board…
        </div>
      </div>
    ),
  }
);

type ProgramBoardPageProps = {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ piPlanId?: string }>;
};

export async function generateMetadata({
  params,
}: ProgramBoardPageProps): Promise<Metadata> {
  const { artId } = await params;
  const art = await getARTById(artId);
  return {
    title: art
      ? `Program Board – ${art.name} | COSMOS`
      : "Program Board | COSMOS",
    description: "Visão do Program Board SAFe 6.0",
  };
}

export default async function ProgramBoardPage({
  params,
  searchParams,
}: ProgramBoardPageProps) {
  const { artId } = await params;
  const { piPlanId } = await searchParams;

  const [art, piPlans, { tenantId }] = await Promise.all([
    getARTById(artId),
    getPIPlansByART(artId),
    requireTenantSession(await headers()),
  ]);

  if (!art) {
    notFound();
  }

  const selectedPiPlanId = piPlanId ?? piPlans[0]?.id;

  const [boardData, planDetails, arts, epics] = await Promise.all([
    selectedPiPlanId ? getProgramBoardData(artId, selectedPiPlanId) : null,
    selectedPiPlanId ? getPIPlanFullDetails(selectedPiPlanId) : null,
    getARTs(),
    database.epic.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      where: { tenantId },
    }),
  ]);
  const objectives = planDetails?.objectives ?? [];
  const epicsForModal = epics.map((epic) => ({ ...epic, sequenceNumber: null }));
  const teamsForModal = boardData?.teams.map((t) => ({ id: t.id, name: t.name })) ?? [];

  const piRelations: PiRelationItem[] = piPlans.map((pi) => ({
    id: pi.id,
    label: pi.name,
    href: `/arts/${artId}/program-board?piPlanId=${pi.id}`,
  }));

  const selectedPi = piPlans.find((pi) => pi.id === selectedPiPlanId);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        badge={
          <>
            <RelationChip
              eyebrow="ART"
              label={art.name}
              href={`/arts/${artId}`}
              tone="accent"
            />
            {piRelations.length > 0 && (
              <PiRelationChip
                pis={piRelations}
                activeId={selectedPiPlanId}
                entityName={art.name}
              />
            )}
          </>
        }
        title="Program Board"
        subtitle={
          selectedPi
            ? `${selectedPi.name} · features por time e iteração. Dependências e capacidade em uma visão de ART.`
            : "Features por time e iteração. Dependências e capacidade em uma visão de ART."
        }
        stats={[
          {
            label: "TIMES",
            value: boardData?.teams.length ?? 0,
            icon: UsersIcon,
          },
          {
            label: "SPRINTS",
            value: boardData ? `${boardData.sprints.length - 1} + IP` : "—",
            icon: CalendarIcon,
          },
        ]}
        actions={
          <ProgramBoardHeaderActions
            arts={arts}
            epics={epicsForModal}
            teams={teamsForModal}
          />
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <ProgramBoardBody
          artId={artId}
          boardData={boardData}
          hasPiPlans={piPlans.length > 0}
          objectives={objectives}
        >
          {boardData && <ProgramBoardClient data={boardData} />}
        </ProgramBoardBody>
      </div>
    </div>
  );
}
