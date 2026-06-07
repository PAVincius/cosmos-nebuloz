import { Button } from "@repo/design-system/components/ui/button";
import {
  AnchorIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  TrainFrontIcon,
  UsersIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { appDesign } from "@/lib/app-design";
import { getARTs } from "../../actions/arts/get-arts";
import { getLACE } from "../../actions/lace";
import { PageHeader } from "../components/page-header";
import { getTeams } from "../teams/actions";

const LACEWorkspace = dynamic(
  () => import("./components/lace-workspace").then((m) => m.LACEWorkspace),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        <span>A carregar LACE workspace…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "LACE | COSMOS",
  description:
    "Lean-Agile Center of Excellence — Large Solution Level SAFe 6.0",
};

export default async function LACEPage() {
  const [laceResult, arts, teamsData] = await Promise.all([
    getLACE(),
    getARTs(),
    getTeams(),
  ]);

  const lace = laceResult.ok ? laceResult.data : null;
  const principleCount = Array.isArray(lace?.principles)
    ? (lace.principles as string[]).length
    : 0;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <Button asChild size="sm" variant="outline">
            <a
              href="https://scaledagileframework.com/lace"
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="mr-2 h-4 w-4" />
              Docs SAFe
            </a>
          </Button>
        }
        badge={
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-[11px] text-primary">
            <AnchorIcon className="h-3 w-3" />
            Large Solution
          </span>
        }
        stats={[
          { label: "ARTs", value: arts.length, icon: TrainFrontIcon },
          { label: "Times", value: teamsData.length, icon: UsersIcon },
          { label: "Princípios", value: principleCount, icon: BookOpenIcon },
        ]}
        subtitle="Lean-Agile Center of Excellence — coordena a implementação SAFe"
        title={lace?.name ?? "LACE"}
      />
      <div className={appDesign.bodyScroll}>
        <LACEWorkspace initialLace={lace} />
      </div>
    </div>
  );
}
