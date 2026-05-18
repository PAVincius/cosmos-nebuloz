import dynamic from "next/dynamic";
import { getARTs } from "../../actions/arts/get-arts";
import Link from "next/link";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import { TrainFrontIcon, ChevronRightIcon } from "lucide-react";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";

const CreateARTDialog = dynamic(
  () => import("./components/create-art-dialog").then((m) => m.CreateARTDialog),
  {
    loading: () => (
      <div className="h-9 w-28 shrink-0 animate-pulse rounded-md bg-muted" aria-hidden />
    ),
  }
);

export const metadata = {
  title: "ART Board | COSMOS",
  description: "Agile Release Train management",
};

export default async function ARTsPage() {
  const arts = await getARTs();

  return (
    <div className={appDesign.shell}>
      <PageHeader
        title="ART Board"
        subtitle="Agile Release Trains — gerencie PI Planning, times e capacidade"
        actions={<CreateARTDialog />}
      />

      <div className={appDesign.bodyScroll}>
      <div className="flex flex-col gap-6">
      {arts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <TrainFrontIcon className="text-muted-foreground mb-4 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            Nenhum ART configurado ainda.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {arts.map((art) => (
            <Card key={art.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <TrainFrontIcon className="text-primary h-5 w-5" />
                  <Badge variant="secondary">{art.piPlans.length} PIs</Badge>
                </div>
                <CardTitle className="text-base">{art.name}</CardTitle>
                <CardDescription>
                  Cadência: {art.cadence} semanas por PI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/arts/${art.id}`}>
                  <Button className="w-full" size="sm" variant="outline">
                    Ver ART
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
    </div>
  );
}
