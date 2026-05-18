"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { AssessmentsTab } from "./assessments-tab";
import { ImprovementActionsTab } from "./improvement-actions-tab";

type AssessmentItem = {
  id: string;
  competency: string;
  competencyLabel: string;
  scope: string;
  scopeId: string;
  score: number;
  notes: string | null;
  assessedAt: Date;
  actions: { id: string; title: string; status: string }[];
};

type ActionItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  relatedMetric: string | null;
  dueDate: Date | null;
  scope: string;
  scopeId: string;
};

type ScopeOption = {
  id: string;
  label: string;
  type: string;
};

export function MeasureGrowDashboard({
  assessments,
  actions,
  scopes,
}: {
  assessments: AssessmentItem[];
  actions: ActionItem[];
  scopes: ScopeOption[];
}) {
  return (
    <Tabs defaultValue="assessments" className="flex flex-col gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="assessments">
          Assessments ({assessments.length})
        </TabsTrigger>
        <TabsTrigger value="actions">
          Ações de Melhoria ({actions.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="assessments">
        <AssessmentsTab initialAssessments={assessments} scopes={scopes} />
      </TabsContent>
      <TabsContent value="actions">
        <ImprovementActionsTab initialActions={actions} scopes={scopes} />
      </TabsContent>
    </Tabs>
  );
}
