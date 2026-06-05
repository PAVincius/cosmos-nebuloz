import { Badge } from "@repo/design-system/components/cosmos/badge";
import { KpiCard } from "@repo/design-system/components/cosmos/kpi-card";
import { SectionCard } from "@repo/design-system/components/cosmos/section-card";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClockIcon,
  LayoutDashboardIcon,
  ListOrderedIcon,
  PlugZapIcon,
  Settings2Icon,
  TrainFrontIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getPortfolioEpics } from "@/app/actions/epics/get-portfolio";
import { getMyActiveStories } from "@/app/actions/stories/get-my-active-stories";
import { appDesign } from "@/lib/app-design";
import { getTeams } from "../teams/actions";

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em progresso",
  IN_REVIEW: "Em revisão",
  BLOCKED: "Bloqueado",
};

const STATUS_TONES: Record<
  string,
  "neutral" | "blue" | "accent" | "amber" | "red"
> = {
  BACKLOG: "neutral",
  TODO: "blue",
  IN_PROGRESS: "accent",
  IN_REVIEW: "amber",
  BLOCKED: "red",
};

const QUICK_LINKS = [
  { href: "/portfolio", label: "Kanban de épicos", icon: LayoutDashboardIcon },
  { href: "/portfolio/wsjf", label: "Priorização WSJF", icon: ListOrderedIcon },
  { href: "/arts", label: "ART Board", icon: TrainFrontIcon },
  { href: "/teams", label: "Times", icon: UsersIcon },
  { href: "/settings/workspace", label: "Workspace", icon: Settings2Icon },
] as const;

export async function HomeDashboard() {
  const [epics, arts, teams, myStories] = await Promise.all([
    getPortfolioEpics(),
    getARTs(),
    getTeams(),
    getMyActiveStories().catch(() => []),
  ]);

  const implementing = epics.filter(
    (e) => e.statusId === "IMPLEMENTING"
  ).length;

  const epicsDelta =
    implementing > 0
      ? { positive: true, value: `${implementing} em impl.` }
      : undefined;

  const avgWsjf =
    epics.length > 0
      ? epics.reduce((s, e) => s + e.wsjfScore, 0) / epics.length
      : null;
  const wsjfDelta =
    avgWsjf !== null
      ? {
          positive: avgWsjf >= 5,
          value: avgWsjf >= 5 ? "alta prioridade" : "média prioridade",
        }
      : undefined;

  return (
    <div className={`${appDesign.shell} gap-6 p-6`}>
      <header>
        <h1 className={appDesign.pageTitle}>Início</h1>
        <p className={appDesign.pageSubtitle}>
          Visão do portfólio SAFe — épicos, ARTs e times do workspace.
        </p>
        <div aria-hidden className={appDesign.accentBar} />
      </header>

      <div className="grid gap-[var(--cosmos-gap,16px)] sm:grid-cols-2 lg:grid-cols-4">
        <Link className="block" href="/portfolio">
          <KpiCard
            delta={epicsDelta}
            hint="no portfólio"
            label="Épicos"
            tone="accent"
            value={epics.length}
          />
        </Link>
        <Link className="block" href="/arts">
          <KpiCard
            hint="release trains"
            label="ARTs"
            tone="blue"
            value={arts.length}
          />
        </Link>
        <Link className="block" href="/teams">
          <KpiCard
            hint="equipes ágeis"
            label="Times"
            tone="green"
            value={teams.length}
          />
        </Link>
        <Link className="block" href="/portfolio/wsjf">
          <KpiCard
            delta={wsjfDelta}
            hint="média do portfólio"
            label="WSJF"
            tone="amber"
            value={avgWsjf !== null ? avgWsjf.toFixed(1) : "—"}
          />
        </Link>
      </div>

      {/* Activation checklist — shown until workspace has all steps done */}
      {(epics.length === 0 || arts.length === 0 || teams.length === 0) && (
        <section className="rounded-lg border border-dashed p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5e6ad2]/10">
              <BarChart3Icon className="h-4 w-4 text-[#5e6ad2]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">
                Primeiros passos para valor imediato
              </p>
              <p className="mt-0.5 mb-3 text-muted-foreground text-xs">
                Complete esses 4 passos para ter visibilidade SAFe em menos de
                15 minutos.
              </p>
              <div className="space-y-2">
                {[
                  {
                    done: arts.length > 0,
                    href: "/arts",
                    icon: TrainFrontIcon,
                    label: "Criar um ART",
                    sub: "Base da sua estrutura SAFe",
                  },
                  {
                    done: teams.length > 0,
                    href: "/teams",
                    icon: UsersIcon,
                    label: "Adicionar times",
                    sub: "Conecte squads ao ART",
                  },
                  {
                    done: epics.length > 0,
                    href: "/portfolio",
                    icon: LayoutDashboardIcon,
                    label: "Criar épicos no portfólio",
                    sub: "Priorize com WSJF",
                  },
                  {
                    done: false,
                    href: "/integrations",
                    icon: PlugZapIcon,
                    label: "Conectar Linear ou GitHub",
                    sub: "Import features sem trocar ferramenta",
                  },
                ].map((step) => (
                  <Link
                    className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                    href={step.href}
                    key={step.href}
                  >
                    {step.done ? (
                      <CheckCircle2Icon className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <CircleDashedIcon className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <step.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium text-sm ${step.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {step.label}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {step.sub}
                      </p>
                    </div>
                    {!step.done && (
                      <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {myStories.length > 0 && (
        <SectionCard
          bodyClassName="p-0"
          description="Tasks atribuídas a você no sprint ativo"
          icon={<ClockIcon className="h-4 w-4" />}
          title="Meu Trabalho"
        >
          <div className="divide-y divide-hairline">
            {myStories.map((story) => (
              <Link
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2"
                href={story.teamId ? `/teams/${story.teamId}/kanban` : "/teams"}
                key={story.id}
              >
                <ClockIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {story.title}
                </span>
                <Badge dot tone={STATUS_TONES[story.status] ?? "neutral"}>
                  {STATUS_LABELS[story.status] ?? story.status}
                </Badge>
                {!!story.teamName && (
                  <span className="hidden shrink-0 text-[11px] text-ink-muted sm:block">
                    {story.teamName}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        bodyClassName="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3"
        description="Fluxos mais usados no dia a dia"
        icon={<LayoutDashboardIcon className="h-4 w-4" />}
        title="Atalhos"
      >
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link className={appDesign.quickLink} href={href} key={href}>
            <Icon
              aria-hidden
              className="h-4 w-4 shrink-0 text-[var(--accent-c)]"
            />
            <span className="flex-1">{label}</span>
            <ArrowRightIcon
              aria-hidden
              className="h-3.5 w-3.5 text-ink-muted"
            />
          </Link>
        ))}
      </SectionCard>
    </div>
  );
}
