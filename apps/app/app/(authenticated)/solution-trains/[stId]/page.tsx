import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { AnchorIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getSolutionTrainById } from "../../../actions/solution-trains";
import { getSuppliers } from "../../../actions/suppliers";

const CapabilitiesTab = dynamic(
  () => import("./components/capabilities-tab").then((m) => m.CapabilitiesTab),
  {
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="mr-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        A carregar capabilities…
      </div>
    ),
  }
);

const SolutionEpicsTab = dynamic(
  () =>
    import("./components/solution-epics-tab").then((m) => m.SolutionEpicsTab),
  {
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="mr-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        A carregar épicos…
      </div>
    ),
  }
);

const SuppliersTab = dynamic(
  () => import("./components/suppliers-tab").then((m) => m.SuppliersTab),
  {
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
        <div
          aria-hidden
          className="mr-2 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
        A carregar fornecedores…
      </div>
    ),
  }
);

type SolutionTrainDetailPageProps = {
  params: Promise<{ stId: string }>;
};

export async function generateMetadata({
  params,
}: SolutionTrainDetailPageProps) {
  const { stId } = await params;
  const result = await getSolutionTrainById(stId);
  const train = result.ok ? result.data : null;
  return {
    title: train
      ? `${train.name} | Solution Trains | COSMOS`
      : "Solution Train | COSMOS",
  };
}

export default async function SolutionTrainDetailPage({
  params,
}: SolutionTrainDetailPageProps) {
  const { stId } = await params;

  const [trainResult, suppliers] = await Promise.all([
    getSolutionTrainById(stId),
    getSuppliers(),
  ]);

  const train = trainResult.ok ? trainResult.data : null;

  if (!train) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <AnchorIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Solution Train</p>
          <h1 className="font-semibold text-2xl tracking-tight">
            {train.name}
          </h1>
          {train.description && (
            <p className="mt-0.5 text-muted-foreground text-sm">
              {train.description}
            </p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant="secondary">
            {train.capabilities.length} capabilities
          </Badge>
          <Badge variant="outline">{train.solutionEpics.length} épicos</Badge>
        </div>
      </div>

      <Tabs defaultValue="capabilities">
        <TabsList>
          <TabsTrigger value="capabilities">
            Capabilities ({train.capabilities.length})
          </TabsTrigger>
          <TabsTrigger value="epics">
            Solution Epics ({train.solutionEpics.length})
          </TabsTrigger>
          <TabsTrigger value="suppliers">
            Fornecedores ({suppliers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value="capabilities">
          <CapabilitiesTab
            initialCapabilities={train.capabilities}
            solutionTrainId={stId}
          />
        </TabsContent>

        <TabsContent className="mt-4" value="epics">
          <SolutionEpicsTab
            initialEpics={train.solutionEpics}
            solutionTrainId={stId}
          />
        </TabsContent>

        <TabsContent className="mt-4" value="suppliers">
          <SuppliersTab initialSuppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
