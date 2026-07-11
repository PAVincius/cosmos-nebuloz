import { Badge } from "@repo/design-system/components/cosmos/badge";
import {
  AlertTriangleIcon,
  AnchorIcon,
  CalendarIcon,
  FlagIcon,
  LayersIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { RelationChip } from "@/app/(authenticated)/components/relation-chip";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import { appDesign } from "@/lib/app-design";
import { listSolutionTrains } from "../../actions/solution-trains";
import type { SolutionTrainWithCounts } from "../../actions/solution-trains/schema";
import { ToneProgress } from "./components/tone-progress";

const CreateSolutionTrainDialog = dynamic(
  () =>
    import("./components/create-solution-train-dialog").then(
      (m) => m.CreateSolutionTrainDialog
    ),
  {
    loading: () => (
      <div
        aria-hidden
        className="h-9 w-40 shrink-0 animate-pulse rounded-md bg-muted"
      />
    ),
  }
);

export const metadata = {
  title: "Solution Trains | COSMOS",
  description: "Large Solution Level — Solution Trains SAFe 6.0",
};

// ─── KPI icon paths (re-skin of prototype's `screenSolutionTrains` KpiCard) ──
const ICON_ANCHOR =
  "M12 6v16 M19 13 l2-1a9 9 0 0 1-18 0l2 1 M9 11h6 M10 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0";
const ICON_FLAG =
  "M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528";
const ICON_LAYERS =
  "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12 M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17";

// ─── Derived visual meta (Capability.status / ART.status are free-form
// strings in Prisma, no numeric progress field exists — mapped honestly to
// indicative bands/tones, matching cosmos.html's progress-bar language
// without fabricating precision the data doesn't have). ─────────────────────
const CAPABILITY_STATUS_META: Record<
  string,
  { pct: number; tone: "blue" | "amber" | "accent" | "green"; label: string }
> = {
  BACKLOG: { pct: 8, tone: "blue", label: "Backlog" },
  ANALYZING: { pct: 35, tone: "amber", label: "Em análise" },
  IMPLEMENTING: { pct: 65, tone: "accent", label: "Implementando" },
  DONE: { pct: 100, tone: "green", label: "Concluída" },
};
const DEFAULT_CAPABILITY_META = CAPABILITY_STATUS_META.BACKLOG;

const ART_STATUS_META: Record<
  string,
  { tone: "green" | "neutral" | "red"; label: string }
> = {
  ACTIVE: { tone: "green", label: "Ativo" },
  INACTIVE: { tone: "neutral", label: "Inativo" },
  RETIRED: { tone: "red", label: "Aposentado" },
};
const DEFAULT_ART_META = ART_STATUS_META.INACTIVE;

const ART_DOT_TONES = ["blue", "purple", "amber", "green"] as const;

function capabilitiesDoneRatio(train: SolutionTrainWithCounts) {
  const { capabilities } = train;
  if (capabilities.length === 0) {
    return 0;
  }
  const done = capabilities.filter((c) => c.status === "DONE").length;
  return Math.round((done / capabilities.length) * 100);
}

export default async function SolutionTrainsPage() {
  const trainsResult = await listSolutionTrains();
  const trains = trainsResult.ok ? trainsResult.data : [];

  const totalCapabilities = trains.reduce(
    (sum, t) => sum + t._count.capabilities,
    0
  );
  const totalSolutionEpics = trains.reduce(
    (sum, t) => sum + t._count.solutionEpics,
    0
  );
  const totalArts = trains.reduce((sum, t) => sum + t.arts.length, 0);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <>
            <RelationChip
              eyebrow="Ecossistema"
              label="ARTs"
              href="/arts"
              tone="blue"
            />
            <CreateSolutionTrainDialog />
          </>
        }
        badge={
          <Badge className="font-mono uppercase tracking-wide" tone="neutral">
            Large Solution · SAFe
          </Badge>
        }
        breadcrumb={[{ label: "Portfolio", href: "/portfolio" }]}
        stats={[
          { label: "Solution Trains", value: trains.length, icon: AnchorIcon },
          { label: "ARTs coordenados", value: totalArts, icon: LayersIcon },
          {
            label: "Capabilities",
            value: totalCapabilities,
            icon: FlagIcon,
          },
        ]}
        subtitle="Agregação de múltiplos ARTs entregando uma solução conjunta. Composição e milestones."
        title="Solution Trains"
      />

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {!trainsResult.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" />
            <span>
              Falha ao carregar Solution Trains: {trainsResult.error}.{" "}
              <a className="underline" href="/solution-trains">
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        {trainsResult.ok && (
          <KpiGrid cols={3}>
            <KpiCard
              badge="— No portfólio"
              iconPath={ICON_ANCHOR}
              label="Solution Trains"
              tone="purple"
              value={trains.length}
            />
            <KpiCard
              badge="— Em entrega"
              iconPath={ICON_FLAG}
              label="Capabilities"
              tone="accent"
              value={totalCapabilities}
            />
            <KpiCard
              badge="— Em andamento"
              iconPath={ICON_LAYERS}
              label="Solution Epics"
              tone="blue"
              value={totalSolutionEpics}
            />
          </KpiGrid>
        )}

        {trainsResult.ok && trains.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <AnchorIcon className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Nenhum Solution Train configurado ainda.
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Crie um Solution Train para coordenar múltiplos ARTs em soluções
              de grande escala.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {trains.map((train: SolutionTrainWithCounts) => {
              const capsDone = capabilitiesDoneRatio(train);
              return (
                <div
                  className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]"
                  key={train.id}
                >
                  {/* solution header — gradient band + ARTs composition */}
                  <div
                    className="flex items-center gap-4 border-hairline border-b px-5 py-4"
                    style={{
                      background:
                        "linear-gradient(180deg, var(--accent-soft), transparent)",
                    }}
                  >
                    <span
                      className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-md"
                      style={{
                        background: "var(--accent)",
                        color: "var(--accent-fg)",
                        boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),.8)",
                      }}
                    >
                      <AnchorIcon className="h-[23px] w-[23px]" />
                    </span>
                    <div className="min-w-0">
                      <div
                        className="font-extrabold text-[11px] uppercase tracking-[.08em]"
                        style={{ color: "var(--accent-text)" }}
                      >
                        Solution Train
                      </div>
                      <Link
                        className="block truncate font-bold text-[19px] text-ink tracking-[-.015em] hover:underline"
                        href={`/solution-trains/${train.id}`}
                      >
                        {train.name}
                      </Link>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      <div
                        className="font-mono font-extrabold text-[26px] tracking-[-.02em]"
                        style={{ color: "var(--accent-text)" }}
                      >
                        {capsDone}%
                      </div>
                      <div className="font-semibold text-[11px] text-ink-subtle">
                        capabilities concluídas
                      </div>
                    </div>
                  </div>

                  {train.arts.length === 0 ? (
                    <div className="px-5 py-4 text-ink-muted text-xs">
                      Nenhum ART vinculado a este Solution Train ainda.{" "}
                      <Link className="underline" href="/arts">
                        Vincular ARTs
                      </Link>
                    </div>
                  ) : (
                    <div
                      className="grid"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(train.arts.length, 4)}, minmax(150px, 1fr))`,
                      }}
                    >
                      {train.arts.map((art, i) => {
                        const dotTone =
                          ART_DOT_TONES[i % ART_DOT_TONES.length];
                        const statusMeta =
                          ART_STATUS_META[art.status] ?? DEFAULT_ART_META;
                        return (
                          <div
                            className="border-hairline border-r px-4 py-4 last:border-r-0"
                            key={art.id}
                          >
                            <div className="mb-2.5 flex items-center gap-2">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{
                                  background: `var(--${dotTone})`,
                                  boxShadow: `0 0 8px rgba(var(--${dotTone}-rgb),.6)`,
                                }}
                              />
                              <Link
                                className="truncate font-bold text-[13px] text-ink tracking-[-.01em] hover:underline"
                                href="/arts"
                              >
                                {art.name}
                              </Link>
                            </div>
                            <div className="mb-2.5 flex items-center gap-3.5 text-[11.5px] text-ink-subtle">
                              <span>
                                <strong className="font-mono font-bold text-ink-muted">
                                  {art._count.teams}
                                </strong>{" "}
                                times
                              </span>
                            </div>
                            <Badge tone={statusMeta.tone}>
                              {statusMeta.label}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* capabilities */}
                  <div className="border-hairline border-t">
                    <SectionCard
                      accentRgb="167,139,250"
                      actions={
                        <Badge tone="purple">
                          {train._count.capabilities} capabilities
                        </Badge>
                      }
                      icon={LayersIcon}
                      noPadding
                      subtitle="Entregas de larga escala que cruzam múltiplos ARTs"
                      title="Capabilities da solução"
                    >
                      {train.capabilities.length === 0 ? (
                        <p className="p-4 text-ink-muted text-xs">
                          Nenhuma capability cadastrada neste Solution Train.
                        </p>
                      ) : (
                        <div className="grid gap-2.5 p-3 sm:grid-cols-2">
                          {train.capabilities.map((cap, i) => {
                            const meta =
                              CAPABILITY_STATUS_META[cap.status] ??
                              DEFAULT_CAPABILITY_META;
                            return (
                              <div
                                className="rounded-md border border-hairline bg-surface px-4 py-3.5"
                                key={cap.id}
                                style={{
                                  borderLeft: `3px solid var(--${meta.tone})`,
                                }}
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="font-mono font-semibold text-[11px] text-ink-subtle">
                                    CAP-{String(i + 1).padStart(2, "0")}
                                  </span>
                                  {cap.milestone && (
                                    <Badge tone="amber">
                                      <FlagIcon className="h-3 w-3" />
                                      {cap.milestone}
                                    </Badge>
                                  )}
                                  <span
                                    className="ml-auto font-mono font-extrabold text-[13px]"
                                    style={{ color: `var(--${meta.tone}-text)` }}
                                  >
                                    {meta.pct}%
                                  </span>
                                </div>
                                <div className="mb-3 font-semibold text-[14px] text-ink leading-tight tracking-[-.01em]">
                                  {cap.title}
                                </div>
                                <ToneProgress
                                  height={5}
                                  tone={meta.tone}
                                  value={meta.pct}
                                />
                                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                                  <CalendarIcon className="h-3 w-3" />
                                  {meta.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </SectionCard>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
