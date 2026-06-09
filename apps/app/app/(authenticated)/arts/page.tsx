import { Badge } from "@repo/design-system/components/cosmos/badge";
import { CosmosButton } from "@repo/design-system/components/cosmos/cosmos-button";
import { ChevronRightIcon, TrainFrontIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";
import { getARTs } from "../../actions/arts/get-arts";

const CreateARTDialog = dynamic(
  () => import("./components/create-art-dialog").then((m) => m.CreateARTDialog),
  {
    loading: () => (
      <div
        aria-hidden
        className="h-9 w-28 shrink-0 animate-pulse rounded-md bg-muted"
      />
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
        actions={<CreateARTDialog />}
        subtitle="Agile Release Trains — gerencie PI Planning, times e capacidade"
        title="ART Board"
      />

      <div className={appDesign.bodyScroll}>
        <div className="flex flex-col gap-6">
          {arts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <TrainFrontIcon className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                Nenhum ART configurado ainda.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {arts.map((art) => (
                <div
                  className="hover:-translate-y-0.5 flex flex-col rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)] transition-all duration-200 hover:border-primary/40 hover:shadow-[var(--hover-shadow)]"
                  key={art.id}
                >
                  <div className="flex items-start justify-between p-5 pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <TrainFrontIcon className="h-4 w-4" />
                    </div>
                    <Badge tone="neutral">{art.piPlans.length} PIs</Badge>
                  </div>
                  <div className="flex-1 px-5 pb-4">
                    <h3 className="font-semibold text-base leading-snug">
                      {art.name}
                    </h3>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Cadência: {art.cadence} semanas por PI
                    </p>
                  </div>
                  <div className="border-hairline border-t px-5 py-3">
                    <Link href={`/arts/${art.id}`}>
                      <CosmosButton className="w-full" size="sm">
                        Ver ART
                        <ChevronRightIcon className="ml-auto h-4 w-4" />
                      </CosmosButton>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
