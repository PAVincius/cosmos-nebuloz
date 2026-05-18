import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { getEpicFeatures } from "@/app/actions/features";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { appDesign } from "@/lib/app-design";

const FeatureBoard = dynamic(
  () => import("./components/feature-board").then((m) => m.FeatureBoard),
  {
    loading: () => (
      <div className="flex min-h-[400px] items-center justify-center gap-3 rounded-lg border border-dashed text-muted-foreground text-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        <span>A carregar quadro de features…</span>
      </div>
    ),
  }
);

interface Props {
  params: Promise<{ epicId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { epicId } = await params;
  const ctx = await requireTenantSession(await headers());
  const epic = await database.epic.findFirst({ where: { id: epicId, tenantId: ctx.tenantId } });
  return { title: epic ? `${epic.title} — Features | COSMOS` : "Features | COSMOS" };
}

export default async function EpicFeaturesPage({ params }: Props) {
  const { epicId } = await params;
  const ctx = await requireTenantSession(await headers());

  const [epic, features] = await Promise.all([
    database.epic.findFirst({ where: { id: epicId, tenantId: ctx.tenantId } }),
    getEpicFeatures(epicId),
  ]);

  if (!epic) notFound();

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "Portfolio", href: "/portfolio" },
          { label: epic.title, href: `/epics/${epicId}` },
          { label: "Features" },
        ]}
        title="Kanban de Features"
        subtitle={epic.title}
      />
      <div className={appDesign.bodyScroll}>
        <FeatureBoard epicId={epicId} epicTitle={epic.title} initialFeatures={features} />
      </div>
    </div>
  );
}
