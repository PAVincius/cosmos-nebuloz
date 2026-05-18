import dynamic from "next/dynamic";
import { listSolutionTrains, type SolutionTrainWithCounts } from "../../actions/solution-trains";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { AnchorIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

const CreateSolutionTrainDialog = dynamic(
  () =>
    import("./components/create-solution-train-dialog").then(
      (m) => m.CreateSolutionTrainDialog
    ),
  {
    loading: () => (
      <div
        className="h-9 w-40 shrink-0 animate-pulse rounded-md bg-muted"
        aria-hidden
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Solution Trains
          </h1>
          <p className="text-muted-foreground text-sm">
            Large Solution Level — coordene Capabilities e Solution Epics
            entre múltiplos ARTs
          </p>
        </div>
        <CreateSolutionTrainDialog />
      </div>

      {trains.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <AnchorIcon className="text-muted-foreground mb-4 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            Nenhum Solution Train configurado ainda.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Crie um Solution Train para coordenar múltiplos ARTs em soluções
            de grande escala.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trains.map((train: SolutionTrainWithCounts) => (
            <Card
              key={train.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <AnchorIcon className="text-primary h-5 w-5" />
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
                {train.description && (
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
  );
}
