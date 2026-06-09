"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@repo/design-system/components/ui/command";
import {
  AnchorIcon,
  BarChart3Icon,
  LayoutDashboardIcon,
  ListOrderedIcon,
  MapIcon,
  ShieldCheckIcon,
  TargetIcon,
  TrainFrontIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NavEntry = {
  label: string;
  href: string;
  icon: React.ElementType;
  group: string;
};

const NAV_ENTRIES: NavEntry[] = [
  {
    label: "Portfolio Kanban",
    href: "/portfolio",
    icon: LayoutDashboardIcon,
    group: "Portfolio",
  },
  {
    label: "WSJF Rankings",
    href: "/portfolio/wsjf",
    icon: ListOrderedIcon,
    group: "Portfolio",
  },
  {
    label: "Temas Estratégicos",
    href: "/portfolio/themes",
    icon: TargetIcon,
    group: "Portfolio",
  },
  {
    label: "Strategy Map",
    href: "/portfolio/strategy-map",
    icon: MapIcon,
    group: "Portfolio",
  },
  {
    label: "OKRs",
    href: "/portfolio/okrs",
    icon: TargetIcon,
    group: "Portfolio",
  },
  {
    label: "Lean Budgets",
    href: "/portfolio/budgets",
    icon: BarChart3Icon,
    group: "Portfolio",
  },
  {
    label: "Anomalias de Budget",
    href: "/portfolio/budgets/anomalies",
    icon: BarChart3Icon,
    group: "Portfolio",
  },
  {
    label: "Roadmap",
    href: "/portfolio/roadmap",
    icon: MapIcon,
    group: "Portfolio",
  },
  {
    label: "Governance Board",
    href: "/portfolio/governance",
    icon: ShieldCheckIcon,
    group: "Portfolio",
  },
  {
    label: "Decision Log",
    href: "/portfolio/governance/decision-log",
    icon: ShieldCheckIcon,
    group: "Portfolio",
  },
  {
    label: "Todos os ARTs",
    href: "/arts",
    icon: TrainFrontIcon,
    group: "ART Board",
  },
  {
    label: "Votação de Confiança",
    href: "/pi-planning",
    icon: TrainFrontIcon,
    group: "ART Board",
  },
  {
    label: "Dependências",
    href: "/dependencies",
    icon: AnchorIcon,
    group: "ART Board",
  },
  { label: "Todos os Times", href: "/teams", icon: UsersIcon, group: "Times" },
  {
    label: "Métricas SAFe",
    href: "/analytics",
    icon: BarChart3Icon,
    group: "Analytics",
  },
  {
    label: "Flow Metrics",
    href: "/analytics/flow",
    icon: BarChart3Icon,
    group: "Analytics",
  },
  {
    label: "Velocity",
    href: "/analytics/velocity",
    icon: BarChart3Icon,
    group: "Analytics",
  },
  {
    label: "Measure & Grow",
    href: "/analytics/measure-grow",
    icon: BarChart3Icon,
    group: "Analytics",
  },
  {
    label: "Riscos ROAM",
    href: "/risks",
    icon: BarChart3Icon,
    group: "Analytics",
  },
];

const GROUPS = [...new Set(NAV_ENTRIES.map((e) => e.group))];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput placeholder="Navegar para…" />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {GROUPS.map((group, gi) => (
          <span key={group}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {NAV_ENTRIES.filter((e) => e.group === group).map((entry) => (
                <CommandItem
                  key={entry.href}
                  onSelect={() => navigate(entry.href)}
                  value={`${entry.label} ${entry.group}`}
                >
                  <entry.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {entry.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </span>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
