import { getOrgId } from "@repo/auth/server";
import { Room } from "@repo/collaboration/room";
import { Badge } from "@repo/design-system/components/ui/badge";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getPIPlanFullDetails } from "@/app/actions/arts/pi-plans";
import {
  getPIPlansByART,
  getProgramBoardData,
} from "@/app/actions/program-board";
import { ProgramBoardClient } from "../arts/[artId]/program-board/components/program-board-client";
import { MiroBoardPanel } from "./components/miro-board-panel";

const ConfidenceVote = dynamic(
  () => import("./components/confidence-vote").then((m) => m.ConfidenceVote),
  {
    loading: () => (
      <div className="flex h-64 items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar votação de confiança…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "PI Planning | COSMOS",
};

type SearchParams = {
  tab?: string;
  artId?: string;
  piPlanId?: string;
};

const TABS = [
  { key: "objectives", label: "Objetivos PI" },
  { key: "board", label: "Program Board" },
  { key: "miro", label: "Miro Board" },
  { key: "vote", label: "Votação de Confiança" },
] as const;

export default async function PIPlanningPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const orgId = await getOrgId();
  if (!orgId) {
    notFound();
  }

  const sp = await searchParams;
  const activeTab = sp.tab ?? "objectives";

  // Auto-detect ART and PI Plan
  const arts = await getARTs();
  const artId = sp.artId ?? arts[0]?.id;
  const piPlans = artId ? await getPIPlansByART(artId) : [];
  const piPlanId = sp.piPlanId ?? piPlans[0]?.id;

  function tabHref(tab: string) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (artId) {
      params.set("artId", artId);
    }
    if (piPlanId) {
      params.set("piPlanId", piPlanId);
    }
    return `/pi-planning?${params.toString()}`;
  }

  return (
    <div className="w-full min-w-0 space-y-6 px-6 py-10">
      <div className="flex flex-col space-y-1">
        <h1 className="font-bold text-3xl tracking-tight">PI Planning</h1>
        {piPlans[0] && (
          <p className="text-muted-foreground text-sm">{piPlans[0].name}</p>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <Link
            className={[
              "px-4 py-2 font-medium text-sm transition-colors",
              activeTab === tab.key
                ? "border-primary border-b-2 text-primary"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            href={tabHref(tab.key)}
            key={tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "objectives" && (
        <ObjectivesTab artId={artId} piPlanId={piPlanId} />
      )}
      {activeTab === "board" && <BoardTab artId={artId} piPlanId={piPlanId} />}
      {activeTab === "miro" && <MiroTab piPlanId={piPlanId} />}
      {activeTab === "vote" && (
        <Room
          authEndpoint="/api/collaboration/auth"
          fallback={
            <div className="flex h-64 items-center justify-center">
              <div className="flex animate-pulse flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground text-sm">
                  A ligar à sessão…
                </p>
              </div>
            </div>
          }
          id={`${orgId}:pi-planning-board:${orgId}`}
        >
          <ConfidenceVote />
        </Room>
      )}
    </div>
  );
}

async function ObjectivesTab({
  artId,
  piPlanId,
}: {
  artId: string | undefined;
  piPlanId: string | undefined;
}) {
  if (!piPlanId) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum PI Planning ativo. Crie um em{" "}
        <Link className="underline" href="/arts">
          ARTs
        </Link>
        .
      </p>
    );
  }

  const plan = await getPIPlanFullDetails(piPlanId);
  if (!plan) {
    return (
      <p className="text-muted-foreground text-sm">PI Plan não encontrado.</p>
    );
  }

  const objectives = plan.objectives;

  return (
    <div className="space-y-3">
      {objectives.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhum objetivo de PI definido ainda.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {objectives.map((obj) => (
            <li
              className="flex items-start justify-between gap-4 p-4"
              key={obj.id}
            >
              <div className="space-y-0.5">
                <p className="font-medium text-sm">{obj.title}</p>
                {obj.businessValue !== null && (
                  <p className="text-muted-foreground text-xs">
                    Business Value: {obj.businessValue}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {obj.isStretch && <Badge variant="outline">Stretch</Badge>}
                <Badge variant="secondary">{obj.status ?? "PLANNED"}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function MiroTab({ piPlanId }: { piPlanId: string | undefined }) {
  if (!piPlanId) {
    return (
      <p className="text-muted-foreground text-sm">Nenhum PI Planning ativo.</p>
    );
  }

  const plan = await getPIPlanFullDetails(piPlanId);
  const miroBoardUrl = plan?.miroBoardUrl ?? null;

  return <MiroBoardPanel initialUrl={miroBoardUrl} piPlanId={piPlanId} />;
}

async function BoardTab({
  artId,
  piPlanId,
}: {
  artId: string | undefined;
  piPlanId: string | undefined;
}) {
  if (!(artId && piPlanId)) {
    return (
      <p className="text-muted-foreground text-sm">
        Selecione um ART e PI Plan para ver o Program Board.
      </p>
    );
  }

  const boardData = await getProgramBoardData(artId, piPlanId);

  return <ProgramBoardClient data={boardData} />;
}
