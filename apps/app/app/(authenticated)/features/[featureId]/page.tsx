import { notFound } from "next/navigation";
import { getFeatureById } from "@/app/actions/features";
import { EditFeatureDialog } from "./components/edit-feature-dialog";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  TargetIcon,
  TrendingUpIcon,
  ClockIcon,
  ShieldIcon,
  BrainIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";

interface FeaturePageProps {
  params: Promise<{ featureId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  ANALYSIS: "Em Análise",
  REVIEW: "Em Revisão",
  IMPLEMENTING: "Implementando",
  DONE: "Concluído",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  BACKLOG: "outline",
  ANALYSIS: "secondary",
  REVIEW: "secondary",
  IMPLEMENTING: "default",
  DONE: "default",
};

export async function generateMetadata({ params }: FeaturePageProps): Promise<Metadata> {
  const { featureId } = await params;
  const feature = await getFeatureById(featureId);
  return {
    title: feature ? `${feature.title} | COSMOS` : "Feature | COSMOS",
    description: "Detalhes da feature SAFe",
  };
}

export default async function FeaturePage({ params }: FeaturePageProps) {
  const { featureId } = await params;
  const feature = await getFeatureById(featureId);

  if (!feature) notFound();

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={
          feature.epicId
            ? [
                { label: "Portfolio", href: "/portfolio" },
                { label: "Épico", href: `/epics/${feature.epicId}` },
                { label: feature.title },
              ]
            : [
                { label: "Portfolio", href: "/portfolio" },
                { label: feature.title },
              ]
        }
        title={feature.title}
        subtitle="Feature SAFe"
        badge={
          <Badge variant={STATUS_VARIANTS[feature.statusId] ?? "outline"}>
            {STATUS_LABELS[feature.statusId] ?? feature.statusId}
          </Badge>
        }
        stats={[
          { label: "WSJF", value: feature.wsjfScore.toFixed(2), icon: BrainIcon },
          { label: "Story Points", value: feature.storyPoints, icon: TargetIcon },
        ]}
        actions={<EditFeatureDialog feature={feature} />}
      />

      <div className={appDesign.bodyScroll}>
      <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* WSJF Score */}
        <Card className="col-span-full sm:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <BrainIcon className="h-4 w-4" />
              WSJF Score
            </CardDescription>
            <CardTitle className="text-4xl font-bold tabular-nums">
              {feature.wsjfScore.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Prioridade calculada: (BV + TC + RR) / JS
            </p>
          </CardContent>
        </Card>

        {/* Story Points */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Story Points</CardDescription>
            <CardTitle className="text-3xl font-bold tabular-nums">
              {feature.storyPoints}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Estimativa de esforço</p>
          </CardContent>
        </Card>

        {/* Assignee */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Responsável</CardDescription>
            <CardTitle className="text-base">
              {feature.assigneeUserId ?? (
                <span className="font-normal text-muted-foreground">Não atribuído</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {feature.completedAt
                ? `Concluído em ${new Date(feature.completedAt).toLocaleDateString("pt-BR")}`
                : "Em progresso"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* WSJF breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes WSJF</CardTitle>
          <CardDescription>Parâmetros de priorização SAFe</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TargetIcon className="h-3.5 w-3.5" />
                Business Value
              </div>
              <p className="text-2xl font-semibold tabular-nums">{feature.bv}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClockIcon className="h-3.5 w-3.5" />
                Time Criticality
              </div>
              <p className="text-2xl font-semibold tabular-nums">{feature.tc}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldIcon className="h-3.5 w-3.5" />
                Risk Reduction
              </div>
              <p className="text-2xl font-semibold tabular-nums">{feature.rr}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUpIcon className="h-3.5 w-3.5" />
                Job Size
              </div>
              <p className="text-2xl font-semibold tabular-nums">{feature.js}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Criado em</span>
            <span>{new Date(feature.createdAt).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Atualizado em</span>
            <span>{new Date(feature.updatedAt).toLocaleDateString("pt-BR")}</span>
          </div>
          {feature.piPlan && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">PI Plan</span>
              <span>{feature.piPlan.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </div>
    </div>
  );
}
