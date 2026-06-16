import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { AnchorIcon, ChevronRightIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { listSolutionTrains } from "../../actions/solution-trains";
import type { SolutionTrainWithCounts } from "../../actions/solution-trains/schema";

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

export default async function SolutionTrainsPage() {
  const trainsResult = await listSolutionTrains();
  const trains = trainsResult.ok ? trainsResult.data : [];

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<CreateSolutionTrainDialog />}
        subtitle="Large Solution Level — coordene Capabilities e Solution Epics entre múltiplos ARTs"
        title="Solution Trains"
      />

      <div className={appDesign.bodyScroll}>
        {trains.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <AnchorIcon className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              Nenhum Solution Train configurado ainda.
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Crie um Solution Train para coordenar múltiplos ARTs em soluções
              de grande escala.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trains.map((train: SolutionTrainWithCounts) => (
              <Card
                className="transition-colors hover:border-primary/50"
                key={train.id}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <AnchorIcon className="h-5 w-5 text-primary" />
                    <div className="flex gap-1.5">
                      <Badge variant="secondary">
                        {train._count.capabilities} cap.
                      </Badge>
                      <Badge variant="outline">
                        {train._count.solutionEpics} épicos
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-base">{train.name}</CardTitle>
                  {!!train.description && (
                    <CardDescription className="line-clamp-2">
                      {train.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Link href={`/solution-trains/${train.id}`}>
                    <Button className="w-full" size="sm" variant="outline">
                      Ver Solution Train
                      <ChevronRightIcon className="ml-auto h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
