"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { LayoutGridIcon, UsersIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { PIPlanFullDetails } from "@/app/actions/arts/types";

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

type Tab = "program-board" | "team-breakout";

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
    </Tabs>
  );
}
