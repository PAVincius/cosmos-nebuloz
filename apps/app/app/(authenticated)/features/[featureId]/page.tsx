import { Badge } from "@repo/design-system/components/cosmos/badge";
import { SectionCard } from "@repo/design-system/components/cosmos/section-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  BrainIcon,
  ClockIcon,
  ShieldIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalSourceBadge } from "@/app/(authenticated)/components/external-source-badge";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { getFeatureById } from "@/app/actions/features";
import { appDesign } from "@/lib/app-design";
import { EditFeatureDialog } from "./components/edit-feature-dialog";

type FeaturePageProps = {
  params: Promise<{ featureId: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  ANALYSIS: "Em Análise",
  REVIEW: "Em Revisão",
  IMPLEMENTING: "Implementando",
  DONE: "Concluído",
};

const STATUS_TONES: Record<
  string,
  "neutral" | "blue" | "amber" | "accent" | "green"
> = {
  BACKLOG: "neutral",
  ANALYSIS: "blue",
  REVIEW: "amber",
  IMPLEMENTING: "accent",
  DONE: "green",
};

export async function generateMetadata({
  params,
}: FeaturePageProps): Promise<Metadata> {
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

  if (!feature) {
    notFound();
  }

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<EditFeatureDialog feature={feature} />}
        badge={
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONES[feature.statusId] ?? "neutral"}>
              {STATUS_LABELS[feature.statusId] ?? feature.statusId}
            </Badge>
            <ExternalSourceBadge
              size="sm"
              source={feature.externalSource}
              url={feature.externalUrl}
            />
          </div>
        }
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
        stats={[
          {
            label: "WSJF",
            value: feature.wsjfScore.toFixed(2),
            icon: BrainIcon,
          },
          {
            label: "Story Points",
            value: feature.storyPoints,
            icon: TargetIcon,
          },
        ]}
        subtitle="Feature SAFe"
        title={feature.title}
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
                <CardTitle className="font-bold text-4xl tabular-nums">
                  {feature.wsjfScore.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  Prioridade calculada: (BV + TC + RR) / JS
                </p>
              </CardContent>
            </Card>

            {/* Story Points */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Story Points</CardDescription>
                <CardTitle className="font-bold text-3xl tabular-nums">
                  {feature.storyPoints}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  Estimativa de esforço
                </p>
              </CardContent>
            </Card>

            {/* Assignee */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Responsável</CardDescription>
                <CardTitle className="text-base">
                  {feature.assigneeUserId ?? (
                    <span className="font-normal text-muted-foreground">
                      Não atribuído
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  {feature.completedAt
                    ? `Concluído em ${new Date(feature.completedAt).toLocaleDateString("pt-BR")}`
                    : "Em progresso"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* WSJF breakdown */}
          <SectionCard
            description="Parâmetros de priorização SAFe"
            icon={<BrainIcon className="h-4 w-4" />}
            title="Detalhes WSJF"
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-1 rounded-lg border border-hairline p-3">
                <div className="flex items-center gap-1.5 text-ink-muted text-xs">
                  <TargetIcon className="h-3.5 w-3.5" />
                  Business Value
                </div>
                <p className="font-semibold text-2xl tabular-nums">
                  {feature.bv}
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-hairline p-3">
                <div className="flex items-center gap-1.5 text-ink-muted text-xs">
                  <ClockIcon className="h-3.5 w-3.5" />
                  Time Criticality
                </div>
                <p className="font-semibold text-2xl tabular-nums">
                  {feature.tc}
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-hairline p-3">
                <div className="flex items-center gap-1.5 text-ink-muted text-xs">
                  <ShieldIcon className="h-3.5 w-3.5" />
                  Risk Reduction
                </div>
                <p className="font-semibold text-2xl tabular-nums">
                  {feature.rr}
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border border-hairline p-3">
                <div className="flex items-center gap-1.5 text-ink-muted text-xs">
                  <TrendingUpIcon className="h-3.5 w-3.5" />
                  Job Size
                </div>
                <p className="font-semibold text-2xl tabular-nums">
                  {feature.js}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Metadata */}
          <SectionCard
            bodyClassName="flex flex-col gap-2 text-sm"
            title="Informações"
          >
            <div className="flex justify-between">
              <span className="text-ink-muted">Criado em</span>
              <span>
                {new Date(feature.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Atualizado em</span>
              <span>
                {new Date(feature.updatedAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {feature.piPlan ? (
              <div className="flex justify-between">
                <span className="text-ink-muted">PI Plan</span>
                <span>{feature.piPlan.name}</span>
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
