"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { LayoutGridIcon, UsersIcon, TargetIcon, AlertTriangleIcon } from "lucide-react";
import type { PIPlanFullDetails } from "@/app/actions/arts/pi-plans";

// Skeleton shown while tab content loads client-side (ssr:false prevents server/client ID mismatch)
function TabSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
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

interface PiWorkspaceTabsProps {
  piPlan: PIPlanFullDetails;
}

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
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
      <TabsList className="w-full justify-start">
        <TabsTrigger value="program-board" className="gap-1.5">
          <LayoutGridIcon className="h-3.5 w-3.5" />
          Program Board
        </TabsTrigger>
        <TabsTrigger value="team-breakout" className="gap-1.5">
          <UsersIcon className="h-3.5 w-3.5" />
          Team Breakout
        </TabsTrigger>
        <TabsTrigger value="objectives" className="gap-1.5">
          <TargetIcon className="h-3.5 w-3.5" />
          Objetivos de PI
          {piPlan.objectives.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {piPlan.objectives.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="risks" className="gap-1.5">
          <AlertTriangleIcon className="h-3.5 w-3.5" />
          Riscos ROAM
          {piPlan.risks.length > 0 && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {piPlan.risks.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="program-board" className="mt-4">
        <ProgramBoardEmbedded
          artId={piPlan.artId}
          piPlanId={piPlan.id}
          teams={piPlan.teams}
          features={features}
          cadence={piPlan.art.cadence}
        />
      </TabsContent>

      <TabsContent value="team-breakout" className="mt-4">
        <TeamBreakoutView
          teams={piPlan.teams}
          features={features}
          cadence={piPlan.art.cadence}
        />
      </TabsContent>

      <TabsContent value="objectives" className="mt-4">
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
          teams={piPlan.teams}
          piPlanId={piPlan.id}
        />
      </TabsContent>

      <TabsContent value="risks" className="mt-4">
        <RiskRoamBoard
          risks={piPlan.risks.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            status: r.status,
            category: r.category,
            impact: r.impact,
            probability: r.probability,
          }))}
          piPlanId={piPlan.id}
        />
      </TabsContent>
    </Tabs>
  );
}
