"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import {
  AlertTriangleIcon,
  LayoutGridIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { PIPlanFullDetails } from "@/app/actions/arts/pi-plans";

// Skeleton shown while tab content loads client-side (ssr:false prevents server/client ID mismatch)
function TabSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4">
      {[1, 2, 3].map((i) => (
        <div className="h-16 animate-pulse rounded-lg bg-muted/50" key={i} />
      ))}
    </div>
  );
}

const ProgramBoardEmbedded = dynamic(
  () => import("./program-board-embedded").then((m) => m.ProgramBoardEmbedded),
  { ssr: false, loading: () => <TabSkeleton /> }
);
const TeamBreakoutView = dynamic(
  () => import("./team-breakout-view").then((m) => m.TeamBreakoutView),
  { ssr: false, loading: () => <TabSkeleton /> }
);
const PiObjectivesView = dynamic(
  () => import("./pi-objectives-view").then((m) => m.PiObjectivesView),
  { ssr: false, loading: () => <TabSkeleton /> }
);
const RiskRoamBoard = dynamic(
  () => import("./risk-roam-board").then((m) => m.RiskRoamBoard),
  { ssr: false, loading: () => <TabSkeleton /> }
);

type Tab = "program-board" | "team-breakout" | "objectives" | "risks";

type PiWorkspaceTabsProps = {
  piPlan: PIPlanFullDetails;
};

export function PiWorkspaceTabs({ piPlan }: PiWorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("program-board");

  const features = piPlan.features.map((f) => ({
    id: f.id,
    title: f.title,
    storyPoints: f.storyPoints,
    wsjfScore: f.wsjfScore,
    statusId: f.statusId,
    epicId: f.epicId,
    epicTitle: f.epic?.title ?? null,
    assigneeUserId: f.assigneeUserId,
  }));

  return (
    <Tabs onValueChange={(v) => setActiveTab(v as Tab)} value={activeTab}>
      <TabsList className="w-full justify-start">
        <TabsTrigger className="gap-1.5" value="program-board">
          <LayoutGridIcon className="h-3.5 w-3.5" />
          Program Board
        </TabsTrigger>
        <TabsTrigger className="gap-1.5" value="team-breakout">
          <UsersIcon className="h-3.5 w-3.5" />
          Team Breakout
        </TabsTrigger>
        <TabsTrigger className="gap-1.5" value="objectives">
          <TargetIcon className="h-3.5 w-3.5" />
          Objetivos de PI
          {piPlan.objectives.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-medium text-[10px]">
              {piPlan.objectives.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger className="gap-1.5" value="risks">
          <AlertTriangleIcon className="h-3.5 w-3.5" />
          Riscos ROAM
          {piPlan.risks.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-medium text-[10px]">
              {piPlan.risks.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-4" value="program-board">
        <ProgramBoardEmbedded
          artId={piPlan.artId}
          cadence={piPlan.art.cadence}
          features={features}
          piPlanId={piPlan.id}
          teams={piPlan.teams}
        />
      </TabsContent>

      <TabsContent className="mt-4" value="team-breakout">
        <TeamBreakoutView
          cadence={piPlan.art.cadence}
          features={features}
          teams={piPlan.teams}
        />
      </TabsContent>

      <TabsContent className="mt-4" value="objectives">
        <PiObjectivesView
          objectives={piPlan.objectives.map((o) => ({
            id: o.id,
            title: o.title,
            description: o.description,
            isStretch: o.isStretch,
            status: o.status,
            businessValue: o.businessValue,
            teamId: o.teamId,
          }))}
          piPlanId={piPlan.id}
          teams={piPlan.teams}
        />
      </TabsContent>

      <TabsContent className="mt-4" value="risks">
        <RiskRoamBoard
          piPlanId={piPlan.id}
          risks={piPlan.risks.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            category: r.category,
            impact: r.impact,
            probability: r.probability,
          }))}
        />
      </TabsContent>
    </Tabs>
  );
}
