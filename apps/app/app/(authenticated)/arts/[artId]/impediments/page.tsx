import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { AlertTriangleIcon, ClockIcon } from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { listImpedimentsByArt } from "@/app/actions/impediments";
import { appDesign } from "@/lib/app-design";
import { ImpedimentARTDashboard } from "./components/impediment-art-dashboard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ artId: string }>;
}) {
  const { artId } = await params;
  const ctx = await requireTenantSession(await headers());
  const art = await database.aRT.findFirst({
    where: { id: artId, tenantId: ctx.tenantId },
    select: { name: true },
  });
  return {
    title: art
      ? `Impedimentos — ${art.name} | COSMOS`
      : "Impedimentos ART | COSMOS",
  };
}

export default async function ARTImpedimentsPage({
  params,
}: {
  params: Promise<{ artId: string }>;
}) {
  const { artId } = await params;
  const ctx = await requireTenantSession(await headers());

  const art = await database.aRT.findFirst({
    where: { id: artId, tenantId: ctx.tenantId },
    select: { id: true, name: true },
  });

  if (!art) {
    notFound();
  }

  const impediments = await listImpedimentsByArt(artId);

  const open = impediments.filter((i) => i.status === "OPEN").length;
  const inProgress = impediments.filter(
    (i) => i.status === "IN_PROGRESS"
  ).length;
  const escalated = impediments.filter((i) => i.isEscalated).length;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        breadcrumb={[
          { label: "ARTs", href: "/arts" },
          { label: art.name, href: `/arts/${artId}` },
        ]}
        stats={[
          { label: "Abertos", value: open, icon: AlertTriangleIcon },
          { label: "Em Andamento", value: inProgress, icon: ClockIcon },
          {
            label: "Escalados (+14d)",
            value: escalated,
            icon: AlertTriangleIcon,
          },
        ]}
        subtitle="Visão consolidada de impedimentos por time — identifique bloqueios críticos e tendências de recorrência."
        title="Impedimentos do ART"
      />
      <div className={appDesign.bodyScroll}>
        <ImpedimentARTDashboard impediments={impediments} />
      </div>
    </div>
  );
}
