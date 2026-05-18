import dynamic from "next/dynamic";
import { getLACE } from "../../actions/lace";
import { getARTs } from "../../actions/arts/get-arts";
import { getTeams } from "../teams/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  AnchorIcon,
  BookOpenIcon,
  ExternalLinkIcon,
  TrainFrontIcon,
  UsersIcon,
} from "lucide-react";

const LACEWorkspace = dynamic(
  () => import("./components/lace-workspace").then((m) => m.LACEWorkspace),
  {
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        <span>A carregar LACE workspace…</span>
      </div>
    ),
  }
);

export const metadata = {
  title: "LACE | COSMOS",
  description: "Lean-Agile Center of Excellence — Large Solution Level SAFe 6.0",
};

export default async function LACEPage() {
  const [laceResult, arts, teamsData] = await Promise.all([
    getLACE(),
    getARTs(),
    getTeams(),
  ]);

  const lace = laceResult.ok ? laceResult.data : null;

  // Teams don't include members count in base query — display team count only
  const totalMembers = teamsData.length;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <AnchorIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {lace?.name ?? "LACE"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Lean-Agile Center of Excellence — coordena a implementação SAFe
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href="https://scaledagileframework.com/lace"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLinkIcon className="mr-2 h-4 w-4" />
            Docs SAFe
          </a>
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrainFrontIcon className="text-primary h-4 w-4" />
              <CardTitle className="text-sm">ARTs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{arts.length}</p>
            <CardDescription className="text-xs mt-1">
              Agile Release Trains ativos
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UsersIcon className="text-primary h-4 w-4" />
              <CardTitle className="text-sm">Times</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{teamsData.length}</p>
            <CardDescription className="text-xs mt-1">
              Times ágeis configurados
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="text-primary h-4 w-4" />
              <CardTitle className="text-sm">Princípios</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Array.isArray(lace?.principles) ? (lace.principles as string[]).length : 0}
            </p>
            <CardDescription className="text-xs mt-1">
              Princípios Lean-Agile definidos
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* LACE Workspace — editable name, description, principles */}
      <LACEWorkspace initialLace={lace} />
    </div>
  );
}
