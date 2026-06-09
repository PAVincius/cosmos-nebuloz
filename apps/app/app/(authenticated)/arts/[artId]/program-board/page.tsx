import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { ArrowLeftIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getARTById } from "@/app/actions/arts/get-arts";
import {
  getPIPlansByART,
  getProgramBoardData,
} from "@/app/actions/program-board";
import { appDesign } from "@/lib/app-design";

const ProgramBoardClient = dynamic(
  () =>
    import("./components/program-board-client").then(
      (m) => m.ProgramBoardClient
    ),
  {
    loading: () => (
      <div className="h-64 animate-pulse rounded-lg border bg-muted/30" />
    ),
  }
);

type ProgramBoardPageProps = {
  params: Promise<{ artId: string }>;
  searchParams: Promise<{ piPlanId?: string }>;
};

export async function generateMetadata({
  params,
}: ProgramBoardPageProps): Promise<Metadata> {
  const { artId } = await params;
  const art = await getARTById(artId);
  return {
    title: art
      ? `Program Board – ${art.name} | COSMOS`
      : "Program Board | COSMOS",
    description: "Visão do Program Board SAFe 6.0",
  };
}

export default async function ProgramBoardPage({
  params,
  searchParams,
}: ProgramBoardPageProps) {
  const { artId } = await params;
  const { piPlanId } = await searchParams;

  const [art, piPlans] = await Promise.all([
    getARTById(artId),
    getPIPlansByART(artId),
  ]);

  if (!art) {
    notFound();
  }

  const selectedPiPlanId = piPlanId ?? piPlans[0]?.id;

  const boardData = selectedPiPlanId
    ? await getProgramBoardData(artId, selectedPiPlanId)
    : null;

  return (
    <div className={appDesign.shell}>
      <div className={appDesign.pageHeader}>
        <Button asChild className="-ml-2 w-fit" size="sm" variant="ghost">
          <Link href={`/arts/${artId}`}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            {art.name}
          </Link>
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-semibold text-2xl tracking-tight">
              <LayoutGridIcon className="h-6 w-6 text-muted-foreground" />
              Program Board
            </h1>
            <p className="text-muted-foreground text-sm">
              Visão cruzada times × sprints do PI — {art.name}
            </p>
          </div>

          {/* PI Selector */}
          {piPlans.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">PI:</span>
              <div className="flex flex-wrap gap-1.5">
                {piPlans.map((pi) => (
                  <Link
                    href={`/arts/${artId}/program-board?piPlanId=${pi.id}`}
                    key={pi.id}
                  >
                    <Badge
                      className="cursor-pointer"
                      variant={
                        pi.id === selectedPiPlanId ? "default" : "outline"
                      }
                    >
                      {pi.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {/* No PIs state */}
          {piPlans.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <LayoutGridIcon className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Nenhum PI criado ainda</p>
                  <p className="text-muted-foreground text-sm">
                    Crie um PI Plan para visualizar o Program Board.
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/arts/${artId}`}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Criar PI Plan
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* PI selected but no board data */}
          {piPlans.length > 0 && !boardData && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                Selecione um PI Plan para visualizar o board.
              </CardContent>
            </Card>
          )}

          {/* Program Board grid — DnD client */}
          {boardData && <ProgramBoardClient data={boardData} />}
        </div>
      </div>
    </div>
  );
}
