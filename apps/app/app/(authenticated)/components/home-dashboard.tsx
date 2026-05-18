import { getPortfolioEpics } from "@/app/actions/epics/get-portfolio";
import { getARTs } from "@/app/actions/arts/get-arts";
import { getTeams } from "../teams/actions";
import { appDesign } from "@/lib/app-design";
import Link from "next/link";
import {
  LayoutDashboardIcon,
  TrainFrontIcon,
  UsersIcon,
  ListOrderedIcon,
  Settings2Icon,
  ArrowRightIcon,
} from "lucide-react";

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

  const implementing = epics.filter((e) => e.statusId === "IMPLEMENTING").length;

  return (
    <div className={`${appDesign.shell} gap-6 p-6`}>
      <header>
        <h1 className={appDesign.pageTitle}>Início</h1>
        <p className={appDesign.pageSubtitle}>
          Visão do portfólio SAFe — épicos, ARTs e times do workspace.
        </p>
        <div className={appDesign.accentBar} aria-hidden />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/portfolio" className={appDesign.statCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Épicos
          </p>
          <p className={`${appDesign.statValue} mt-1`}>{epics.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {implementing} em implementação
          </p>
        </Link>
        <Link href="/arts" className={appDesign.statCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            ARTs
          </p>
          <p className={`${appDesign.statValue} mt-1`}>{arts.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Release trains</p>
        </Link>
        <Link href="/teams" className={appDesign.statCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Times
          </p>
          <p className={`${appDesign.statValue} mt-1`}>{teams.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Equipes ágeis</p>
        </Link>
        <Link href="/portfolio/wsjf" className={appDesign.statCard}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            WSJF
          </p>
          <p className={`${appDesign.statValue} mt-1`}>
            {epics.length > 0
              ? (
                  epics.reduce((s, e) => s + e.wsjfScore, 0) / epics.length
                ).toFixed(1)
              : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Média do portfólio</p>
        </Link>
      </div>

      <section className={appDesign.section}>
        <div className={appDesign.sectionHeader}>
          <h2 className={appDesign.sectionTitle}>Atalhos</h2>
          <p className={appDesign.sectionDesc}>Fluxos mais usados no dia a dia</p>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={appDesign.quickLink}>
              <Icon className="h-4 w-4 shrink-0 text-[#5e6ad2]" aria-hidden />
              <span className="flex-1">{label}</span>
              <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
