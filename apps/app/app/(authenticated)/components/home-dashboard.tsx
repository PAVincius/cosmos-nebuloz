import {
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  CircleDashedIcon,
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
import { appDesign } from "@/lib/app-design";
import { getTeams } from "../teams/actions";

const QUICK_LINKS = [
  { href: "/portfolio", label: "Kanban de épicos", icon: LayoutDashboardIcon },
  { href: "/portfolio/wsjf", label: "Priorização WSJF", icon: ListOrderedIcon },
  { href: "/arts", label: "ART Board", icon: TrainFrontIcon },
  { href: "/teams", label: "Times", icon: UsersIcon },
  { href: "/settings/workspace", label: "Workspace", icon: Settings2Icon },
] as const;

export async function HomeDashboard() {
  const [epics, arts, teams] = await Promise.all([
    getPortfolioEpics(),
    getARTs(),
    getTeams(),
  ]);

  const implementing = epics.filter(
    (e) => e.statusId === "IMPLEMENTING"
  ).length;

  return (
    <div className={`${appDesign.shell} gap-6 p-6`}>
      <header>
        <h1 className={appDesign.pageTitle}>Início</h1>
        <p className={appDesign.pageSubtitle}>
          Visão do portfólio SAFe — épicos, ARTs e times do workspace.
        </p>
        <div aria-hidden className={appDesign.accentBar} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link className={appDesign.statCard} href="/portfolio">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Épicos
          </p>
          <p className={`${appDesign.statValue} mt-1`}>{epics.length}</p>
          <p className="mt-1 text-muted-foreground text-xs">
            {implementing} em implementação
          </p>
        </Link>
        <Link className={appDesign.statCard} href="/arts">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            ARTs
          </p>
          <p className={`${appDesign.statValue} mt-1`}>{arts.length}</p>
          <p className="mt-1 text-muted-foreground text-xs">Release trains</p>
        </Link>
        <Link className={appDesign.statCard} href="/teams">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Times
          </p>
          <p className={`${appDesign.statValue} mt-1`}>{teams.length}</p>
          <p className="mt-1 text-muted-foreground text-xs">Equipes ágeis</p>
        </Link>
        <Link className={appDesign.statCard} href="/portfolio/wsjf">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            WSJF
          </p>
          <p className={`${appDesign.statValue} mt-1`}>
            {epics.length > 0
              ? (
                  epics.reduce((s, e) => s + e.wsjfScore, 0) / epics.length
                ).toFixed(1)
              : "—"}
          </p>
          <p className="mt-1 text-muted-foreground text-xs">
            Média do portfólio
          </p>
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

      <section className={appDesign.section}>
        <div className={appDesign.sectionHeader}>
          <h2 className={appDesign.sectionTitle}>Atalhos</h2>
          <p className={appDesign.sectionDesc}>
            Fluxos mais usados no dia a dia
          </p>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link className={appDesign.quickLink} href={href} key={href}>
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-[#5e6ad2]" />
              <span className="flex-1">{label}</span>
              <ArrowRightIcon
                aria-hidden
                className="h-3.5 w-3.5 text-muted-foreground"
              />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
